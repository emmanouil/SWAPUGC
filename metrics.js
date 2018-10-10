'use strict';

//Score weights
const a1 = 0.20; //Shakiness
const a2 = 0.20; //Tilt/Yaw
const a3 = 0.20; //Bitrate
const a4 = 0.20; //Image Quality
const a5 = 0.20; //Link Reliability
//Score ranges
const maxTilt = 5; //Tilt (in degrees) more/less than maxTilt scores 0
const shakeScale = [0, 5]; //The min and max of the shake values


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


function calculateRanking() {
    let ranking = [globalSetIndex.length];
    console.log(ranking)

}

//returns Shakiness metric (Ss)
function getShakinessMetric(index_in) {
    let temp_set = globalSetIndex[index_in];
    let Ss;
    Ss = mapToRange(temp_set.lastShake.Shake, shakeScale[0], shakeScale[1], 0, 1);    
    return Ss;
}

//returns Tilt metric (St)
function getTiltMetric(index_in) {
    let temp_set = globalSetIndex[index_in];

    let St;
    if (Math.abs(temp_set.lastTilt.Tilt) > maxTilt) {
        St = 1;
    } else {
        St = mapToRange(Math.abs(temp_set.lastTilt.Tilt), 0, maxTilt, 0, 1);
    }
    return St;
}

//returns Bitrate metric (Vb)
function getBitrateMetric(index_in) {
    let temp_set = globalSetIndex[index_in];

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
    //TODO should we map it wrt to 0, wrt to minBitrate, or global minBitrate?
    return Vb;
}

//returns Image Quality metric (Iq)
function getImageQualityMetric(index_in) {
    let temp_frame = parseInt(p.v.currentTime - globalSetIndex[index_in].descriptor.tDiffwReferenceMs / 1000);
    let temp_set = globalSetIndex[index_in];

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
    return Iq;
}


function getScore(index_in) {
    let temp_frame = parseInt(p.v.currentTime - globalSetIndex[index_in].descriptor.tDiffwReferenceMs / 1000);
    let temp_set = globalSetIndex[index_in];

    let Ss = getShakinessMetric(index_in); //this is the metric
    let SSs = 1 - Ss; //this is the actual score (without the weight)

    let St = getTiltMetric(index_in); //this is the metric
    let SSt = 1 - St; //this is the actual score (without the weight)

    let Vb = getBitrateMetric(index_in); //this is the metric & score (without the weight)

    let Iq = getImageQualityMetric(index_in); //this is the metric & score (without the weight)

    let Lr = 1; //TODO not implemented yet

    let finalScore = a1 * SSs + a2 * SSt + a3 * Vb + a4 * Iq + a5 * Lr;

    return finalScore;
    //    let SSs = a1 * (1 - Ss);
    //    let SSt = a1 * (1 - St);

}