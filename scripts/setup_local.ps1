# ─────────────────────────────────────────────────────────────────────────────
# IOH Performance Dashboard — Local Setup Script (Windows PowerShell)
#
# Usage (run as Administrator or with execution policy set):
#   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
#   .\scripts\setup_local.ps1
# ─────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║    IOH Performance Dashboard — Local Setup (Win)    ║" -ForegroundColor Cyan
Write-Host "  ╚══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── Check Docker ──────────────────────────────────────────────────────────
Write-Host "[1/5] Checking prerequisites..." -ForegroundColor Blue
try {
    $dockerVersion = docker --version
    Write-Host "  ✅ $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Docker not found. Install from: https://www.docker.com/products/docker-desktop/" -ForegroundColor Red
    exit 1
}

try {
    docker info | Out-Null
    Write-Host "  ✅ Docker daemon is running" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Docker daemon is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

# ── Create .env.local ─────────────────────────────────────────────────────
Write-Host "[2/5] Setting up environment..." -ForegroundColor Blue
if (-not (Test-Path ".env.local")) {
    Copy-Item "deploy\env.template" ".env.local"
    Write-Host "  ✅ Created .env.local from template" -ForegroundColor Green
    Write-Host "  ℹ️  Using default local passwords (safe for development)" -ForegroundColor Yellow
} else {
    Write-Host "  ✅ .env.local already exists" -ForegroundColor Green
}

# ── Build images ──────────────────────────────────────────────────────────
Write-Host "[3/5] Building Docker images (this takes ~2 minutes first time)..." -ForegroundColor Blue
docker compose -f docker-compose.local.yml --env-file .env.local build
Write-Host "  ✅ Images built" -ForegroundColor Green

# ── Start services ────────────────────────────────────────────────────────
Write-Host "[4/5] Starting services..." -ForegroundColor Blue
docker compose -f docker-compose.local.yml --env-file .env.local up -d
Write-Host "  ✅ Services started" -ForegroundColor Green

# ── Wait for MySQL ────────────────────────────────────────────────────────
Write-Host "[5/5] Waiting for MySQL to be ready..." -ForegroundColor Blue
$maxWait = 60
$waited = 0
do {
    Start-Sleep -Seconds 3
    $waited += 3
    Write-Host "  Waiting... ($waited/$maxWait s)" -ForegroundColor Yellow
    $result = docker exec ioh_db_local mysqladmin ping -h localhost -u root -plocalroot123 --silent 2>&1
} while ($LASTEXITCODE -ne 0 -and $waited -lt $maxWait)

if ($waited -ge $maxWait) {
    Write-Host "  ❌ MySQL did not start within $maxWait seconds" -ForegroundColor Red
    docker logs ioh_db_local --tail 20
    exit 1
}
Write-Host "  ✅ MySQL is ready" -ForegroundColor Green

# ── Done ──────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  🎉 IOH Dashboard is running!                        ║" -ForegroundColor Green
Write-Host "║                                                      ║" -ForegroundColor Green
Write-Host "║  App:      http://localhost:3000                     ║" -ForegroundColor Green
Write-Host "║  Database: localhost:3306 (user: ioh_user)           ║" -ForegroundColor Green
Write-Host "║                                                      ║" -ForegroundColor Green
Write-Host "║  To stop:  docker compose -f docker-compose.local.yml down" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

# Open browser
Start-Process "http://localhost:3000"
