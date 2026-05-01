// =============================================================================
// Fichier  : src-tauri/src/data/ptz_data.rs
// Auteur   : KREMER Regis
// Desc.    : Donnees PTZ 2025 - zones, plafonds, quotites
//            Source : Decret ndeg 2023-1297 du 28 decembre 2023
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation du fichier
// =============================================================================

/// Zone PTZ
#[derive(Debug, Clone, PartialEq)]
pub enum PtzZone {
    ABis,
    A,
    B1,
    B2,
    C,
}

impl PtzZone {
    pub fn as_str(&self) -> &'static str {
        match self {
            PtzZone::ABis => "A_BIS",
            PtzZone::A    => "A",
            PtzZone::B1   => "B1",
            PtzZone::B2   => "B2",
            PtzZone::C    => "C",
        }
    }
}

/// Retourne la zone PTZ d'une ville (liste partielle - completee progressivement)
pub fn get_zone(city: &str) -> Option<PtzZone> {
    match city {
        "Paris" | "Boulogne-Billancourt" | "Neuilly-sur-Seine" | "Levallois-Perret" => Some(PtzZone::ABis),
        "Lyon"  | "Marseille" | "Nice" | "Versailles" | "Bordeaux" => Some(PtzZone::A),
        "Toulouse" | "Nantes" | "Strasbourg" | "Montpellier" | "Lille"
        | "Rennes"  | "Grenoble" => Some(PtzZone::B1),
        "Tours"  | "Dijon" | "Rouen" | "Reims" | "Metz" | "Nancy"
        | "Clermont-Ferrand" => Some(PtzZone::B2),
        "Limoges" | "Brest" | "Le Mans" | "Caen" => Some(PtzZone::C),
        _ => Some(PtzZone::C),  // Defaut : zone C
    }
}

/// Plafond de revenus PTZ (revenus fiscaux N-2, EUR/an) selon la zone et la taille du foyer
/// Indice 0 = 1 personne, indice 4 = 5+ personnes
pub fn get_income_ceiling(zone: &PtzZone, household_size: u32) -> f64 {
    let idx = (household_size.saturating_sub(1) as usize).min(4);
    match zone {
        PtzZone::ABis | PtzZone::A => [37_000.0, 51_800.0, 62_900.0, 74_000.0, 85_100.0][idx],
        PtzZone::B1               => [30_000.0, 42_000.0, 51_000.0, 60_000.0, 69_000.0][idx],
        PtzZone::B2               => [27_000.0, 37_800.0, 45_900.0, 54_000.0, 62_100.0][idx],
        PtzZone::C                => [24_000.0, 33_600.0, 40_800.0, 48_000.0, 55_200.0][idx],
    }
}

/// Quotite PTZ (fraction du prix eligible financee a taux zero)
pub fn get_quotity(zone: &PtzZone, is_new: bool) -> f64 {
    match zone {
        PtzZone::ABis | PtzZone::A | PtzZone::B1 => 0.40,
        PtzZone::B2   | PtzZone::C               => if is_new { 0.20 } else { 0.40 },
    }
}

/// Plafond du prix de l'operation pris en compte pour le PTZ (EUR)
pub fn get_price_ceiling(zone: &PtzZone, household_size: u32) -> f64 {
    let idx = (household_size.saturating_sub(1) as usize).min(4);
    match zone {
        PtzZone::ABis | PtzZone::A => [150_000.0, 210_000.0, 255_000.0, 300_000.0, 345_000.0][idx],
        PtzZone::B1               => [135_000.0, 189_000.0, 230_000.0, 270_000.0, 310_000.0][idx],
        PtzZone::B2               => [110_000.0, 154_000.0, 187_000.0, 220_000.0, 253_000.0][idx],
        PtzZone::C                => [100_000.0,  140_000.0, 170_000.0, 200_000.0, 230_000.0][idx],
    }
}

/// Duree du differe PTZ selon la part des revenus par rapport au plafond
/// * < 50% du plafond -> 15 ans de differe
/// * 50-75% -> 10 ans
/// * > 75% -> 5 ans
pub fn get_deferral_years(income: f64, ceiling: f64) -> u32 {
    let ratio = income / ceiling;
    if ratio <= 0.50 { 15 }
    else if ratio <= 0.75 { 10 }
    else { 5 }
}
