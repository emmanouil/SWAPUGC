"use strict";
//var globalSetIndex = [];	//in helper.js holds EVERYTHING parsed
//var map;	//in maps.js holds MAP
//temporary vars used for testing purposes
var last_fetched_seg_n = -1;
var last_fetched_index = -1;

/**
 * Playlist & File Parameters
 */
//Files and folders
const PLAYLIST_FILE = 'playlist.txt'; //holds the base names of the recordings
const PLAYLIST_MAIN_VIEW_INDEX = 0;	//the position in the playlist txt of the recording considered as reference (starting from 0)
const PARSER_DIR = 'samples/script_out';	//holds the parser output (location, orientation, descriptor) jsons
const DASH_DIR = 'samples/segmented';	//contains the segments, inits and mpd init of the video files

//extensions, suffixes and prefixes
const DASH_MPD_SUFFIX = '_dash'	//i.e. NAMEOFRECORDING_dash.mpd
var PL_SENSORS_SUFFIX = '_SENSOR_DATA';
var PL_SENSORS_EXTENSION = '.xml';
var PL_VIDEO_SUFFIX = '';
//var PL_VIDEO_EXTENSION = '.mp4';
var PL_VIDEO_EXTENSION = '.webm';
var PL_LOCATION_SUFFIX = '_LOC';
var PL_ORIENTATION_SUFFIX = '_ORIENT';
var PL_DESCRIPTOR_SUFFIX = '_DESCRIPTOR';
var PORT = '8000'
var BASE_URL = '';	//set when parse_playlist is called (e.g. 192.0.0.1:8000)

//pseudo-simulation parameters
const INTERVAL_MS = 900;	//check interval (in ms)
var interval_id = -1;	//timeout id
const UPDATE_S = 1.7;	//condition (in s) to fetch next segment, relative to the current video time and end of the sourceBuffer
const MARKER_UPDATE_LIMIT_ON = true;	//enable cue timespan limit
const MARKER_UPDATE_LIMIT = 500;	// (in ms) limit the timespan between two updates for the same marker (i.e. number of cues)
const MARKER_LIMIT_BEHAVIOUR = 'discard';	//'discard' or 'average' - not implemented TODO


/**
 * Script Parameters & Objs
 */
var active_video_id = null;
var active_video_index = null;
var mediaSource = new MediaSource();
var main_view, main_view_tracks = [], main_view_startTime, playlist, items_fetched = 0;

/**
 * Entry point
 */
//after window loads do the init
window.onload = init;

/**
 * Initialize
 */
