import datetime
import json
import os
import re
import sys
import xml.etree.ElementTree as ET
import math

#Parameters
#Paremeters for input files
FILE_IN_DIR = 'parsing'  #dir with files to be parsed
TIMING_FILE_EXTENSION = '.xml'
TIMINIG_XML_SUFFIX = '_EbuCore'
SENSOR_FILE_EXTENSION = '.xml'
SENSOR_XML_SUFFIX = '_SENSORDATA'
VIDEO_FILE_EXTENSION = '.webm'
ORIENTATION_FIELD = '4'
OVERWRITE_LOCATION = False    #checks if there is a location in the output dir and if so skips the generation of it
IN_RAD = False
LOCATION_FIELD = '0'

#Paremeters for output files
LOGFILE = 'python_script.log'  #logfile
OUTPUTDIR = 'script_out'
PLAYLIST = 'playlist.txt'  #generated playlist containing formated files

#Parameters for parser
CLEAR_LOG = True  #When init log - delete previous logfile
SHOW_DBG_LOGS = False
LOG_TO_FILE = False

#Global vars
orient_count = 0
orient_start = 0
orient_dur_tot = 0
orientations = []
locations = []

#constants
LOG_LVL_ERROR = -1
LOG_LVL_DEBUG = 0
LOG_LVL_INFO = 1


#recording class
class RecordingClass:
    """class for maintaining the recordings"""

    def __init__(self, r_recordingID, r_videoFilename, r_startTime, r_duration):
        self.recordingID = r_recordingID
        self.videoFilename = r_videoFilename
        self.startTime = r_startTime
        self.startTimeMs = timeStr_toMs(r_startTime)
        self.duration = r_duration
        self.durationMs = timeStr_toMs(r_duration)

    def addSensors(self, measurements, descriptor):
        self.sensorValues = measurements
        self.sensorDescriptor = descriptor


##    Log
#
#    lvl = None log to console
#        < 0 ERROR
#        > 0 INFO
#        = 0 Debug
def log(msg, lvl):
    now = datetime.datetime.now()
    str_now = '\n' + str(now.day) + '/' + str(now.month) + '/' + str(now.year) + ' ' + str(now.hour) + ':' + str(now.minute) + ':' + str(now.second) + ' '
    str_now = str_now.ljust(19)
    with open(LOGFILE, 'a') as logfile:
        if (lvl is None):  #normal
            print(msg)
        elif (lvl < 0):  #error
            print('\033[31m' + '[ERROR]\t' + '\033[0m' + msg)
            if LOG_TO_FILE:
                logfile.write(str_now + '[ERROR]\t' + msg)
        elif (lvl > 0):  #info
            print('\033[32m' + '[INFO]\t' + '\033[0m' + msg)
            if LOG_TO_FILE:
                logfile.write(str_now + '[INFO]\t' + msg)
        elif (lvl == 0):  #dbg
            if SHOW_DBG_LOGS:
                print('\033[35m' + '[DEBUG]\t' + '\033[0m' + msg)
            if LOG_TO_FILE:
                logfile.write(str_now + '[DEBUG]\t' + msg)


def log_blankline():
    with open(LOGFILE, 'a') as logfile:
        print('\n')
        if LOG_TO_FILE:
            logfile.write('\n')


## Create output file and flush
def flush_json_to_file_out(filename, data):
    if not os.path.exists(OUTPUTDIR):
        print(os.mkdir(OUTPUTDIR))
    with open(os.getcwd()+'/'+OUTPUTDIR+'/'+filename, 'w+') as f:
        json.dump(data, f)



def open_video_file(filename):
    try:
        tmp_file = open(filename, 'r')
        return tmp_file.name
    except:
        log('INVALID FILE NAME', LOG_LVL_ERROR)
        raise


