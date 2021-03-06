"use strict";
/* global VTTCue:true */ //standard supported by Firefox and Chrome (not IE)
/* global sourceBuffer */ //in mse.js

//var map;	//in maps.js holds MAP
//temporary vars used for testing purposes
var last_fetched_seg_n = -1;
var last_fetched_index = -1;
var last_removed_timerage = -1; //during resetSourceBuffer or cleanSourceBuffer

/* VTT id types
 * "Event"
 * "OrientationUpdate"
 * "LocationUpdate"
 */

/**
 * Playlist & File Parameters
 */
//Files and folders
const PLAYLIST_FILE = 'playlist.txt'; //holds the base names of the recordings
const PLAYLIST_MAIN_VIEW_INDEX = 0; //the position in the playlist txt of the recording considered as reference (starting from 0)
const PARSER_DIR = 'samples/descriptors'; //holds the parser output (location, orientation, descriptor) jsons
const DASH_DIR = 'samples/video'; //contains the segments, inits and mpd init of the video files [for demo use 'samples/multi-res' for the multiple representations, 'samples/segmented' for single bitstream]

//extensions, suffixes and prefixes
const DASH_MPD_SUFFIX = '_dash'; //i.e. NAMEOFRECORDING_dash.mpd
//not implemented or obsolete constants
/*
const PL_SENSORS_SUFFIX = '_SENSOR_DATA';
const PL_SENSORS_EXTENSION = '.xml';
const PL_VIDEO_SUFFIX = '';
*/

const PL_VIDEO_EXTENSION = '.webm';
const PL_LOCATION_SUFFIX = '_LOC';
const PL_ORIENTATION_SUFFIX = '_ORIENT';
const PL_DESCRIPTOR_SUFFIX = '_DESCRIPTOR';
const PL_BLUR_SUFFIX = '_BLUR';
const PL_SHAKE_SUFFIX = '_SHAKE';
const PL_TILT_SUFFIX = '_TILT';
const PL_FOV_SUFFIX = '_FOV';
const PORT = '8000';
var BASE_URL = ''; //set when parse_playlist is called (e.g. 192.0.0.1:8000)

//pseudo-simulation parameters
var check_interval_id = -1; //timeout id
var metrics_interval_id = -1; //timeout id
const UPDATE_S = 1.7; //condition (in s) to fetch next segment, relative to the current video time and end of the sourceBuffer
const MARKER_UPDATE_LIMIT_ON = true; //enable cue timespan limit
const MARKER_UPDATE_LIMIT = 600; // (in ms) limit the timespan between two updates for the same marker (i.e. number of cues)

//performance parameters
const CHECK_INTERVAL_MS = 900; //check MSE buffer interval (in ms)
const METRICS_INTERVAL_MS = 1000; //metrics update interval (in ms)
const VTTCUE_DURATION = 400; //whenever a cuechange event is fired all cues are checked if active (and if so, updated) - recommended value < MARKER_UPDATE_LIMIT
const OVERRIDE_CUE_DURATION_FOR_METRICS = true;

//selection policy;
var policies = ['Manual', 'Round-Robin 10s', 'Round-Robin 20s', 'Ranking 10s', 'Ranking 20s', ];
var roundRobin_interval_t;
var roundRobin_interval_id = -1;


/**
 * Script Parameters & Objs
 */
var active_video_id = null;
var active_video_index = null;
var playlist, items_fetched = 0,
	main_view_tracks = [];

/**
 * Entry point
 */
//after window loads do the init
window.onload = init;

/**
 * Initialize
 */
