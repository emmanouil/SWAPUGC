'use strict';
/**
 * Player object, that holds references
 * to vars and objects used during playback
 * 
 */
function Player(video_element, media_source) {
    this.v = video_element;
    this.ms = media_source;
    this.v.startTime = 0;
    this.v.endTime = Infinity;
    this.active_set_id = -1;
}

Player.prototype = {
    get t_videoStart() {
        return this.v.startTime;
    },
    set t_videoStart(t) {
        this.v.startTime = t;
    },
    get t_videoEnd() {
        return this.v.endTime;
    },
    set t_videoEnd(t) {
        this.v.endTime = t;
    }
};


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