"use strict";
var isPlaying = false;

//TODO depricated - not used currently
function initVideo() {
	video.muted = true;
	// Capture the play event
	video.addEventListener("play", function () {
		if (isPlaying) {
			console.log("Play RESUME");
		} else {
			console.log("Play FIRST");
		}
		console.log("Play - seeking:" + video.seeking);
	}, false);

	video.addEventListener("playing", function () {
		console.log("PlayING - empty");
	}, false);

	// Capture the pause event
	video.addEventListener("pause", function () {
		console.log("pause");
	}, false);

	// Capture the seek (start) event
	video.addEventListener("seeking", function () {
		console.log("seeking - empty");
	}, false);
	/*
		 // Capture the seek (end) event
		 video.addEventListener("seeked", function () {
		   seekCheckPoint();
					 console.log( "seek - seekend");
		 }, false);
		 */
}