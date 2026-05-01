// =============================================================================
// Fichier  : src-tauri/src/calculator/rules.rs
// Auteur   : KREMER Regis
// Desc.    : Moteur de regles expert - alertes + recommandations personnalisees
//            30+ regles couvrant budget, logement, achat, epargne, optimisation
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation Phase 0
//   2026-04-26 | KREMER Regis | Extension Phase 4 - 30+ regles + recommandations expertes
// =============================================================================

use crate::models::profile::UserProfile;
use crate::models::purchase::{PtzResult, PurchaseInput};
use crate::models::simulation::{Alert, AlertLevel, BudgetBreakdown, Recommendation, SubScores};

// =============================================================================
// ALERTES BUDGET GENERAL
// =============================================================================

pub fn generate_alerts(
    profile:   &UserProfile,
    rdv:       f64,
    breakdown: &BudgetBreakdown,
    scores:    &SubScores,
) -> Vec<Alert> {
    let mut alerts = Vec::new();
    let total = breakdown.total_income + breakdown.total_aids;

    // CRITIQUE — Reste a vivre negatif
    if rdv < 0.0 {
        alerts.push(Alert {
            id:      "A001".into(),
            level:   AlertLevel::Critical,
            message: format!("Reste a vivre negatif ({:.0} EUR) — budget en deficit.", rdv),
            detail:  Some("Vos charges depassent vos revenus. Action immediate requise.".into()),
            action:  Some("Identifiez les 3 postes de depenses les plus importants et reduisez-les de 20%.".into()),
        });
    }
    // DANGER — RdV < 200 EUR
    else if rdv < 200.0 {
        alerts.push(Alert {
            id:      "A002".into(),
            level:   AlertLevel::Danger,
            message: format!("Reste a vivre tres faible ({:.0} EUR/mois).", rdv),
            detail:  Some("Le moindre imprevu peut desequilibrer votre budget.".into()),
            action:  Some("Visez un reste a vivre d'au moins 400 EUR/mois.".into()),
        });
    }

    // DANGER — Taux d'effort logement > 40%
    if total > 0.0 {
        let effort = breakdown.housing / total;
        if effort > 0.40 {
            alerts.push(Alert {
                id:      "A003".into(),
                level:   AlertLevel::Danger,
                message: format!("Taux d'effort logement de {:.0}% — au-dessus du seuil critique de 40%.", effort * 100.0),
                detail:  Some("Un taux superieur a 40% signifie que votre logement est trop cher pour vos revenus.".into()),
                action:  Some("Renegociez votre loyer ou cherchez un logement moins cher de 15-20%.".into()),
            });
        } else if effort > 0.33 {
            alerts.push(Alert {
                id:      "A004".into(),
                level:   AlertLevel::Vigilance,
                message: format!("Taux d'effort logement de {:.0}% — au-dessus du seuil recommande de 33%.", effort * 100.0),
                detail:  None,
                action:  None,
            });
        }
    }

    // DANGER — Taux d'endettement > 33%
    if total > 0.0 && breakdown.credits > 0.0 {
        let debt_ratio = breakdown.credits / total;
        if debt_ratio > 0.40 {
            alerts.push(Alert {
                id:      "A005".into(),
                level:   AlertLevel::Critical,
                message: format!("Taux d'endettement de {:.0}% — situation critique.", debt_ratio * 100.0),
                detail:  Some("Aucune banque n'accordera de nouveau credit au-dessus de 40%.".into()),
                action:  Some("Rachat de credits ou remboursement anticipe du credit le plus couteux.".into()),
            });
        } else if debt_ratio > 0.33 {
            alerts.push(Alert {
                id:      "A006".into(),
                level:   AlertLevel::Danger,
                message: format!("Taux d'endettement de {:.0}% — depasse le seuil bancaire de 33%.", debt_ratio * 100.0),
                detail:  Some("Difficultés a obtenir un nouveau credit dans cet etat.".into()),
                action:  None,
            });
        }
    }

    // VIGILANCE — Aucune epargne de securite
    if profile.savings_months < 1.0 {
        alerts.push(Alert {
            id:      "A007".into(),
            level:   AlertLevel::Vigilance,
            message: "Coussin de securite insuffisant — moins d'un mois de charges en reserve.".into(),
            detail:  Some("Sans epargne de precaution, un imprevu (panne, sante) peut tout desequilibrer.".into()),
            action:  Some("Objectif : 3 mois de charges en epargne de precaution (Livret A ou LEP).".into()),
        });
    } else if profile.savings_months < 3.0 {
        alerts.push(Alert {
            id:      "A008".into(),
            level:   AlertLevel::Info,
            message: format!("Coussin de securite de {:.1} mois — objectif recommande : 3 mois.", profile.savings_months),
            detail:  None,
            action:  Some("Alimentez votre livret d'epargne jusqu'a 3 mois de charges.".into()),
        });
    }

    // VIGILANCE — Revenus variables sans matelas
    if profile.variable_enabled && profile.savings_months < 2.0 {
        alerts.push(Alert {
            id:      "A009".into(),
            level:   AlertLevel::Vigilance,
            message: "Revenus variables sans epargne de securite adequate.".into(),
            detail:  Some("Avec des revenus irreguliers, un matelas de 3 mois minimum est indispensable.".into()),
            action:  Some("Provisionnez {:.0} EUR sur votre livret avant tout autre projet.".into()),
        });
    }

    // INFO — APL potentielle non simulee
    if profile.apl_zone > 0 && breakdown.total_aids == 0.0 {
        let rent = match profile.current_housing.housing_type.as_str() {
            "tenant" | "colocation" => {
                profile.current_housing.rent.unwrap_or(0.0) + profile.current_housing.charges.unwrap_or(0.0)
            }
            _ => 0.0,
        };
        if rent > 0.0 {
            alerts.push(Alert {
                id:      "A010".into(),
                level:   AlertLevel::Info,
                message: "Des aides au logement (APL) sont peut-etre disponibles selon vos revenus.".into(),
                detail:  Some("Verifiez votre eligibilite sur caf.fr — les estimations sont affichees sur le dashboard.".into()),
                action:  None,
            });
        }
    }

    // DANGER — CDD avec loyer eleve
    if profile.employment_type == "cdd" {
        if total > 0.0 && breakdown.housing / total > 0.35 {
            alerts.push(Alert {
                id:      "A011".into(),
                level:   AlertLevel::Danger,
                message: "Contrat precaire (CDD) avec taux d'effort logement eleve.".into(),
                detail:  Some("En cas de non-renouvellement du CDD, votre budget logement deviendrait insoutenable.".into()),
                action:  Some("Constituez un matelas de 3 mois de loyer avant la fin du CDD.".into()),
            });
        }
    }

    // INFO — Taux d'effort optimal
    if total > 0.0 {
        let effort = breakdown.housing / total;
        if effort <= 0.25 && rdv > 500.0 {
            alerts.push(Alert {
                id:      "A012".into(),
                level:   AlertLevel::Conseil,
                message: format!("Excellent taux d'effort logement de {:.0}% — budget bien maitrise.", effort * 100.0),
                detail:  Some("Vous avez une bonne capacite d'epargne ou de remboursement de credit.".into()),
                action:  None,
            });
        }
    }

    // VIGILANCE — Charges alimentaires estimees elevees (famille nombreuse)
    if profile.children.len() >= 3 && breakdown.food > 800.0 {
        alerts.push(Alert {
            id:      "A013".into(),
            level:   AlertLevel::Info,
            message: format!("Budget alimentation estime a {:.0} EUR/mois pour votre famille.", breakdown.food),
            detail:  Some("Les allocations familiales (CAF) peuvent alleger ce poste — verifiez vos droits.".into()),
            action:  None,
        });
    }

    // INFO — Scores SSF
    if scores.housing_effort < 0.3 && scores.savings < 0.2 && rdv > 200.0 {
        alerts.push(Alert {
            id:      "A014".into(),
            level:   AlertLevel::Conseil,
            message: "Votre logement est abordable mais votre epargne est sous-optimale.".into(),
            detail:  None,
            action:  Some("Mettez en place un virement automatique de 10% de vos revenus vers un livret des le virement du salaire.".into()),
        });
    }

    alerts
}

