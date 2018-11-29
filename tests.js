"use strict";
//Scenes
const test_interval_min = 4000; //scene duration
const test_interval_max = 12000; //scene duration
var test_interval_id; //stores the setInterval id

//Network
//Representation switches
const Qswitch_interval_t = 4000; //interval between representation/quality switches
var Qswitch_interval_id = 0;
var last_Qswitch_timestamp = 0;
//const P_of_Qswitch = [0.05, 0.05, 0.1, 0.1, 0.2, 0.2, 0.3, 0.3]; //probability of changing quality after the interval
//const L_quality_good = [true, false, true, false, true, false, true, false]; //if the quality of the link is good, it has higher P to return to HiQ
const P_of_Qswitch = [0.01, 0.3, 0.01, 0.3, 0.01, 0.01, 0.3, 0.01]; //probability of changing quality after the interval
const L_quality_good = [true, false, true, false, true, true, false, true]; //if the quality of the link is good, it has higher P to return to HiQ
//Disconnects
const n_for_Disconnect = 3; //after how many view changes should we disconnect
const t_of_Disconnect = 2000; //how long after the change shall we disconnect
var view_switches = 0;

//Test Scenarios
//test id
var test_id = null; //set when a test is running
//Adaptive streaming
var DASH_POLICY = 'NONE'; //initialized when test stats [accepted values: 'CONSERVATIVE' or 'AGGRESSIVE']


//------- START OF 00000 --------
//TEST 1 
//Environment: HiQ
//Selection: Baseline - Fov Only

function test1() {
    test_1_getSwitchStream();
    //test_interval_id = setTimeout(test1, getRandomInt(test_interval_min, test_interval_max));
    testVTT(getRandomInt(test_interval_min, test_interval_max) / 1000, 1);
}

function test_1_getSwitchStream() {
    let streams = test_1_streamselect();
    let stream_index = getRandomInt(0, streams.length);
    let s = streams[stream_index];
    switchToStream(s.index, s.id);
    return s;
}

//returns ALL streams that: film ROI, are not selected and are not static (i.e. no cinematic and no score)
function test_1_streamselect() {
    //Filter streams (that do not film the ROI)
    let filteredStreams = filterStreams();

    //Cinematic (history only)
    let last_scene = scenes[scenes.length - 1];
    let passed_streams = [];
    for (let i = 0; i < filteredStreams.length; i++) {
        let s_i = filteredStreams[i];
        //check if previously selected
        if (last_scene && (last_scene.currentStreamId == s_i.id || last_scene.previousStreamId == s_i.id)) {
            continue;
        }
        passed_streams.push(s_i);
    }

    //remove static streams
    passed_streams = removeStatic(passed_streams);

    return passed_streams;
}



//------- START OF 00000 --------
//TEST 2 
//Environment: HiQ
//Selection: Sensor-Only - No Lr - with Cinematic
function test2() {
    test_2_getSwitchStream();
    //setInterval(test_2_getSwitchStream, test_interval_t);
    testVTT(getRandomInt(test_interval_min, test_interval_max) / 1000, 2);
}

function test_2_getSwitchStream() {
    let s = test_2_streamselect();
    switchToStream(s.index, s.id);
    return s;
}

//Returns 1 single stream, selected on cinematic + score without Lr
function test_2_streamselect() {
    //Filter streams (that do not film the ROI)
    let filteredStreams = filterStreams();

    //remove static streams
    filteredStreams = removeStatic(filteredStreams);

    //Calculate score (without Lr)
    for (let i = 0; i < filteredStreams.length; i++) {
        filteredStreams[i].score = getScore(filteredStreams[i].index, false);
    }

    //Sort them according to score (descenting)
    filteredStreams.sort(function (a, b) {
        return b.score - a.score;
    });

    let sel_ected = evaluateCinematic(filteredStreams);
    return sel_ected;
}




//------- START OF 00000 --------
//TEST 3
//Environment: VarQ
//Selection: Sensor-Only - No Lr - with Cinematic
function test3() {
    if (Qswitch_interval_id == 0) {
        Qswitch_interval_id = start_Q_switches();
    }
    let id_i = test_3_getSwitchStream();
    let pos = getRankingPosition(id_i.id);
    console.log(pos);
    if (pos == 1) { //the next stream is the "best" atm
        testVTT(test_interval_max / 1000, 3);
    } else if (pos < 4) { //it is "good"
        testVTT(((test_interval_min + test_interval_max) / 2) / 1000, 3);
    } else { //it is bad
        testVTT(test_interval_min / 1000, 3);
    }
}