#get timing information from the EbuCore xml file
#argument: filename, returns: {'startTime': startTime, 'duration': duration}
def get_timing(file_in):
    timing_xml_tree = ET.parse(file_in.name)
    for child in timing_xml_tree.iter():
        if (child.tag == '{urn:ebu:metadata-schema:ebuCore_2014}partStartTime'):
            for kid in child.iter():
                if (kid.tag == '{urn:ebu:metadata-schema:ebuCore_2014}timecode'):
                    startTime = kid.text
                    print('startTime ' + kid.text)
        if (child.tag == '{urn:ebu:metadata-schema:ebuCore_2014}partDuration'):
            for kid in child.iter():
                if (kid.tag == '{urn:ebu:metadata-schema:ebuCore_2014}timecode'):
                    duration = kid.text
                    print('duration ' + kid.text)
    return {'startTime': startTime, 'duration': duration}


#get sensor values
#argument: filename, returns: {'measurements': measurements, 'descriptor':descriptor}
#TODO: Optimize: we do unecessary iterations (the first iter() should iterate through the subsequent segments and children)
def get_sensors(file_in):
    timing_xml_tree = ET.parse(file_in.name)
    measurements = []
    for child in timing_xml_tree.iter():
        if (child.tag == 'header'):
            descriptor = child.text
        elif (child.tag == 'segment'):
            measurement = {}
            for kid in child.iter():
                if (kid.tag == 'segment'):
                    continue
                elif (kid.tag == 'sensorID'):
                    measurement['sensorID'] = kid.text
                elif (kid.tag == 'time'):
                    measurement['time'] = int(kid.text)
                elif (kid.tag.lower() == 'values'):
                    measurement['values'] = kid.text.split()
                    measurement['values'] = [float(i) for i in measurement['values']]
                else:
                    log('unkown entry ' + kid.tag +' in sensor file', LOG_LVL_ERROR)
            if (measurement != {}):
                measurements.append(measurement)
            else:
                log('unkown entry with tag: ' + child.tag + ' in sensor file', LOG_LVL_ERROR)
    if (measurements == []):
        log('unknown error while parsing sensor file ' + file_in, LOG_LVL_ERROR)
    return {'measurements': measurements, 'descriptor': descriptor}


def calculate_orientation(item_in):
    global orient_count
    global time_diff
    orient_obj = {'X': 0, 'Y': 0, 'Z': 0, 'LocalTimestamp': 0, 'PresentationTime': 0, 'Type': "ORIENTATION"}
    global orient_start
    global orientations
    if not IN_RAD and not ((item_in['values'][0] < 1 and item_in['values'][0] > -1) and (item_in['values'][1] < 1 and item_in['values'][1] > -1)):
        orient_count += 1
        if (orient_count == 1):
            orient_start = item_in['time']
        orient_obj['Z'] += item_in['values'][2]
        orient_obj['X'] += item_in['values'][0]
        orient_obj['Y'] += item_in['values'][1]
        orient_obj['LocalTimestamp'] = item_in['time']
        orient_obj['PresentationTime'] = item_in['time'] - orient_start
        return orient_obj
    elif IN_RAD:
        orient_count += 1
        if (orient_count == 1):
            orient_start = item_in['time']
        orient_obj['Z'] += math.degrees(item_in['values'][2])
        orient_obj['X'] += math.degrees(item_in['values'][0])
        orient_obj['Y'] += math.degrees(item_in['values'][1])
        orient_obj['LocalTimestamp'] = item_in['time']
        orient_obj['PresentationTime'] = item_in['time'] - orient_start
        return orient_obj
    else:
        log('error in parsing orientation values', LOG_LVL_DEBUG)


def calculate_location(item_in):
    loc_obj = {'Latitude': 0, 'Longitude': 0, 'Altitude': 0, 'Accuracy': 0, 'LocalTimestamp': 0, 'PresentationTime': 0, 'Provider': "undefined"}
    loc_obj['Latitude'] += item_in['values'][0]
    loc_obj['Longitude'] += item_in['values'][1]
    loc_obj['Altitude'] += item_in['values'][2]
    loc_obj['Accuracy'] += item_in['values'][3]
    loc_obj['LocalTimestamp'] = item_in['time']
    return loc_obj


