# PowerShell script to start Firebase emulators
# Run this in a separate terminal while developing

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting Firebase Emulators" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Check if we're in the right directory
if (-not (Test-Path "functions")) {
    Write-Host "ERROR: functions directory not found!" -ForegroundColor Red
    Write-Host "Please run this script from the project root directory." -ForegroundColor Red
    exit 1
}

# Build functions first
Write-Host "`nBuilding functions..." -ForegroundColor Yellow
cd functions
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Build failed!" -ForegroundColor Red
    cd ..
    exit 1
}

cd ..

# Start emulators
Write-Host "`nStarting Firebase emulators..." -ForegroundColor Yellow
Write-Host "Functions will be available at: http://localhost:5001" -ForegroundColor Green
Write-Host "Emulator UI will be available at: http://localhost:4000" -ForegroundColor Green
Write-Host "`nPress Ctrl+C to stop the emulators" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan

firebase emulators:start --only functions

