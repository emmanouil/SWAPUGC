"use strict";
/* jshint node: true */
const fs = require('fs');
const x2j = require('fast-xml-parser');


//Simulator specific
const TOP_DIR = '';

//copied from main.js
//TODO don't
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
const PORT = '8000';
var BASE_URL = ''; //set when parse_playlist is called (e.g. 192.0.0.1:8000)

//pseudo-simulation parameters
var interval_id = -1; //timeout id
const UPDATE_S = 1.7; //condition (in s) to fetch next segment, relative to the current video time and end of the sourceBuffer
const MARKER_UPDATE_LIMIT_ON = true; //enable cue timespan limit
const MARKER_UPDATE_LIMIT = 600; // (in ms) limit the timespan between two updates for the same marker (i.e. number of cues)

//performance parameters
const INTERVAL_MS = 900; //check interval (in ms)
const VTTCUE_DURATION = 400; //whenever a cuechange event is fired all cues are checked if active (and if so, updated) - recommended value < MARKER_UPDATE_LIMIT

//selection policy;
var policies = ['Manual', 'Ranking 10s', 'Ranking 20s', 'Round-Robin 10s', 'Round-Robin 20s'];
var roundRobin_interval_t;
var roundRobin_interval_id = -1;


/**
 * Script Parameters & Objs
 */
var active_video_id = null;
var active_video_index = null;
var playlist, items_fetched = 0,
    main_view_tracks = [];


//from parameters.js
/* main/reference view recording ID */
var reference_recordingID = 'A002C001_140325E3';
var reference_recording_set;

//from helper.js
var globalSetIndex = [];



console.log('Simulator script running from ' + process.cwd());

try {
    fs.accessSync(TOP_DIR + PLAYLIST_FILE);
} catch (err) {
    console.error(err);
    process.exit(1);
}
let pl_entries = fs.readFileSync(TOP_DIR + PLAYLIST_FILE, 'utf8').split(/\r\n|\r|\n/)
console.log(pl_entries)

playlist = pl_entries.filter((elem) => {
    if (elem.startsWith('#') || elem.startsWith(' ')) {
        return false;
    }
    try {
        fs.accessSync(TOP_DIR + DASH_DIR + '/' + elem + DASH_MPD_SUFFIX + '.mpd', 'r');
        fs.accessSync(TOP_DIR + PARSER_DIR + '/' + elem + PL_DESCRIPTOR_SUFFIX + '.json', 'r');
    } catch (err) {
        console.log(err + 'Removing element from playlist');
        return false;
    }
    return true;
});

console.log('Finished parsing playlist. Found ' + playlist.length + ' elements');


for (let i = 0; i < playlist.length; i++) {
    var loc_obj = {};
    loc_obj.descriptor = JSON.parse(fs.readFileSync(TOP_DIR + PARSER_DIR + '/' + playlist[i] + PL_DESCRIPTOR_SUFFIX + '.json'));
    loc_obj.index = globalSetIndex.length;
    loc_obj.id = loc_obj.descriptor.recordingID;
    loc_obj.videoFile = loc_obj.id + PL_VIDEO_EXTENSION;
    globalSetIndex.push(loc_obj);
    //we check if it is our main view
    if (loc_obj.id === reference_recordingID) {
        reference_recording_set = globalSetIndex[globalSetIndex.length - 1];
    }

}

//TODO GL130 ; parse MPD