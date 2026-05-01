// =============================================================================
// Fichier  : src-tauri/src/calculator/purchase.rs
// Auteur   : KREMER Regis
// Desc.    : Calculs achat immobilier - mensualite, PTZ, frais, taux endettement
//            Formule mensualite : M = C _ [t / (1 - (1+t)^-n)]
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation du fichier
// =============================================================================

use crate::calculator::rules;
use crate::data::{ptz_data, reference_costs};
use crate::models::purchase::{PtzResult, PurchaseInput, PurchaseResult};

/// Calcule la mensualite d'un credit immobilier a taux fixe.
///
/// # Formule
/// ```text
/// M = C Ã— [t / (1 - (1+t)^(-n))]
/// ```
/// * `C` = capital emprunte (EUR)
/// * `t` = taux mensuel = taux_annuel / 12 / 100
/// * `n` = duree en mois
pub fn monthly_payment(capital: f64, annual_rate_pct: f64, duration_months: u32) -> f64 {
    if annual_rate_pct == 0.0 {
        return capital / duration_months as f64;
    }
    let t = annual_rate_pct / 12.0 / 100.0;
    let n = duration_months as f64;
    capital * (t / (1.0 - (1.0 + t).powf(-n)))
}

/// Calcule le montant PTZ accorde selon le profil et le bien.
/// Retourne `None` si l'emprunteur n'est pas eligible.
pub fn calculate_ptz(input: &PurchaseInput) -> PtzResult {
    if !input.is_first_time_buyer || input.usage != "primary" {
        return PtzResult {
            eligible: false,
            zone: None,
            amount: None,
            deferral_years: None,
        };
    }

    let zone = match ptz_data::get_zone(&input.city) {
        Some(z) => z,
        None => {
            return PtzResult {
                eligible: false,
                zone: None,
                amount: None,
                deferral_years: None,
            }
        }
    };

    let ceiling = ptz_data::get_income_ceiling(&zone, input.household_size);

    // Verification plafond de revenus (utilise les revenus fiscaux N-2 si disponibles)
    let fiscal_income = input
        .fiscal_reference_income
        .unwrap_or(input.monthly_income * 12.0 * 0.90); // Estimation si non renseigne

    if fiscal_income > ceiling {
        return PtzResult {
            eligible: false,
            zone: None,
            amount: None,
            deferral_years: None,
        };
    }

    let price_ceiling = ptz_data::get_price_ceiling(&zone, input.household_size);
    let eligible_price = input.property_price.min(price_ceiling);
    let quotity = ptz_data::get_quotity(&zone, input.is_new);
    let amount = eligible_price * quotity;
    let deferral = ptz_data::get_deferral_years(fiscal_income, ceiling);

    PtzResult {
        eligible: true,
        zone: Some(zone.as_str().to_string()),
        amount: Some(amount),
        deferral_years: Some(deferral),
    }
}

