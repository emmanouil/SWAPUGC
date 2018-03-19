'use strict';
/**
 * This file contains the definition of the Player object, that holds references
 * to vars and objects used during playback
 * 
 */
function Player(video_element, media_source) {
    this.v = video_element;
    this.ms = media_source;
    this.active_set_id = -1;
}