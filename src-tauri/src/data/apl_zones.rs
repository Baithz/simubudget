// =============================================================================
// Fichier  : src-tauri/src/data/apl_zones.rs
// Auteur   : KREMER Regis
// Desc.    : Donnees APL - plafonds de loyer et parametres de calcul par zone
//            Source : Arrete du 27 septembre 2024, JO du 28 septembre 2024
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation du fichier
// =============================================================================

/// Retourne le plafond de loyer APL (EUR/mois) selon la zone et le nombre de personnes a charge
/// # Arguments
/// * `zone` - Zone APL (1, 2 ou 3)
/// * `household_size` - Nombre de personnes dans le foyer (1 = seul, 2 = couple, 3+ = famille)
pub fn get_rent_ceiling(zone: u8, household_size: u32) -> f64 {
    match (zone, household_size) {
        (1, 1) => 322.0,
        (1, 2) => 387.0,
        (1, 3) => 466.0,
        (1, 4) => 510.0,
        (1, _) => 554.0,
        (2, 1) => 262.0,
        (2, 2) => 315.0,
        (2, 3) => 378.0,
        (2, 4) => 415.0,
        (2, _) => 452.0,
        (3, 1) => 236.0,
        (3, 2) => 285.0,
        (3, 3) => 344.0,
        (3, 4) => 378.0,
        (3, _) => 412.0,
        _       => 236.0,   // Defaut zone 3 seul
    }
}

/// Retourne le revenu plancher R0 (EUR/an) selon la zone
/// En dessous de R0, l'APL est maximale
pub fn get_r0(zone: u8) -> f64 {
    match zone {
        1 => 17_000.0,
        2 => 15_000.0,
        _ => 13_500.0,
    }
}

/// Participation minimale residuelle (part toujours a la charge du locataire)
pub const APL_MINIMUM_PARTICIPATION: f64 = 35.0;

/// Taux de couverture APL (simplifie)
pub const APL_COVERAGE_RATE: f64 = 0.90;
