# =============================================================================
# Fichier  : scripts/validate-before-release.ps1
# Auteur   : KREMER Régis
# Desc.    : Script de validation locale avant release auto-update SimuBudget.
# -----------------------------------------------------------------------------
# Changelog :
#   2026-05-04 | KREMER Régis | Création — validation Phase 6
# =============================================================================

$ErrorActionPreference = "Stop"

function Run-Step {
    param(
        [string]$Name,
        [string]$Command
    )

    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host " $Name" -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "> $Command" -ForegroundColor DarkGray

    powershell -NoProfile -ExecutionPolicy Bypass -Command $Command

    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "ECHEC : $Name" -ForegroundColor Red
        exit $LASTEXITCODE
    }

    Write-Host "OK : $Name" -ForegroundColor Green
}

Write-Host "SimuBudget — Validation avant release" -ForegroundColor Green
Write-Host "Racine attendue : C:\Dev\simubudget" -ForegroundColor DarkGray

if (-not (Test-Path "package.json")) {
    Write-Host "Erreur : lance ce script depuis la racine du projet SimuBudget." -ForegroundColor Red
    exit 1
}

Run-Step "TypeScript strict" "npm run type-check"
Run-Step "ESLint" "npm run lint"
Run-Step "Tests frontend" "npm run test"
Run-Step "Tests Rust" "npm run test:rust"
Run-Step "Build production" "npm run build"

Write-Host ""
Write-Host "Validation automatique OK." -ForegroundColor Green
Write-Host "Etape suivante : lancer npm run dev pour les tests manuels, puis npm run build:windows avant tag release." -ForegroundColor Yellow
