// =============================================================================
// Fichier  : src-tauri/src/calculator/housing.rs
// Auteur   : KREMER Regis
// Desc.    : Calculs specifiques a la location - APL approximative, taux d'effort
//            Formule APL : max(0, (Loyer_CC _ Particip_min _ Tp) _ Taux_couverture)
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation du fichier
//   2026-05-01 | KREMER Regis | Masquage warning dead_code sur effort_ratio utilise en tests
// =============================================================================

use crate::data::apl_zones;
use crate::models::profile::UserProfile;
use crate::models::simulation::{AplConfidence, AplEstimate};

/// Estime le montant APL mensuel pour un profil locataire.
///
/// # Formule simplifiee
/// ```text
/// APL = max(0, (Loyer_CC - Participation_min - Tp) * Taux_couverture)
/// Tp  = f(R0, revenus_annuels, composition_familiale)
/// ```
pub fn estimate_apl(profile: &UserProfile) -> AplEstimate {
    // Pas de APL si non-locataire
    match profile.current_housing.housing_type.as_str() {
        "tenant" | "colocation" => {}
        _ => {
            return AplEstimate {
                estimated: 0.0,
                confidence: AplConfidence::High,
                zone: profile.apl_zone,
            }
        }
    }

    let rent = profile.current_housing.rent.unwrap_or(0.0);
    let charges = profile.current_housing.charges.unwrap_or(0.0);
    let rent_cc = rent + charges;

    let zone = profile.apl_zone;

    // Taille du foyer
    let household_size = household_size(profile);

    // Plafond de loyer pris en compte
    let ceiling = apl_zones::get_rent_ceiling(zone, household_size);
    let eligible_rent = rent_cc.min(ceiling);

    // Revenus annuels bruts du foyer
    let annual_income = annual_household_income(profile);

    // R0 de la zone
    let r0 = apl_zones::get_r0(zone);

    // Si revenus > 3 * R0 -> pas d'APL
    if annual_income > r0 * 3.0 {
        return AplEstimate {
            estimated: 0.0,
            confidence: AplConfidence::Medium,
            zone,
        };
    }

    // Calcul de Tp (participation personnelle)
    let tp = if annual_income <= r0 {
        apl_zones::APL_MINIMUM_PARTICIPATION // Tp minimum
    } else {
        let ratio = (annual_income - r0) / (r0 * 2.0);
        apl_zones::APL_MINIMUM_PARTICIPATION + ratio * (eligible_rent * 0.50)
    };

    // APL estimee
    let raw =
        (eligible_rent - apl_zones::APL_MINIMUM_PARTICIPATION - tp) * apl_zones::APL_COVERAGE_RATE;
    let estimated = raw.max(0.0).round();

    AplEstimate {
        estimated,
        confidence: AplConfidence::Medium,
        zone,
    }
}

/// Calcule le taux d'effort logement (loyer CC / revenus nets + aides)
/// Retourne un ratio 0-1
#[allow(dead_code)]
pub fn effort_ratio(rent_cc: f64, total_income_with_aids: f64) -> f64 {
    if total_income_with_aids <= 0.0 {
        return 1.0;
    }
    rent_cc / total_income_with_aids
}

// --- Helpers prives -----------------------------------------------------------

fn household_size(profile: &UserProfile) -> u32 {
    let base = match profile.situation.as_str() {
        "couple" | "cohabiting" => 2,
        _ => 1,
    };
    let children: u32 = profile
        .children
        .iter()
        .map(|c| {
            match c.custody_type.as_str() {
                "full" => 1,
                "alternate" => 1, // Compte meme en garde alternee pour les aides
                _ => 0,
            }
        })
        .sum();
    base + children
}

fn annual_household_income(profile: &UserProfile) -> f64 {
    let monthly = profile.salary_net
        + profile.partner_salary_net.unwrap_or(0.0)
        + profile.rental_income
        + profile.other_income
        + profile.bonus_annual / 12.0;
    monthly * 12.0
}

// --- Tests --------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::profile::{HousingProfile, UserProfile};
    use approx::assert_abs_diff_eq;

    fn base_profile(salary: f64, rent: f64, charges: f64, zone: u8) -> UserProfile {
        UserProfile {
            id: "test".into(),
            created_at: "".into(),
            updated_at: "".into(),
            situation: "single".into(),
            employment_type: "cdi".into(),
            salary_net: salary,
            bonus_annual: 0.0,
            variable_income_min: 0.0,
            variable_income_max: 0.0,
            variable_enabled: false,
            allocations_total: 0.0,
            pension_received: 0.0,
            rental_income: 0.0,
            other_income: 0.0,
            children: vec![],
            partner_salary_net: None,
            current_housing: HousingProfile {
                housing_type: "tenant".into(),
                rent: Some(rent),
                charges: Some(charges),
                purchase_loan_monthly: None,
                condo_fees: None,
                property_tax: None,
                maintenance_provision: None,
                surface: 30.0,
                heating_type: "collective".into(),
            },
            credits: vec![],
            phone_internet: 0.0,
            insurance_total: 0.0,
            pension_paid: 0.0,
            other_fixed: 0.0,
            savings_months: 0.0,
            department: "69".into(),
            city: "Lyon".into(),
            apl_zone: zone,
        }
    }

    #[test]
    fn test_apl_low_income_zone2() {
        // Lucas : 1 800EUR/mois, loyer CC 650EUR, Lyon zone 2
        let profile = base_profile(1800.0, 600.0, 50.0, 2);
        let apl = estimate_apl(&profile);
        // APL attendue : 100-170EUR
        assert!(
            apl.estimated >= 80.0 && apl.estimated <= 200.0,
            "APL hors plage : {}",
            apl.estimated
        );
    }

    #[test]
    fn test_apl_high_income_zero() {
        // Revenus tres eleves -> APL = 0
        let profile = base_profile(5000.0, 800.0, 100.0, 1);
        let apl = estimate_apl(&profile);
        assert_abs_diff_eq!(apl.estimated, 0.0, epsilon = 1.0);
    }

    #[test]
    fn test_apl_owner_zero() {
        let mut profile = base_profile(1800.0, 0.0, 0.0, 2);
        profile.current_housing.housing_type = "owner".into();
        let apl = estimate_apl(&profile);
        assert_abs_diff_eq!(apl.estimated, 0.0, epsilon = 0.01);
    }

    #[test]
    fn test_effort_ratio() {
        // 650EUR / 1800EUR = 36.1%
        let ratio = effort_ratio(650.0, 1800.0);
        assert_abs_diff_eq!(ratio, 0.361, epsilon = 0.01);
    }
}