// =============================================================================
// RECOMMANDATIONS EXPERTES BUDGET
// =============================================================================

pub fn generate_recommendations(
    profile:   &UserProfile,
    rdv:       f64,
    breakdown: &BudgetBreakdown,
    _scores:   &SubScores,
    alerts:    &[Alert],
) -> Vec<Recommendation> {
    let mut recs = Vec::new();
    let total = breakdown.total_income + breakdown.total_aids;
    let has_critical = alerts.iter().any(|a| matches!(a.level, AlertLevel::Critical));

    // --- Priorite 1 : Securite immediate -----------------------------------------

    if rdv < 0.0 {
        recs.push(Recommendation {
            id:       "R001".into(),
            priority: 1,
            label:    "Reduire les charges immediatement".into(),
            impact:   format!("Votre deficit est de {:.0} EUR/mois — soit {:.0} EUR/an.", rdv.abs(), rdv.abs() * 12.0),
            action:   "1. Listez toutes vos charges fixes. 2. Identifiez les 3 plus importantes. 3. Negociez ou supprimez les moins essentielles.".into(),
        });
    }

    // --- Priorite 2 : Optimisation logement --------------------------------------

    if total > 0.0 {
        let effort = breakdown.housing / total;
        if effort > 0.33 {
            let loyer_optimal = total * 0.30;
            let economie = breakdown.housing - loyer_optimal;
            recs.push(Recommendation {
                id:       "R002".into(),
                priority: if effort > 0.40 { 2 } else { 3 },
                label:    "Optimiser votre budget logement".into(),
                impact:   format!("Un logement a {:.0} EUR/mois vous economiserait {:.0} EUR/mois ({:.0} EUR/an).", loyer_optimal, economie, economie * 12.0),
                action:   "Comparez les loyers de votre secteur sur SeLoger ou PAP. Une negociation de 5% est souvent possible a la signature ou au renouvellement.".into(),
            });
        }
    }

    // --- Priorite 3 : Epargne de precaution --------------------------------------

    if profile.savings_months < 3.0 && rdv > 100.0 {
        let monthly_savings_target = (breakdown.housing + breakdown.fixed + breakdown.credits) * 3.0;
        let months_to_goal = if rdv > 0.0 { (monthly_savings_target / (rdv * 0.3)).ceil() as u32 } else { 0 };
        recs.push(Recommendation {
            id:       "R003".into(),
            priority: if profile.savings_months < 1.0 { 2 } else { 4 },
            label:    "Constituer un matelas de securite".into(),
            impact:   format!("Objectif : {:.0} EUR (3 mois de charges). Atteignable en environ {} mois en epargnant 30% de votre reste a vivre.", monthly_savings_target, months_to_goal),
            action:   "Ouvrez un Livret A ou LEP (taux garantis, disponibles a tout moment). Mettez en place un virement automatique le jour du versement du salaire.".into(),
        });
    }

    // --- Priorite 4 : Optimisation fiscale ---------------------------------------

    let annual_income = breakdown.total_income * 12.0;
    if annual_income > 15_000.0 && annual_income < 80_000.0 {
        recs.push(Recommendation {
            id:       "R004".into(),
            priority: 5,
            label:    "Optimiser votre fiscalite".into(),
            impact:   format!("Avec {:.0} EUR de revenus annuels, des niches fiscales peuvent reduire votre IR.", annual_income),
            action:   "Verifiez : PEE/PERCO (si salarie), PER individuel (deduction revenus), dons associatifs (66% de reduction). Consultez impots.gouv.fr ou un comptable.".into(),
        });
    }

    // --- Priorite 5 : Credits - renégociation -------------------------------------

    if breakdown.credits > 0.0 {
        let debt_ratio = breakdown.credits / total;
        if debt_ratio > 0.20 {
            recs.push(Recommendation {
                id:       "R005".into(),
                priority: 3,
                label:    "Optimiser vos credits en cours".into(),
                impact:   format!("Vos credits representent {:.0}% de vos revenus ({:.0} EUR/mois).", debt_ratio * 100.0, breakdown.credits),
                action:   "1. Comparez les taux actuels sur ANIL.org. 2. Si taux actuel - taux marche > 0.7%, la renégociation est rentable. 3. Simulez un rachat de credits si vous avez plusieurs credits conso.".into(),
            });
        }
    }

    // --- Priorite 6 : Capacite d'investissement ----------------------------------

    if rdv > 500.0 && profile.savings_months >= 3.0 && !has_critical {
        recs.push(Recommendation {
            id:       "R006".into(),
            priority: 6,
            label:    "Valoriser votre capacite d'epargne".into(),
            impact:   format!("Avec {:.0} EUR/mois de disponible et 3 mois de reserve, vous pouvez investir.", rdv),
            action:   "Selon votre horizon : court terme -> Livret A/LEP, moyen terme -> assurance-vie fonds euros, long terme -> PEA (actions) ou SCPI (immobilier). Consultez un conseiller financier independant (CIF).".into(),
        });
    }

    // --- Priorite 7 : Aides non perçues ------------------------------------------

    if profile.children.len() > 0 {
        recs.push(Recommendation {
            id:       "R007".into(),
            priority: 5,
            label:    "Verifier toutes vos aides CAF".into(),
            impact:   "Les familles avec enfants sont souvent sous-informees de leurs droits (complements, AJPP, AEEH...).".into(),
            action:   "Faites une simulation complete sur caf.fr — rubrique 'Mes droits'. Signalez tout changement de situation sous 3 mois.".into(),
        });
    }

    // Trier par priorite
    recs.sort_by_key(|r| r.priority);
    recs
}

