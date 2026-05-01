// =============================================================================
// Fichier  : src-tauri/src/commands/budget.rs
// Auteur   : KREMER Regis
// Desc.    : Commande Tauri `calculate_budget` - bridge frontend _ backend
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation du fichier
// =============================================================================

use crate::calculator::budget;
use crate::models::{profile::UserProfile, simulation::BudgetResult};

/// Commande Tauri : calcule le budget complet pour un profil utilisateur.
/// Appelee depuis React via : `invoke("calculate_budget", { profile })`
#[tauri::command]
pub fn calculate_budget(profile: UserProfile) -> Result<BudgetResult, String> {
    let result = budget::compute(&profile);
    Ok(result)
}
