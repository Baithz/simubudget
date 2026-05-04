# =============================================================================
# Fichier  : scripts/prepare-release-v2.5.1.ps1
# Auteur   : KREMER Régis
# Desc.    : Aide à la préparation de la release SimuBudget v2.5.1.
# -----------------------------------------------------------------------------
# Changelog :
#   2026-05-04 | KREMER Régis | Création — préparation version patch
#   2026-05-04 | KREMER Régis | Correction échappement guillemets PowerShell
# =============================================================================

$ErrorActionPreference = "Stop"

if (-not (Test-Path "package.json")) {
    Write-Host "Erreur : lance ce script depuis la racine du projet SimuBudget." -ForegroundColor Red
    exit 1
}

Write-Host "Préparation release SimuBudget v2.5.1" -ForegroundColor Green
Write-Host "Ce script ne crée pas le tag automatiquement. Il affiche les commandes sûres." -ForegroundColor Yellow
Write-Host ""

Write-Host "1) Aligner package.json / package-lock.json :" -ForegroundColor Cyan
Write-Host "npm version patch --no-git-tag-version" -ForegroundColor White
Write-Host ""

Write-Host "2) Vérifier et aligner manuellement :" -ForegroundColor Cyan
Write-Host "src-tauri/tauri.conf.json -> version 2.5.1" -ForegroundColor White
Write-Host "src-tauri/Cargo.toml       -> version 2.5.1" -ForegroundColor White
Write-Host ""

Write-Host "3) Valider :" -ForegroundColor Cyan
Write-Host "npm run type-check" -ForegroundColor White
Write-Host "npm run lint" -ForegroundColor White
Write-Host "npm run test" -ForegroundColor White
Write-Host "npm run test:rust" -ForegroundColor White
Write-Host "npm run build:windows" -ForegroundColor White
Write-Host ""

Write-Host "4) Commit + tag :" -ForegroundColor Cyan
Write-Host "git add ." -ForegroundColor White
Write-Host 'git commit -m "chore: prepare release v2.5.1"' -ForegroundColor White
Write-Host "git push origin main" -ForegroundColor White
Write-Host "git tag v2.5.1" -ForegroundColor White
Write-Host "git push origin v2.5.1" -ForegroundColor White