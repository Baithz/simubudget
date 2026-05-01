// =============================================================================
// Fichier  : src-tauri/src/calculator/scoring.rs
// Auteur   : KREMER Regis
// Desc.    : Score de Sante Financiere (SSF 0-100) - 5 sous-scores ponderes
//
//            SSF = effort_logement*0.30 + epargne*0.25 + endettement*0.20
//                + stabilite*0.15 + rebond*0.10
//            Chaque sous-score normalise 0->1, resultat multiplie par 100
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation du fichier
// =============================================================================

use crate::models::profile::UserProfile;
use crate::models::simulation::{BudgetBreakdown, HealthLevel, SubScores};
use crate::data::reference_costs;

/// Calcule le Score de Sante Financiere global (SSF, 0-100)
pub fn compute_ssf(scores: &SubScores) -> f64 {
    let raw = scores.housing_effort   * 0.30
            + scores.savings          * 0.25
            + scores.debt             * 0.20
            + scores.income_stability * 0.15
            + scores.resilience       * 0.10;
    (raw * 100.0).round().clamp(0.0, 100.0)
}

/// Calcule tous les sous-scores individuels
pub fn compute_scores(
    profile:    &UserProfile,
    rdv:        f64,
    breakdown:  &BudgetBreakdown,
) -> SubScores {
    SubScores {
        housing_effort:   score_housing_effort(breakdown),
        savings:          score_savings(profile),
        debt:             score_debt(breakdown),
        income_stability: score_stability(profile),
        resilience:       score_resilience(profile, rdv),
    }
}

/// Retourne le niveau de sante textuel selon le SSF
pub fn health_level(ssf: f64) -> HealthLevel {
    match ssf as u32 {
        0..=25  => HealthLevel::Critical,
        26..=45 => HealthLevel::Fragile,
        46..=65 => HealthLevel::Stable,
        66..=80 => HealthLevel::Solid,
        _       => HealthLevel::Robust,
    }
}

// --- Sous-scores --------------------------------------------------------------

/// Score taux d'effort logement (0-1)
/// <= 25% -> 1.0 | 25-33% -> 0.7-1.0 | 33-40% -> 0.2-0.7 | > 40% -> 0.0
fn score_housing_effort(breakdown: &BudgetBreakdown) -> f64 {
    let total = breakdown.total_income + breakdown.total_aids;
    if total <= 0.0 { return 0.0; }
    let ratio = breakdown.housing / total;

    if ratio <= 0.25      { 1.0 }
    else if ratio <= 0.33 { 1.0 - (ratio - 0.25) / (0.33 - 0.25) * 0.30 }
    else if ratio <= 0.40 { 0.70 - (ratio - 0.33) / (0.40 - 0.33) * 0.50 }
    else                  { (0.40_f64 / ratio.max(0.01) * 0.20).clamp(0.0, 0.20) }
}

/// Score epargne (0-1) - base sur le coussin de securite (nb mois de charges)
fn score_savings(profile: &UserProfile) -> f64 {
    match profile.savings_months as u32 {
        0       => 0.0,
        1       => 0.15,
        2       => 0.40,
        3..=5   => lerp(3.0, 5.0, profile.savings_months, 0.60, 0.85),
        _       => 1.0,
    }
}

/// Score endettement (0-1) - rapport credits/revenus
fn score_debt(breakdown: &BudgetBreakdown) -> f64 {
    let total = breakdown.total_income;
    if total <= 0.0 { return 0.0; }
    let ratio = breakdown.credits / total;

    if ratio == 0.0       { 1.0 }
    else if ratio <= 0.15 { 0.90 }
    else if ratio <= 0.25 { lerp(0.15, 0.25, ratio, 0.90, 0.60) }
    else if ratio <= 0.33 { lerp(0.25, 0.33, ratio, 0.60, 0.30) }
    else if ratio <= 0.40 { lerp(0.33, 0.40, ratio, 0.30, 0.10) }
    else                  { 0.0 }
}

/// Score stabilite des revenus selon le type d'emploi (0-1)
fn score_stability(profile: &UserProfile) -> f64 {
    reference_costs::employment_stability_score(&profile.employment_type)
}

/// Score rebond / resilience (0-1)
/// Base sur : reste a vivre positif, epargne disponible, emploi stable
fn score_resilience(profile: &UserProfile, rdv: f64) -> f64 {
    let rdv_score     = if rdv > 500.0 { 1.0 } else if rdv > 0.0 { rdv / 500.0 } else { 0.0 };
    let savings_score = (profile.savings_months / 3.0).clamp(0.0, 1.0);
    let job_score     = score_stability(profile);
    (rdv_score * 0.40 + savings_score * 0.35 + job_score * 0.25).clamp(0.0, 1.0)
}

/// Interpolation lineaire
fn lerp(x0: f64, x1: f64, x: f64, y0: f64, y1: f64) -> f64 {
    let t = (x - x0) / (x1 - x0);
    y0 + t * (y1 - y0)
}

// --- Tests --------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use approx::assert_abs_diff_eq;

    #[test]
    fn test_ssf_balanced() {
        let scores = SubScores {
            housing_effort:   0.8,
            savings:          0.6,
            debt:             0.9,
            income_stability: 1.0,
            resilience:       0.7,
        };
        let ssf = compute_ssf(&scores);
        // 0.8*30 + 0.6*25 + 0.9*20 + 1.0*15 + 0.7*10 = 24+15+18+15+7 = 79
        assert_abs_diff_eq!(ssf, 79.0, epsilon = 1.0);
    }

    #[test]
    fn test_ssf_zero() {
        let scores = SubScores {
            housing_effort: 0.0, savings: 0.0, debt: 0.0,
            income_stability: 0.0, resilience: 0.0,
        };
        assert_abs_diff_eq!(compute_ssf(&scores), 0.0, epsilon = 0.01);
    }

    #[test]
    fn test_ssf_perfect() {
        let scores = SubScores {
            housing_effort: 1.0, savings: 1.0, debt: 1.0,
            income_stability: 1.0, resilience: 1.0,
        };
        assert_abs_diff_eq!(compute_ssf(&scores), 100.0, epsilon = 0.01);
    }

    #[test]
    fn test_health_levels() {
        assert_eq!(health_level(15.0),  HealthLevel::Critical);
        assert_eq!(health_level(35.0),  HealthLevel::Fragile);
        assert_eq!(health_level(55.0),  HealthLevel::Stable);
        assert_eq!(health_level(72.0),  HealthLevel::Solid);
        assert_eq!(health_level(90.0),  HealthLevel::Robust);
    }
}
