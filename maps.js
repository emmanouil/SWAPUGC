"use strict";
var map;
var markers = [];
var marker_icon = 'assets/icon_48px.svg';
var current_zoom = DEFAULT_ZOOM;
var mapOptions; // set inside initMap()



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

var roomPoly; //constructed by roomCoords and roomStyle
var roomCoords = [{
		lat: 53.47266,
		lng: -2.29929
	},
	{
		lat: 53.47279,
		lng: -2.29904
	},
	{
		lat: 53.47263,
		lng: -2.29879
	},
	{
		lat: 53.47251,
		lng: -2.29904
	},
	{
		lat: 53.47266,
		lng: -2.29929
	}
];
var roomStyle = {
	paths: roomCoords,
	draggable: false,
	clickable: false,
	strokeColor: '#FF0000',
	strokeOpacity: 0.8,
	strokeWeight: 2,
	fillColor: '#FF6600',
	fillOpacity: 0.2
};

var orchestraPath; //constructed by orchestraCoords and orchestraStyle
var orchestraCoords = [{
		lat: 53.47274,
		lng: -2.29904
	},
	{
		lat: 53.47272,
		lng: -2.29898
	},
	{
		lat: 53.47269,
		lng: -2.29894
	},
];
var orchestraStyle = {
	path: orchestraCoords,
	draggable: false,
	clickable: false,
	strokeColor: '#FF0000',
	strokeOpacity: 0.5,
	strokeWeight: 10
};

var Marker;

function createMarkerProto() {
	//constructor + prototype from maps api
	Marker = function () {
		google.maps.Marker.apply(this, arguments);
	}
	Marker.prototype = google.maps.Marker.prototype;
	Marker.prototype.constructor = Marker;

	//custom functions
	Marker.prototype.init = function (lat, lng, index, recording_id, bearing, active = false) {
		this.ok = true;
		initMarker(this, lat, lng, index, recording_id, bearing, active);
	}


}

function setControlStyle(control, title) {
	control.style.backgroundColor = '#fff';
	control.style.border = '1px solid grey';
	control.style.borderRadius = '1px';
	//control.style.boxShadow = '0 2px 6px rgba(0,0,0,.3)';
	control.style.cursor = 'pointer';
	control.style.marginBottom = '2px';
	control.style.marginLeft = '4px';
	control.style.marginTop = '1px';
	control.style.textAlign = 'center';
	control.title = title;
}

function setControlTextStyle(control, text) {
	control.style.color = 'rgb(25,25,25)';
	control.style.fontFamily = 'Roboto,Arial,sans-serif';
	control.style.fontSize = '12px';
	control.style.lineHeight = '16px';
	control.style.paddingLeft = '5px';
	control.style.paddingRight = '5px';
	control.style['user-select'] = 'none';
	control.innerHTML = text;
}

//Custom control constructor
function CustomControl(controlDiv, map, c_title, c_text, c_function) {

	// Set CSS for the control border.
	var controlUI = document.createElement('div');
	setControlStyle(controlUI, c_title);
	controlDiv.appendChild(controlUI);

	// Set CSS for the control interior.
	var controlText = document.createElement('div');
	setControlTextStyle(controlText, c_text);

	controlUI.appendChild(controlText);

	// Setup the click event listener
	controlUI.addEventListener('click', c_function);
}



function initMap() {

	mapOptions = {
		center: {
			lat: 48.8263,
			lng: 2.3463
		},
		clickableIcons: false,
		mapTypeControl: false,
		disableDefaultUI: true,
		gestureHandling: "cooperative",
		maxZoom: 20,
		minZoom: 20,
		keyboardShortcuts: false,
		mapTypeId: google.maps.MapTypeId.ROADMAP,
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
		zoom: 20
		/**
		 Zoom levels (approx.)
		 
			1: World
			5: Landmass/continent
			10: City
			15: Streets
			20: Buildings
		
		 */
	};





	map = new google.maps.Map(document.getElementById('map'), mapOptions);
	if (ENABLE_HIGHLIGHTER) {
		document.getElementById('user-svg').style.visibility = "visible";
		map.getDiv().appendChild(document.getElementById('user-svg'));
	} else {
		document.getElementById('user-svg').style.visibility = "hidden";
	}


	//we build the overlay anyway, and if SHOW_ROOM is enabled, we render it
	roomPoly = new google.maps.Polygon(roomStyle);
	orchestraPath = new google.maps.Polyline(orchestraStyle);

	if (SHOW_ROOM) {
		roomPoly.setMap(map);
		orchestraPath.setMap(map);
	}


	//Add custom controls
	//custom control for centering map
	var centerControlDiv = document.createElement('div');
	//	var centerControl = new CenterControl(centerControlDiv, map);
	var centerControl = new CustomControl(centerControlDiv, map, 'Click to recenter the map', 'Center Map', function () {
		centerMap(reference_location[0], reference_location[1]);
	});

	centerControlDiv.index = 1;
	map.controls[google.maps.ControlPosition.TOP_LEFT].push(centerControlDiv);

	//custom control for togggling room overlay
	var toggleControlDiv = document.createElement('div');
	var toggleControl = new CustomControl(toggleControlDiv, map, 'Click to toggle room overlay on/off', 'Toggle Overlay', toggleRoom);

	toggleControlDiv.index = 1;
	map.controls[google.maps.ControlPosition.TOP_LEFT].push(toggleControlDiv);

	//endof add custom controls


	activateMapEvents(); //in events.js
	activateUI(); //in events.js
}

