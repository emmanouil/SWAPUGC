---
---

# SWAPUGC

**SWAPUGC**: **S**oft**w**are for **A**daptive **P**layback of Geotagged **U**ser-**G**enerated **C**ontent

This is the repository for *SWAPUGC*: a platform for creating applications that consume geotagged User-Generated Content (UGC).

---

GoTo:  
[About](#about)  
[Architecture Flow](#architecture-flow-of-the-client)  
[Demo](#demo)  
[Generate/Record Compatible Files](#generate-compatible-files)  
[Known Issues](#known-issues)  
[Links/Contact](#links)  

---

## About

The about page is [here](https://github.com/emmanouil/SWAPUGC/blob/master/ABOUT.md).

TL;DR:  
SWAPUGC is a platform for building web applications that consume geotagged UGC, in a syncrhonous and adaptive manner. Some key features:

* Support for **_mixed_ adaptation policies**. Stream adaptation can be based on spatial and/or cinematic and/or quality and/or system criteria.
* **Inter-stream synchronization** between the geospatial data and the video.
* **Inter-bundle synchronization** between the different recordings.
* **Extensibility** for other timed data types (e.g. network metrics).




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

An online demo is available at [https://emmanouil.github.io/SWAPUGC/](https://emmanouil.github.io/SWAPUGC/). 
To run a local demo, start a server on the top dir and navigate to `index.html`

The demo is working better with Chrome, was tested and works with Firefox [3], and does *not* work with Microsoft Edge [4].

## Generate Compatible Files

### UGC recorder (video + sensors)

A compatible UGC recorder Android application that can be used, is available [here](https://github.com/emmanouil/Spatiotemporal-Navigation-Recorder)

### Generate DASH-compatible Segmented Video Files

For the demo we used MP4Box of the [GPAC](gpac.io) suite, but other tools (like ffmpeg) should work.
With MP4Box, an example command to generate the mpd file [1] and the associated 2s-long segments would be [2]: 
`MP4Box -frag 2000 -dash 2000 -segment-name file_out_seg_ file_in.mp4`


NOTE: MP4Box does _not_ do any transcoding on the media files. For that, we used ffmpeg. An example command for encoding a video in x264 (audio aac) with framerate = 30 fps and GOP size of 30 frames at 2Mbps bitrate, scaled with height = 1080px would be :
`ffmpeg.exe -i 20140325_121238.webm -r 30 -preset slow -vf scale=-1:1080 -c:v libx264 -b:v 2000k -movflags +faststart -sc_threshold 0 -keyint_min 30 -g 30 -c:a aac 20140325_121238.mp4`


### Format XML sensor data (compatible with ICoSOLE dataset)

File `parser_single_file` located inside the `tool` dir will generate files, from XML files, as those used in the demo, taken by the [ICoSOLE](http://www.bbc.co.uk/rd/blog/2014-04-icosole-test-shoot) project (project repository [here](https://icosole.lab.vrt.be/viewer/))

#### Using The Parser

`parser_single_file` run with the name _NAMEOFFILE_ as an argument (without extension). For example, for a file ABC123.mp4 in the folder 'parsing', it should be executed as `python3 parser_single_file.py parsing/ABC123`. Each entry should have at least a video file and an associated EbuCore timing file (in xml)

#### Parser Output

1. _NAMEOFFILE_`_DESCRIPTOR.json`, containing information about the recording
2. _NAMEOFFILE_`_ORIENT.json`, containg the timestamped orientation samples of the recording
3. _NAMEOFFILE_`_LOC.json`, containg the timestamped location samples of the recording


### Platform-specific data used

#### Global Pairs Holder
global variable name: ```globalSetIndex```
decription: an Array of recordings - the Location/Sensor Pair Objects of each recording are stored in the ```set``` field)
```javascript
    {
        id: "1234567_12345"
        index: 0
        set: Array[12]
        textFile: "OUT_1234567_12345.txt"
        textFileURL: "http://137.194.232.162:8080/parsing/OUT_1234567_12345.txt"
        videoFile: "OUT_1234567_12345.mp4"
    }
```


#### Location and Sensor Pairs
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


## Known Issues

[1] MP4Box does not play nice when generating the mpd of the files. More specifically, the "mimeType" and "codec" of the mpd's are *extremely* unreliable. It is recommendaded to completely delete the "codecs" attributed and change mimeType="video/mp4"

[2] Even though in the official blog of GPAC recommends using the "-rap" option when creating files for dash using MP4Box, I strongly suggest to ommit it, since it can misalign the timing of the MSE

[3] For this demo, we are using non-aligned segments. This is an edge non-standardized case scenario, but it is the only way to seamlessly switch between views. Chrome handles its bufffers as expected, but Firefox keeps the audio of all the fetched segments, even if newer have arrived, thus occasionally switching the video before the audio.

[4] Demo does not work on Microsoft Edge, because we are using VTTCues for the marker updates, [that are not supported by Edge](https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/8120475/)

If an issue is not mentioned here, you can either contact [us](##links), or submit a [New Issue](https://github.com/emmanouil/SWAPUGC/issues)


## Links:
 * [contact](https://emmanouil.wp.imt.fr/contact/) , on github @emmanouil
 * [GPAC](https://www.gpac.io) , on github @gpac
