// =============================================================================
// Fichier  : src-tauri/src/data/reference_costs.rs
// Auteur   : KREMER Regis
// Desc.    : Couts de reference (alimentation, transport, taux credit estimatifs)
//            Source : INSEE 2024, CRE, Empruntis
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation du fichier
// =============================================================================

/// Cout alimentation mensuel par adulte (INSEE 2024, EUR)
pub const FOOD_COST_PER_ADULT: f64 = 250.0;

/// Surcout alimentation par enfant selon age (EUR/mois)
pub fn food_cost_per_child(age: u32) -> f64 {
    if age < 10 { 120.0 }
    else if age < 18 { 180.0 }
    else { 200.0 }
}

/// Taux credit immobilier estimatif par duree (%, valeurs mai 2025)
pub fn estimate_mortgage_rate(duration_years: u32) -> f64 {
    match duration_years {
        ..=10  => 3.10,
        11..=15 => 3.30,
        16..=20 => 3.50,
        21..=25 => 3.70,
        _       => 3.80,
    }
}

/// Taux assurance emprunteur selon age (%, du capital annuel)
pub fn estimate_insurance_rate(age: u32, is_smoker: bool) -> f64 {
    let base = match age {
        ..=34 => 0.10,
        35..=44 => 0.18,
        45..=54 => 0.30,
        55..=64 => 0.50,
        _       => 0.70,
    };
    if is_smoker { base + 0.10 } else { base }
}

/// Frais de notaire estimatifs selon le type de bien
/// Ancien : ~7.5%, Neuf : ~2.5%
pub fn estimate_notary_fees(price: f64, is_new: bool) -> f64 {
    if is_new { price * 0.025 } else { price * 0.075 }
}

/// Frais de garantie (caution Credit Logement) : ~1.5% dont ~75% recuperables
pub fn estimate_guarantee_fees(capital: f64) -> f64 {
    capital * 0.015
}

/// Score de stabilite des revenus selon le type d'emploi (0-1)
pub fn employment_stability_score(employment_type: &str) -> f64 {
    match employment_type {
        "cdi"       => 1.0,
        "fonctionnaire" => 1.0,
        "cdd"       => 0.55,
        "freelance" => 0.50,
        "unemployed"=> 0.20,
        "retired"   => 0.90,
        _           => 0.50,
    }
}