#put the result in 'orientations' obj
def extract_measurements(r_set, fID):
    for item in r_set.sensorValues:
        if (item['sensorID'] != fID):
            continue
        else:
            if (fID == ORIENTATION_FIELD):
                tmp_orient = calculate_orientation(item)
                if (tmp_orient):
                    orientations.append(tmp_orient)
            elif (fID == LOCATION_FIELD):
                locations.append(calculate_location(item))
            else:
                log('ID unknown', LOG_LVL_ERROR)

#eg 12:22:11.70000
def timeStr_toMs(t_str):
    t_elems = re.split('[:.]', t_str)
    t_elems = [ int(x[:3]) for x in t_elems ]
    t_elems[1] += t_elems[0]*60 #H to M
    t_elems[2] += t_elems[1]*60 #M to s
    t_elems[3] += t_elems[2]*1000 #s to ms
    return t_elems[3]


def main():
    #ENTRY POINT
    if (CLEAR_LOG):
        if os.path.isfile(LOGFILE):
            os.remove(LOGFILE)
#CHECK IF WE HAVE ARGUMENT AND IT'S A VALID FILENAME
#check if called for specific file    - TODO for new dataset
#check this instead: https://docs.python.org/3/library/fileinput.html#module-fileinput
    if (len(sys.argv) > 1):
        recordingID = sys.argv[1]
        filepath = FILE_IN_DIR + '/' + recordingID
        log('PROCESSING FILE: ' + recordingID, LOG_LVL_INFO)
        videoFilename = open_video_file(filepath + VIDEO_FILE_EXTENSION)

        #From here is for extracting the timing xml
        try:
            file_in_timing = open(filepath + TIMINIG_XML_SUFFIX + TIMING_FILE_EXTENSION, 'r')
        except:
            log('video file found, but without associated timing file. Aborting', LOG_LVL_ERROR)
            raise

        timing_info = get_timing(file_in_timing)
        file_in_timing.close()
        recording = RecordingClass(recordingID, videoFilename, timing_info['startTime'], timing_info['duration'])
        #Until here

        #From here is for extracting the sensor data xml
        try:
            file_in_sensors = open(filepath + SENSOR_XML_SUFFIX + SENSOR_FILE_EXTENSION, 'r')
        except:
            log('video file found, but without associated sensor recordings file. Aborting', LOG_LVL_ERROR)
            raise
        #get sensor recordings
        sensor_info = get_sensors(file_in_sensors)
        file_in_sensors.close()
        recording.addSensors(sensor_info['measurements'], sensor_info['descriptor'])
        #until here

        #From here is for extracting the orientation measurements (pushed in orientations list)
        #find orientation items and push them in 'orientations' object
        extract_measurements(recording, ORIENTATION_FIELD)
        #until here

        #From here is for extracting the location measurements (pushed in locations list)
        #find location items and push them in 'locations' object
        extract_measurements(recording, LOCATION_FIELD)
        #until here

        #write to files
        flush_json_to_file_out(recordingID+'_ORIENT.json', orientations)
        if OVERWRITE_LOCATION:
            flush_json_to_file_out(recordingID+'_LOC.json', locations)
        else:
            try:
                file_out_loc = open(os.getcwd()+'/'+OUTPUTDIR+'/'+recordingID+'_LOC.json', 'r')
            except:
                log('location file not found - creating location output file', LOG_LVL_INFO)
                file_out_loc.close()
                flush_json_to_file_out(recordingID+'_LOC.json', locations)

        flush_json_to_file_out(recordingID + '_DESCRIPTOR.json', {
            'recordingID': recording.recordingID,
            'startTime': recording.startTime,
            'startTimeMs': recording.startTimeMs,
            'duration': recording.duration,
            'durationMs': recording.durationMs,
            'videoFilename': recording.videoFilename,
            'orientationFilename': OUTPUTDIR + '/' + recordingID + '_ORIENT.json',
            'locationFilename': OUTPUTDIR + '/' + recordingID + '_LOC.json'
        })

    else:
        log('PROVIDE A FILE TO PARSE', -1)


#        file_in = open(file_list[0])
#        print(file_list)
#        print(file_in)
    input('continue?')

    #That's All Folks!
    exit(0)

if __name__ == '__main__':
    main()
