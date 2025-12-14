# PowerShell script to deploy Firebase Functions
# Run this from the project root directory

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deploying Firebase Functions" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Check if we're in the right directory
if (-not (Test-Path "functions")) {
    Write-Host "ERROR: functions directory not found!" -ForegroundColor Red
    Write-Host "Please run this script from the project root directory." -ForegroundColor Red
    exit 1
}

# Step 1: Install dependencies
Write-Host "`n[1/4] Installing function dependencies..." -ForegroundColor Yellow
Set-Location functions
if (-not (Test-Path "node_modules")) {
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: npm install failed!" -ForegroundColor Red
        Set-Location ..
        exit 1
    }
} else {
    Write-Host "Dependencies already installed, skipping..." -ForegroundColor Green
}

# Step 2: Build functions
Write-Host "`n[2/4] Building functions..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Build failed!" -ForegroundColor Red
    Set-Location ..
    exit 1
}

# Step 3: Check Firebase login
Write-Host "`n[3/4] Checking Firebase login..." -ForegroundColor Yellow
Set-Location ..
$firebaseUser = firebase login:list 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Please login to Firebase first..." -ForegroundColor Yellow
    firebase login
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Firebase login failed!" -ForegroundColor Red
        exit 1
    }
}

# Step 4: Deploy functions
Write-Host "`n[4/4] Deploying functions to Firebase..." -ForegroundColor Yellow
Write-Host "This may take a few minutes..." -ForegroundColor Yellow
firebase deploy --only functions
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Deployment failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "✅ Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "Functions deployed at:" -ForegroundColor Cyan
Write-Host "  - https://us-central1-translate-to-english-80cad.cloudfunctions.net/detectLanguage" -ForegroundColor White
Write-Host "  - https://us-central1-translate-to-english-80cad.cloudfunctions.net/translateText" -ForegroundColor White
Write-Host "`nRefresh your app and try again!" -ForegroundColor Yellow

