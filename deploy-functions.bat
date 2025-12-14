@echo off
REM Batch script to deploy Firebase Functions
REM Run this from the project root directory

echo ========================================
echo Deploying Firebase Functions
echo ========================================
echo.

REM Check if we're in the right directory
if not exist "functions" (
    echo ERROR: functions directory not found!
    echo Please run this script from the project root directory.
    exit /b 1
)

REM Step 1: Install dependencies
echo [1/4] Installing function dependencies...
cd functions
if not exist "node_modules" (
    call npm install
    if errorlevel 1 (
        echo ERROR: npm install failed!
        cd ..
        exit /b 1
    )
) else (
    echo Dependencies already installed, skipping...
)

REM Step 2: Build functions
echo.
echo [2/4] Building functions...
call npm run build
if errorlevel 1 (
    echo ERROR: Build failed!
    cd ..
    exit /b 1
)

REM Step 3: Check Firebase login
echo.
echo [3/4] Checking Firebase login...
cd ..
firebase login:list >nul 2>&1
if errorlevel 1 (
    echo Please login to Firebase first...
    call firebase login
    if errorlevel 1 (
        echo ERROR: Firebase login failed!
        exit /b 1
    )
)

REM Step 4: Deploy functions
echo.
echo [4/4] Deploying functions to Firebase...
echo This may take a few minutes...
call firebase deploy --only functions
if errorlevel 1 (
    echo ERROR: Deployment failed!
    exit /b 1
)

echo.
echo ========================================
echo Deployment Complete!
echo ========================================
echo Functions deployed at:
echo   - https://us-central1-translate-to-english-80cad.cloudfunctions.net/detectLanguage
echo   - https://us-central1-translate-to-english-80cad.cloudfunctions.net/translateText
echo.
echo Refresh your app and try again!
pause

