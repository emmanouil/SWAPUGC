"use strict";
var globalSetIndex = [];
var p = {};
var msg_div = document.getElementById('messages_div');
const SHOW_DEBUG = true;
const LOG_LVL = 4; //0: all, 1: INFO, 2: WARN, 3: ERR, 4: NONE
//extend Array prototype to remove 'deleteValue' (call with undefined to keep only defined elements)
Array.prototype.clean = function (deleteValue) {
    for (var i = 0; i < this.length; i++) {
        if (this[i] == deleteValue) {
            this.splice(i, 1);
            i--;
        }
    }
    return this;
};

function logUI(msg) {
    logINFO(msg);
    msg_div.innerText = "INFO: " + msg;
}

function logERR(msg) {
    if (LOG_LVL > 3) return;
    if (typeof msg === 'string') { //we have an error message string
        console.error("[ERROR] " + msg);
    } else { //we have an Error
        console.error(msg);
    }
}

function logWARN(msg) {
    if (LOG_LVL > 2) return;
    console.warn("[WARNING] " + msg);
}

function logINFO(msg) {
    if (LOG_LVL > 1) return;
    console.info("[INFO] " + msg);
}

function logDEBUG(msg) {
    if (LOG_LVL > 0) return;
    if (SHOW_DEBUG)
        console.debug("[DEBUG] " + msg);
}

/**
 * check if a file exists without actually fetching it
 * @param {*} url url to check if it exists 
 */
function ajax_url_exists(url) {
    let req = new XMLHttpRequest();
    req.open('HEAD', url, false);
    req.send();
    return req.status != 404;
}

/**
 * Like fetch(), but asserts and returns only the response
 * @param {*} what asset location
 * @param {*} where function to be called with the result
 * @param {*} resp_type default: 'no-type'
 * @param {*} args arguments to be passed to the <where>
 */
function fetch_res(what, where, resp_type = 'no-type') {
    logDEBUG("fetching " + what + "   for " + where.name);
    if (what.length < 2) {
        logERR("erroneous request");
    }
    var req = new XMLHttpRequest();
    req.addEventListener("load", function () {
        assert_fetch(req, where);
    });


    req.open("GET", what);
    if (resp_type != 'no-type') {
        req.responseType = resp_type;
    }

    req.send();
}

/**
 * Promise implementation of fetch()
 * @param {*} what asset location
 * @param {String} resp_type default: 'no-type'
 * @param {Boolean} full_request default: false, send the request (with the response), regardless of success
 */
function fetch_promise(what, resp_type = 'no-type', full_request = false) {

    return new Promise(function (resolve, reject) {
        if (what.length < 2) {
            logERR("erroneous request");
        }
        var req = new XMLHttpRequest();

        req.onload = function () {
            var resp;
            if (full_request && req.status === 200) {
                resolve(req);
            } else if (req.status === 200) {
                resolve(req.response);
            } else {
                logERR(req.statusText);
                reject(Error('Request for ' + what + ' failed. Error: ' + req.statusText));
            }
        };
        req.onerror = function () {
            logERR(req.statusText);
            reject(Error('Request for ' + what + ' failed. Netowork error: ' + req.statusText));
        };


        req.open("GET", what);
        if (resp_type != 'no-type') {
            req.responseType = resp_type;
        }

        req.send();
    });
}

/**
 * Returns true if the file was successufully fetched
 * Return false and prints error message otherwise
 */
function assert_fetch(response, target) {
    if (response.status != 200) {
        logERR("could NOT fetch file " + response.responseURL + " for " + target + "   . Error: " + response.status + " " + response.statusText);
        return false;
    } else {
        logDEBUG("fetched " + response.responseURL + " of type " + ", for function " + target.name);
    }
    target(response.response);
    return true;
}

function calcBearing(lat1, lng1, lat2, lng2) {
    var y = Math.sin(lat2 - lat1) * Math.cos(lng2);
    var x = Math.cos(lng1) * Math.sin(lng2) -
        Math.sin(lng1) * Math.cos(lng2) * Math.cos(lat2 - lat1);
    var brng = Math.atan2(y, x); //in rad
    var brngDgr = brng / (Math.PI / 180);
    return brngDgr;
}

function calcDistanceBetweenCoords(lat1, lng1, lat2, lng2) {
    var earthRadiusM = 6371000;

    var dLat = degToRad(lat2 - lat1);
    var dLon = degToRad(lng2 - lng1);

    lat1 = degToRad(lat1);
    lat2 = degToRad(lat2);

    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusM * c;
}

function radToDeg(rad_in) {
    return rad_in / (Math.PI / 180);
}

function degToRad(rad_in) {
    return rad_in * (Math.PI / 180);
}

function getSetByVideoId(id_in) {
    for (let item in globalSetIndex) {
        if (globalSetIndex[item].id === id_in.toString())
            return globalSetIndex[item];
    }
}

function disable_btn_for(btn_name, dur) {
    document.getElementById(btn_name).disabled = true;
    setTimeout(function () {
        document.getElementById(btn_name).disabled = false;
    }, dur);
}