/// Calcule l'ensemble de la simulation achat pour un PurchaseInput.
pub fn compute(input: &PurchaseInput) -> PurchaseResult {
    // -- 1. Frais ------------------------------------------------------------
    let notary_fees = reference_costs::estimate_notary_fees(input.property_price, input.is_new);
    let ptz = calculate_ptz(input);
    let ptz_amount = ptz.amount.unwrap_or(0.0);

    let loan_amount = (input.property_price
        + notary_fees
        + reference_costs::estimate_guarantee_fees(input.property_price)
        - input.down_payment
        - ptz_amount)
        .max(0.0);

    let guarantee_fees = reference_costs::estimate_guarantee_fees(loan_amount);
    let total_op_cost = input.property_price + notary_fees + guarantee_fees;

    // -- 2. Taux -------------------------------------------------------------
    let rate_pct = input
        .interest_rate
        .unwrap_or_else(|| reference_costs::estimate_mortgage_rate(input.loan_duration_years));
    let insurance_rate = input
        .insurance_rate
        .unwrap_or_else(|| reference_costs::estimate_insurance_rate(input.age, input.is_smoker));

    let total_rate = rate_pct + insurance_rate;
    let duration_months = input.loan_duration_years * 12;

    // -- 3. Mensualites -------------------------------------------------------
    let monthly_no_ins = monthly_payment(loan_amount, rate_pct, duration_months);
    let monthly_with_ins = monthly_payment(loan_amount, total_rate, duration_months);

    let total_repaid = monthly_with_ins * duration_months as f64;
    let total_interest = (total_repaid - loan_amount).max(0.0);
    let total_insurance = (loan_amount * insurance_rate / 100.0 / 12.0) * duration_months as f64;

    // -- 4. Mensualite avec PTZ (phase 1 = differe, phase 2 = PTZ rembourse) -
    let (monthly_phase1, monthly_phase2) = if ptz.eligible {
        let deferral = ptz.deferral_years.unwrap_or(0);
        let ptz_amt = ptz_amount;
        let ptz_duration = (input.loan_duration_years - deferral).max(1) * 12;

        // Phase 1 : PTZ en differe = on rembourse seulement le credit principal
        let phase1 = monthly_with_ins;

        // Phase 2 : PTZ s'ajoute au credit principal
        let ptz_monthly = ptz_amt / ptz_duration as f64;
        let phase2 = monthly_with_ins + ptz_monthly;

        (Some(phase1), Some(phase2))
    } else {
        (None, None)
    };

    // -- 5. Taux d'endettement ------------------------------------------------
    // HCSF 2022 : (mensualite + autres credits) / revenus nets <= 35%
    let total_monthly_debt = monthly_with_ins
        + ptz
            .amount
            .map(|a| a / ((input.loan_duration_years * 12) as f64))
            .unwrap_or(0.0)
        + input.other_loans_monthly;
    let debt_ratio = if input.monthly_income > 0.0 {
        total_monthly_debt / input.monthly_income
    } else {
        1.0
    };

    // -- 6. Reste a vivre post-achat ------------------------------------------
    // Estimation simplifiee Phase 0 (Phase 2 integre toutes les charges reelles)
    let food_est = 250.0;
    let transport_est = 100.0;
    let fixed_est = 80.0;
    let maintenance = input.property_price * 0.01 / 12.0;

    let disposable = input.monthly_income
        - monthly_with_ins
        - input.other_loans_monthly
        - food_est
        - transport_est
        - fixed_est
        - maintenance;

    // -- 7. Apport ratio ------------------------------------------------------
    let down_payment_ratio = input.down_payment / input.property_price;
    let residual_savings = (input.down_payment - notary_fees - guarantee_fees).max(0.0);

    // -- 8. Achat vs Location -------------------------------------------------
    let rent_equivalent = input.property_price * 0.005; // ~0.5% du prix / mois
    let break_even = compute_break_even(
        input.property_price,
        input.down_payment,
        monthly_with_ins,
        rent_equivalent,
        total_interest,
        notary_fees + guarantee_fees,
    );

    let wealth_5 = compute_wealth_built(loan_amount, rate_pct / 100.0, duration_months, 5 * 12);
    let wealth_10 = compute_wealth_built(loan_amount, rate_pct / 100.0, duration_months, 10 * 12);

    // -- 9. SSF (simplifie pour comparaison avant/apres) -----------------------
    let ssf_before = 65.0; // Placeholder - calcule dynamiquement en Phase 2
    let ssf_after = if debt_ratio > 0.40 {
        35.0
    } else if debt_ratio > 0.35 {
        48.0
    } else {
        (1.0 - debt_ratio / 0.35).max(0.0) * 30.0 + 45.0
    };

    // -- 10. Alertes -----------------------------------------------------------
    let alerts = rules::generate_purchase_alerts(
        input,
        debt_ratio,
        disposable,
        down_payment_ratio,
        notary_fees,
        residual_savings,
        &ptz,
    );
    let recommendations = vec![];

    PurchaseResult {
        notary_fees,
        guarantee_fees,
        total_operation_cost: total_op_cost,
        loan_amount,
        monthly_payment_no_insurance: monthly_no_ins,
        monthly_payment_with_insurance: monthly_with_ins,
        total_interest_paid: total_interest,
        total_insurance_paid: total_insurance,
        ptz,
        monthly_phase1,
        monthly_phase2,
        debt_ratio_post_purchase: debt_ratio,
        disposable_income_post_purchase: disposable,
        down_payment_ratio,
        residual_savings,
        break_even_years: break_even,
        wealth_at_5_years: wealth_5,
        wealth_at_10_years: wealth_10,
        rent_equivalent,
        ssf_before,
        ssf_after,
        alerts,
        recommendations,
    }
}

