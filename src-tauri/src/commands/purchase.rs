// =============================================================================
// Fichier  : src-tauri/src/commands/purchase.rs
// Auteur   : KREMER Regis
// Desc.    : Commande Tauri `simulate_purchase` - bridge frontend _ backend
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation du fichier
// =============================================================================

use crate::calculator::purchase;
use crate::models::purchase::{PurchaseInput, PurchaseResult};

/// Commande Tauri : simule un achat immobilier complet.
/// Appelee depuis React via : `invoke("simulate_purchase", { input })`
#[tauri::command]
pub fn simulate_purchase(input: PurchaseInput) -> Result<PurchaseResult, String> {
    let result = purchase::compute(&input);
    Ok(result)
}
