# Nuenime Admin Dashboard - Development Server Runner

$ErrorActionPreference = "Stop"
$ProjectDir = $PSScriptRoot

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    Nuenime Admin Dashboard Web         " -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan

Set-Location -Path $ProjectDir
Write-Host "[INFO] Direktori aktif: $ProjectDir" -ForegroundColor Gray

$portInUse = Get-NetTCPConnection -LocalPort 8082 -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Host "[WARN] Port 8082 sedang digunakan oleh Process ID: $($portInUse.OwningProcess[0])" -ForegroundColor Yellow
    $confirm = Read-Host "Apakah Anda ingin mematikan proses lama di port 8082 terlebih dahulu? (Y/n)"
    if ($confirm -eq "" -or $confirm -match "^[yY]") {
        Stop-Process -Id $portInUse.OwningProcess -Force -ErrorAction SilentlyContinue
        Write-Host "[OK] Proses lama telah dimatikan." -ForegroundColor Green
        Start-Sleep -Seconds 1
    }
}

Start-Job -ScriptBlock {
    param($url)
    $maxWait = 30
    $waited = 0
    while ($waited -lt $maxWait) {
        Start-Sleep -Seconds 2
        $waited += 2
        try {
            $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            if ($resp.StatusCode -eq 200) {
                Start-Process $url
                break
            }
        } catch {
            # Tunggu server aktif
        }
    }
} -ArgumentList "http://localhost:8082" | Out-Null

Write-Host "[INFO] Browser akan otomatis terbuka ke: http://localhost:8082" -ForegroundColor Green

if (Get-Command bun -ErrorAction SilentlyContinue) {
    Write-Host "[INFO] Menjalankan via Bun (bun run dev)..." -ForegroundColor Cyan
    bun run dev
} elseif (Get-Command npx -ErrorAction SilentlyContinue) {
    Write-Host "[INFO] Menjalankan via NPX (npx expo start --web --port 8082)..." -ForegroundColor Cyan
    npx expo start --web --port 8082
} else {
    Write-Host "[INFO] Menjalankan via NPM (npm run dev)..." -ForegroundColor Cyan
    npm run dev
}