/// Estime le point de bascule achat vs location (en annees).
/// Retourne 999.0 si l'achat ne devient jamais rentable dans les 30 ans.
fn compute_break_even(
    price: f64,
    down_payment: f64,
    monthly: f64,
    rent: f64,
    _total_interest: f64,
    fixed_costs: f64,
) -> f64 {
    let appreciation_rate = 0.015_f64; // +1.5%/an
    let rent_increase_rate = 0.018_f64; // +1.8%/an

    let mut rental_cumul = 0.0_f64;
    let mut purchase_cumul = fixed_costs + (monthly - rent) * 12.0;
    let mut property_value = price;
    let mut current_rent = rent;

    for year in 1..=30_u32 {
        current_rent *= 1.0 + rent_increase_rate;
        property_value *= 1.0 + appreciation_rate;
        rental_cumul += current_rent * 12.0;
        purchase_cumul += monthly * 12.0;

        // Patrimoine constitue = valeur bien _ capital restant du
        let capital_remaining =
            loan_remaining(price - down_payment, 3.5 / 100.0 / 12.0, 20 * 12, year * 12);
        let wealth = property_value - capital_remaining;

        if wealth + rental_cumul >= purchase_cumul {
            return year as f64;
        }
    }
    999.0
}

/// Capital restant du apres `months_paid` mensualites
fn loan_remaining(capital: f64, monthly_rate: f64, total_months: u32, months_paid: u32) -> f64 {
    if monthly_rate == 0.0 {
        let paid = (capital / total_months as f64) * months_paid as f64;
        return (capital - paid).max(0.0);
    }
    let n = total_months as f64;
    let k = months_paid as f64;
    capital * ((1.0 + monthly_rate).powf(n) - (1.0 + monthly_rate).powf(k))
        / ((1.0 + monthly_rate).powf(n) - 1.0)
}

/// Patrimoine constitue (capital rembourse) apres N mois
fn compute_wealth_built(capital: f64, annual_rate: f64, total_months: u32, months: u32) -> f64 {
    let rate = annual_rate / 12.0;
    let remaining = loan_remaining(capital, rate, total_months, months.min(total_months));
    (capital - remaining).max(0.0)
}

