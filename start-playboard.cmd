@echo off
rem Starts the SRD 5.2.1 playboard locally (Vite dev server) and opens it in the default browser.
rem Double-click this file, or run it from a terminal. Close the window (or press Ctrl+C) to stop the server.
rem The npm .cmd shims break on the "&" in this folder's path, so node is called directly.
cd /d "%~dp0"
if not exist node_modules (
  echo Installing dependencies ^(first run^)...
  call npm install
)
start "" http://127.0.0.1:5188/
node node_modules\vite\bin\vite.js --port 5188 --strictPort --host 127.0.0.1
