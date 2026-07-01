@echo off
cd /d "%~dp0"
echo Starting WatchHQ Development Server...
echo Vite dev server + Electron will launch in a moment.
npm run electron:dev
pause
