---
---

**SWAPUGC**: **S**oft**w**are for **A**daptive **P**layback of Geotagged **U**ser-**G**enerated **C**ontent

## About

SWAPUGC is a browser-based platform for bulding applications that use accompanying geospatial data to dynamically select streams for watching a spatiotemporal reference point from multiple User-Generated Content (UGC) videos. The platform takes as input video files and their accompanying recorded Orientation and Location traces and utilizes them for multi-view spatial-aware playback.

So... **What _is_ SWAPUGC**

* An adaptation engine front-end. First and foremost, SWAPUGC can be modified to test adaptation policies, either to geospatial, temporal, video or system critera. This is why it comes with an MPD parser (for multiple video qualities descriptions), and Geospatial data parser.
* A multiview player. SWAPUGC comes with a player implemented (with MPEG-DASH support) for demo applications.
* A geospatial events engine. Triggers for orientation / location updates are part of the afforementioned player.


Then... **What _isn't_ SWAPUGC**

* It is **not** a UGC recorder; for that we use the [Spatiotemporal Video Navigarion Recorder](https://github.com/emmanouil/Spatiotemporal-Navigation-Recorder), or public datasets like [ICoSOLE](http://icosole.lab.vrt.be/) (for which we also include a [parser](https://github.com/emmanouil/SWAPUGC/blob/master/tools/parser_single_file.py) in the repository!)
* It is **not** a synchronization engine; even though SWAPUGC enforces synchronous playback, it assumes that the timing information provided with the recordings to be correct. If it is missing, you can use synchronization techniques (like audio landmark detection), prior to loading your content to SWAPUGC.
* It is **not** an encoder/packager; the video files should already be encoded and segmented. Our recommendation is to use ffmpeg for encoding and MP4Box (of GPAC) for segmenting.


But... **_Why_ SWAPUGC**

Because there are not any other tools with similar features currently out. There [are](https://github.com/emmanouil/Beta-App-Client) tools for navigating in time or space betwwen multiple Geotagged videos with spatiotemporal annotation, or tools for adaptive HTTP video streaming (like dash.js). But nothing that combines these functionalities, or being modular enough to be patched to accomodate them.

And... **_How_ did it start**

The original idea came from the client of _"Extended Video Streams for Spatiotemporal Video Navigation"_, presented at The Graphical Web 2016 ([slides](https://emmanouil.wp.imt.fr/files/2017/03/Extended-Video-Streams-for-Spatiotemporal-Navigation.pdf) & [video](https://www.youtube.com/watch?v=iUhGZV9SSiM)), part of the project _"Streaming And Presentation Architectures for Extended Video Streams"_ ([short-paper](https://www.researchgate.net/publication/317593679_Streaming_and_Presentation_Architectures_for_Extended_Video_Streams)) showcased at the TVX '17. 
This web application allowed for users to navigate on a map according to the currently displayed frame, or seek in video according to the location. However, there was no concept of common timeline between different recordings, neither live streaming capabilities, nor support for adaptation policies. But, adding those feature would repurpose the platform, thus instead of extending it, we built upon it and SWAPUGC was born.


**_Who_ is behind it**

SWAPUGC was developed at the Multimedia group of Telecom ParisTech engineering school. It was designed and currently maintained by [Emmanouil Potetsianakis](https://emmanouil.wp.imt.fr) (gh: @emmanouil) and [Jean Le Feuvre](https://lefeuvre.wp.imt.fr/) (gh: @jeanlf).