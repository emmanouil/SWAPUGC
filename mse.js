"use strict";
/*
    This file contains MSE-related functions
    It assumes that a MediaSource has been created (mediaSource) and assigned a .video with a compatible .src
*/
var sourceBuffer;


//Adds a sourceBuffer when the mediaSource is ready for the first time
function onSourceOpen(mime_codec) {

    if (mediaSource.video.canPlayType(mime_codec) == "") {
        logERR('Mime codec ' + mime_codec + ' is not supported. SourceBuffer will not be added to MSE');
    }

    if (mediaSource.sourceBuffers.length > 0) {
        logWARN('onSourceOpen called with mediaSource.sourceBuffers.length > 0');
        return;
    }

    sourceBuffer = mediaSource.addSourceBuffer(mime_codec);
    sourceBuffer.ms = mediaSource;

    sourceBuffer.addEventListener('onerror', function (e) {
        logERR('Error on sourceBuffer');
        logERR(e);
    }, { once: false });


    sourceBuffer.addEventListener('onabort', function (e) {
        logWARN('Abort ofsourceBuffer');
        logWARN(e);
    }, { once: false });


    //We also add the init element
    if (sourceBuffer.updating) {
        sourceBuffer.addEventListener('updateend', function () {
            fetch_res(DASH_DIR + '/' + globalSetIndex[PLAYLIST_MAIN_VIEW_INDEX].mpd.init_seg, addSegment, "arraybuffer");
        }, { once: true });
    } else {
        fetch_res(DASH_DIR + '/' + globalSetIndex[PLAYLIST_MAIN_VIEW_INDEX].mpd.init_seg, addSegment, "arraybuffer")
    }
}

//Append the initialization segment.
function addSegment(seg_in) {
    if (seg_in == null) {
        // Error fetching the initialization segment. Signal end of stream with an error.
        console.log("[ERROR] endofstream?")
        mediaSource.endOfStream("network");
        return;
    }

    sourceBuffer.appendBuffer(seg_in);
    //    playlistPosition++;
    //    sourceBuffer.addEventListener('updateend', handleNextPlElement, { once: false });
}

//Returns the number of TimeRage objects of the SourceBuffer
function getSourceBufferTimeRangeNumber(){
    return sourceBuffer.buffered.length;
}

//Return the end time (in sec) of the SourceBuffer contents
function getSourceBufferEnd() {
    if (sourceBuffer.buffered.length == 0) {
        logWARN("SourceBuffer is empty (contains no TimeRanges");
        return -1;
    } else if (sourceBuffer.buffered.length > 1) {
        logWARN("SourceBuffer contains multiple TimeRanges - returning the end of the first one");
    }
    return sourceBuffer.buffered.end(0);
}

//Get/set timestamp offset for sourcebuffer
function getTimeStampOffset(){
    return sourceBuffer.timestampOffset;
}
function setTimeStampOffset(t_in){
    sourceBuffer.timestampOffset = t_in;
}