function init() {

	main_view = document.getElementById('v_main');
	main_view.ms = mediaSource;
	mediaSource.video = main_view;
	main_view.src = window.URL.createObjectURL(mediaSource);

	//fetch playlist and parse elements (IDs) in 'playlist' array
	fetch_promise(PLAYLIST_FILE, 'no-type', true)
		.then(
			//then fetch the descriptor jsons and build the globalSetIndex[]
			function (response, mpd) {
				parse_playlist(response);
				var promises = [];
				for (var i = 0; i < playlist.length; i++) {
					promises.push(fetch_promise(PARSER_DIR + '/' + playlist[i] + PL_DESCRIPTOR_SUFFIX + '.json', 'json', true));
				}
				//load descriptors and update globalSetIndex
				Promise.all(promises).then(function (values) {
					for (var i = 0; i < values.length; i++) {
						parse_pl_descriptor(values[i]);
					}
				}).then(
					//then fetch the mpds and construct the mpd[]	
					function () {
						var promises = [];
						for (var i = 0; i < playlist.length; i++) {
							promises.push(fetch_promise(DASH_DIR + '/' + globalSetIndex[i].id + DASH_MPD_SUFFIX + '.mpd', 'no-type', true));
						}
						Promise.all(promises)
							.then(function (values) {
								for (var i = 0; i < values.length; i++) {
									if (values[i].status === 200) {
										for (var j = 0; j < globalSetIndex.length; j++) {
											if (values[i].responseURL.search(globalSetIndex[j].id) > -1) {
												globalSetIndex[j].mpd = new MPD(values[i].responseURL);
												globalSetIndex[j].mpd.fullDocument = mpd_parse(values[i].response);
												globalSetIndex[j].mpd.initSegment = mpd_getInitSegURL(globalSetIndex[j].mpd.fullDocument);
												var t_rep = mpd_getRepresentationNodeByID(globalSetIndex[j].mpd.fullDocument, 1);
												globalSetIndex[j].mpd.representations.push(mpd_getRepresentationByNode(t_rep));
												break;
											}
										}
									} else {
										logERR('request for ' + values[i].responseURL + ' failed');
									}
								}
								logINFO('done parsing mpds')
							}).then(function () {
								var mimeCodec = globalSetIndex[PLAYLIST_MAIN_VIEW_INDEX].mpd.representations[0].mimeType;
								if (typeof globalSetIndex[PLAYLIST_MAIN_VIEW_INDEX].mpd.representations[0].codecs != "undefined") {
									mimeCodec = '; codecs=\"' + globalSetIndex[PLAYLIST_MAIN_VIEW_INDEX].mpd.representations[0].codecs + '\"';
								}

								if (MediaSource.isTypeSupported(mimeCodec)) {
									logDEBUG("mimeCodec :" + mimeCodec + " (from .mpd) is supported")
								} else if (MediaSource.isTypeSupported("video/mp4")) {
									logINFO("default mimeCodec was not supported, using genering \"video/mp4\" instead");
									mimeCodec = "video/mp4";
								} else if (navigator.userAgent.indexOf("Chrome") != -1) {
									mimeCodec = "video/mp4; codecs=\"avc1.640028, mp4a.40.2\"";
									logWARN("Possible mimeCodec issue (occuring with Chrome) - using default mimeCodec " + mimeCodec);
								} else {
									logWARN("No codec support indication by the browser. playback might not work");
								}

								//setup MSE
								if (mediaSource.readyState == "open") {
									onSourceOpen(mimeCodec);
								} else {
									mediaSource.addEventListener("sourceopen", function () { onSourceOpen(mimeCodec); }, { once: true });
								}
								active_video_id = globalSetIndex[PLAYLIST_MAIN_VIEW_INDEX].id;
								active_video_index = PLAYLIST_MAIN_VIEW_INDEX;
								logINFO('active_video_id set to ' + active_video_id);
								document.getElementById('init_ts_btn').disabled = false;
							}).catch(function (err) { logERR(err); });
					}).catch(function (err) { logERR('Error parsing playlist - check file ' + PLAYLIST_FILE); });
			}).then(function (response) {
				//we currently do not do anything after parsing playlist, prior to mpds
				//TODO delete this block if not needed
			}).catch(function (err) { logWARN('Failed promise - Error log: '); logERR(err); });
	main_view.addEventListener("playing", function () { interval_id = setInterval(check_status, INTERVAL_MS); }, { once: true });
}

function parse_playlist(request) {
	BASE_URL = request.responseURL.slice(0, request.responseURL.indexOf(PORT) + PORT.length)
	playlist = request.responseText.split(/\r\n|\r|\n/); //split on break-line
	var req_status = request.status;
	if (req_status == 200 && playlist.length > 0) {
		Promise.resolve();
	} else if (req_status == 200) {
		logWARN("Fetching " + PLAYLIST_FILE + " returned with an empty file");
		Promise.reject('Empty playlist');
	} else {
		logWARN("Fetching " + PLAYLIST_FILE + " unsuccessful");
		Promise.reject('No Playlist found')
	}
}

function parse_pl_descriptor(req) {
	if (req.status == 200) {
		let tmp_obj = addVideoToIndex(req);	//add to globalSetIndex
		if (tmp_obj.id == reference_recordingID) {
			logINFO('We got our main view with ID ' + tmp_obj.id + ', skipping dropdown');
		}
		addOption(tmp_obj.id);	//add option to the dropdown
	}
	logINFO(req)
	items_fetched++;	//count playlist entries fetched
	if (items_fetched == playlist.length) {	//when everything's loaded go to first video
		goToVideo(0);
	}
}

