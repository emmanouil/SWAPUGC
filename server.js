'use strict';
/**
 * Server object, that holds references
 * to vars and Sources used to simulate delivery environment
 * 
 */
function Server() {
    this.sources = [];
    this.buffer_size = NaN; //from server to clients
    this.latency = NaN; //from server to clients
}


Server.prototype.addSource = function (source_in) {
    this.sources.push(source_in);
};

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


Source.prototype = {
    addRepresentation: function (rep_in) {
        this.representations.push(rep_in);
    },
    get isAvailable() {
        return this.available;
    },
    set isAvailable(i) {
        this.isAvailable = i;
    }
};

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

Representation.prototype = {
    get isAvailable() {
        return this.available;
    },
    set isAvailable(i) {
        this.available = i;
    }
};