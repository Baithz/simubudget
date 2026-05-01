// =============================================================================
// Fichier  : src-tauri/src/calculator/budget.rs
// Auteur   : KREMER Regis
// Desc.    : Calcul du budget global et du reste a vivre reel
//            Formule : RdV = Revenus + Aides _ Logement _ Credits _ Alim _ Transport _ Fixes
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation du fichier
// =============================================================================

use crate::models::profile::UserProfile;
use crate::models::simulation::{BudgetBreakdown, BudgetResult};
use crate::calculator::{housing, scoring, rules};
use crate::data::reference_costs;

/// Calcule le budget complet d'un profil utilisateur.
/// Retourne un BudgetResult avec tous les indicateurs et alertes.
pub fn compute(profile: &UserProfile) -> BudgetResult {
    // -- 1. Revenus totaux ----------------------------------------------------
    let salary      = profile.salary_net;
    let bonus       = profile.bonus_annual / 12.0;     // Lissage annuel sur 12 mois
    let partner     = profile.partner_salary_net.unwrap_or(0.0);
    let allocs      = profile.allocations_total;
    let pension_in  = profile.pension_received;
    let rental      = profile.rental_income;
    let other       = profile.other_income;

    let total_income = salary + bonus + partner + rental + other + pension_in;
    let total_gross  = total_income + allocs;

    // -- 2. Estimation APL ----------------------------------------------------
    let apl         = housing::estimate_apl(profile);
    let _total_aids = allocs + apl.estimated;   // allocs deja dans le calcul, APL s'y ajoute

    // -- 3. Charges logement --------------------------------------------------
    let housing_cost = compute_housing_cost(profile);

    // -- 4. Credits en cours --------------------------------------------------
    let credits_total: f64 = profile.credits.iter().map(|c| c.monthly_payment).sum();

    // -- 5. Alimentation ------------------------------------------------------
    let nb_adults = match profile.situation.as_str() {
        "couple" | "cohabiting" => 2,
        _ => 1,
    };
    let food_adults = reference_costs::FOOD_COST_PER_ADULT * nb_adults as f64;
    let food_children: f64 = profile.children.iter().map(|c| {
        let factor = match c.custody_type.as_str() {
            "full"      => 1.0,
            "alternate" => 0.5,
            _           => 0.0,
        };
        reference_costs::food_cost_per_child(c.age) * factor
    }).sum();
    let food_total = food_adults + food_children;

    // -- 6. Transport (estimation forfaitaire) ---------------------------------
    let transport_est = 100.0;   // Valeur par defaut Phase 0 (Phase 1 : formulaire transport)

    // -- 7. Charges fixes -----------------------------------------------------
    let fixed = profile.phone_internet
        + profile.insurance_total
        + profile.pension_paid
        + profile.other_fixed;

    // -- 8. Garde d'enfants ---------------------------------------------------
    let childcare: f64 = profile.children.iter().map(|c| {
        let factor = match c.custody_type.as_str() {
            "full"      => 1.0,
            "alternate" => 0.5,
            _           => 0.0,
        };
        c.childcare_cost * factor
    }).sum();

    // -- 9. Reste a vivre reel -------------------------------------------------
    //  RdV = (Revenus + APL) _ Logement _ Credits _ Alim _ Transport _ Fixes _ Garde
    let real_disposable_income = total_gross + apl.estimated
        - housing_cost
        - credits_total
        - food_total
        - transport_est
        - fixed
        - childcare;

    let breakdown = BudgetBreakdown {
        total_income,
        total_aids:       apl.estimated,
        housing:          housing_cost,
        credits:          credits_total,
        food:             food_total,
        transport:        transport_est,
        fixed,
        savings_capacity: real_disposable_income.max(0.0),
    };

    // -- 10. Scoring et alertes ------------------------------------------------
    let scores = scoring::compute_scores(profile, real_disposable_income, &breakdown);
    let health_score = scoring::compute_ssf(&scores);
    let health_level = scoring::health_level(health_score);
    let alerts       = rules::generate_alerts(profile, real_disposable_income, &breakdown, &scores);
    let recommendations = rules::generate_recommendations(profile, real_disposable_income, &breakdown, &scores, &alerts);

    BudgetResult {
        real_disposable_income,
        health_score,
        health_level,
        breakdown,
        apl_estimate: apl,
        scores,
        alerts,
        recommendations,
    }
}

