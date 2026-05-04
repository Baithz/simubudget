// =============================================================================
// Fichier  : src/types/accounting.ts
// Auteur   : KREMER Regis
// Desc.    : Types comptables complets - depenses, revenus, bilan mensuel
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation du fichier Phase 3
//   2026-04-27 | KREMER Regis | Phase 6 - owner field (couple), ExpenseOwner
//   2026-04-28 | KREMER Regis | Correction TS strict - rebalanceSuggestion optionnel
//   2026-04-29 | KREMER Regis | Phase 9 - pilotage mensuel, validation des charges recurrentes, cloture
//   2026-05-01 | KREMER Régis | Phase 12A — MonthlyExpenseLine enrichie (creditRemainingMonths, creditEndsThisMonth)
//   2026-05-01 | KREMER Régis | Phase 12A — ExpenseLine enrichie (remainingMonths, lender pour crédits)
//   2026-05-01 | KREMER Régis | Patch 12A.1 — Ajout du type de crédit aux charges récurrentes
//   2026-05-01 | KREMER Régis | Phase 12C — Charges saisonnières et montant réel vs prévu
//   2026-05-01 | KREMER Régis | ZIP 5 — Intelligence financière avancée : scoring et priorité des recommandations
//   2026-05-01 | KREMER Régis | Phase 13 — méthode des enveloppes budgétaires
//   2026-05-01 | KREMER Régis | Phase 13C.3 — création et gestion explicite des enveloppes
//   2026-05-04 | KREMER Régis | Phase 3 — stabilisation displayLabel/importedRawLabel pour libellés humains
// =============================================================================

import type { CreditType } from "./profile";

export type ExpenseOwner = "me" | "partner" | "shared";
export type Frequency = "weekly" | "monthly" | "annual";
export type MonthlyExpenseStatus = "pending" | "validated" | "added" | "ignored";
export type EnvelopePeriod = "monthly" | "weekly";
export type EnvelopeHealth = "safe" | "watch" | "danger" | "empty";

export function toMonthly(amount: number, freq: Frequency): number {
  switch (freq) {
    case "weekly":  return amount * 52 / 12;
    case "monthly": return amount;
    case "annual":  return amount / 12;
  }
}

export function toAnnual(amount: number, freq: Frequency): number {
  switch (freq) {
    case "weekly":  return amount * 52;
    case "monthly": return amount * 12;
    case "annual":  return amount;
  }
}

export type ExpenseCategory =
  | "housing" | "food" | "transport" | "health" | "insurance"
  | "telecom" | "childcare" | "leisure" | "clothing" | "savings"
  | "taxes" | "credit" | "gifts" | "subscriptions" | "professional" | "other";

export const CATEGORY_ORDER: ExpenseCategory[] = [
  "housing", "credit", "insurance", "telecom", "taxes", "health",
  "food", "transport", "childcare", "savings", "subscriptions",
  "leisure", "clothing", "gifts", "professional", "other",
];

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  housing:       "Logement",
  food:          "Alimentation",
  transport:     "Transport",
  health:        "Santé",
  insurance:     "Assurances",
  telecom:       "Téléphone & Internet",
  childcare:     "Garde & Scolarité",
  leisure:       "Loisirs & Vacances",
  clothing:      "Habillement",
  savings:       "Épargne & Placements",
  taxes:         "Impôts & Taxes",
  credit:        "Crédits",
  gifts:         "Cadeaux & Dons",
  subscriptions: "Abonnements",
  professional:  "Frais professionnels",
  other:         "Autres",
};

export const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  housing:       "#0ea5e9",
  food:          "#22c55e",
  transport:     "#f97316",
  health:        "#ec4899",
  insurance:     "#8b5cf6",
  telecom:       "#06b6d4",
  childcare:     "#f59e0b",
  leisure:       "#84cc16",
  clothing:      "#e879f9",
  savings:       "#10b981",
  taxes:         "#ef4444",
  credit:        "#f43f5e",
  gifts:         "#fb923c",
  subscriptions: "#a78bfa",
  professional:  "#64748b",
  other:         "#94a3b8",
};

