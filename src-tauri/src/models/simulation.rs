// =============================================================================
// Fichier  : src-tauri/src/models/simulation.rs
// Auteur   : KREMER Regis
// Desc.    : Structs Rust pour les resultats de simulation budgetaire
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation du fichier
// =============================================================================

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AlertLevel {
    Critical,
    Danger,
    Vigilance,
    Info,
    Conseil,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum HealthLevel {
    Critical,
    Fragile,
    Stable,
    Solid,
    Robust,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Alert {
    pub id:      String,
    pub level:   AlertLevel,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail:  Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub action:  Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Recommendation {
    pub id:       String,
    pub priority: u32,
    pub label:    String,
    pub impact:   String,
    pub action:   String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AplEstimate {
    pub estimated:  f64,
    pub confidence: AplConfidence,
    pub zone:       u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AplConfidence {
    Low,
    Medium,
    High,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubScores {
    pub housing_effort:    f64,
    pub savings:           f64,
    pub debt:              f64,
    pub income_stability:  f64,
    pub resilience:        f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetBreakdown {
    pub total_income:     f64,
    pub total_aids:       f64,
    pub housing:          f64,
    pub credits:          f64,
    pub food:             f64,
    pub transport:        f64,
    pub fixed:            f64,
    pub savings_capacity: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetResult {
    pub real_disposable_income: f64,
    pub health_score:           f64,
    pub health_level:           HealthLevel,
    pub breakdown:              BudgetBreakdown,
    pub apl_estimate:           AplEstimate,
    pub scores:                 SubScores,
    pub alerts:                 Vec<Alert>,
    pub recommendations:        Vec<Recommendation>,
}
