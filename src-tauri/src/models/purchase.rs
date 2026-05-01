// =============================================================================
// Fichier  : src-tauri/src/models/purchase.rs
// Auteur   : KREMER Regis
// Desc.    : Structs Rust pour la simulation achat immobilier
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation du fichier
// =============================================================================

use serde::{Deserialize, Serialize};
use crate::models::simulation::{Alert, Recommendation};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PurchaseInput {
    pub property_price:      f64,
    pub property_type:       String,
    pub surface:             f64,
    pub city:                String,
    pub department:          String,
    pub condition:           String,
    pub usage:               String,
    pub renovation_budget:   f64,
    pub is_new:              bool,
    pub down_payment:        f64,
    pub loan_duration_years: u32,
    pub interest_rate:       Option<f64>,
    pub insurance_rate:      Option<f64>,
    pub other_loans_monthly: f64,
    pub monthly_income:      f64,
    pub age:                 u32,
    pub is_smoker:           bool,
    pub household_size:      u32,
    pub is_first_time_buyer: bool,
    pub fiscal_reference_income: Option<f64>,
    pub employer_over_10:    bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PtzResult {
    pub eligible:       bool,
    pub zone:           Option<String>,
    pub amount:         Option<f64>,
    pub deferral_years: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PurchaseResult {
    pub notary_fees:            f64,
    pub guarantee_fees:         f64,
    pub total_operation_cost:   f64,
    pub loan_amount:            f64,
    pub monthly_payment_no_insurance:   f64,
    pub monthly_payment_with_insurance: f64,
    pub total_interest_paid:    f64,
    pub total_insurance_paid:   f64,
    pub ptz:                    PtzResult,
    pub monthly_phase1:         Option<f64>,
    pub monthly_phase2:         Option<f64>,
    pub debt_ratio_post_purchase:        f64,
    pub disposable_income_post_purchase: f64,
    pub down_payment_ratio:     f64,
    pub residual_savings:       f64,
    pub break_even_years:       f64,
    pub wealth_at_5_years:      f64,
    pub wealth_at_10_years:     f64,
    pub rent_equivalent:        f64,
    pub ssf_before:             f64,
    pub ssf_after:              f64,
    pub alerts:                 Vec<Alert>,
    pub recommendations:        Vec<Recommendation>,
}
