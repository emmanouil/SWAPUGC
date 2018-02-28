# SWAPUGC

SWAPUGC: **S**oft**w**are for **A**daptive **P**layback of Geotagged **U**ser-**G**enerated **C**ontent

## About

This repository contains a browser-based platoform for viewing content recorder with spatiotemporal information.

The client is a modified version of the client used for the _"Extended Video Streams for Spatiotemporal Video Navigation"_, presented at The Graphical Web 2016 ([slides](https://emmanouil.wp.imt.fr/files/2017/03/Extended-Video-Streams-for-Spatiotemporal-Navigation.pdf) [video](https://www.youtube.com/watch?v=iUhGZV9SSiM)), part of the project _"Streaming And Presentation Architectures for Extended Video Streams"_ ([short-paper](https://www.researchgate.net/publication/317593679_Streaming_and_Presentation_Architectures_for_Extended_Video_Streams)) showcased at the TVX '17.

## Architecture flow of the client
When the client is launched it does the following, in the corresponding order:
1. Load items from the _playlist.txt_, containing the _NAMEOFFILE_ of relevant recordings. And then, for each _NAMEOFFILE_ entry:
    1. Construct `globalSetIndex` where all the information/data on the recordings is placed
    2. Fetch the corresponding _NAMEOFFILE_`_DESCRIPTOR.json` file, containing information on the recordings about its timing, location of its video / location / orientation files.
    3. Fetch the corresponding _NAMEOFFILE_`_dash.mpd` file
2. Fetch _NAMEOFFILE_`_LOC.json` containing the location data (placed in the `globalSetIndex`)
3. Fetch _NAMEOFFILE_`_ORIENT.json` containing the orientation data (placed in the `globalSetIndex`)
4. With the acquired timed location/orientation pairs
    1. Place the markers on the map from the location/orientation pairs
    2. Add the cues for updating the markers
5. Fetch _NAMEOFFILE_`_dash.mpd` with the information on the segmented files (placed in the `globalSetIndex`)
6. Adjust MSE accordingly



## Demo
To run a local demo, start a server on the top dir and navigate to `index.html`


## Generate Compatible Files

### UGC recorder (video + sensors)

A compatible UGC recorder Android application that can be used, is available [here](https://github.com/emmanouil/Spatiotemporal-Navigation-Recorder)

### Generate DASH-compatible Segmented Video Files

For the demo we used MP4Box of the [GPAC](gpac.io) suite, but other tools (like ffmpeg) should work.
With MP4Box, an example command to generate 2s-long segments would be: 
`MP4Box -frag 2000 -dash 2000 -segment-name file_out_seg_ file_in.mp4`

### Format XML sensor data (compatible with ICoSOLE dataset)

File `parser_single_file` located inside the `tool` dir will generate files, from XML files, as those used in the demo, taken by the [ICoSOLE](http://www.bbc.co.uk/rd/blog/2014-04-icosole-test-shoot) project (project repository [here](https://icosole.lab.vrt.be/viewer/))

#### Using The Parser

`parser_single_file` run with the name _NAMEOFFILE_ as an argument (without extension). For example, for a file ABC123.mp4 in the folder 'parsing', it should be executed as `python3 parser_single_file.py parsing/ABC123`. Each entry should have at least a video file and an associated EbuCore timing file (in xml)

#### Parser Output

1. _NAMEOFFILE_`_DESCRIPTOR.json`, containing information about the recording
2. _NAMEOFFILE_`_ORIENT.json`, containg the timestamped orientation samples of the recording
3. _NAMEOFFILE_`_LOC.json`, containg the timestamped location samples of the recording


=====
### Platform-specific data used

####Global Pairs Holder
global variable name: ```globalSetIndex```
decription: an Array of recordings - the Location/Sensor Pair Objects of each recording are stored in the ```set``` field)
```JSON
    {
        id: "1234567_12345"
        index: 0
        set: Array[12]
        textFile: "OUT_1234567_12345.txt"
        textFileURL: "http://137.194.232.162:8080/parsing/OUT_1234567_12345.txt"
        videoFile: "OUT_1234567_12345.mp4"
    }
```


####Location and Sensor Pairs
decription: An Object holding Orientation and Location information for a POI
```JSON
    {
        "id": 1,
        "Sensor": {
            "Y": -0.083974324,
            "LocalTimestamp": 1466187515309,
            "Type": "ORIENTATION",
            "X": 2.5136049,
            "Z": -1.4016464
        },
        "Location": {
            "Time": 1466187920000,
            "LocalNanostamp": 27814219216825,
            "Longitude": 2.3506619881858737,
            "Latitude": 48.83000039044928,
            "Altitude": 111.77508694140864,
            "Bearing": 213.30880737304688,
            "Provider": "gps",
            "Accuracy": 16,
            "LocalTimestamp": 1466187515321,
            "Velocity": 1.0693713426589966
        }
    }
```


=====
Links:
 * [contact](https://emmanouil.wp.imt.fr/contact/) 
 * [GPAC](www.gpac.io)