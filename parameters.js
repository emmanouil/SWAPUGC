"use strict";
/**
 * Parameters related to map/display; some are obsolete (used in Spatiotemporal navigation)
 */
/* Display Default Google Maps Marker for each Location Point */
var USE_DEFAULT_MARKERS = false;
/* Display Default Google Maps Marker for each Location Point that does not have bearing information*/
var USE_NO_BEARING_MARKERS = true;
/* Zoom Level [0,20] when viewing videos */
var DEFAULT_ZOOM = 20;
/* Reset zoom level to default when viewing a video */
var LOCK_ZOOM = false;

/**
 * Parameters used mostly by main.js and are experiment-specific
 */
/* Show/hide concert hall estimation */
var SHOW_ROOM = true;
/* reference view location coordinates - only used for map-centering */
var reference_location = [53.472667, -2.299053];
/* main/reference view recording ID */
var reference_recordingID = 'A002C001_140325E3';
/* main/reference parsed recording data set (samples) */
var reference_recording_set;



/* Other Global vars that hold/set elements: */

/**
 *  in maps. js
 *
 *  map         (Object) Holds Google Map
 *  test_icon   (Object) Holds SVG icon for camera markers
 *  current_zoom (int)   Holds current zoom level
 **/

/**
 *  in helper.js
 *
 *  globalSetIndex  (Array of Objects) Holds all Location/Sensor data
 **/

/**
 *  in video.js
 *
 **/

/**
 *  in events.j
 *
 *  selector        (Element)   The "Select File"
 **/

/**
 *  in script.js
 *
 *  active_video_id (String)    The id of selected file
 *  active_video_index (int)    Index (in globalSetIndex) of the selected file
 *  playlist        (Array of Strings)  Holds IDs
 *  p.v       (Element)   The main view video
 *  items_fetched   (int)       Number of playlist elements fetched
 *
 * File-in related vars:
 * playlist_file = 'playlist.txt'
 * pl_element_prefix = 'OUT_'
 * pl_video_prefix = 'VID_'
 * pl_element_extension = '.txt'
 * pl_video_extension = '.mp4'
 **/