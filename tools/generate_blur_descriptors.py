from measure_blur import get_blur_by_filename
import copy
import os
import json

#input parameters
filenames = [
    '20140325_121238_720p_1800k', '20140325_121245_720p_1800k', '20140325_131253_720p_1800k', 'A002C001_140325E3_720p_1800k',
    'IMG_0367_720p_1800k', 'Take5_Nexus5_720p_1800k', 'VID_20140325_131247_720p_1800k', 'VID_20140325_131249_720p_1800k'
]
separator = '_'
start_n = 0
end_n = 999
formater = '03d'
extension = '.bmp'
subdir = 'frames'

#output parameters
OUTPUTDIR = 'test'
file_out_suffix = '_BLUR'

#logging
log_file = 'blur_measurements.json'
min_blur = 9999
max_blur = -9999
frames_n = 0


def get_em(filename):
    blurs = []
    blur = dict()
    for i in range(start_n, end_n):
        blur_v = get_blur_by_filename(subdir + '/' + filename + separator + format(i, formater) + extension)
        if blur_v is None:
            print('Done at ' + (filename + separator + format(i, formater) + extension))
            return blurs
        else:
            blur['PresentationTime'] = i * 1000    #in ms
            blur['Blur'] = blur_v
            blurs.append(copy.copy(blur))


def flush_json_to_file_out(filename, data):
    if not os.path.exists(OUTPUTDIR):
        print(os.mkdir(OUTPUTDIR))
    with open(os.getcwd() + '/' + OUTPUTDIR + '/' + filename, 'w+') as f:
        json.dump(data, f)
        print('written at ' + os.getcwd() + '/' + OUTPUTDIR + '/' + filename)


def get_minmax(dict_list, key):
    seq = [x[key] for x in dict_list]
    min_ = min(seq)
    max_ = max(seq)
    return min_, max_


def main():
    log = []
    for filename in filenames:
        blur = get_em(filename)
        if not blur:
            print('No blur metrics returned for ' + filename)
        else:
            min_, max_ = get_minmax(blur, 'Blur')
            log.append({'File': filename, 'MinBlurValue': min_, 'MaxBlurValue': max_})
            print('max:  ' + str(max_))
            print('min:  ' + str(min_))
            flush_json_to_file_out(filename + file_out_suffix + '.json', blur)
    flush_json_to_file_out(log_file, log)
    input('continue?')
    #That's All Folks!
    exit(0)


if __name__ == '__main__':
    main()