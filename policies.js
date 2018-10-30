"use strict";
/* global globalSetIndex */ //standard supported by Firefox and Chrome (not IE)
/* global sourceBuffer */ //in mse.js


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