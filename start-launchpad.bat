@echo off
title Launchpad System Starter
echo ===================================================
echo     STARTING LAUNCHPAD VIRTUAL OFFICE SYSTEMS
echo ===================================================
echo.

:: 1. Start the React/Vite Frontend (since you are already in this folder)
echo [1/2] Booting up the Frontend Server...
start "Launchpad Frontend" cmd /k "npm run dev"

:: 2. Step back one folder, go into the Backend, and start it
echo [2/2] Booting up the Backend Server...
cd ../launchpadvo-backend
start "Launchpad Backend" cmd /k "node server.js"

echo.
echo ===================================================
echo   ✅ Both systems are now running in separate windows!
echo   You can safely close this launcher window.
echo ===================================================
pause