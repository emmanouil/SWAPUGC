# SWAPUGC

SWAPUGC: __S__oft__w__are for __A__daptive __P__layback of Geotagged __U__ser-__G__enerated __C__ontent


## Demo
To run a local demo, start a server on the top dir and navigate to `index.html`


## Generate Compatible Files

### Format sensor data

File `parser_single_file` located inside the `tool` dir will generate files, from XML files, as those used in the demo, taken by the [ICoSOLE](http://www.bbc.co.uk/rd/blog/2014-04-icosole-test-shoot) project (project repository [here](https://icosole.lab.vrt.be/viewer/))

#### Using The Parser

`parser_single_file` run with the name _NAMEOFFILE_ as an argument (without extension). For example, for a file ABC123.mp4 in the folder 'parsing', it should be executed as `python3 parser_single_file.py parsing/ABC123`. Each entry should have at least a video file and an associated EbuCore timing file (in xml)

### Parser Output

1. _NAMEOFFILE_`_DESCRIPTOR.json`, containing information about the recording
2. _NAMEOFFILE_`_ORIENT.json`, containg the timestamped orientation samples of the recording
3. _NAMEOFFILE_`_LOC.json`, containg the timestamped location samples of the recording

### Generate DASH-compatible Segmented Video Files

For the demo we used MP4Box of the [GPAC](gpac.io) suite, but other tools (like ffmpeg) should work.
With MP4Box, an example command to generate 2s-long segments would be: 
`MP4Box -frag 2000 -dash 2000 -segment-name file_out_seg_ file_in.mp4`


