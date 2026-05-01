// =============================================================================
// Fichier  : src-tauri/src/commands/updater.rs
// Auteur   : KREMER Régis
// Desc.    : Commandes Tauri pour la gestion des mises à jour automatiques.
//            Expose check_update, install_update et get_app_version au frontend.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-05-01 | KREMER Régis | Création — mise à jour automatique via GitHub Releases
// =============================================================================

use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;

/// Informations sur une mise à jour disponible
#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct UpdateInfo {
    pub available:       bool,
    pub current_version: String,
    pub new_version:     Option<String>,
    pub release_notes:   Option<String>,
    pub release_date:    Option<String>,
}

/// Vérifie si une mise à jour est disponible sur GitHub Releases.
/// Retourne les informations de version sans lancer l'installation.
#[tauri::command]
pub async fn check_update(app: AppHandle) -> Result<UpdateInfo, String> {
    let current = app.package_info().version.to_string();

    match app.updater_builder().build() {
        Err(e) => Err(format!("Updater non disponible : {e}")),
        Ok(updater) => {
            match updater.check().await {
                Err(e) => Err(format!("Erreur de vérification : {e}")),
                Ok(None) => Ok(UpdateInfo {
                    available:       false,
                    current_version: current,
                    new_version:     None,
                    release_notes:   None,
                    release_date:    None,
                }),
                Ok(Some(update)) => {
                    let notes = update.body.clone();
                    let date  = update.date.map(|d| d.to_string());
                    Ok(UpdateInfo {
                        available:       true,
                        current_version: current,
                        new_version:     Some(update.version.clone()),
                        release_notes:   notes,
                        release_date:    date,
                    })
                }
            }
        }
    }
}

/// Lance le téléchargement et l'installation de la mise à jour.
/// L'app se relancera automatiquement après installation.
#[tauri::command]
pub async fn install_update(app: AppHandle) -> Result<(), String> {
    match app.updater_builder().build() {
        Err(e) => Err(format!("Updater non disponible : {e}")),
        Ok(updater) => {
            match updater.check().await {
                Err(e) => Err(format!("Erreur de vérification : {e}")),
                Ok(None) => Err("Aucune mise à jour disponible.".to_string()),
                Ok(Some(update)) => {
                    update
                        .download_and_install(|_chunk, _total| {}, || {})
                        .await
                        .map_err(|e| format!("Échec de l'installation : {e}"))?;
                    Ok(())
                }
            }
        }
    }
}

/// Retourne la version actuelle de l'application (depuis Cargo.toml).
#[tauri::command]
pub fn get_app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}