export interface ExpenseLine {
  id:          string;
  label:       string;
  category:    ExpenseCategory;
  amount:      number;
  frequency:   Frequency;
  isFixed:     boolean;
  isMandatory: boolean;
  owner:       ExpenseOwner;
  notes?:      string;
  monthlyAmount: number;
  annualAmount:  number;
  // Phase 12C — charge annuelle ponctuelle sur un mois précis (1-12)
  annualMonth?:   number;
  // Champs crédit optionnels (Phase 12A) — uniquement si category === "credit"
  remainingMonths?: number;      // Mois restants sur ce crédit
  creditType?:      CreditType;  // Type de crédit : immo, auto, conso ou revolving
  lender?:          string;      // Établissement prêteur
}

export interface MonthlyExpenseLine {
  id:              string;
  month:           string;
  sourceExpenseId?: string;
  label:           string;
  category:        ExpenseCategory;
  amount:          number;
  plannedAmount?:  number;  // Montant prévu issu de la charge récurrente
  realAmount?:     number;  // Montant réel saisi par l'utilisateur
  isFixed:         boolean;
  isMandatory:     boolean;
  owner:           ExpenseOwner;
  status:          MonthlyExpenseStatus;
  notes?:          string;
  validatedAt?:    string;
  // Snapshot crédit (Phase 12A) — renseigné si category === "credit"
  creditRemainingMonths?: number;   // Nb de mois restants ce mois-ci
  creditEndsThisMonth?:   boolean;  // true si c'est le dernier mois de ce crédit
  creditLender?:          string;   // Établissement prêteur (pour affichage)
  // Phase 15.4 — traçabilité import bancaire
  importedTransactionId?: string;   // ID transaction bancaire source
  importedAt?:            string;   // Date ISO d'intégration dans Mes Comptes
  importSource?:          string;   // Banque/source du relevé importé
  // Phase 2 — rapprochement et protection charges fixes
  reconciliationStatus?:  "manual" | "real" | "reconciled" | "ignored" | "possible_duplicate";
  matchedTransactionId?:  string;   // ID transaction rapprochée avec la ligne prévue
  plannedReferenceAmount?: number;  // Montant prévu initial conservé pour analyse d'écart
  reconciliationDelta?:   number;   // realAmount - plannedReferenceAmount
  rawBankLabel?:          string;   // Libellé bancaire brut conservé pour audit
  importedRawLabel?:      string;   // Alias UI Phase 2 : libellé bancaire original affichable
  displayLabel?:          string;   // Libellé humain affiché dans Mes Comptes
  isRecurringProtected?:  boolean;  // true si charge fixe/obligatoire : ne pas modifier la récurrence
}

export type IncomeType =
  | "salary" | "bonus" | "freelance" | "rental"
  | "pension" | "allowance" | "investment" | "other";

export const INCOME_LABELS: Record<IncomeType, string> = {
  salary:     "Salaire net",
  bonus:      "Primes & 13e mois",
  freelance:  "Facturation freelance",
  rental:     "Revenus locatifs",
  pension:    "Retraite / Pension",
  allowance:  "Allocations",
  investment: "Dividendes & Intérêts",
  other:      "Autres revenus",
};

export interface IncomeLine {
  id:        string;
  label:     string;
  type:      IncomeType;
  amount:    number;
  frequency: Frequency;
  isTaxable: boolean;
  owner:     ExpenseOwner;
  notes?:    string;
  monthlyAmount: number;
  annualAmount:  number;
}

export interface EnvelopeSettings {
  enabled: boolean;
  period: EnvelopePeriod;
}

export interface EnvelopeBudget {
  id: string;
  category: ExpenseCategory;
  label: string;
  monthlyLimit: number;
  isActive: boolean;
  notes?: string;
}