function init() {

	s = new Server();
	p = new Player(document.getElementById('v_main'), new MediaSource());
	p.v.src = window.URL.createObjectURL(p.ms);

	activate_policies();

	//fetch playlist and parse elements (IDs) in 'playlist' array
	fetch_promise(PLAYLIST_FILE, 'no-type', true)
		.then(
			//then fetch the descriptor jsons and build the globalSetIndex[]
			function (response, mpd) {
				parse_playlist(response);
				var promises = [];
				var to_delete = [];
				for (var i = 0; i < playlist.length; i++) {
					if (playlist[i].startsWith('#') || playlist[i].startsWith(' ')) {
						to_delete.push(playlist[i]);
						continue;
					}
					if (ajax_url_exists(PARSER_DIR + '/' + playlist[i] + PL_DESCRIPTOR_SUFFIX + '.json')) {
						if (!(ajax_url_exists(DASH_DIR + '/' + playlist[i] + DASH_MPD_SUFFIX + '.mpd'))) {
							logDEBUG('MPD of element of playlist at index ' + i + ', with value' + playlist[i] + ' not found - skipping');
							to_delete.push(playlist[i]);
						} else {
							promises.push(fetch_promise(PARSER_DIR + '/' + playlist[i] + PL_DESCRIPTOR_SUFFIX + '.json', 'json', true).catch(function (err_) {
								logERR('Error in parsing playlist element. Skipping item');
								logERR(err_);
							}));
						}
					} else {
						logDEBUG('DESCRIPTOR of element of playlist at index ' + i + ', with value' + playlist[i] + ' not found - skipping');
						to_delete.push(playlist[i]);
					}
				}
				for (let i = 0; i < to_delete.length; i++) {
					logINFO('Removing item ' + to_delete[i] + ' from playlist');
					playlist.clean(to_delete[i]);
				}

				//load descriptors and update globalSetIndex
				Promise.all(promises).then(function (values) {
					values.clean(undefined); //remove failed promises results - i.e. not-found playlist entries
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
												globalSetIndex[j].mpd.fullRepresentations = globalSetIndex[j].mpd.fullDocument.getElementsByTagName("Representation");


												let rep_n = globalSetIndex[j].mpd.fullRepresentations.length;
												//we have multiple representations (we assume one period, one adaptation set and live profile for now TODO)
												if (rep_n > 1) {
													globalSetIndex[j].mpd.isLiveProfile = true;
													globalSetIndex[j].mpd.fullAdaptationSet = globalSetIndex[j].mpd.fullDocument.getElementsByTagName("Period")[0].getElementsByTagName("AdaptationSet")[0];
													globalSetIndex[j].mpd.initSegment = find_attribute_in_children(globalSetIndex[j].mpd.fullAdaptationSet, "initialization");
													globalSetIndex[j].qSelector = document.createElement("select");
													for (let i = 0; i < rep_n; i++) {
														globalSetIndex[j].mpd.representations.push(mpd_getRepresentationAttributesByNode(globalSetIndex[j].mpd.fullRepresentations[i]));
														globalSetIndex[j].mpd.representations[i].SegmentTemplate = mpd_getRepresentationAttributesByNode(globalSetIndex[j].mpd.fullRepresentations[i].getElementsByTagName("SegmentTemplate")[0]);
														globalSetIndex[j].qSelector.add(createRepresentationOption(i, globalSetIndex[j].mpd.representations[i].height, globalSetIndex[j].mpd.representations[i].bandwidth));
													}
													globalSetIndex[j].active_representation = 0;
												} else if (rep_n == 1) { //TODO merge with multiple representations
													//we have a live profile - generate segment list
													var t_rep;
													if (globalSetIndex[j].mpd.document.getAttribute("profiles").indexOf("dash:profile:isoff-live") != -1) {
														globalSetIndex[j].mpd.isLiveProfile = true;
														let temp_template = globalSetIndex[j].mpd.document.getElementsByTagName("SegmentTemplate")[0];
														globalSetIndex[j].mpd.SegmentTemplate = mpd_getRepresentationAttributesByNode(globalSetIndex[j].mpd.document.getElementsByTagName("SegmentTemplate")[0]);
														globalSetIndex[j].mpd.initSegment = temp_template.getAttribute("initialization");
														t_rep = mpd_getRepresentationNodeByID(globalSetIndex[j].mpd.fullDocument, 1);
														globalSetIndex[j].mpd.representations.push(mpd_getRepresentationAttributesByNode(t_rep));

													} else { //we do not have a live profile - parse segment list
														globalSetIndex[j].mpd.isLiveProfile = false;
														globalSetIndex[j].mpd.initSegment = mpd_getInitSegURL(globalSetIndex[j].mpd.fullDocument);
														t_rep = mpd_getRepresentationNodeByID(globalSetIndex[j].mpd.fullDocument, 1);
														globalSetIndex[j].mpd.representations.push(mpd_getRepresentationByNode(t_rep));
													}
												} else {
													logERR("No representations found for " + globalSetIndex[j].id);
												}
												break;
											}
										}
									} else {
										logERR('request for ' + values[i].responseURL + ' failed');
									}
								}
								logINFO('done parsing mpds');
							}).then(function () {
								var mimeCodec = globalSetIndex[PLAYLIST_MAIN_VIEW_INDEX].mpd.representations[0].mimeType;
								if (typeof globalSetIndex[PLAYLIST_MAIN_VIEW_INDEX].mpd.representations[0].codecs != "undefined") {
									mimeCodec = '; codecs=\"' + globalSetIndex[PLAYLIST_MAIN_VIEW_INDEX].mpd.representations[0].codecs + '\"';
								}

								if (MediaSource.isTypeSupported(mimeCodec)) {
									logDEBUG("mimeCodec :" + mimeCodec + " (from .mpd) is supported");
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
								if (p.ms.readyState === "open") {
									onSourceOpen(mimeCodec);
								} else {
									p.ms.addEventListener("sourceopen", function () {
										onSourceOpen(mimeCodec);
									}, {
										once: true
									});
								}

								//setup Sources
								for (let i = 0; i < globalSetIndex.length; i++) {
									var tmp_source = new Source(globalSetIndex[i].id, globalSetIndex[i].index);
									s.addSource(tmp_source);
									//add representations to sources
									for (let j = 0; j < globalSetIndex[i].mpd.representations.length; j++) {
										let mpd_rep = globalSetIndex[i].mpd.representations[j];
										let tmp_rep = new Representation(j, Number(mpd_rep.bandwidth), mpd_rep.id, Number(mpd_rep.width), Number(mpd_rep.height));
										tmp_source.addRepresentation(tmp_rep); //TODO - this
									}
								}


								active_video_id = globalSetIndex[PLAYLIST_MAIN_VIEW_INDEX].id;
								active_video_index = PLAYLIST_MAIN_VIEW_INDEX;
								logINFO('active_video_id set to ' + active_video_id);
								//display the available representations
								setQualitySelector(PLAYLIST_MAIN_VIEW_INDEX);
								//prepare the textTracks
								for (let s_i of globalSetIndex) {
									s_i.main_view_tracks_no = main_view_tracks.push(p.v.addTextTrack("metadata", s_i.id)) - 1;
									main_view_tracks[main_view_tracks.length - 1].setReference = s_i;
								}
								//we want MSE to be ready before calling fetchAndInitMarkers
								if (p.ms.readyState === "open") {
									fetchAndInitMarkers();
								} else {
									p.ms.addEventListener("sourceopen", function () {
										fetchAndInitMarkers();
									}, {
										once: true
									});
								}
							}).catch(function (err) {
								logERR(err);
							});
					}).catch();
			}).catch(function (err) {
			logWARN('Failed promise - Error log: ');
			logERR(err);
		});
	p.v.addEventListener("playing", function () {
		check_interval_id = setInterval(check_status, CHECK_INTERVAL_MS);
		metrics_interval_id = setInterval(logMetrics, METRICS_INTERVAL_MS);
	}, {
		once: true
	});

}

