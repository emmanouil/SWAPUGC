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
//engine vars
var lastMetricTimestamp = 0;


/**
 * This file contains the definition of the Metrics object, that is present in 
 *  all recording sets and updates during playback
 * 
 */
function Metrics() {
    //Shakiness (actually this is 1 - Ss)
    this.Ss = 0;
    //Tilt (actually this is 1 - St)
    this.St = 0;
    //Bitrate
    this.Vb = 0;
    //Image Quality (blur)
    this.Iq = 0;
    //Link Reliability
    this.Lr = 0;
    //Total Score
    this.S = 0;
    //Timestamp (wrt video timeline)
    this.t_video = 0;
    //Timestamp (wrt start of stream)
    this.t_abs = 0;
}

function logMetrics() {
    if (lastMetricTimestamp != p.v.currentTime) {
        lastMetricTimestamp = p.v.currentTime;
    } else {
        logWARN('last metric timestamp: ' + lastMetricTimestamp + '. current timestamp: ' + p.v.currentTime + '. skipping metric');
        return;
    }
    for (let i = 0; i < globalSetIndex.length; i++) {
        let tmp_m = new Metrics();
        tmp_m.Ss = getShakinessMetric(i);
        tmp_m.St = getTiltMetric(i);
        tmp_m.Vb = getBitrateMetric(i);
        tmp_m.Iq = getImageQualityMetric(i);
        tmp_m.Lr = 0; //TODO
        tmp_m.S = calculateScore(tmp_m.Ss, tmp_m.St, tmp_m.Vb, tmp_m.Iq, tmp_m.Lr);
        tmp_m.t_video = p.v.currentTime;
        tmp_m.t_abs = (p.v.currentTime - globalSetIndex[i].descriptor.tDiffwReferenceMs / 1000);
        globalSetIndex[i].metrics.push(tmp_m);
    }
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
    for (let i = 0; i < globalSetIndex.length; i++) {
        console.log(i + ' Score: ' + getScore(i));
    }
}

function flushMetricsJSON() {
    var metrics_to_print = [];
    for (let i = 0; i < globalSetIndex.length; i++) {
        downloadFile(globalSetIndex[i].id + '_metrics.json', JSON.stringify(globalSetIndex[i].metrics));
    }
}

function flushMetricCSV(metric_type) {
    var rows = [];
    var t_row = ['video t (ms)'];
    for (let i = 0; i < globalSetIndex.length; i++) {
        t_row.push(globalSetIndex[i].id);
    }
    rows.push(t_row)
    for (let i = 0; i < globalSetIndex[0].metrics.length; i++) {
        let row = [];
        row.push(globalSetIndex[0].metrics[i].t_video);
        for (let j = 0; j < globalSetIndex.length; j++) {
            row.push(globalSetIndex[j].metrics[i][metric_type]);
        }
        rows.push(row);
    }
    rows.forEach(function (row) {
        row.join(', ');
    });
    let string_to_print = rows.join('\n');
    downloadFile(metric_type + '_metric.csv', string_to_print);
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

//returns if the current camera is filming the ROI
function getFoVMetric(index_in) {
    return globalSetIndex[index_in].inFoV;
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

    let Lr = 0; //TODO not implemented yet

    let finalScore = calculateScore(Ss, St, Vb, Iq, Lr);

    return finalScore;
}

function calculateScore(Ss, St, Vb, Iq, Lr) {
    return a1 * (1 - Ss) + a2 * (1 - St) + a3 * Vb + a4 * Iq + a5 * Lr;
}