export interface EnvelopeStatus {
  category: ExpenseCategory;
  label: string;
  planned: number;
  spent: number;
  remaining: number;
  percent: number;
  health: EnvelopeHealth;
  isSavingsEnvelope: boolean;
  isConfigured: boolean;
}

export interface MonthlyBudget {
  totalIncomeMonthly:      number;
  totalIncomeAnnual:       number;
  incomeByType:            Record<IncomeType, number>;
  totalExpensesMonthly:    number;
  totalExpensesAnnual:     number;
  expenseByCategory:       Record<ExpenseCategory, number>;
  fixedExpensesMonthly:    number;
  variableExpensesMonthly: number;
  balanceMonthly:          number;
  balanceAnnual:           number;
  savingsRate:             number;
  optimizableAmount:       number;
  mandatoryExpenses:       number;
  fixedChargesRatio:       number;
  debtRatio:               number;
}

export interface MonthPilotSummary {
  month:              string;
  isClosed:           boolean;
  pendingCount:       number;
  validatedCount:     number;
  ignoredCount:       number;
  addedCount:         number;
  daysRemaining:      number;
  projectedBalance:   number;
  projectedExpenses:  number;
  validationProgress: number;
}

export interface PersonBudget {
  label:                string;
  totalIncomeMonthly:   number;
  totalExpensesMonthly: number;
  balanceMonthly:       number;
  savingsRate:          number;
  shareOfCommonExpenses: number;
}

export interface CoupleBudget {
  me:               PersonBudget;
  partner:          PersonBudget;
  combined:         MonthlyBudget;
  sharedExpenses:   number;
  whoSavesMore:     "me" | "partner" | "equal";
  whoSpendMore:     "me" | "partner" | "equal";
  rebalanceSuggestion?: string | undefined;
}

export type RecommendationLevel = "critical" | "danger" | "vigilance" | "info" | "conseil";

export interface AccountingRecommendation {
  id:       string;
  level:    RecommendationLevel;
  category: ExpenseCategory | "global" | "savings" | "tax";
  title:    string;
  detail:   string;
  saving?:  number;
  action?:  string;
  // ZIP 5 — Intelligence financière avancée
  priority?: number;
  scoreBefore?: number;
  scoreAfter?: number;
  impactLabel?: string;
  profileContext?: string;
}

export interface AnnualReport {
  year:           number;
  totalIncomeNet: number;
  totalExpenses:  number;
  totalSaved:     number;
  savingsRate:    number;
  taxableIncome:  number;
  estimatedTax:   number;
  netAfterTax:    number;
  byMonth:        MonthlyBudget[];
  topExpenses:    { category: ExpenseCategory; amount: number; pct: number }[];
  recommendations: AccountingRecommendation[];
}

export interface AccountingState {
  incomes:  IncomeLine[];
  expenses: ExpenseLine[];
  monthlyExpenses: MonthlyExpenseLine[];
  activeMonth: string;
  closedMonths: string[];
  envelopeSettings: EnvelopeSettings;
  envelopeBudgets: EnvelopeBudget[];
}

export function makeIncomeLine(
  partial: Omit<IncomeLine, "id" | "monthlyAmount" | "annualAmount">
): IncomeLine {
  return {
    ...partial,
    id:            crypto.randomUUID(),
    monthlyAmount: toMonthly(partial.amount, partial.frequency),
    annualAmount:  toAnnual(partial.amount,  partial.frequency),
  };
}

export function makeExpenseLine(
  partial: Omit<ExpenseLine, "id" | "monthlyAmount" | "annualAmount">
): ExpenseLine {
  return {
    ...partial,
    id:            crypto.randomUUID(),
    monthlyAmount: toMonthly(partial.amount, partial.frequency),
    annualAmount:  toAnnual(partial.amount,  partial.frequency),
  };
}
