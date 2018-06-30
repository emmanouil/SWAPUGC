import sys
import json
import os
import datetime
import re
import copy
import math

LOGFILE = 'python_script.log'
OUTPUTDIR = 'script_out'
PLAYLIST = 'playlist.txt'
USE_FULL_FILENAME_IN_PLAYLIST = False    #otherwise use only ID (without the OUT_ and .txt)
LOG_STATISTICS = True
CLEAR_LOG = True    #When init log - delete previous logfile

IN_FILE_EXTENTION = '.txt'
OUT_FILE_EXTENTION = 'json'
OUT_FILE_PREFIX = ''
OUT_FILE_LOC_SUFFIX = '_LOC'
OUT_FILE_ORIENT_SUFFIX = '_ORIENT'

IS_IN_RAD = True    #convert to degrees

orient_count = 0
orient_start = 0
orient_dur = 0
orient_dur_tot = 0
orient_obj = None


##	Log
#
#	lvl = None log to console
#		< 0 ERROR
#		> 0 INFO
#		= 0 Debug
def log(msg, lvl):
	now = datetime.datetime.now()
	str_now = '\n' + str(now.day) + '/' + str(now.month) + '/' + str(now.year) + ' ' + str(now.hour) + ':' + str(now.minute) + ':' + str(
	    now.second) + ' '
	str_now = str_now.ljust(19)
	with open(LOGFILE, 'a') as logfile:
		if (lvl is None):    #normal
			print(msg)
		elif (lvl < 0):    #error
			print('\033[31;1m' + '[ERROR]\t' + '\033[0m' + msg)
			logfile.write(str_now + '[ERROR]\t' + msg)
		elif (lvl > 0):    #info
			print('\033[32m' + '[INFO]\t' + '\033[0m' + msg)
			logfile.write(str_now + '[INFO]\t' + msg)
		elif (lvl == 0):    #dbg
			print('\033[35;1m' + '[DEBUG]\t' + '\033[0m' + msg)
			logfile.write(str_now + '[DEBUG]\t' + msg)


def log_blankline():
	with open(LOGFILE, 'a') as logfile:
		print('\n')
		logfile.write('\n')


log_location_dict = dict()


## initialize log_location_dict
def log_location_init():
	global log_location_dict
	log_location_dict['minDiff'] = 0
	log_location_dict['maxDiff'] = 0
	log_location_dict['avgDiff'] = 0
	log_location_dict['sum'] = 0
	log_location_dict['count'] = 0
	log_location_dict['baseNano'] = 0
	log_location_dict['baseTime'] = 0
	log_location_dict['nanoDiffSum'] = 0
	log_location_dict['timeDiffSum'] = 0


## Process location for analysis
def log_location(json_loc):
	global log_location_dict
	diff = json_loc['Time'] - (json_loc['LocalNanostamp'] / 1000000)
	if log_location_dict['count'] == 0:
		log_location_dict['count'] += 1
		return
	if log_location_dict['count'] == 1:
		log_location_dict['minDiff'] = diff
		log_location_dict['baseNano'] = json_loc['LocalNanostamp']
		log_location_dict['baseTime'] = json_loc['Time']
	else:
		log_location_dict['nanoDiffSum'] += (json_loc['LocalNanostamp'] - log_location_dict['baseNano']) / 1000000
		log_location_dict['timeDiffSum'] += (json_loc['Time'] - log_location_dict['baseTime'])
		log(
		    "nano diff: " + str((json_loc['LocalNanostamp'] - log_location_dict['baseNano']) / 1000000) + "    time diff: " +
		    str(json_loc['Time'] - log_location_dict['baseTime']), 1)
		log_location_dict['baseNano'] = json_loc['LocalNanostamp']
		log_location_dict['baseTime'] = json_loc['Time']
	if (log_location_dict['minDiff'] > diff):
		log_location_dict['minDiff'] = diff
	if (log_location_dict['maxDiff'] < diff):
		log_location_dict['maxDiff'] = diff
	log_location_dict['count'] += 1
	log_location_dict['sum'] += diff


## flush to logfile
def log_location_flush():
	global log_location_dict
	if log_location_dict['count'] > 0:
		log("nano diff sum: " + str(log_location_dict['nanoDiffSum']) + "    time diff sum: " + str(log_location_dict['timeDiffSum']), 1)
		log("minDiff: " + str(log_location_dict['minDiff']), 1)
		log("maxDiff: " + str(log_location_dict['maxDiff']), 1)
		log("avgDiff: " + str(log_location_dict['sum'] / log_location_dict['count'] - 1), 1)
	log_blankline()
	log_location_init()


## Checks if item exists in PLAYLIST file and appends it
def append_to_playlist(item):
	if os.path.isfile(os.getcwd() + '/' + OUTPUTDIR + '/' + PLAYLIST):
		with open(os.getcwd() + '/' + OUTPUTDIR + '/' + PLAYLIST, 'r') as f:
			for line in f:
				res = re.match(item, line)
				if res is not None:
					return
	with open(os.getcwd() + '/' + OUTPUTDIR + '/' + PLAYLIST, 'a') as f:
		f.write(item + '\n')