function parse_playlist(request) {
	BASE_URL = request.responseURL.slice(0, request.responseURL.indexOf(PORT) + PORT.length);
	playlist = request.responseText.split(/\r\n|\r|\n/); //split on break-line
	var req_status = request.status;
	if (req_status === 200 && playlist.length > 0) {
		Promise.resolve();
	} else if (req_status === 200) {
		logWARN("Fetching " + PLAYLIST_FILE + " returned with an empty file");
		Promise.reject('Empty playlist');
	} else {
		logWARN("Fetching " + PLAYLIST_FILE + " unsuccessful");
		Promise.reject('No Playlist found');
	}
}

function parse_pl_descriptor(req) {
	if (req.status === 200) {
		let tmp_obj = addVideoToIndex(req); //add to globalSetIndex
		if (tmp_obj.id === reference_recordingID) {
			logINFO('We got our main view with ID ' + tmp_obj.id + ', skipping dropdown');
		}
		addOption(tmp_obj.id); //add option to the dropdown
	}
	logINFO(req);
	items_fetched++; //count playlist entries fetched
	if (items_fetched === playlist.length) { //when everything's loaded go to first video
		goToVideo(0);
	}
}

//called at regular intervals (every CHECK_INTERVAL_MS) to check if the stream has changed, or if we have buffer starvation
function check_status() {

	//if true, will fetch next segment
	let should_fetch_next_seg = true;

	//info on readyState: https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/readyState
	if (p.v.readyState === HTMLMediaElement.HAVE_CURRENT_DATA) {
		logUI('Buffer empty - If video is frozen your internet connection might not support this demo');
	}


	let tmp_set = globalSetIndex[active_video_index];
	let tmp_source = s.getSourceById(active_video_id);

	//first we check if the video is rolling
	//TODO later, add support for updating buffer *and* switching videos at paused state
	if (p.v.paused) {
		logDEBUG('check_status called with main view paused - skipping check');
		return;
	}

	//we check if the media source is available
	if (sourceBuffer.updating || p.ms.readyState != "open") {
		logWARN("MSE or sourceBuffer not available");
		return;
	}

	let end_time = getSourceBufferEnd();

	if (getSourceBufferTimeRangeNumber() > 2) {
		logDEBUG('sourceBuffer contains more than 2 time ranges. resetting...');
		resetSourceBuffer();
		return;
	} else if (getSourceBufferTimeRangeNumber() === 2) {
		logDEBUG('sourceBuffer contains 2 time ranges. cleaning up contents...');
		cleanSourceBuffer();
		return;
	} else if (end_time - p.v.currentTime > UPDATE_S) {
		return;
	}

	if (should_fetch_next_seg) {
		fetch_next_segment();
	}

}


function fetch_next_segment() {
	let seg_n = 0;
	let tmp_set = globalSetIndex[active_video_index];
	let end_time = getSourceBufferEnd();

	seg_n = mpd_getSegmentNum(active_video_index, end_time);

	seg_n++; //in this case we need the next segment

	if (seg_n === last_fetched_seg_n && active_video_index === last_fetched_index) {
		logWARN('previously fetched seg had same number, incrementing by 1');
		seg_n++;
	}
	last_fetched_seg_n = seg_n;
	last_fetched_index = active_video_index;
	if (tmp_set.mpd.isLiveProfile) {
		if (tmp_set.mpd.representationCount > 1) {
			fetch_res(DASH_DIR + '/' + tmp_set.mpd.representations[tmp_set.ActiveRepresentation].SegmentTemplate.media.replace("$Number$", seg_n), addSegment, "arraybuffer");
		} else {
			fetch_res(DASH_DIR + '/' + tmp_set.mpd.SegmentTemplate.media.replace("$Number$", seg_n), addSegment, "arraybuffer");
		}
	} else {
		fetch_res(DASH_DIR + '/' + tmp_set.mpd.representations[tmp_set.ActiveRepresentation].SegmentList.Segments[seg_n], addSegment, "arraybuffer");
	}

}

/**
 * Revised version of the function - only for video files
 * TODO: we handle a lot of stuff here, refactor
 * @param {*Object} XMLHttpRequest_in
 */
//returns recording id
function addVideoToIndex(XMLHttpRequest_in) {
	var tmp_req = XMLHttpRequest_in;
	var loc_obj = {
		descriptor: tmp_req.response,
		id: tmp_req.response.recordingID,
		index: globalSetIndex.length,
		active_representation: 0,
		stats: {
			switches: 1,
			last_switch_t: 0,
			avgBitrate: 0,
		},
		get ActiveRepresentation() {
			return this.active_representation;
		},
		set ActiveRepresentation(x) {
			if (this.active_representation != x) {
				this.active_representation = x;
				recRepresentationChange(this.index, x);
			}
		}
	};
	loc_obj.videoFile = loc_obj.id + PL_VIDEO_EXTENSION;
	//this used to hold the coords/orient in previous version
	//	loc_obj.set = XMLHttpRequest_in.response;
	//this is used to store the stream metrics
	loc_obj.metrics = [];
	loc_obj.reps = [];
	globalSetIndex.push(loc_obj);
	//we check if it is our main view
	if (loc_obj.id === reference_recordingID) {
		reference_recording_set = globalSetIndex[globalSetIndex.length - 1];
	}
	return loc_obj;
}

