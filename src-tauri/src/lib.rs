// =============================================================================
// Fichier  : src-tauri/src/lib.rs
// Auteur   : KREMER Regis
// Desc.    : Point d'entree de la crate library - enregistrement Tauri complet
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation initiale Phase 0
//   2026-04-26 | KREMER Regis | Ajout DbState + commandes profil Phase 1
//   2026-04-26 | KREMER Regis | Correction use tauri::Manager + commandes Phase 1
//   2026-05-01 | KREMER Regis | Correction Phase 13C.2 — activation plugin updater sans permission process invalide
// =============================================================================

pub mod calculator;
pub mod commands;
pub mod data;
pub mod db;
pub mod models;

use db::DbState;
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()
                .expect("Impossible de trouver AppData");
            let conn = db::init_db(app_data_dir)
                .expect("Echec initialisation SQLite");
            app.manage(DbState(Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::budget::calculate_budget,
            commands::purchase::simulate_purchase,
            commands::profile::save_profile,
            commands::profile::load_profile,
            commands::profile::load_profile_by_id,
            commands::profile::list_profiles,
            commands::profile::delete_profile,
        ])
        .run(tauri::generate_context!())
        .expect("Erreur au demarrage de Tauri");
}
