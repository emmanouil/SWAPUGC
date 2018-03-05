"use strict";
var map;
var markers = [];
var marker_icon = 'assets/icon_48px.svg';
var current_zoom = DEFAULT_ZOOM;

//we use this for now
var test_icon = {
	path: 'm 0,12 h 14 v 2 H 0 z M 7,0 0.33,10 h 13.34 z',
	//  d="m 0,17 h 14 v 2 H 0 z M 7,5 0.33,15 h 13.34 z"	//left
	//	d="m 0,12 h 14 v 2 H 0 z M 7,0 0.33,10 h 13.34 z"	//top left
	//	path: 'm 5,22 h 14 v 2 H 5 z M 12,10 5.33,20 h 13.34 z',	//original
	//    strokeColor: '#F00',
	fillColor: '#000',
	fillOpacity: 1
};

function initMap() {
	map = new google.maps.Map(document.getElementById('map'), {
		center: {
			lat: -34.397,
			lng: 150.644
		},
		mapTypeControl: true,
		mapTypeControlOptions: {
			style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
			mapTypeIds: [
				google.maps.MapTypeId.ROADMAP,
				google.maps.MapTypeId.TERRAIN,
				google.maps.MapTypeId.HYBRID,
				google.maps.MapTypeId.SATELLITE,
			]
		},
		scaleControl: true,
		zoom: 10
		/**
		 Zoom levels (approx.)
		 
			1: World
			5: Landmass/continent
			10: City
			15: Streets
			20: Buildings
		
		 */
	});
	if (ENABLE_HIGHLIGHTER) {
		document.getElementById('user-svg').style.visibility = "visible";
		map.getDiv().appendChild(document.getElementById('user-svg'));
	} else {
		document.getElementById('user-svg').style.visibility = "hidden";
	}

	activateMapEvents();	//in events.js
	activateUI();	//in events.js
}

function centerMap(latitude, longitude, zoom) {
	if (!latitude || !longitude) {
		console.log("Lat and/or Lng not set");
		return;
	} else {
		map.panTo({ lat: latitude, lng: longitude });
	}

	if (zoom)
		if (zoom > 0 && zoom < 21)
			map.setZoom(zoom)
}

function addLiveMarker(lat, lng, index, recording_id, bearing, active = false) {

	/*
	 * if no coordinates, or recording info, skip the marker
	 */
	if (!lat || !lng || typeof recording_id === 'undefined') {
		logINFO('Marker was not placed on map (check lat, lng, index and recording_id args');
		return;
	}

	var marker;

	/*
	 * if no bearing information, use default markers
	 */
	if (USE_DEFAULT_MARKERS || (typeof bearing === 'undefined' && USE_NO_BEARING_MARKERS)) {
		var marker1 = new google.maps.Marker({
			position: new google.maps.LatLng(lat, lng),
			title: label
		});
		marker1.setMap(map);
		marker1.addListener('click', function () {
			console.log("click to no bearing marker");
			switchToStream(index, recording_id);
		});
		markers.push(marker1);
		return;
	} else if (bearing) {
		var label = "Marker " + recording_id;
		var local_icon = test_icon;
		local_icon.rotation = bearing;
		if (active) {
			local_icon.fillColor = 'green';
		}
		marker = new google.maps.Marker({
			position: new google.maps.LatLng(lat, lng),
			title: label,
			icon: local_icon
		});
	}

	marker.setMap(map);
	marker.index = index;
	marker.recording_id = recording_id;
	marker.addListener('click', function () {
		console.log("click");
		switchToStream(index, recording_id);
	});
	markers.push(marker);
	globalSetIndex[index].marker = marker;
}


function updateMarkerByLabel(marker_label, orientation) {
	for (var m in markers) {
		if (markers[m].title.split(' ')[1] == marker_label.split(' ')[0]) {
			markers[m].icon.rotation = orientation;
			markers[m].setMap(map);
			return;
		}
	}
	logINFO('marker ' + marker_label + ' not found in order to be updated');
}