/* Called from fetchAndInitMarkers and fetches location and orientation sets */
//TODO: use loadJSONData for this too
function loadSpatialData() {

	let loc_promises = [];
	let orient_promises = [];
	for (let i = 0; i < globalSetIndex.length; i++) {
		loc_promises.push(fetch_promise(globalSetIndex[i].descriptor.locationFilename, 'json', true));
		orient_promises.push(fetch_promise(globalSetIndex[i].descriptor.orientationFilename, 'json', true));
	}
	Promise.all(loc_promises).then(function (values) {
		for (var i = 0; i < values.length; i++) {
			loadCoords(values[i]);
		}
	}).catch(function (err) {
		logERR('Error parsing location files');
		logERR(err);
	});

	Promise.all(orient_promises).then(function (values) {
		for (var i = 0; i < values.length; i++) {
			loadLocs(values[i]);
		}
	}).then(function () {
		window.dispatchEvent(new CustomEvent('spatialDataReady', {
			detail: 'done'
		}));
	}).catch(function (err) {
		logERR('Error parsing orientation files');
		logERR(err);
	});
}

/* Called from fetchAndInitMarkers and fetches image quality metrics sets */
function loadImageQualityData() {
	loadJSONDataFromGlobalSet('imageQFilename', loadImageQ);
}


/* Called from fetchAndInitMarkers and fetches shake set */
function loadShakeData() {
	loadJSONDataFromGlobalSet('shakeFilename', loadShake);
}


/* Called from fetchAndInitMarkers and fetches tilt set */
function loadTiltData() {
	loadJSONDataFromGlobalSet('tiltFilename', loadTilt);
}


/* Called from fetchAndInitMarkers and fetches FoV set */
function loadFovData() {
	loadJSONDataFromGlobalSet('fovFilename', loadFov);
}

/**
 * Loads <filename_field> from globalSetIndex and uses the resulting JSON as argument
 * to <function_to_call>
 * @param {*} filename_field 
 * @param {*} function_to_call 
 */
function loadJSONDataFromGlobalSet(filename_field, function_to_call) {
	let t_promises = [];
	for (let i = 0; i < globalSetIndex.length; i++) {
		t_promises.push(fetch_promise(globalSetIndex[i].descriptor[filename_field], 'json', true));
	}
	Promise.all(t_promises).then(function (values) {
		for (var i = 0; i < values.length; i++) {
			function_to_call(values[i]);
		}
	}).catch(function (err) {
		logERR('Error parsing requested files');
		logERR(err);
	});
}

/* Called from fetchAndInitMarkers and calculates relative time between views */
function setMainViewStartTime() {
	let tmp_time = globalSetIndex[PLAYLIST_MAIN_VIEW_INDEX].descriptor.startTimeMs - reference_recording_set.descriptor.startTimeMs;
	if (tmp_time) { //should be 0
		logWARN('timing on PLAYLIST_MAIN_VIEW_INDEX and reference_recording_set does NOT match');
	}
	for (let i = 0; i < globalSetIndex.length; i++) {
		globalSetIndex[i].descriptor.tDiffwReferenceMs = globalSetIndex[i].descriptor.startTimeMs - reference_recording_set.descriptor.startTimeMs;
		if (globalSetIndex[i].descriptor.tDiffwReferenceMs > tmp_time && globalSetIndex[i].id != reference_recordingID) {
			tmp_time = globalSetIndex[i].descriptor.startTimeMs - reference_recording_set.descriptor.startTimeMs;
		}
	}


	let index, tmp_template;
	if (globalSetIndex[0].mpd.isLiveProfile) {

		if (globalSetIndex[0].mpd.representationCount > 1) {
			tmp_template = globalSetIndex[0].mpd.representations[globalSetIndex[0].active_representation].SegmentTemplate;
		} else {
			tmp_template = globalSetIndex[0].mpd.SegmentTemplate;
		}
		index = mpd_getSegmentIndexAtTime4Live(tmp_template, (tmp_time / 1000)) + 2; //TODO fix this +1
		logDEBUG('first segment is ' + index + ' for start time ' + tmp_time / 1000 + 's');
		fetch_promise(DASH_DIR + '/' + tmp_template.media.replace("$Number$", index), "arraybuffer", false)
			.then(function (response) {
				addSegment(response);
				sourceBuffer.addEventListener('updateend', function () {
					p.v.currentTime = p.t_videoStart = (tmp_time / 1000); //in seconds

					//TODO from here
					if (sourceBuffer.buffered.start(0) > p.v.currentTime) {
						logDEBUG('buffered starts at t = ' + sourceBuffer.buffered.start(0) + 's and current video time at ' + p.v.currentTime + 's. fetching next segment');
						fetch_promise(DASH_DIR + '/' + tmp_template.media.replace("$Number$", index - 1), "arraybuffer", false)
							.then(function (response) {
								addSegment(response);
							})
					}
					//till here is a safety patch for bordeline cases of first seg 

				}, {
					once: true
				});
				//TODO (#33) for now we use an event to signal timing info is ready
				window.dispatchEvent(new CustomEvent('timeDataReady', {
					detail: 'done'
				}));
			}).catch(function (err) {
				logWARN('Failed promise - Error log: ');
				logERR(err);
			});
	} else {
		index = mpd_getSegmentIndexAtTime(globalSetIndex[0].mpd.representations[0], (tmp_time / 1000)) + 1; //TODO fix this +1
		fetch_promise(DASH_DIR + '/' + globalSetIndex[0].mpd.representations[0].SegmentList.Segments[index], "arraybuffer", false)
			.then(function (response) {
				addSegment(response);
				p.v.currentTime = p.t_videoStart = (tmp_time / 1000); //in seconds
				//TODO (#33) for now we use an event to signal timing info is ready
				window.dispatchEvent(new CustomEvent('timeDataReady', {
					detail: 'done'
				}));
			}).catch(function (err) {
				logWARN('Failed promise - Error log: ');
				logERR(err);
			});
	}

}

