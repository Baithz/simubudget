// =============================================================================
// Fichier  : src-tauri/src/models/profile.rs
// Auteur   : KREMER Regis
// Desc.    : Struct UserProfile - profil financier de l'utilisateur
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation du fichier
// =============================================================================

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChildProfile {
    pub age:           u32,
    pub custody_type:  String,
    pub childcare_type:String,
    pub childcare_cost: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreditItem {
    pub name:            String,
    pub monthly_payment: f64,
    pub remaining_months:u32,
    #[serde(rename = "type")]
    pub credit_type:     String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HousingProfile {
    #[serde(rename = "type")]
    pub housing_type:          String,
    pub rent:                  Option<f64>,
    pub charges:               Option<f64>,
    pub purchase_loan_monthly: Option<f64>,
    pub condo_fees:            Option<f64>,
    pub property_tax:          Option<f64>,
    pub maintenance_provision: Option<f64>,
    pub surface:               f64,
    pub heating_type:          String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserProfile {
    pub id:          String,
    pub created_at:  String,
    pub updated_at:  String,

    // Situation
    pub situation:      String,
    pub employment_type: String,

    // Revenus (EUR/mois)
    pub salary_net:          f64,
    pub bonus_annual:        f64,
    pub variable_income_min: f64,
    pub variable_income_max: f64,
    pub variable_enabled:    bool,
    pub allocations_total:   f64,
    pub pension_received:    f64,
    pub rental_income:       f64,
    pub other_income:        f64,

    // Famille
    pub children:          Vec<ChildProfile>,
    pub partner_salary_net: Option<f64>,

    // Logement
    pub current_housing: HousingProfile,

    // Charges
    pub credits:        Vec<CreditItem>,
    pub phone_internet: f64,
    pub insurance_total:f64,
    pub pension_paid:   f64,
    pub other_fixed:    f64,

    // Epargne
    pub savings_months: f64,

    // Geo
    pub department: String,
    pub city:       String,
    pub apl_zone:   u8,
}
