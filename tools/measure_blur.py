#import numpy
import cv2
import sys
#from scipy.signal import argrelextrema
import os


def get_blur(img):
    laplacian = cv2.Laplacian(img, cv2.CV_64F)

    blur = laplacian.var()
    return blur


#alternative to laplacian - not implemented
#sobelx = cv2.Sobel(img, cv2.CV_64F, 1, 0, ksize=5)

#for row in sobelx:
#	loc_minima = argrelextrema(row, numpy.greater)[0]
#	loc_maxima = argrelextrema(row, numpy.less)[0]


def get_blur_by_filename(file):

    #read B&W image (for color remove last argument)
    img = cv2.imread(file, 0)
    if img is None:
        print('Image ' + file + ' not found')
        return None

    return get_blur(img)