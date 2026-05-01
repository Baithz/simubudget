# =============================================================================
# Fichier  : scripts/apply_rust_warning_fixes.ps1
# Auteur   : KREMER Régis
# Desc.    : Patch ciblé des warnings Rust dead_code sans modifier la logique métier.
# -----------------------------------------------------------------------------
# Changelog :
#   2026-05-01 | KREMER Régis | Création du script de correction warnings Rust
# =============================================================================

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

function Patch-AllowDeadCode {
    param(
        [Parameter(Mandatory = $true)][string]$RelativePath,
        [Parameter(Mandatory = $true)][string[]]$FunctionNames
    )

    $path = Join-Path $root $RelativePath
    if (-not (Test-Path $path)) {
        throw "Fichier introuvable : $RelativePath"
    }

    $content = Get-Content -Raw -Encoding UTF8 $path

    foreach ($name in $FunctionNames) {
        $pattern = "(?m)^(?!#\[allow\(dead_code\)\]\r?\n)(\s*(?:pub\s+)?fn\s+$name\s*\()"
        $replacement = "#[allow(dead_code)]`r`n`$1"
        $content = [regex]::Replace($content, $pattern, $replacement)
    }

    Set-Content -Encoding UTF8 -NoNewline -Path $path -Value $content
    Write-Host "OK  $RelativePath" -ForegroundColor Green
}

# Sécurité : corrige aussi l'accès State<Tauri> si l'ancien code est encore présent.
$profileCommands = Join-Path $root "src-tauri/src/commands/profile.rs"
if (Test-Path $profileCommands) {
    $profileContent = Get-Content -Raw -Encoding UTF8 $profileCommands
    $profileContent = $profileContent -replace "state\.0\.lock\(\)", "state.inner().0.lock()"
    Set-Content -Encoding UTF8 -NoNewline -Path $profileCommands -Value $profileContent
}

Patch-AllowDeadCode -RelativePath "src-tauri/src/commands/profile.rs" -FunctionNames @(
    "load_profile_by_id",
    "list_profiles",
    "delete_profile"
)

Patch-AllowDeadCode -RelativePath "src-tauri/src/db/mod.rs" -FunctionNames @(
    "init_db",
    "run_migrations"
)

Patch-AllowDeadCode -RelativePath "src-tauri/src/db/profile_repo.rs" -FunctionNames @(
    "load",
    "list",
    "delete"
)

Write-Host ""
Write-Host "Corrections warnings Rust appliquees. Lance maintenant : npm run test:rust" -ForegroundColor Cyan
