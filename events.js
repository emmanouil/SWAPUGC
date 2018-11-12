"use strict";
var zoomLvl, tmpZoom, initiated = false;
var selector, policy_slk, quality_slk;

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
    quality_slk = document.getElementById('quality_slk');
}

//called when file is selected from the dropdown
function selectFile(index_in, id_in) {
    if (p.v.paused) {
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
    }, {
        once: true
    });

    window.addEventListener('spatialDataReady', function (e) {
        logDEBUG('spatialDataReady event fired - calling setMainViewStartTime');
        setMainViewStartTime();
    }, {
        once: true
    });

    loadSpatialData();
    loadImageQualityData();
    loadShakeData();
    loadTiltData();
    loadFovData();
}

/**
 * Called when timeDataReady event is fired
 */
function initMarkers() {
    createMarkerProto(); //for Marker objects (we need the maps API to be already loaded, this is why it is placed here)
    logINFO('Initializing markers for reference start time (ms): ' + p.t_videoStart);
    /* Setup main view */
    centerMap(reference_view_centering_location[0], reference_view_centering_location[1], 20);
    analyzeGeospatialData();
    document.getElementById('play_btn').disabled = false;
}



/**
 * Called when GoToAndPlay button is clicked
 */
function goToAndPlayPause() {
    if (p.v.paused) {
        document.getElementById('play_btn').innerText = 'Pause';
        logINFO('starting playback from (ms): ' + p.v.currentTime);
        p.v.play();
        document.getElementById('reset_btn').disabled = false;
        document.getElementById('next_btn').disabled = false;
        document.getElementById('next_p_btn').disabled = false;
        document.getElementById('selector').disabled = false;
        document.getElementById('policy_slk').disabled = false;
        document.getElementById('quality_slk').disabled = false;
    } else {
        document.getElementById('play_btn').innerText = 'Play';
        logINFO('Paused playback at: ' + p.v.currentTime);
        p.v.pause();
        document.getElementById('reset_btn').disabled = true;
        document.getElementById('next_btn').disabled = true;
        document.getElementById('next_p_btn').disabled = true;
        document.getElementById('selector').disabled = true;
        document.getElementById('policy_slk').disabled = true;
        document.getElementById('quality_slk').disabled = true;
    }
}