// =============================================================================
// Fichier  : src/types/simulation.ts
// Auteur   : KREMER Regis
// Desc.    : Types TypeScript pour les resultats de simulation budget
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation Phase 0
//   2026-04-26 | KREMER Regis | Ajout aids detail Phase 1
//   2026-04-27 | KREMER Regis | Ajout action? dans Recommendation (TS strict)
// =============================================================================

export type AlertLevel  = "critical" | "danger" | "vigilance" | "info" | "conseil";
export type HealthLevel = "critical" | "fragile" | "stable" | "solid" | "robust";
export type AplConfidence = "low" | "medium" | "high";

export interface Alert {
  id:      string;
  level:   AlertLevel;
  message: string;
  detail?: string;
  action?: string;
}

export interface Recommendation {
  id:       string;
  priority: number;
  label:    string;
  impact:   string;
  saving?:  number;
  action?:  string;
}

export interface AplEstimate {
  estimated:  number;
  confidence: AplConfidence;
  zone:       number;
}

export interface SubScores {
  housingEffort:   number;  // 0-1
  savings:         number;
  debt:            number;
  incomeStability: number;
  resilience:      number;
}

export interface BudgetBreakdown {
  totalIncome:     number;
  totalAids:       number;
  housing:         number;
  credits:         number;
  food:            number;
  transport:       number;
  fixed:           number;
  savingsCapacity: number;
}

export interface BudgetResult {
  realDisposableIncome: number;
  healthScore:          number;
  healthLevel:          HealthLevel;
  breakdown:            BudgetBreakdown;
  aplEstimate:          AplEstimate;
  scores:               SubScores;
  alerts:               Alert[];
  recommendations:      Recommendation[];
}
