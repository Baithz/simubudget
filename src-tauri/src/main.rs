// =============================================================================
// Fichier  : src-tauri/src/main.rs
// Auteur   : KREMER Régis
// Desc.    : Point d'entrée Tauri — enregistrement des plugins et commandes.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Régis | Création Phase 0
//   2026-05-01 | KREMER Régis | Correction modules Rust + nettoyage commandes inexistantes
// =============================================================================

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod calculator;
mod commands;
mod data;
mod db;
mod models;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            commands::budget::calculate_budget,
            commands::purchase::simulate_purchase,
            commands::profile::save_profile,
            commands::profile::load_profile,
        ])
        .run(tauri::generate_context!())
        .expect("Erreur lors du démarrage de SimuBudget");
}
