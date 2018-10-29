"use strict";
/* global globalSetIndex */ //standard supported by Firefox and Chrome (not IE)
/* global sourceBuffer */ //in mse.js
var rankedStreams = []; //it is updated with the streams each time a new score is calculated
var scenes = []; //holds the scenes


/**
 * Scene object, used for cinematic criteria
 */
function Scene(cur_t, new_id, old_id, overridden = false) {
    this.startTime = cur_t;
    this.currentStreamId = new_id;
    this.previousStreamId = old_id;
    this.overridden = overridden; //indicates that a cinematic criterion was overridden
    this.duration = 0;
    this.endTime = 0;
    //this.cutshort = '';   //TODO probably not needed
    //this.typeofswitch = ''; //'SHORT', 'MANUAL' //TODO probably not needed
}

Scene.prototype.endScene = function (endtime) {
    this.duration = endtime - this.startTime;
    this.endTime = endtime;
};




function newScene(cur_t, new_id, old_id, overridden = false) {
    let tmp = scenes.push(new Scene(cur_t, new_id, old_id, overridden));
    let i = tmp - 1;
    if (i) {
        scenes[i - 1].endScene(cur_t);
    }

}

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