//called at regular intervals to check if the stream has changed, or if we have buffer starvation
function check_status() {

	//first we check if the video is rolling //TODO later, add support for updating buffer *and* switching videos at paused state
	if (main_view.paused) {
		logDEBUG('check_status called with main view paused - skipping check');
		return;
	}

	//we check if the media source is available
	if (sourceBuffer.updating || mediaSource.readyState != "open") {
		logWARN("MSE or sourceBuffer not available");
		return;
	}

	let end_time = getSourceBufferEnd();

	if (getSourceBufferTimeRangeNumber() > 2) {
		logDEBUG('sourceBuffer contains more than 2 time ranges. cleaning up contents...')
		resetSourceBuffer();
		return;
	} else if (end_time - main_view.currentTime > UPDATE_S || getSourceBufferTimeRangeNumber == 0) {
		return;
	}

	let seg_n = mpd_getSegmentIndexAtTime(globalSetIndex[active_video_index].mpd.representations[0], end_time - globalSetIndex[active_video_index].descriptor.tDiffwReferenceMs / 1000);
	seg_n++;	//in this case we need the next segment

	if (seg_n == last_fetched_seg_n && active_video_index == active_video_index) {
		logWARN('previously fetched seg had same number, incrementing by 1');
		seg_n++;
	}
	last_fetched_seg_n = seg_n;
	last_fetched_index = active_video_index;
	fetch_res(DASH_DIR + '/' + globalSetIndex[active_video_index].mpd.representations[0].SegmentList.Segments[seg_n], addSegment, "arraybuffer");

}

/**
 * Revised version of the function - only for video files
 * TODO: we handle a lot of stuff here, refacture
 * @param {*Object} XMLHttpRequest_in
 */
//returns recording id
function addVideoToIndex(XMLHttpRequest_in) {
	var tmp_req = XMLHttpRequest_in;
	var loc_obj = new Object();
	loc_obj.descriptor = tmp_req.response;
	loc_obj.index = globalSetIndex.length;
	loc_obj.id = tmp_req.response.recordingID;
	loc_obj.videoFile = loc_obj.id + PL_VIDEO_EXTENSION;
	loc_obj.videoFile = loc_obj.id + PL_VIDEO_EXTENSION;
	//this used to hold the coords/orient in previous version
	//	loc_obj.set = XMLHttpRequest_in.response;
	globalSetIndex.push(loc_obj);
	//we check if it is our main view
	if (loc_obj.id == reference_recordingID) {
		reference_recording_set = globalSetIndex[globalSetIndex.length - 1];
	}
	return loc_obj;
}

/* Called when "Init Time & Space" btn is clicked and fetches location and orientation sets */
function loadSpatialData() {
	for (var i = 0; i < globalSetIndex.length; i++) {
		fetch(globalSetIndex[i].descriptor.locationFilename, loadCoords, 'json');
		fetch(globalSetIndex[i].descriptor.orientationFilename, loadLocs, 'json');
	}
}

/* Called when "Init Time & Space" btn is clicked and calculates relative time between views */
function setMainViewStartTime() {
	let tmp_time = globalSetIndex[PLAYLIST_MAIN_VIEW_INDEX].descriptor.startTimeMs - reference_recording_set.descriptor.startTimeMs;
	if (tmp_time) {//should be 0
		logWARN('timing on PLAYLIST_MAIN_VIEW_INDEX and reference_recording_set does NOT match');
	}
	for (let i = 0; i < globalSetIndex.length; i++) {
		globalSetIndex[i].descriptor.tDiffwReferenceMs = globalSetIndex[i].descriptor.startTimeMs - reference_recording_set.descriptor.startTimeMs;
		if (globalSetIndex[i].descriptor.tDiffwReferenceMs > tmp_time && globalSetIndex[i].id != reference_recordingID) {
			tmp_time = globalSetIndex[i].descriptor.startTimeMs - reference_recording_set.descriptor.startTimeMs;
		}
	}

	let index = mpd_getSegmentIndexAtTime(globalSetIndex[0].mpd.representations[0], (tmp_time / 1000)) + 1;
	fetch_promise(DASH_DIR + '/' + globalSetIndex[0].mpd.representations[0].SegmentList.Segments[index], "arraybuffer", false)
		.then(function (response) {
			addSegment(response);
			main_view.currentTime = main_view_startTime = reference_start_time = (tmp_time / 1000);	//in seconds
		}).catch(function (err) { logWARN('Failed promise - Error log: '); logERR(err); });

}