//Returns 1 single stream, FULL criteria + cinematic
function test_3_getSwitchStream() {
    let s = test_2_streamselect();
    switchToStream(s.index, s.id);
    return s;
}




//------- START OF 00000 --------
//TEST 4
//Environment: VarQ
//Selection: Full
function test4() {
    if (Qswitch_interval_id == 0) {
        Qswitch_interval_id = start_Q_switches();
    }
    let id_i = test_4_getSwitchStream();
    let pos = getRankingPosition(id_i.id);
    console.log(pos)
    if (pos == 1) { //the next stream is the "best" atm
        testVTT(test_interval_max / 1000, 4);
    } else if (pos < 4) { //it is "good"
        testVTT(((test_interval_min + test_interval_max) / 2) / 1000, 4);
    } else { //it is bad
        testVTT(test_interval_min / 1000, 4);
    }
}

//Returns 1 single stream, FULL criteria + cinematic
function test_4_getSwitchStream() {
    //Filter streams (that do not film the ROI)
    let filteredStreams = filterStreams();

    //remove static streams
    filteredStreams = removeStatic(filteredStreams);

    //Calculate score
    for (let i = 0; i < filteredStreams.length; i++) {
        filteredStreams[i].score = getScore(filteredStreams[i].index);

        if (filteredStreams[i].index == 2 || filteredStreams[i].index == 6) {
            let test_streams_todo = globalSetIndex[filteredStreams[i].index]
            if (test_streams_todo.stats.last_switch_t + 30 > p.v.currentTime) {
                console.log('penalty for ' + test_streams_todo.id);
                filteredStreams[i].score = 0.1
            }

        }
    }

    //Sort them according to score (descenting)
    filteredStreams.sort(function (a, b) {
        return b.score - a.score;
    });

    let sel_ected = evaluateCinematic(filteredStreams);

    switchToStream(sel_ected.index, sel_ected.id);

    return sel_ected;
}








//------- START OF 00000 --------
//TEST 5
//Environment: Disconnects
//Selection: Nearest
function test5() {
    view_switches++;
    let s = test_2_streamselect();
    switchToStream(s.index, s.id);
    let pos = getRankingPosition(s.id);
    console.log(pos)
    if (pos == 1) { //the next stream is the "best" atm
        testVTT(test_interval_max / 1000, 5);
    } else if (pos < 4) { //it is "good"
        testVTT(((test_interval_min + test_interval_max) / 2) / 1000, 5);
    } else { //it is bad
        testVTT(test_interval_min / 1000, 5);
    }
    if (view_switches % 3 == 0) {
        simulate_disconnect_nearest();
    }
}







//------- START OF 00000 --------
//TEST 6
//Environment: Disconnects
//Selection: Full
function test6() {
    view_switches++;
    let s = test_2_streamselect();
    switchToStream(s.index, s.id);
    let pos = getRankingPosition(s.id);
    console.log(pos)
    if (pos == 1) { //the next stream is the "best" atm
        testVTT(test_interval_max / 1000, 5);
    } else if (pos < 4) { //it is "good"
        testVTT(((test_interval_min + test_interval_max) / 2) / 1000, 5);
    } else { //it is bad
        testVTT(test_interval_min / 1000, 5);
    }
    if (view_switches % 3 == 0) {
        simulate_disconnect_nearest();
    }
    return null;
}













//------ LINK SIMULATION -----
//------------------------------
//

function start_Q_switches() {
    return setInterval(start_link_flunctuations, Qswitch_interval_t);
}

function start_link_flunctuations() {

    if (last_Qswitch_timestamp == p.v.currentTime) {
        logINFO('skipping Quality Switch check');
        return;
    }

    for (let i = 0; i < s.sources.length; i++) {
        let tmp_P = P_of_Qswitch[i];
        let tmp_switch = false;
        let tmp_Lq = L_quality_good[i];

        if (s.sources[i].representations[0].isAvailable) { //we are at best quality
            tmp_switch = should_switch(tmp_P);
        } else if (tmp_Lq) { //we are at a bad quality but it's a "good-quality" link
            tmp_switch = should_switch(tmp_P + 0.5);
        } else { //we are at a bad quality with a normal stream
            tmp_switch = should_switch(tmp_P);
        }

        if (tmp_switch && s.sources[i].representations[0].isAvailable) { //Q down
            s.sources[i].representations[0].isAvailable = false;
            s.sources[i].representations[1].isAvailable = false;
        } else if (tmp_switch) { //Q up
            s.sources[i].representations[0].isAvailable = true;
            s.sources[i].representations[1].isAvailable = true;
        }
    }
    last_Qswitch_timestamp = p.v.currentTime;
}