/// Calcule la charge mensuelle liee au logement selon le type (locataire / proprietaire)
fn compute_housing_cost(profile: &UserProfile) -> f64 {
    let h = &profile.current_housing;
    match h.housing_type.as_str() {
        "tenant" | "colocation" => {
            let rent    = h.rent.unwrap_or(0.0);
            let charges = h.charges.unwrap_or(0.0);
            rent + charges
        }
        "owner" => {
            let loan    = h.purchase_loan_monthly.unwrap_or(0.0);
            let condo   = h.condo_fees.unwrap_or(0.0);
            let tax     = h.property_tax.unwrap_or(0.0) / 12.0;
            let maint   = h.maintenance_provision.unwrap_or(0.0) / 12.0;
            loan + condo + tax + maint
        }
        "hosted" => 0.0,
        _        => 0.0,
    }
}

// --- Tests unitaires ----------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::profile::{UserProfile, HousingProfile};
    use approx::assert_abs_diff_eq;

    fn profile_lucas() -> UserProfile {
        UserProfile {
            id:          "test_lucas".into(),
            created_at:  "2026-04-26T00:00:00Z".into(),
            updated_at:  "2026-04-26T00:00:00Z".into(),
            situation:          "single".into(),
            employment_type:    "cdi".into(),
            salary_net:         1800.0,
            bonus_annual:       0.0,
            variable_income_min: 0.0,
            variable_income_max: 0.0,
            variable_enabled:   false,
            allocations_total:  0.0,
            pension_received:   0.0,
            rental_income:      0.0,
            other_income:       0.0,
            children:           vec![],
            partner_salary_net: None,
            current_housing: HousingProfile {
                housing_type:          "tenant".into(),
                rent:                  Some(600.0),
                charges:               Some(50.0),
                purchase_loan_monthly: None,
                condo_fees:            None,
                property_tax:          None,
                maintenance_provision: None,
                surface:               30.0,
                heating_type:          "collective".into(),
            },
            credits:        vec![],
            phone_internet: 30.0,
            insurance_total:30.0,
            pension_paid:   0.0,
            other_fixed:    0.0,
            savings_months: 0.0,
            department:     "69".into(),
            city:           "Lyon".into(),
            apl_zone:       2,
        }
    }

    #[test]
    fn test_lucas_budget_calcul() {
        let profile = profile_lucas();
        let result  = compute(&profile);

        // Le reste a vivre doit etre positif
        assert!(result.real_disposable_income > 0.0,
            "RdV negatif : {}", result.real_disposable_income);

        // Revenus = 1800EUR, loyer CC = 650EUR, alim = 250EUR, fixed ~60EUR, transport ~100EUR
        // RdV _ 1800 - 650 - 250 - 100 - 60 = ~740EUR (+ APL estimee ~120-150EUR)
        assert_abs_diff_eq!(result.real_disposable_income, 800.0, epsilon = 200.0);
    }

    #[test]
    fn test_lucas_budget_ssf_range() {
        let profile = profile_lucas();
        let result  = compute(&profile);
        assert!(result.health_score >= 0.0 && result.health_score <= 100.0,
            "SSF hors plage : {}", result.health_score);
    }

    #[test]
    fn test_housing_cost_tenant() {
        let mut profile = profile_lucas();
        profile.current_housing.rent    = Some(1000.0);
        profile.current_housing.charges = Some(100.0);
        let cost = compute_housing_cost(&profile);
        assert_abs_diff_eq!(cost, 1100.0, epsilon = 0.01);
    }

    #[test]
    fn test_food_cost_single() {
        // Celibataire sans enfant : 250EUR
        let profile = profile_lucas();
        let result  = compute(&profile);
        assert_abs_diff_eq!(result.breakdown.food, 250.0, epsilon = 0.01);
    }
}