function loadCoords(XMLHttpRequest_in) {
	loadAssets('_LOC', XMLHttpRequest_in.target)
}

function loadLocs(XMLHttpRequest_in) {
	loadAssets('_ORIENT', XMLHttpRequest_in.target)
}

function loadAssets(type, Xreq_target) {
	var tmp_name = Xreq_target.responseURL.split('/').pop().split('.')[0];
	for (var i = 0; i < globalSetIndex.length; i++) {
		if (globalSetIndex[i].descriptor.recordingID + type == tmp_name) {
			switch (type) {
				case '_LOC':
					globalSetIndex[i].coordSet = Xreq_target.response;
					break;
				case '_ORIENT':
					globalSetIndex[i].orientSet = Xreq_target.response;
					break;
				default:
					logERR('type ' + type + ' not recognized');
					break;
			}
			logDEBUG('found coord set for ' + tmp_name);
			return;
		}
	}
}

/**
 * NOTE: It adds INITIAL markers (not all markers - TODO)
 */
function analyzeGeospatialData() {
	/**
	 * Add initial markers (TODO specify initial loc and orient)
	 */
	for (let i = 0; i < globalSetIndex.length; i++) {
		let s = globalSetIndex[i];
		if (s.id != reference_recordingID) {
			addLiveMarker(s.coordSet[0].Latitude, s.coordSet[0].Longitude,
				s.index, s.id, s.orientSet[0].X, true);
		} else {
			addLiveMarker(s.coordSet[0].Latitude, s.coordSet[0].Longitude,
				s.index, s.id, s.orientSet[0].X, false);
		}
	}


	/**
	 * Add marker updates
	 */
	for (let i = 0; i < globalSetIndex.length; i++) {
		let s = globalSetIndex[i];
		if (s.id != reference_recordingID) {
			let tmp_index = main_view_tracks.push(main_view.addTextTrack("metadata", s.id))
			addMarkerUpdates(s, tmp_index - 1);
			globalSetIndex[i].main_view_tracks_no = tmp_index - 1;
			main_view_tracks[tmp_index - 1].oncuechange = function () {
				for (let i = 0; i < this.activeCues.length; i++) {
					updateMarkerByLabel(this.activeCues[i].track.label, Number(this.activeCues[i].text));
				}
			}
		} else {
			logINFO('main view has no changes in loc/orient, skipping addMarkerUpdates for set')
			continue;
		}
	}
}

function addMarkerUpdates(set_in, tmp_index) {
	//TODO; I messed it up
	/* locate and init track */
	var tmp_track = main_view_tracks[tmp_index];

	/* analyze orientations to cues */
	/* use as main (a.k.a. reference) view */
	var tmp_start = set_in.descriptor.startTimeMs;
	var t_diff = tmp_start - reference_recording_set.descriptor.startTimeMs;
	if (reference_start_time == 0) {
		reference_start_time = t_diff / 1000;
		main_view.currentTime = reference_start_time;
	}
	var cur_t = set_in.orientSet[0].PresentationTime;
	for (var i = 0; i < set_in.orientSet.length - 1; i++) {
		var tmp_orient = set_in.orientSet[i];
		//check if we have set a min timespan between marker updates
		if (MARKER_UPDATE_LIMIT_ON) {
			if (tmp_orient.PresentationTime - cur_t < MARKER_UPDATE_LIMIT) {
				continue;
			}
		}
		cur_t = tmp_orient.PresentationTime;
		//TODO handle cues according to main vid time (not relevant to the take time)
		tmp_track.addCue(new VTTCue((t_diff + cur_t) / 1000, (t_diff + set_in.orientSet[i + 1].PresentationTime) / 1000, String(tmp_orient.X)));
	}

	/*
	var t_start = set_in.descriptor.startTimeMs;
	for( var i =0; i< set_in.orientSet; i++){

	}
	*/
}

//called when the play button is pressed
function startPlayback() {
	main_view.play();
}

