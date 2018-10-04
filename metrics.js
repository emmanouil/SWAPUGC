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
        'Orientation: ' + temp_set.lastOrientation['X'] + '  Bearing: ' + getBearing(temp_set) +
        '   Distance: ' + getDistance(temp_set) + '     __Score:_' + getScore(index_in)
    );
}

function getScore(index_in) {
    let temp_frame = parseInt(p.v.currentTime - globalSetIndex[index_in].descriptor.tDiffwReferenceMs / 1000);
    let temp_set = globalSetIndex[index_in];

    //Shakiness
    let Ss = 1; //TODO shakiness not implemented yet
    let SSs = 1 - Ss;

    //Tilt
    let St;
    if (Math.abs(temp_set.lastOrientation['Y']) > maxTilt) {
        St = 1;
    } else {
        St = mapToRange(Math.abs(temp_set.lastOrientation['Y']), 0, maxTilt, 0, 1);
    }
    let SSt = 1 - St;

    //Bitrate
    let Vb = 0;
    let Bmin = 999999;
    let Bmax = 0;
    temp_set.mpd.representations.forEach((rep) => {
        let b = Number(rep.bandwidth);
        if (b < Bmin) {
            Bmin = b;
        } else if (b > Bmax) {
            Bmax = b;
        }
    });
    Vb = mapToRange(
        Number(
            temp_set.mpd.representations[temp_set.active_representation].bandwidth
        ), Bmin, Bmax, 0, 1);

    //Image Q
    let ImQmin = 0;
    let ImQmax = 0;
    //TODO calculate this once per event update, not per request / per stream
    for (let i = 0; i < globalSetIndex.length; i++) {
        let t_f = parseInt(p.v.currentTime - globalSetIndex[i].descriptor.tDiffwReferenceMs / 1000);
        let b = globalSetIndex[i].imageQSet[t_f].Blur;
        //We keep ImQmin to 0, because we can have a frame with no edges at some point (but not now)
        //ImQmin = (ImQmin > b) ? b : ImQmin;
        ImQmax = (ImQmax < b) ? b : ImQmax;
    }
    let Iq = mapToRange(temp_set.imageQSet[temp_frame].Blur, ImQmin, ImQmax, 0, 1);


    //    let SSs = a1 * (1 - Ss);
    //    let SSt = a1 * (1 - St);

}