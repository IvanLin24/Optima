@echo off
setlocal
cd /d "%~dp0"
title Optima - local demo
py -3 --version >nul 2>&1
if not errorlevel 1 goto use_py
python --version >nul 2>&1
if not errorlevel 1 goto use_python
echo Python 3 was not found.
echo Install Python 3 from https://www.python.org/downloads/ and run this file again.
echo When installing, enable Add python.exe to PATH.
pause
exit /b 1
:use_py
py -3 run_local.py
goto finish
:use_python
python run_local.py
:finish
pause