function setQualitySelector(set_index) {
	quality_slk.innerHTML = globalSetIndex[set_index].qSelector.innerHTML;
	quality_slk[globalSetIndex[set_index].active_representation].selected = true;
}
/* Called from fetchAndInitMarkers and sets an event to fire when the shortest video is over */
function setMainViewEndTime() {
	let end_time = Infinity;
	for (let i = 0; i < globalSetIndex.length; i++) {
		if (globalSetIndex[i].id === reference_recordingID) {
			continue;
		}
		if (globalSetIndex[i].descriptor.durationMs / 1000 + p.t_videoStart < end_time) {
			end_time = globalSetIndex[i].descriptor.durationMs / 1000 + p.t_videoStart;
		}
	}
	p.t_videoEnd = end_time;

	//we add the end time event at the textTrack of reference view
	let vtc = new VTTCue(p.t_videoEnd - 1.0, p.t_videoEnd + VTTCUE_DURATION / 1000, "{ \"Event\": \"video_end\" }");
	vtc.id = "Event";
	for (let i = 0; i < main_view_tracks.length; i++) {
		if (main_view_tracks[i].label === reference_recordingID) {
			main_view_tracks[i].addCue(vtc);
			return;
		}
	}
}



function loadCoords(req_in) {
	loadAssets(PL_LOCATION_SUFFIX, req_in);
}

function loadLocs(req_in) {
	loadAssets(PL_ORIENTATION_SUFFIX, req_in);
}

function loadImageQ(req_in) {
	loadAssets(PL_BLUR_SUFFIX, req_in);
}

function loadShake(req_in) {
	loadAssets(PL_SHAKE_SUFFIX, req_in);
}

function loadTilt(req_in) {
	loadAssets(PL_TILT_SUFFIX, req_in);
}

function loadFov(req_in) {
	loadAssets(PL_FOV_SUFFIX, req_in);
}

