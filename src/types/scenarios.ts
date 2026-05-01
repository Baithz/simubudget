// =============================================================================
// Fichier  : src/types/scenarios.ts
// Auteur   : KREMER Regis
// Desc.    : Types pour les scenarios de vie et les projections temporelles
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation du fichier Phase 2
// =============================================================================

export type ScenarioType =
  | "baby"           // Naissance enfant
  | "job_loss"       // Perte emploi
  | "separation"     // Separation / divorce
  | "move"           // Demenagement
  | "job_change"     // Changement de poste
  | "purchase"       // Achat immobilier
  | "loan_renegotiation" // Renegociation credit
  | "part_time"      // Passage temps partiel
  | "retirement";    // Retraite

export type ProjectionHorizon = 6 | 12 | 24;

export interface ScenarioEvent {
  id:          string;
  type:        ScenarioType;
  label:       string;
  monthOffset: number;   // Dans combien de mois cet evenement survient
  // Modificateurs appliques au profil ce mois-la
  salaryDelta?:     number;   // EUR/mois (negatif = baisse)
  fixedCostsDelta?: number;   // EUR/mois
  oneTimeCost?:     number;   // Cout ponctuel (demenagement, etc.)
  newRent?:         number;   // Nouveau loyer CC si demenagement
}

export interface ProjectionPoint {
  month:              number;  // 0 = maintenant, 1 = dans 1 mois...
  label:              string;  // "Jan 2025"
  disposableIncome:   number;
  healthScore:        number;
  cumulativeSavings:  number;
  hasEvent:           boolean;
  eventLabel?:        string;
}

export interface ScenarioResult {
  id:           string;
  name:         string;
  events:       ScenarioEvent[];
  projections:  ProjectionPoint[];
  breakpointMonth?: number;  // Mois ou le budget devient critique (<0)
  isStressTest: boolean;
}

// Scenarios predéfinis
export const SCENARIO_PRESETS: Record<ScenarioType, {
  label:       string;
  icon:        string;
  description: string;
  defaults:    Partial<ScenarioEvent>;
}> = {
  baby: {
    label: "Naissance d'un enfant",
    icon: "bebe",
    description: "Impact du conge parental et des nouveaux frais",
    defaults: { salaryDelta: -800, fixedCostsDelta: 300 },
  },
  job_loss: {
    label: "Perte d'emploi",
    icon: "alerte",
    description: "Simulation avec indemnites chomage (~57% du salaire net)",
    defaults: { salaryDelta: -780 },
  },
  separation: {
    label: "Separation",
    icon: "coeur",
    description: "Division des charges, recalcul des aides",
    defaults: { fixedCostsDelta: 400 },
  },
  move: {
    label: "Demenagement",
    icon: "maison",
    description: "Nouveau loyer dans une autre ville",
    defaults: { oneTimeCost: 2000 },
  },
  job_change: {
    label: "Changement de poste",
    icon: "travail",
    description: "Nouveau salaire, impact sur les aides",
    defaults: { salaryDelta: 300 },
  },
  purchase: {
    label: "Achat immobilier",
    icon: "cle",
    description: "Passage de locataire a proprietaire",
    defaults: { salaryDelta: 0, fixedCostsDelta: 200 },
  },
  loan_renegotiation: {
    label: "Renegociation de credit",
    icon: "banque",
    description: "Baisse de la mensualite apres renegociation",
    defaults: { fixedCostsDelta: -150 },
  },
  part_time: {
    label: "Passage a mi-temps",
    icon: "horloge",
    description: "Reduction du salaire, impact sur les aides",
    defaults: { salaryDelta: -900 },
  },
  retirement: {
    label: "Depart en retraite",
    icon: "retraite",
    description: "Revenus -> pension de retraite estimee",
    defaults: { salaryDelta: -600 },
  },
};