/*
function start_Q_switches() {
    return setInterval(switch_representations, Qswitch_interval_t);
}

function switch_representations() {
    if (last_Qswitch_timestamp == p.v.currentTime) {
        logINFO('skipping Quality Switch check');
        return;
    }
    for (let i = 0; i < globalSetIndex.length; i++) {
        let tmp_P = P_of_Qswitch[i];
        let tmp_switch = false;
        let tmp_Lq = L_quality_good[i];

        if (globalSetIndex[i].ActiveRepresentation == 0) { //we are at best quality
            tmp_switch = should_switch(tmp_P);
        } else if (tmp_Lq) { //we are at a bad quality but it's a "good-quality" link
            tmp_switch = should_switch(tmp_P + 0.5);
        } else { //we are at a bad quality with a normal stream
            tmp_switch = should_switch(tmp_P);
        }

        if (tmp_switch && globalSetIndex[i].ActiveRepresentation == 0) { //Q down
            globalSetIndex[i].ActiveRepresentation = 2;
        } else if (tmp_switch) { //Q up
            globalSetIndex[i].ActiveRepresentation = 0;
        }
    }
    last_Qswitch_timestamp = p.v.currentTime;
}
*/
function simulate_disconnect_best() {
    logINFO('simulating disconnect in ' + t_of_Disconnect + 'ms');
    return setTimeout(test_2_getSwitchStream, 3000);
}

function simulate_disconnect_nearest() {
    logINFO('simulating disconnect in ' + t_of_Disconnect + 'ms');
    return setTimeout(switch_nearest, 3000);
}

function switch_nearest() {

    logINFO('finding nearest disconnect stream');
    //Filter streams (that do not film the ROI)
    let filteredStreams = filterStreams();

    //remove static streams
    filteredStreams = removeStatic(filteredStreams);

    //find nearest stream(s)
    filteredStreams = getNearest(filteredStreams);

    //Calculate score (without Lr)
    for (let i = 0; i < filteredStreams.length; i++) {
        filteredStreams[i].score = getScore(filteredStreams[i].index, false);
    }

    //Sort them according to score (descenting)
    filteredStreams.sort(function (a, b) {
        return b.score - a.score;
    });

    logINFO('closest is ' + filteredStreams[0].id + ' out of ' + filteredStreams.length);
    switchToStream(filteredStreams[0].index, filteredStreams[0].id);

}

//------ GENERIC FUNCTIONS -----
//------------------------------
//

//inputs a list of streams {id, index} and returns a list of streams excluding the static (comparing against gSetIndex)
function removeStatic(streams_in) {
    let s_out = [];
    for (let i = 0; i < streams_in.length; i++) {
        if (globalSetIndex[streams_in[i].index].descriptor.is_mobile) {
            s_out.push(streams_in[i]);
        }
    }
    return s_out;
}

//inputs the probability for a switch and returns true or false
function should_switch(P_i) {
    if (Math.random() < P_i) {
        return true;
    }
    return false;
}

//gets a stream id and returns its position in the ranking (excluding irrelevant and static)
function getRankingPosition(id_in) {
    //Filter streams (that do not film the ROI)
    let filteredStreams = filterStreams();

    //remove static streams
    filteredStreams = removeStatic(filteredStreams);

    //Calculate score
    for (let i = 0; i < filteredStreams.length; i++) {
        filteredStreams[i].score = getScore(filteredStreams[i].index);
    }

    //Sort them according to score (descenting)
    filteredStreams.sort(function (a, b) {
        return b.score - a.score;
    });

    return (filteredStreams.findIndex(x => x.id == id_in) + 1);
    /*
        for (let i = 0; i < filteredStreams.length; i++) {
            if (id_in == filteredStreams[i].id) {
                return i + 1;
            }
        }
        */
}

//adds a VTTCue on the main track
function testVTT(t, testID) {
    //we add the end time event at the textTrack of reference view
    let vtc = new VTTCue(p.v.currentTime + t, p.v.currentTime + t + 1, "{ \"Event\": \"test_switch\", \"TestId\": \"" + testID + "\" }");
    vtc.id = "Event";
    for (let i = 0; i < main_view_tracks.length; i++) {
        if (main_view_tracks[i].label === reference_recordingID) {
            main_view_tracks[i].addCue(vtc);
            return;
        }
    }
}

//event callback
function testEvent(i) {
    switch (i) {
        case 1:
            test1();
            break;
        case 2:
            test2();
            break;
        case 3:
            test3();
            break;
        case 4:
            test4();
            break;
        case 5:
            test5();
            break;
        case 6:
            test6();
            break;
        default:
            logERR('test id not recognized');
    }
}