## Create output file and flush
#
#  like: OUTPUTDIR/OUT_<file_in>.txt
def flush_json_to_file_out(filename, data):
	if not os.path.exists(OUTPUTDIR):
		print(os.mkdir(OUTPUTDIR))
	with open(os.getcwd() + '/' + OUTPUTDIR + '/' + filename, 'w+') as f:
		json.dump(data, f)
	if USE_FULL_FILENAME_IN_PLAYLIST:
		append_to_playlist(filename)
	else:
		append_to_playlist(os.path.splitext(os.path.split(filename)[1])[0])
	reset_vars()


def reset_vars():
	global orient_count
	global orient_start
	global orient_dur
	global orient_obj
	global orient_dur_tot
	orient_count = 0
	orient_start = 0
	orient_dur = 0
	orient_obj = None
	orient_dur_tot = 0


##	Returns a list of FILES of the defined extension
#
#	returns only the file NAME (without the extension)
#	of files in current folder having that extension
def get_file_list(extension):
	all_files = os.listdir()
	file_list = []
	for file in all_files:
		tmp_file = get_file_name(file, extension)
		if (tmp_file is not None):
			log(tmp_file, 0)
			file_list.append(file)
	return file_list


##	Checks a file (or filename) for extension
#
#	Return the file NAME without the extension if true
#	Return None otherwise
def get_file_name(file_in, extension):
	if (type(file_in) is str):
		file_full_name = os.path.splitext(os.path.split(file_in)[1])
	else:
		file_full_name = os.path.splitext(os.path.split(file_in.name)[1])
	file_name = file_full_name[0]
	file_ext = file_full_name[1]
	if (file_ext != extension):
		return
	else:
		return file_name


def return_orient(orientation):
	global orient_count
	global orient_obj
	global orient_start
	global orient_dur
	orient_count += 1
	if orient_count == 1:
		orient_obj = orientation
		orient_start = orientation['LocalTimestamp']
		orient_dur = 0
	else:
		orient_dur = orientation['LocalTimestamp'] - orient_start
	if IS_IN_RAD:
		orient_obj['Z'] = math.degrees(orientation['Z'])
		orient_obj['X'] = math.degrees(orientation['X'])
		orient_obj['Y'] = math.degrees(orientation['Y'])
	else:
		orient_obj['Z'] = orientation['Z']
		orient_obj['X'] = orientation['X']
		orient_obj['Y'] = orientation['Y']
	orient_obj['LocalTimestamp'] = orientation['LocalTimestamp']
	orient_obj['PresentationTime'] = orient_dur
	return orient_obj


##	Processes file
#
#	void
def process_file(filename):
	log('Processing file: ' + filename, 1)
	latestOrient = None
	latestLoc = None
	json_out = {}
	orient_full = []
	loc_full = []
	id = 0
	flushed = True
	global orient_obj
	global orient_count
	filename_stripped = os.path.splitext(filename)[0]
	#	create_file_out(filename)
	with open(filename, 'r') as file_in:
		if LOG_STATISTICS:
			log_location_init()
		for line in file_in:
			json_line = json.loads(line)
			if 'Type' in json_line:
				if json_line['Type'] == "ORIENTATION":
					latestOrient = return_orient(json_line)
					if latestOrient['PresentationTime'] > 0:
						orient_full.append(copy.copy(latestOrient))
					latestOrient = None
				else:
					log('Uknown type: ' + json_line['Type'] + '- skipping', 0)
			elif 'Provider' in json_line:
				if LOG_STATISTICS:
					log_location(json_line)
				loc_full.append(json_line)
				latestLoc = None
			else:
				log('Not Found - skipping', 0)
		flush_json_to_file_out(OUT_FILE_PREFIX + filename_stripped + OUT_FILE_ORIENT_SUFFIX + '.' + OUT_FILE_EXTENTION, orient_full)
		flush_json_to_file_out(OUT_FILE_PREFIX + filename_stripped + OUT_FILE_LOC_SUFFIX + '.' + OUT_FILE_EXTENTION, loc_full)
		json_full = []
		if LOG_STATISTICS:
			log_location_flush()
	file_in.closed


def main():
	if (CLEAR_LOG):
		if os.path.isfile(LOGFILE):
			os.remove(LOGFILE)
	#check if called for specific file
	#check this instead: https://docs.python.org/3/library/fileinput.html#module-fileinput
	if (len(sys.argv) > 1):
		file_in = open(sys.argv[1], 'r')
		file_name = get_file_name(file_in, IN_FILE_EXTENTION)
		if file_name is None:
			exit('Wrong file extension (' + file_ext + ') for file ' + file_full_name[0] + file_full_name[1] + '   :  expected ' +
			     IN_FILE_EXTENTION)
		else:
			process_file(file_name + IN_FILE_EXTENTION)
		file_in.close()
	#default case when check for every file in current folder with .txt extension
	else:
		file_list = get_file_list(IN_FILE_EXTENTION)
		for file_name in file_list:
			process_file(file_name)


#		file_in = open(file_list[0])
#		print(file_list)
#		print(file_in)
	input('continue?')

	#That's All Folks!
	exit(0)

if __name__ == '__main__':
	main()