function centerMap(latitude, longitude, zoom) {
	if (!latitude || !longitude) {
		logDEBUG("Lat and/or Lng not set");
		return;
	} else {
		map.panTo({
			lat: latitude,
			lng: longitude
		});
	}

	if (zoom)
		if (zoom > 0 && zoom < 21)
			map.setZoom(zoom);
}

function initMarker(marker, lat, lng, index, recording_id, bearing, active = false) {

	/*
	 * if no coordinates, or recording info, skip the marker
	 */
	if (!lat || !lng || typeof recording_id === 'undefined') {
		logINFO('Marker was not placed on map (check lat, lng, index and recording_id args');
		return;
	}

	marker.title = "Marker " + recording_id;
	marker.index = index;
	marker.recording_id = recording_id;
	
	/*
	 * if no bearing information, use default markers
	 */
	if (bearing) {
		var local_icon = test_icon;
		local_icon.rotation = bearing;
		if (active) {
			local_icon.fillColor = 'green';
		}
		marker.setIcon(local_icon);
	} else if (USE_DEFAULT_MARKERS || (typeof bearing === 'undefined' && USE_NO_BEARING_MARKERS)) {
		logINFO('Initialized default marker (no bearing)');
	} else {
		logERROR('could not initialize ' + marker.title + 'aborting ');
		return;
	}
	marker.setPosition(new google.maps.LatLng(lat, lng));
	marker.setMap(map);
	marker.addListener('click', function () {
		logDEBUG('clicked on marker with title: ' + marker.title + 'of ID: ' + marker.recording_id);
		switchToStream(index, recording_id);
	});
	markers.push(marker);
	globalSetIndex[index].marker = marker;
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
	var label = "Marker " + recording_id;
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
		logDEBUG('clicked on marker with title: ' + marker.title + 'of ID: ' + marker.recording_id);
		switchToStream(index, recording_id);
	});
	markers.push(marker);
	globalSetIndex[index].marker = marker;
}

function updateMarkerOrientation(marker_id, orientation = "none") {
	if (orientation != "none") {
		updateMarkerByID(marker_id, orientation);
		logDEBUG("Updated marker orientation to " + orientation);
	} else {
		logWARN("Did not update orientation of marker with id" + marker_id);
	}
}

//loc should be in the form of {lat: value, lng: value}
function updateMarkerLocation(marker_id, loc = "none") {
	if (loc != "none") {
		updateMarkerByID(marker_id, "none", loc);
		logDEBUG("Updated marker position to " + loc);
	} else {
		logWARN("Did not update location of marker with id" + marker_id);
	}
}

//orientation is just a number (in degrees) - loc should be in the form of {lat: value, lng: value}
function updateMarkerByID(marker_id, orientation = "none", loc = "none") {
	for (var m in markers) {
		if (markers[m].recording_id === marker_id) {
			if (orientation != "none") {
				markers[m].icon.rotation = orientation;
			}
			if (loc != "none") {
				markers[m].setPosition(loc);
			}
			markers[m].setMap(map);
			return;
		}
	}
	logINFO('marker ' + marker_id + ' not found in order to be updated');
}

function highlightMarker(marker_in, highlight = true) {
	let ic = marker_in.icon;
	if (highlight) {
		ic.strokeWeight = 2;
		ic.strokeColor = 'red';
	} else {
		ic.strokeWeight = 1;
		ic.strokeColor = 'black';
	}
	marker_in.setMap(map);
}

function deactivateMarkerClick(marker_in) {
	marker_in.setClickable(false);
	marker_in.icon.fillColor = 'gray';
	marker_in.setMap(map);
}

function activateMarkerClick(marker_in) {
	marker_in.setClickable(true);
	if (globalSetIndex[marker_in.index].descriptor.is_mobile) {
		marker_in.icon.fillColor = 'green';
	} else {
		marker_in.icon.fillColor = 'black';
	}
	marker_in.setMap(map);
}

function toggleRoom() {
	if (SHOW_ROOM) {
		roomPoly.setMap(null);
		orchestraPath.setMap(null);
		SHOW_ROOM = false;
	} else {
		roomPoly.setMap(map);
		orchestraPath.setMap(map);
		SHOW_ROOM = true;
	}
}