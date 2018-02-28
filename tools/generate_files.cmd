@echo off
if exist playlist.txt (
	echo playlist.txt found - processing entries
	for /F "tokens=*" %%A in (playlist.txt) do py parser_single_file.py %%A
) else (
	echo playlist.txt not found
)
echo done