//called when marker is clicked
function switchToStream(set_index, recordingID) {
	if (active_video_id === recordingID) {
		logINFO("currently active stream selected - ignoring switch");
		return;
	} else {
		logINFO("switching to stream with ID: " + recordingID);
	}

	let new_set = getSetByVideoId(recordingID);
	let end_time = main_view.currentTime;
	/*
		let end_time = getSourceBufferEnd();
	
		if(Math.abs(end_time - main_view.currentTime) < 0.2){
			logDEBUG('safety check for time diff between buffer and video end');
			end_time -= 0.2;
		}
	*/
	active_video_id = recordingID;
	active_video_index = set_index;

	setTimeStampOffset(globalSetIndex[set_index].descriptor.tDiffwReferenceMs / 1000);

	let seg_n = mpd_getSegmentIndexAtTime(globalSetIndex[set_index].mpd.representations[0], end_time - globalSetIndex[set_index].descriptor.tDiffwReferenceMs / 1000);

	mse_initAndAdd(set_index, seg_n);
}

function resetSourceBuffer() {
	logINFO('resetting sourceBuffer');
	killInterval();
	last_fetched_index = -1;
	last_fetched_seg_n = -1;
	for (let i = sourceBuffer.buffered.length - 1; i >= 0; i--) {
		if (sourceBuffer.updating) {
			sourceBuffer.addEventListener('updateend', function () {
				resetSourceBuffer();
			}, { once: true });
			logINFO('sourceBuffer is updating, reset will commence when the update is over');
			return;
		}
		sourceBuffer.remove(sourceBuffer.buffered.start(i), sourceBuffer.buffered.end(i));
	}
	let seg_n = mpd_getSegmentIndexAtTime(globalSetIndex[active_video_index].mpd.representations[0], main_view.currentTime - (globalSetIndex[active_video_index].descriptor.tDiffwReferenceMs / 1000));
	if (sourceBuffer.updating) {
		sourceBuffer.addEventListener('updateend', function () {
			mse_initAndAdd(active_video_index, seg_n);
		}, { once: true });
	} else {
		mse_initAndAdd(active_video_index, seg_n);
	}
	//TODO workaround because Chrome does not auto-play (nor auto-pauses) after reset
	if (navigator.userAgent.indexOf("Chrome") != -1) {
		main_view.currentTime += 0.001;
	}
	startInterval();
}

function addOption(file_id) {
	let option = document.createElement("option");
	option.text = file_id;
	option.value = file_id;
	selector.add(option);
}

function mse_initAndAdd(stream_index, segment_n) {
	fetch_promise(DASH_DIR + '/' + globalSetIndex[stream_index].mpd.init_seg, "arraybuffer", false)
		.then(function (response) {
			addSegment(response);
			sourceBuffer.addEventListener('updateend', function () {
				fetch_promise(DASH_DIR + '/' + globalSetIndex[stream_index].mpd.representations[0].SegmentList.Segments[segment_n], "arraybuffer", false)
					.then(function (response) {
						addSegment(response);
					})
					.catch(function (err) { logWARN('Failed promise - Error log: '); logERR(err); });
			}, { once: true });
		}).catch(function (err) { logWARN('Failed promise - Error log: '); logERR(err); });
}

function killInterval() {
	clearInterval(interval_id);
	interval_id = -1;
}

function startInterval() {
	if (interval_id != -1) {
		logINFO('interval already running');
		return;
	}
	interval_id = setInterval(check_status, INTERVAL_MS);
}

function resetInterval() {
	killInterval();
	startInterval();
}


function printBufferStatus() {
	console.log('Current video time: ' + main_view.currentTime);
	for (let i = 0; i < getSourceBufferTimeRangeNumber(); i++) {
		console.log('buffer with index ' + i + ' starts at ' + sourceBuffer.buffered.start(i))
		console.log('buffer with index ' + i + ' ends at ' + sourceBuffer.buffered.end(i))
	}
}

function nextStream() {
	let next_index = -1;
	if (active_video_index == globalSetIndex.length - 1) {
		next_index = 0;
	} else {
		next_index = active_video_index + 1;
	}
	switchToStream(next_index, globalSetIndex[next_index].id);
}