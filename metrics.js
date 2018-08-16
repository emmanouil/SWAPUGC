'use strict';
/**
 * This file contains the definition of the Metrics object, that is present in 
 *  all recording sets and updates during playback
 * 
 */
function Metrics() {
    //Image-based objective
    this.bluriness = 0;
    //Sensor-based
    this.shakiness = 0;
    this.FOV.orientation = 0;
    this.FOV.tilt = 0;
    //proposed
    this.facing = 0;
    //Characteristics
    this.bitrate = 0;
    this.resolution = 0;
}