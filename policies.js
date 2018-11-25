"use strict";
/* global globalSetIndex */
/* global sourceBuffer */ //in mse.js


//Cinematic Criteria Parameters
var JUMP_CUT_TOLERANCE_MIN = 160; //in deg
var JUMP_CUT_TOLERANCE_MAX = 200; //in deg

//Start of View Selection Policy Functions

function filterStreams() {
    let filteredStreams = [];
    for (let i = 0; i < globalSetIndex.length; i++) {
        if (globalSetIndex[i].isFoV.FoV) {
            filteredStreams.push({
                index: i,
                id: globalSetIndex[i].id
            });
        }
    }
    return filteredStreams;
}

function evaluateCinematic(streams_in) {
    let passed_streams = [];
    let last_scene = scenes[scenes.length - 1];

    let current_view_angle = globalSetIndex[active_video_index].lastOrientation.X;
    for (let i = 0; i < streams_in.length; i++) {

        //check history and skip current and previous view
        if (last_scene && (last_scene.currentStreamId == streams_in[i].id || last_scene.previousStreamId == streams_in[i].id)) {
            continue;
        }

        //check angle
        let angle_diff = angle0N180_0P180(current_view_angle, globalSetIndex[streams_in[i].index].lastOrientation.X);
        if (!((angle_diff < JUMP_CUT_TOLERANCE_MAX) && (angle_diff > JUMP_CUT_TOLERANCE_MIN))) {
            streams_in[i].angle_diff = angle_diff;
            passed_streams.push(streams_in[i]);
        }
    }

    if (!passed_streams.length) {
        //TODO
        logDEBUG('No stream meets the cinematic criteria - selecting furthest');
    } else {
        return passed_streams[0];
    }

    return null; //TODO return furthest
}

/**
 * Returns list of streams that share the same shortest distance from active_video
 * @param {Object} streams_in subset of streams to compare 
 */
function getNearest(streams_in) {
    let passed_streams = [];
    let min_distance = Infinity;
    let curr_loc = {
        lat: 0,
        lng: 0
    };
    curr_loc.lat = globalSetIndex[active_video_index].lastLocation.Latitude;
    curr_loc.lng = globalSetIndex[active_video_index].lastLocation.Longitude;
    for (let i = 0; i < streams_in.length; i++) {
        if (active_video_id == streams_in[i].id) {
            continue;
        }
        let tmp = {
            lat: globalSetIndex[streams_in[i].index].lastLocation.Latitude,
            lng: globalSetIndex[streams_in[i].index].lastLocation.Longitude,
            dist: 0
        };
        tmp.dist = calcDistanceBetweenCoords(curr_loc.lat, curr_loc.lng, tmp.lat, tmp.lng);
        console.log(streams_in[i].id+' with distance '+tmp.dist);
        if (tmp.dist < min_distance) {
            min_distance = tmp.dist;
            passed_streams = [streams_in[i]];
        } else if (tmp.dist == min_distance) {
            passed_streams.push(streams_in[i]);
        }
    }
    return passed_streams;
}

function getSwitchStream() {

    //Filter streams (that do not film the ROI)
    let filteredStreams = filterStreams();


    //Calculate score
    for (let i = 0; i < filteredStreams.length; i++) {
        filteredStreams[i].score = getScore(filteredStreams[i].index);
    }

    //Sort them according to score (descenting)
    filteredStreams.sort(function (a, b) {
        return b.score - a.score;
    });

    let sel_ected = evaluateCinematic(filteredStreams);
    return sel_ected;
}