function loadAssets(type, Xreq_target) {
	var tmp_name = Xreq_target.responseURL.split('/').pop().split('.')[0];
	for (var i = 0; i < globalSetIndex.length; i++) {
		if (globalSetIndex[i].descriptor.recordingID + type === tmp_name) {
			switch (type) {
				case PL_LOCATION_SUFFIX:
					globalSetIndex[i].coordSet = Xreq_target.response;
					break;
				case PL_ORIENTATION_SUFFIX:
					globalSetIndex[i].orientSet = Xreq_target.response;
					break;
				case PL_BLUR_SUFFIX:
					globalSetIndex[i].imageQSet = Xreq_target.response;
					break;
				case PL_SHAKE_SUFFIX:
					globalSetIndex[i].shakeSet = Xreq_target.response;
					break;
				case PL_TILT_SUFFIX:
					globalSetIndex[i].tiltSet = Xreq_target.response;
					break;
				case PL_FOV_SUFFIX:
					globalSetIndex[i].fovSet = Xreq_target.response;
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
 * NOTE: It adds INITIAL markers
 */
function analyzeGeospatialData() {
	/**
	 * Add initial markers (TODO specify initial loc and orient)
	 */
	for (let i = 0; i < globalSetIndex.length; i++) {
		let s = globalSetIndex[i];
		let is_active = false;
		if (s.coordSet.length > 2) { //we consider a recording to be mobile if it has more than 2 updates
			s.descriptor.is_mobile = true;
		} else {
			s.descriptor.is_mobile = false;
		}
		s.marker = new Marker();
		s.marker.init(s.coordSet[0].Latitude, s.coordSet[0].Longitude,
			s.index, s.id, s.orientSet[0].X, s.descriptor.is_mobile);

		if (s.id === reference_recordingID) {
			highlightMarker(s.marker, true); //we start by the current marker selected
		}
	}


	/**
	 * Add marker updates
	 */
	for (let i = 0; i < globalSetIndex.length; i++) {
		let s = globalSetIndex[i];
		addMarkerUpdates(s, i);
		globalSetIndex[i].main_view_tracks_no = i;
		main_view_tracks[i].oncuechange = function () {
			for (let j = 0; j < this.activeCues.length; j++) {
				if (this.activeCues[j].id === "OrientationUpdate") {
					updateLastOrientation(this.setReference, JSON.parse(this.activeCues[j].text), this.activeCues[j].startTime);
					updateMarkerOrientation(this.activeCues[j].track.label, JSON.parse(this.activeCues[j].text).X); //we only use X for display
				} else if (this.activeCues[j].id === "LocationUpdate") {
					updateLastLocation(this.setReference, JSON.parse(this.activeCues[j].text), this.activeCues[j].startTime);
					updateMarkerLocation(this.activeCues[j].track.label, JSON.parse(this.activeCues[j].text));
				} else if (this.activeCues[j].id === "TiltUpdate") {
					updateTilt(this.setReference, JSON.parse(this.activeCues[j].text), this.activeCues[j].startTime);
				} else if (this.activeCues[j].id === "ShakeUpdate") {
					updateShake(this.setReference, JSON.parse(this.activeCues[j].text), this.activeCues[j].startTime);
				} else if (this.activeCues[j].id === "FovUpdate") {
					updateFov(this.setReference, JSON.parse(this.activeCues[j].text), this.activeCues[j].startTime);
				} else if (this.activeCues[j].id === "Event") {
					handleEvent(this.activeCues[j].track.label, JSON.parse(this.activeCues[j].text));
				}
			}
		};
	}

	/**
	 * add shake and tilt updates
	 * 
	 */
	for (let i = 0; i < globalSetIndex.length; i++) {
		addMetricUpdates(i);
	}


	/**
	 * Add initial Location and Orientation references
	 */

	for (let i = 0; i < globalSetIndex.length; i++) {
		globalSetIndex[i].lastLocation = globalSetIndex[i].coordSet[0];
		globalSetIndex[i].lastLocation.v_t = p.v.currentTime;
		globalSetIndex[i].lastOrientation = globalSetIndex[i].orientSet[0];
		globalSetIndex[i].lastOrientation.v_t = p.v.currentTime;
	}

	//TODO after we move set p.t_videoStart out of addMarkerUpdates, move this out of here
	setMainViewEndTime();

}


function addMetricUpdates(index_in) {

	if (p.t_videoStart === 0) {
		logERR('p.t_videoStart = 0 . Updates will not work properly');
	}

	addShakeVTTC(index_in);

	addTiltVTTC(index_in);

	addFovVTTC(index_in);
}

function addShakeVTTC(index_in) {
	addVTTCueUpdates(index_in, 'shakeSet', 'ShakeUpdate');
}

function addTiltVTTC(index_in) {
	addVTTCueUpdates(index_in, 'tiltSet', 'TiltUpdate');
}

function addFovVTTC(index_in) {
	addVTTCueUpdates(index_in, 'fovSet', 'FovUpdate');
}

/**
 * Adds VTT Cues for JSON sets, currently used for metrics
 * 
 * @param {Number} index_in the index of the set 
 * @param {String} update_type_set the subset of the set containing the data
 * @param {String} vtc_id the VTTCue string used to indicate the type of update
 */
function addVTTCueUpdates(index_in, update_type_set, vtc_id) {
	//track to add the VTT Cues on
	let tmp_track = main_view_tracks[index_in];
	let set_in = globalSetIndex[index_in];
	//this is the time difference between this set and the reference
	let t_diff = set_in.descriptor.startTimeMs - reference_recording_set.descriptor.startTimeMs;

	let cur_t = set_in[update_type_set][0].PresentationTime;
	for (let i = 0; i < set_in[update_type_set].length; i++) {
		let tmp_data_set = set_in[update_type_set][i];
		//check if we have set a min timespan between marker updates
		//TODO probably not for the non-marker update elements (e.g. FoV), left here as safety
		if (MARKER_UPDATE_LIMIT_ON && i > 0) {
			if (tmp_data_set.PresentationTime - cur_t < MARKER_UPDATE_LIMIT) {
				continue;
			}
		}
		cur_t = tmp_data_set.PresentationTime;
		let vtc;
		if (OVERRIDE_CUE_DURATION_FOR_METRICS && set_in[update_type_set][i + 1]) {
			let cue_dur = set_in[update_type_set][i + 1].PresentationTime - tmp_data_set.PresentationTime;
			vtc = new VTTCue((t_diff + cur_t) / 1000, (t_diff + cur_t + cue_dur) / 1000, JSON.stringify(tmp_data_set));
		} else if (i + 1 == set_in[update_type_set].length) {
			let cue_dur = set_in.descriptor.durationMs - tmp_data_set.PresentationTime;
			vtc = new VTTCue((t_diff + cur_t) / 1000, (t_diff + cur_t + cue_dur) / 1000, JSON.stringify(tmp_data_set));
		} else {
			//TODO handle cues according to main vid time (not relevant to the take time)
			vtc = new VTTCue((t_diff + cur_t) / 1000, (t_diff + cur_t + VTTCUE_DURATION) / 1000, JSON.stringify(tmp_data_set));
		}
		vtc.id = vtc_id;
		tmp_track.addCue(vtc);
	}
}


//TODO refactor
function addMarkerUpdates(set_in, tmp_index) {
	/* locate and init track */
	var tmp_track = main_view_tracks[tmp_index];

	/* analyze orientations to cues */
	/* use as main (a.k.a. reference) view */
	var tmp_start = set_in.descriptor.startTimeMs;
	var t_diff = tmp_start - reference_recording_set.descriptor.startTimeMs;
	if (p.t_videoStart === 0) {
		p.t_videoStart = t_diff / 1000;
		p.v.currentTime = p.t_videoStart;
	}
	let cur_t;

	//first we set the orientation updates
	cur_t = set_in.orientSet[0].PresentationTime;
	for (let i = 0; i < set_in.orientSet.length - 1; i++) {
		let tmp_orient = set_in.orientSet[i];
		//check if we have set a min timespan between marker updates
		if (MARKER_UPDATE_LIMIT_ON && i > 0) {
			if (tmp_orient.PresentationTime - cur_t < MARKER_UPDATE_LIMIT) {
				continue;
			}
		}
		cur_t = tmp_orient.PresentationTime;
		//TODO handle cues according to main vid time (not relevant to the take time)
		let vtc = new VTTCue((t_diff + cur_t) / 1000, (t_diff + cur_t + VTTCUE_DURATION) / 1000, JSON.stringify(tmp_orient));
		vtc.id = "OrientationUpdate";
		tmp_track.addCue(vtc);
	}

	//then we set the location updates
	cur_t = set_in.coordSet[0].PresentationTime;
	for (var i = 0; i < set_in.coordSet.length - 1; i++) {
		let tmp_loc = set_in.coordSet[i];
		//check if we have set a min timespan between marker updates
		if (MARKER_UPDATE_LIMIT_ON && i > 0) {
			if (tmp_loc.PresentationTime - cur_t < MARKER_UPDATE_LIMIT) {
				continue;
			}
		}
		cur_t = tmp_loc.PresentationTime;
		//TODO handle cues according to main vid time (not relevant to the take time)
		let vtc = new VTTCue((t_diff + cur_t) / 1000, (t_diff + cur_t + VTTCUE_DURATION) / 1000, "{\"Latitude\":" + tmp_loc.Latitude + ", \"Longitude\":" + tmp_loc.Longitude + "}");
		vtc.id = "LocationUpdate";
		tmp_track.addCue(vtc);
	}
}

//called when marker is clicked
function switchToStream(set_index, recordingID) {

	if (!recordingID) {
		recordingID = getIdByIndex(set_index);
	}

	if (p.v.paused) {
		logUI("Ignoring switch to " + recordingID + ", at index " + set_index + " - main view paused");
		return;
	}
	if (active_video_id === recordingID) {
		logUI("Ignoring Switch - currently active stream selected");
		return;
	} else {
		logUI("Switching to stream with ID: " + recordingID);
	}

	doTheSwitch(set_index, recordingID);

}

function forceSwitch(set_index) {
	logWARN('Performing Forced Switch');
	let recordingID = getIdByIndex(set_index);
	doTheSwitch(set_index, recordingID);
}

function doTheSwitch(set_index, recordingID) {
	let new_set = getSetByVideoId(recordingID);
	let end_time = p.v.currentTime;

	/*
				let end_time = getSourceBufferEnd();
	
				if(Math.abs(end_time - p.v.currentTime) < 0.2){
					logDEBUG('safety check for time diff between buffer and video end');
					end_time -= 0.2;
				}
	*/

	newScene(end_time, recordingID, active_video_id);

	new_set.marker.highlightMarker(true); //highlight new marker
	globalSetIndex[active_video_index].marker.highlightMarker(false); //de-hihglight old marker

	active_video_id = recordingID;
	active_video_index = set_index;
	let tmp_set = globalSetIndex[set_index];

	//display available representations
	setQualitySelector(set_index);

	p.ms.sourceBuffers[0].timestampOffset = tmp_set.descriptor.tDiffwReferenceMs / 1000;


	let seg_n = 0;
	seg_n = mpd_getSegmentNum(active_video_index, end_time);

	seg_n++; //because we are switching we need the segment after the end of the currently playing
	mse_initAndAdd(set_index, seg_n);
}

function resetSourceBuffer() {
	logINFO('resetting sourceBuffer');
	killInterval();
	last_fetched_index = -1;
	last_fetched_seg_n = -1;

	if (sourceBuffer.updating) {
		sourceBuffer.addEventListener('updateend', function () {
			resetSourceBuffer();
		}, {
			once: true
		});
		logINFO('sourceBuffer is updating, reset will commence when the update is over');
		return;
	}
	sourceBuffer.remove(sourceBuffer.buffered.start(0), sourceBuffer.buffered.end(sourceBuffer.buffered.length - 1));

	let seg_n = 0;
	seg_n = mpd_getSegmentNum(active_video_index, p.v.currentTime);


	if (sourceBuffer.updating) {
		sourceBuffer.addEventListener('updateend', function () {
			mse_initAndAdd(active_video_index, seg_n);
		}, {
			once: true
		});
	} else {
		mse_initAndAdd(active_video_index, seg_n);
	}
	//TODO Chrome-specific workaround because it does not auto-play (nor auto-pauses) after reset
	if (navigator.userAgent.indexOf("Chrome") != -1) {
		p.v.currentTime += 0.001;
	}
	startAllIntervals();
}

//WARNING: so far we call it only with 2 timeranges inside the source buffer
function cleanSourceBuffer() {
	logINFO('cleaning sourceBuffer');
	killInterval();
	last_fetched_index = -1;
	last_fetched_seg_n = -1;

	if (sourceBuffer.updating) {
		sourceBuffer.addEventListener('updateend', function () {
			cleanSourceBuffer();
		}, {
			once: true
		});
		logINFO('sourceBuffer is updating, cleanup will commence when the update is over');
		return;
	}

	if (sourceBuffer.buffered.end(0) < p.v.currentTime) { //if the early source buffer ends before the current time
		if (last_removed_timerage === sourceBuffer.buffered.end(0)) { //check that we did not get into a loophole (usually when the diff is less than the dur of a frame)
			resetSourceBuffer();
			return;
		}
		last_removed_timerage = sourceBuffer.buffered.end(0);
		sourceBuffer.remove(sourceBuffer.buffered.start(0), sourceBuffer.buffered.end(0));
	} else if (sourceBuffer.buffered.start(1) > p.v.currentTime && ((sourceBuffer.buffered.end(0) + globalSetIndex[0].mpd.representations[0].frameRate / 1000) < sourceBuffer.buffered.start(1))) { //or the late start after the current time
		if (last_removed_timerage === sourceBuffer.buffered.start(1)) { //check that we did not get into a loophole (usually when the diff is less than the dur of a frame)
			resetSourceBuffer();
			return;
		}
		last_removed_timerage = sourceBuffer.buffered.start(1);
		sourceBuffer.remove(sourceBuffer.buffered.start(1), sourceBuffer.buffered.end(1));
	} else {
		logWARN("cleanSourceBuffer FAILED, check buffer contents (printBufferStatus())");
	}
	startAllIntervals();
}


function addOption(file_id) {
	let option = document.createElement("option");
	option.text = file_id;
	option.value = file_id;
	selector.add(option);
}

function createRepresentationOption(rep_index, height, bandwidth) {
	let option = document.createElement("option");
	option.text = height + "p - " + Math.trunc(bandwidth / 1000) + "kbps";
	option.value = rep_index;
	return option;
}


function updateLastOrientation(set_in, orient, v_t) {
	set_in.lastOrientation = orient;
	set_in.lastOrientation.v_t = v_t;
}

function updateLastLocation(set_in, loc, v_t) {
	set_in.lastLocation = loc;
	set_in.lastLocation.v_t = v_t;
}

function updateShake(set_in, sh_in, v_t) {
	set_in.lastShake = sh_in;
	set_in.lastShake.v_t = v_t;
}

function updateTilt(set_in, tl_in, v_t) {
	set_in.lastTilt = tl_in;
	set_in.lastTilt.v_t = v_t;
}

function updateFov(set_in, fv_in, v_t) {
	set_in.isFoV = fv_in;
	set_in.isFoV.v_t = v_t;
}

function mse_initAndAdd(stream_index, segment_n) {
	fetch_promise(DASH_DIR + '/' + globalSetIndex[stream_index].mpd.init_seg, "arraybuffer", false)
		.then(function (response) {
			addSegment(response);

			if (globalSetIndex[stream_index].mpd.isLiveProfile) {
				let tmp_template;

				if (globalSetIndex[stream_index].mpd.representationCount > 1) {
					tmp_template = globalSetIndex[stream_index].mpd.representations[globalSetIndex[stream_index].active_representation].SegmentTemplate;
				} else {
					tmp_template = globalSetIndex[stream_index].mpd.SegmentTemplate;
				}

				sourceBuffer.addEventListener('updateend', function () {
					fetch_promise(DASH_DIR + '/' + tmp_template.media.replace("$Number$", segment_n), "arraybuffer", false)
						.then(function (response) {
							addSegment(response);
						})
						.catch(function (err) {
							logWARN('Failed promise - Error log: ');
							logERR(err);
						});
				}, {
					once: true
				});

			} else {
				sourceBuffer.addEventListener('updateend', function () {
					fetch_promise(DASH_DIR + '/' + globalSetIndex[stream_index].mpd.representations[0].SegmentList.Segments[segment_n], "arraybuffer", false)
						.then(function (response) {
							addSegment(response);
						})
						.catch(function (err) {
							logWARN('Failed promise - Error log: ');
							logERR(err);
						});
				}, {
					once: true
				});
			}

		}).catch(function (err) {
			logWARN('Failed promise - Error log: ');
			logERR(err);
		});
}

function killInterval() {
	clearInterval(check_interval_id);
	clearInterval(metrics_interval_id);
	check_interval_id = -1;
	metrics_interval_id = -1;
}

function startAllIntervals() {
	check_interval_id = startInterval(check_interval_id, check_status, CHECK_INTERVAL_MS);
	metrics_interval_id = startInterval(metrics_interval_id, logMetrics, METRICS_INTERVAL_MS);
}

/**
 * starts an interval with <id>, that calls <function> every <interval_duration>
 * TODO: replace all setInterval
 * @param {*} id_in the id of the interval
 * @param {*} fun_in the function to be called
 * @param {*} tms_in the interval duration
 */
function startInterval(id_in, fun_in, tms_in) {
	if (id_in != -1) {
		logINFO('interval for ' + fun_in.name + 'already running');
		return;
	}
	return setInterval(fun_in, tms_in);
}

function resetInterval() {
	killInterval();
	startAllIntervals();
}

function nextStream() {
	let next_index = -1;
	if (active_video_index === globalSetIndex.length - 1) {
		next_index = 0;
	} else {
		next_index = active_video_index + 1;
	}
	switchToStream(next_index, globalSetIndex[next_index].id);
}

function nextPolicyStream() {
	let tmp_s;
	tmp_s = getSwitchStream();
	switchToStream(tmp_s.index, tmp_s.id);
}

function selectPolicy(p_in) {
	switch (p_in) {
		case 'Manual':
			stopRoundRobin();
			activateUIselection();
			break;
		case 'Round-Robin 10s':
			deactivateUIselection();
			startRoundRobin(10);
			break;
		case 'Round-Robin 20s':
			deactivateUIselection();
			startRoundRobin(20);
			break;
		case 'Ranking 10s':
			stopRoundRobin();
			deactivateUIselection();
			break;
		case 'Ranking 20s':
			stopRoundRobin();
			deactivateUIselection();
			break;
		case 'Proximity-Stability':
			break;
		default:
			logWARN('Policy ' + p_in + ' unknown');
			break;
	}
}

function selectQuality(p_in) {
	logDEBUG('Switching to representation index ' + p_in);
	globalSetIndex[active_video_index].ActiveRepresentation = p_in;
}

function deactivateUIselection() {
	for (let i = 0; i < markers.length; i++) {
		markers[i].deactivateClick();
	}
	document.getElementById('next_btn').disabled = true;
	document.getElementById('next_p_btn').disabled = true;
	document.getElementById('selector').disabled = true;
}

function activateUIselection() {
	for (let i = 0; i < markers.length; i++) {
		markers[i].activateClick();
	}
	document.getElementById('next_btn').disabled = false;
	document.getElementById('next_p_btn').disabled = false;
	document.getElementById('selector').disabled = false;
}

function stopRoundRobin() {
	clearInterval(roundRobin_interval_id);
	roundRobin_interval_id = -1;
}

function startRoundRobin(t_sec) {
	if (roundRobin_interval_id > 0) {
		stopRoundRobin();
	}
	roundRobin_interval_t = t_sec;
	roundRobin_interval_id = setInterval(nextStream, t_sec * 1000);
}

function activate_policies() {
	for (let i = 0; i < policies.length; i++) {
		let p_i = policies[i];
		let option = document.createElement("option");
		option.text = option.value = p_i;
		policy_slk.add(option);
	}
}

function handleEvent(marker_id, obj_in) {
	if (obj_in.Event === 'test_switch') {
		testEvent(parseInt(obj_in.TestId));
	} else if (obj_in.Event === 'video_end') {
		video_end();
	}
}

function video_end() {
	killInterval();
	p.v.load();
	deactivateUIselection();
	stopRoundRobin();
	deactivateUIselection();
	logUI('Demo is over, reload page to start over');
}