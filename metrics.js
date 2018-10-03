'use strict';

//Score weights
const a1 = 0.20; //Shakiness
const a2 = 0.20; //Tilt/Yaw
const a3 = 0.20; //Bitrate
const a4 = 0.20; //Image Quality
const a5 = 0.20; //Link Reliability
//Score ranges
const maxTilt = 5; //Tilt (in degrees) more/less than maxTilt scores 0


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

function printMetrics(index_in) {
    let temp_frame = parseInt(p.v.currentTime - globalSetIndex[index_in].descriptor.tDiffwReferenceMs / 1000);
    let temp_set = globalSetIndex[index_in];
    logUI('Showing metrics for set at index: ' + index_in + ' at video time' + p.v.currentTime +
        ' Blur Metric (for frame: ' + temp_frame + '): ' + temp_set.imageQSet[temp_frame].Blur +
        'Tilt: ' + temp_set.lastOrientation['Y'] + '  Skew: ' + temp_set.lastOrientation['Z'] + //tilt should be around 0deg
        'Orientation: ' + temp_set.lastOrientation['X'] + '  Bearing: ' + getBearing(temp_set) + '   Distance: ' + getDistance(temp_set)
    );
}