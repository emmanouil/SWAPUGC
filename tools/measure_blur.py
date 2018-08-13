import numpy
import cv2
import sys
from scipy.signal import argrelextrema
from matplotlib import pyplot as plt
import os


Nb = 0    #number of edges
BM = 0    #total blur measurement

#read B&W image (for color remove last argument)
img = cv2.imread('tools/blurs.png', 0)
print(os.getcwd())

if img is None:
	exit('Image not found')

laplacian = cv2.Laplacian(img, cv2.CV_64F)
print(laplacian.var())

sobelx = cv2.Sobel(img, cv2.CV_64F, 1, 0, ksize=5)
abs_sobel64f = numpy.absolute(sobelx)
sobel_8u = numpy.uint8(abs_sobel64f)
sobely = cv2.Sobel(img, cv2.CV_64F, 0, 1, ksize=5)
print(sobelx)

plt.subplot(2, 2, 1), plt.imshow(img, cmap='gray')
plt.title('Original'), plt.xticks([]), plt.yticks([])
plt.subplot(2, 2, 2), plt.imshow(laplacian, cmap='gray')
plt.title('Laplacian'), plt.xticks([]), plt.yticks([])
plt.subplot(2, 2, 3), plt.imshow(sobel_8u, cmap='gray')
plt.title('Sobel X'), plt.xticks([]), plt.yticks([])
plt.subplot(2, 2, 4), plt.imshow(sobely, cmap='gray')
plt.title('Sobel Y'), plt.xticks([]), plt.yticks([])

plt.show()

min = 999999
max = -99999

for row in sobelx:
	for elem in row:
		if elem < min:
			min = elem
		if elem > max:
			max = elem
	loc_minima = argrelextrema(row, numpy.greater)[0]
	loc_maxima = argrelextrema(row, numpy.less)[0]
	x_axis = range(0, len(row))

print('done')


def main():
	#check if called for specific file
	#check this instead: https://docs.python.org/3/library/fileinput.html#module-fileinput
	if (len(sys.argv) > 1):
		file_in = open(sys.argv[1], 'r')
		if file_in is None:
			exit('Wrong file')

		input('continue?')

		#That's All Folks!
		exit(0)


if __name__ == '__main__':
	main()