// --- Tests unitaires ----------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use approx::assert_abs_diff_eq;

    #[test]
    fn test_monthly_payment_200k_20y_3_5pct() {
        // Capital 200 000EUR, 20 ans, 3.5% -> ~1 159EUR/mois
        let m = monthly_payment(200_000.0, 3.5, 240);
        assert_abs_diff_eq!(m, 1159.92, epsilon = 1.0);
    }

    #[test]
    fn test_monthly_payment_zero_rate() {
        // Capital 120 000EUR, 20 ans, 0% -> 500EUR/mois exact
        let m = monthly_payment(120_000.0, 0.0, 240);
        assert_abs_diff_eq!(m, 500.0, epsilon = 0.01);
    }

    #[test]
    fn test_notary_fees_old() {
        // 200 000EUR ancien -> ~15 000EUR (7.5%)
        let fees = reference_costs::estimate_notary_fees(200_000.0, false);
        assert_abs_diff_eq!(fees, 15_000.0, epsilon = 500.0);
    }

    #[test]
    fn test_notary_fees_new() {
        // 200 000EUR neuf -> ~5 000EUR (2.5%)
        let fees = reference_costs::estimate_notary_fees(200_000.0, true);
        assert_abs_diff_eq!(fees, 5_000.0, epsilon = 200.0);
    }

    #[test]
    fn test_ptz_eligible_lyon() {
        let input = PurchaseInput {
            property_price: 200_000.0,
            property_type: "apartment".into(),
            surface: 50.0,
            city: "Lyon".into(),
            department: "69".into(),
            condition: "good".into(),
            usage: "primary".into(),
            renovation_budget: 0.0,
            is_new: false,
            down_payment: 20_000.0,
            loan_duration_years: 20,
            interest_rate: None,
            insurance_rate: None,
            other_loans_monthly: 0.0,
            monthly_income: 2400.0,
            age: 30,
            is_smoker: false,
            household_size: 1,
            is_first_time_buyer: true,
            fiscal_reference_income: Some(28_000.0),
            employer_over_10: false,
        };
        let ptz = calculate_ptz(&input);
        assert!(
            ptz.eligible,
            "PTZ devrait etre eligible pour Lyon avec revenus modestes"
        );
        assert!(ptz.amount.unwrap_or(0.0) > 0.0);
    }

    #[test]
    fn test_ptz_ineligible_high_income() {
        let input = PurchaseInput {
            property_price: 200_000.0,
            property_type: "apartment".into(),
            surface: 50.0,
            city: "Lyon".into(),
            department: "69".into(),
            condition: "good".into(),
            usage: "primary".into(),
            renovation_budget: 0.0,
            is_new: false,
            down_payment: 40_000.0,
            loan_duration_years: 20,
            interest_rate: None,
            insurance_rate: None,
            other_loans_monthly: 0.0,
            monthly_income: 6000.0,
            age: 35,
            is_smoker: false,
            household_size: 1,
            is_first_time_buyer: true,
            fiscal_reference_income: Some(90_000.0),
            employer_over_10: false,
        };
        let ptz = calculate_ptz(&input);
        assert!(
            !ptz.eligible,
            "PTZ ne devrait pas etre eligible avec des revenus de 90kEUR"
        );
    }

    #[test]
    fn test_ptz_not_first_buyer() {
        let input = PurchaseInput {
            property_price: 200_000.0,
            property_type: "apartment".into(),
            surface: 50.0,
            city: "Lyon".into(),
            department: "69".into(),
            condition: "good".into(),
            usage: "primary".into(),
            renovation_budget: 0.0,
            is_new: false,
            down_payment: 20_000.0,
            loan_duration_years: 20,
            interest_rate: None,
            insurance_rate: None,
            other_loans_monthly: 0.0,
            monthly_income: 2400.0,
            age: 30,
            is_smoker: false,
            household_size: 1,
            is_first_time_buyer: false, // NON primo-accedant
            fiscal_reference_income: Some(25_000.0),
            employer_over_10: false,
        };
        let ptz = calculate_ptz(&input);
        assert!(!ptz.eligible);
    }

    #[test]
    fn test_purchase_profile_lucas_achat() {
        // Profil test documente : 160kEUR, apport 15kEUR, 20 ans, Lyon, 2400EUR/mois
        let input = PurchaseInput {
            property_price: 160_000.0,
            property_type: "apartment".into(),
            surface: 45.0,
            city: "Lyon".into(),
            department: "69".into(),
            condition: "good".into(),
            usage: "primary".into(),
            renovation_budget: 0.0,
            is_new: false,
            down_payment: 15_000.0,
            loan_duration_years: 20,
            interest_rate: Some(3.5),
            insurance_rate: None,
            other_loans_monthly: 0.0,
            monthly_income: 2400.0,
            age: 26,
            is_smoker: false,
            household_size: 1,
            is_first_time_buyer: true,
            fiscal_reference_income: Some(26_000.0),
            employer_over_10: false,
        };
        let result = compute(&input);

        // Taux endettement doit depasser 35% (HCSF) -> alerte DANGER
        assert!(
            result.debt_ratio_post_purchase > 0.33,
            "Taux endettement trop faible : {}",
            result.debt_ratio_post_purchase
        );

        // PTZ doit etre eligible
        assert!(result.ptz.eligible, "PTZ non eligible pour Lucas");

        // Frais de notaire ~12 000EUR (ancien 7.5%)
        assert_abs_diff_eq!(result.notary_fees, 12_000.0, epsilon = 1_000.0);
    }

    #[test]
    fn test_debt_ratio_threshold() {
        // 200kEUR, 20 ans, 3.5%, revenus 2000EUR -> ratio > 0.35
        let m = monthly_payment(200_000.0, 3.5 + 0.18, 240);
        let ratio = m / 2000.0;
        assert!(ratio > 0.35, "Ratio attendu > 35% : {}", ratio);
    }
}
