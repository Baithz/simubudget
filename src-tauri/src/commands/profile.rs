// =============================================================================
// Fichier  : src-tauri/src/commands/profile.rs
// Auteur   : KREMER Regis
// Desc.    : Commandes Tauri pour la gestion des profils utilisateur
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation du fichier
// =============================================================================

use crate::db::{profile_repo, DbState};
use crate::models::profile::UserProfile;
use tauri::State;

/// Sauvegarde un profil en base SQLite
#[tauri::command]
pub fn save_profile(state: State<DbState>, profile: UserProfile) -> Result<(), String> {
    let conn = state.inner().0.lock().map_err(|e| e.to_string())?;
    profile_repo::save(&conn, &profile).map_err(|e| e.to_string())
}

/// Charge le profil le plus recent
#[tauri::command]
pub fn load_profile(state: State<DbState>) -> Result<Option<UserProfile>, String> {
    let conn = state.inner().0.lock().map_err(|e| e.to_string())?;
    profile_repo::load_latest(&conn).map_err(|e| e.to_string())
}

/// Charge un profil par son id
#[tauri::command]
#[allow(dead_code)]
pub fn load_profile_by_id(
    state: State<DbState>,
    id: String,
) -> Result<Option<UserProfile>, String> {
    let conn = state.inner().0.lock().map_err(|e| e.to_string())?;
    profile_repo::load(&conn, &id).map_err(|e| e.to_string())
}

/// Liste les profils disponibles (id, nom, date)
#[tauri::command]
#[allow(dead_code)]
pub fn list_profiles(state: State<DbState>) -> Result<Vec<(String, String, String)>, String> {
    let conn = state.inner().0.lock().map_err(|e| e.to_string())?;
    profile_repo::list(&conn).map_err(|e| e.to_string())
}

/// Supprime un profil
#[tauri::command]
#[allow(dead_code)]
pub fn delete_profile(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.inner().0.lock().map_err(|e| e.to_string())?;
    profile_repo::delete(&conn, &id).map_err(|e| e.to_string())
}