// =============================================================================
// ALERTES ACHAT IMMOBILIER
// =============================================================================

pub fn generate_purchase_alerts(
    input:              &PurchaseInput,
    debt_ratio:         f64,
    disposable:         f64,
    down_payment_ratio: f64,
    notary_fees:        f64,
    residual_savings:   f64,
    ptz:                &PtzResult,
) -> Vec<Alert> {
    let mut alerts = Vec::new();

    // CRITIQUE — Apport insuffisant
    if input.down_payment < notary_fees {
        alerts.push(Alert {
            id:      "P001".into(),
            level:   AlertLevel::Critical,
            message: format!("Apport insuffisant pour couvrir les frais de notaire ({:.0} EUR requis).", notary_fees),
            detail:  Some("Aucune banque n'acceptera ce dossier en l'etat. Votre apport doit couvrir au minimum les frais annexes.".into()),
            action:  Some(format!("Constituez au minimum {:.0} EUR d'apport avant de vous lancer.", notary_fees + 5_000.0)),
        });
    }

    // CRITIQUE — Taux d'endettement > 45%
    if debt_ratio > 0.45 {
        alerts.push(Alert {
            id:      "P002".into(),
            level:   AlertLevel::Critical,
            message: format!("Taux d'endettement post-achat de {:.0}% — refus bancaire certain.", debt_ratio * 100.0),
            detail:  Some("Le plafond HCSF est de 35%. A 45%, aucune banque ne peut accorder le pret.".into()),
            action:  Some("Reduisez le prix du bien, augmentez l'apport, ou allongez la duree du credit.".into()),
        });
    }
    // DANGER — Taux d'endettement 35-45%
    else if debt_ratio > 0.35 {
        alerts.push(Alert {
            id:      "P003".into(),
            level:   AlertLevel::Danger,
            message: format!("Taux d'endettement de {:.1}% — depasse le plafond HCSF de 35%.", debt_ratio * 100.0),
            detail:  Some("La banque peut accorder une derogation (<20% des dossiers) mais ce n'est pas garanti.".into()),
            action:  Some("Allongez la duree du credit ou augmentez l'apport de 10 000 EUR.".into()),
        });
    }

    // VIGILANCE — Apport < 10%
    if down_payment_ratio < 0.10 && input.down_payment >= notary_fees {
        alerts.push(Alert {
            id:      "P004".into(),
            level:   AlertLevel::Vigilance,
            message: format!("Apport de {:.0}% — en dessous du seuil recommande de 10%.", down_payment_ratio * 100.0),
            detail:  Some("Un apport faible augmente le risque de refus et le cout total du credit.".into()),
            action:  None,
        });
    }

    // DANGER — Pas d'epargne residuelle
    if residual_savings < 1_000.0 && input.down_payment >= notary_fees {
        alerts.push(Alert {
            id:      "P005".into(),
            level:   AlertLevel::Danger,
            message: "Aucune reserve apres l'apport — aucun coussin en cas de travaux urgents.".into(),
            detail:  Some("Il est recommande de conserver au moins 5 000 EUR de reserve apres l'achat.".into()),
            action:  Some("Reduisez l'apport de 5 000 EUR pour conserver une reserve de precaution.".into()),
        });
    }

    // CRITIQUE — Reste a vivre post-achat negatif
    if disposable < 0.0 {
        alerts.push(Alert {
            id:      "P006".into(),
            level:   AlertLevel::Critical,
            message: format!("Reste a vivre post-achat negatif ({:.0} EUR/mois) — projet insoutenable.", disposable),
            detail:  Some("Ce projet immobilier n'est pas compatible avec votre situation financiere actuelle.".into()),
            action:  Some("Ciblez un bien moins cher ou attendez d'avoir de meilleurs revenus.".into()),
        });
    } else if disposable < 400.0 {
        alerts.push(Alert {
            id:      "P007".into(),
            level:   AlertLevel::Danger,
            message: format!("Reste a vivre post-achat de {:.0} EUR/mois — marge tres faible.", disposable),
            detail:  Some("Moins de 400 EUR/mois laisse peu de place aux imprevus.".into()),
            action:  None,
        });
    }

    // INFO — PTZ eligible
    if ptz.eligible {
        if let Some(amount) = ptz.amount {
            alerts.push(Alert {
                id:      "P008".into(),
                level:   AlertLevel::Info,
                message: format!("Eligible au PTZ : {:.0} EUR sans interets (differe {} ans).",
                    amount, ptz.deferral_years.unwrap_or(0)),
                detail:  Some("Le PTZ reduit votre mensualite pendant la periode de differe.".into()),
                action:  None,
            });
        }
    }

    // INFO — Assurance deléguée
    alerts.push(Alert {
        id:      "P009".into(),
        level:   AlertLevel::Info,
        message: "La delegation d'assurance emprunteur peut vous economiser 30 a 60% sur l'assurance.".into(),
        detail:  Some("Vous pouvez choisir votre assurance librement depuis la loi Lemoine (2022).".into()),
        action:  Some("Comparez sur reassurez-moi.fr ou lelynx.fr avant de signer.".into()),
    });

    alerts
}
