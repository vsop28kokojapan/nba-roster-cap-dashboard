@echo off
set "NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
cd /d "%~dp0"
"%NODE%" src\update.mjs
start "" http://127.0.0.1:4173
"%NODE%" src\server.mjs
