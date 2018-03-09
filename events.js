"use strict";
var zoomLvl, tmpZoom, initiated = false;
var selector, policy_slk;

function activateMapEvents() {

    map.addListener('zoom_changed', function () {
        tmpZoom = map.getZoom();
        if (!LOCK_ZOOM) {
            current_zoom = tmpZoom;
        }
    });

}

function activateUI() {
    selector = document.getElementById('selector');
    policy_slk = document.getElementById('policy_slk');
}

//called when file is selected from the dropdown
function selectFile(index_in, id_in) {
    if (main_view.paused) {
        return;
    }
    logDEBUG("selected option using dropdown (selectFile). index: " + index_in + " id: " + id_in);
    switchToStream(index_in, id_in);
    //active_video_id = selector[index_in].text;
}

//called when a marker is clicked
function goToVideo(i_in) {
    logINFO("called goToVideo with index: " + i_in);
    selector.selectedIndex = i_in;
    selectFile(i_in);
}

/**
 * Called after map is loaded and MSE is ready
 */
function fetchAndInitMarkers() {
    //TODO (#33) the following is a workaround - we fire an event when start time is calculated - promise to re-implement with promises
    // execution order: 1. loadSpatialData 2. setMainViewStartTime 3. initMarkers
    window.addEventListener('timeDataReady', function (e) {
        logDEBUG('timeDataReady event fired - calling initMarkers');
        initMarkers();
    }, { once: true });

    window.addEventListener('spatialDataReady', function (e) {
        logDEBUG('spatialDataReady event fired - calling setMainViewStartTime');
        setMainViewStartTime();
    }, { once: true });

    loadSpatialData();
}

/**
 * Called when timeDataReady event is fired
 */
function initMarkers() {
    logINFO('Initializing markers for reference start time (ms): ' + main_view_startTime);
    /* Setup main view */
    centerMap(reference_location[0], reference_location[1], 20)
    analyzeGeospatialData();
    document.getElementById('play_btn').disabled = false;
    document.getElementById('toggle_room_btn').disabled = false;
}



/**
 * Called when GoToAndPlay button is clicked
 * @param {*} e 
 */
function goToAndPlay(e) {
    document.getElementById('play_btn').disabled = true;
    logINFO('starting playback from (ms): ' + main_view_startTime);
    startPlayback();
    document.getElementById('reset_btn').disabled = false;
    document.getElementById('next_btn').disabled = false;
    document.getElementById('selector').disabled = false;
    document.getElementById('policy_slk').disabled = false;
}