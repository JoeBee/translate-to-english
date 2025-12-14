@echo off
REM Batch script to start Firebase emulators
REM Run this in a separate terminal while developing

echo ========================================
echo Starting Firebase Emulators
echo ========================================
echo.

REM Check if we're in the right directory
if not exist "functions" (
    echo ERROR: functions directory not found!
    echo Please run this script from the project root directory.
    exit /b 1
)

REM Build functions first
echo Building functions...
cd functions
call npm run build
if errorlevel 1 (
    echo ERROR: Build failed!
    cd ..
    exit /b 1
)

cd ..

REM Start emulators
echo.
echo Starting Firebase emulators...
echo Functions will be available at: http://localhost:5001
echo Emulator UI will be available at: http://localhost:4000
echo.
echo Press Ctrl+C to stop the emulators
echo ========================================

call firebase emulators:start --only functions

pause

