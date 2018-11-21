'use strict';
/**
 * Server object, that holds references
 * to vars and Sources used to simulate delivery environment
 * 
 */
function Server(video_element, media_source) {
    this.sources = [];
    this.buffer_size = NaN; //from server to clients
    this.latency = NaN; //from server to clients
}

/**
 * Source object, that holds references
 * to vars and Representations used to simulate delivery environment
 * 
 */
function Source(id, index) {
    this.available = true;
    this.id = id;
    this.index = index;
    this.representations = [];
    this.buffer_size = NaN; //from source to server
    this.latency = NaN; //from source to server
}

/**
 * Representations object, that holds
 * to vars used to simulate delivery environment
 * 
 */
function Representation(index, bandwidth, id, width, height) {
    this.available = true;
    this.index = index;
    this.bandwidth = bandwidth;
    this.id = id;
    this.width = width;
    this.height = height;
}