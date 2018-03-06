---
title: About SWAPUGC
---

# SWAPUGC

**SWAPUGC**: **S**oft**w**are for **A**daptive **P**layback of Geotagged **U**ser-**G**enerated **C**ontent

## About

SWAPUGC is a browser-based platform for bulding applications that use accompanying geospatial data to dynamically select streams for watching a spatiotemporal reference point from multiple User-Generated Content (UGC) videos. The platform takes as inputs video files and their accompanying recorded Orientation and Location traces and utilizes them for multi-view spatial-aware playback.

So... **What _is_ SWAPUGC**
* An adaptation engine front-end. First and foremost, SWAPUGC can be modified to test adaptation policies, either to geospatial, temporal, video or system critera. This is why it comes with an MPD parser (for multiple video qualities descriptions), and Geospatial data parser.
 * A multiview player. SWAPUGC comes with a player implemented for the demo application.
 * A geospatial events engine. Triggers for orientation / location updates are part of the afforementioned player.


Then... **What _isn't_ SWAPUGC**
  * A UGC recorder; for that we use the [Spatiotemporal Video Navigarion Recorder](https://github.com/emmanouil/Spatiotemporal-Navigation-Recorder), or public datasets like [ICoSOLE](http://icosole.lab.vrt.be/) (for which we also include a [parser](https://github.com/emmanouil/SWAPUGC/blob/master/tools/parser_single_file.py) in the repository!)
 * A synchronization engine; even though SWAPUGC enforces synchronous playback, it assumes that the timing information provided with the recordings to be correct. If it is missing, you can use synchronization techniques (like audio landmark detection), prior to loading your content to SWAPUGC.
 * An encoder/packager; the video files should be encoded and segmented. Our recommendation is with ffmpeg for encoding and MP4Box (of GPAC) for segmenting.


 But... **_Why_ SWAPUGC**  
 Because there are not any other tools with similar features currently out. There [are](https://github.com/emmanouil/Beta-App-Client) tools for navigating in time or space betwwen multiple Geotagged videos with spatiotemporal annotation, or adaptive HTTP video streaming (like dash.js). But nothing that combines these functionalities, or being modular enough to be patched to accomodate them.