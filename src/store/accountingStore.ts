// =============================================================================
// Fichier  : src/store/accountingStore.ts
// Auteur   : KREMER Regis
// Desc.    : Store Zustand pour la comptabilite mensuelle pilotee
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation du fichier Phase 3
//   2026-04-27 | KREMER Regis | Phase 6 - getCoupleBudget, snapshots, drift detection
//   2026-04-28 | KREMER Regis | Correction TS strict - CoupleBudget rebalanceSuggestion optionnel
//   2026-04-29 | KREMER Regis | Phase 9 - mois actif, validation des charges recurrentes, cloture
//   2026-04-29 | KREMER Regis | Phase 9.1 - synchronisation profil vers Mes Comptes et reset comptable
//   2026-04-29 | KREMER Regis | Phase 9.2 - revenus nominatifs personne A/B et analyse couple
//   2026-05-01 | KREMER Régis | Phase 11 — Fix 1 : crédits+variableIncome sync profil→comptes
//   2026-05-01 | KREMER Régis | Phase 11 — Fix 5 : algorithme optimisation 50/30/20 + INSEE
//   2026-05-01 | KREMER Régis | Phase 12A — crédits intelligents : décrément, alertes, snapshot
//   2026-05-01 | KREMER Régis | Phase 12B — scope multi-profils des données comptables
//   2026-05-01 | KREMER Régis | Phase 12C — charges saisonnières + réel vs prévu
//   2026-05-01 | KREMER Régis | ZIP 5 — intelligence financière : recommandations contextualisées et scoring action
//   2026-05-01 | KREMER Régis | Phase 13 — méthode des enveloppes budgétaires intégrée
//   2026-05-01 | KREMER Régis | Phase 13C.3 — création, édition et liaison dépenses↔enveloppes
// =============================================================================

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  type IncomeLine, type ExpenseLine, type MonthlyBudget,
  type AccountingRecommendation, type ExpenseCategory, type IncomeType,
  type CoupleBudget, type PersonBudget, type MonthlyExpenseLine,
  type MonthPilotSummary, type EnvelopeSettings, type EnvelopeStatus, type EnvelopePeriod, type EnvelopeBudget,
  CATEGORY_ORDER, CATEGORY_LABELS,
  toMonthly, toAnnual, makeIncomeLine, makeExpenseLine,
} from "@/types/accounting";
import type { MonthlySnapshot, UserProfile } from "@/types/profile";
import { profileScopedStorage } from "@/store/profileListStore";
import { useProfileStore } from "@/store/profileStore";

interface AccountingStore {
  incomes:   IncomeLine[];
  expenses:  ExpenseLine[];
  monthlyExpenses: MonthlyExpenseLine[];
  activeMonth: string;
  closedMonths: string[];
  snapshots: MonthlySnapshot[];
  envelopeSettings: EnvelopeSettings;
  envelopeBudgets: EnvelopeBudget[];

  addIncome:    (line: Omit<IncomeLine,  "id" | "monthlyAmount" | "annualAmount">) => void;
  updateIncome: (id: string, patch: Partial<Omit<IncomeLine, "id">>) => void;
  removeIncome: (id: string) => void;

  addExpense:    (line: Omit<ExpenseLine, "id" | "monthlyAmount" | "annualAmount">) => void;
  updateExpense: (id: string, patch: Partial<Omit<ExpenseLine, "id">>) => void;
  removeExpense: (id: string) => void;

  setActiveMonth: (month: string) => void;
  shiftActiveMonth: (offset: number) => void;
  ensureMonth: (month?: string) => void;
  getMonthExpenses: (month?: string) => MonthlyExpenseLine[];
  validateMonthlyExpense: (id: string) => void;
  ignoreMonthlyExpense: (id: string) => void;
  restoreMonthlyExpense: (id: string) => void;
  deleteMonthlyExpense: (id: string) => void;
  updateMonthlyExpense: (id: string, patch: Partial<Omit<MonthlyExpenseLine, "id" | "month">>) => void;
  addMonthlyExpense: (line: Omit<MonthlyExpenseLine, "id" | "status"> & { status?: MonthlyExpenseLine["status"] }) => void;
  upsertImportedMonthlyExpense: (line: Omit<MonthlyExpenseLine, "status"> & { status?: MonthlyExpenseLine["status"] }) => string;
  closeMonth: (month?: string) => void;
  reopenMonth: (month?: string) => void;
  setEnvelopeMode: (enabled: boolean, period?: EnvelopePeriod) => void;
  upsertEnvelopeBudget: (budget: Omit<EnvelopeBudget, "id"> & { id?: string }) => void;
  removeEnvelopeBudget: (id: string) => void;
  getEnvelopeStatuses: (month?: string) => EnvelopeStatus[];
  getEnvelopeStatus: (category: ExpenseCategory, month?: string) => EnvelopeStatus;
  redistributeEnvelopeRemaining: (from: ExpenseCategory, to: ExpenseCategory, amount: number) => void;
  decrementCreditMonths: () => void;  // Phase 12A — décrémente remainingMonths des crédits actifs
  getMonthSummary: (month?: string) => MonthPilotSummary;

  saveSnapshot:  (snap: MonthlySnapshot) => void;
  getSnapshots:  () => MonthlySnapshot[];

  getBudget:            () => MonthlyBudget;
  getBudgetForMonth:    (month: string) => MonthlyBudget;
  getCoupleBudget:      (personName?: string, partnerName?: string) => CoupleBudget | null;
  getRecommendations:   () => AccountingRecommendation[];
  getDriftAlerts:       () => AccountingRecommendation[];
  syncFromProfile:     (profile: UserProfile) => void;
  resetAccounting:      () => void;
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function addMonths(month: string, offset: number): string {
  const [yearRaw, monthRaw] = month.split("-");
  const year = Number.parseInt(yearRaw ?? `${new Date().getFullYear()}`, 10);
  const m = Number.parseInt(monthRaw ?? "1", 10) - 1;
  const d = new Date(year, m + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function daysRemainingInMonth(month: string): number {
  const today = new Date();
  const thisMonth = today.toISOString().slice(0, 7);
  const [yearRaw, monthRaw] = month.split("-");
  const year = Number.parseInt(yearRaw ?? `${today.getFullYear()}`, 10);
  const m = Number.parseInt(monthRaw ?? `${today.getMonth() + 1}`, 10);
  const lastDay = new Date(year, m, 0).getDate();
  if (month !== thisMonth) return 0;
  return Math.max(0, lastDay - today.getDate());
}

function recompute(line: IncomeLine | ExpenseLine) {
  return {
    ...line,
    monthlyAmount: toMonthly(line.amount, line.frequency),
    annualAmount:  toAnnual(line.amount,  line.frequency),
  };
}

function monthNumber(month: string): number {
  const [, rawMonth] = month.split("-");
  return Number.parseInt(rawMonth ?? "0", 10);
}

function shouldInjectRecurringExpense(expense: ExpenseLine, month: string): boolean {
  if (expense.frequency !== "annual" || expense.annualMonth === undefined) {
    return true;
  }
  return monthNumber(month) === expense.annualMonth;
}

function recurringAmountForMonth(expense: ExpenseLine, month: string): number {
  if (expense.frequency === "annual" && expense.annualMonth !== undefined) {
    return monthNumber(month) === expense.annualMonth ? expense.amount : 0;
  }
  return expense.monthlyAmount;
}

function monthlyFromRecurring(expense: ExpenseLine, month: string): MonthlyExpenseLine | null {
  if (!shouldInjectRecurringExpense(expense, month)) return null;
  const plannedAmount = recurringAmountForMonth(expense, month);
  const result: MonthlyExpenseLine = {
    id: crypto.randomUUID(),
    month,
    sourceExpenseId: expense.id,
    label: expense.label,
    category: expense.category,
    amount: plannedAmount,
    plannedAmount,
    isFixed: expense.isFixed,
    isMandatory: expense.isMandatory,
    owner: expense.owner,
    status: "pending",
  };
  if (expense.notes !== undefined) result.notes = expense.notes;
  // Phase 12A — snapshot crédit
  if (expense.category === "credit" && expense.remainingMonths !== undefined) {
    result.creditRemainingMonths = expense.remainingMonths;
    result.creditEndsThisMonth   = expense.remainingMonths <= 1;
    if (expense.lender !== undefined) result.creditLender = expense.lender;
  }
  return result;
}

function usableMonthExpenses(lines: MonthlyExpenseLine[]): MonthlyExpenseLine[] {
  return lines.filter((line) => line.status === "validated" || line.status === "added");
}

const ENVELOPE_CATEGORIES: ExpenseCategory[] = [
  "food", "transport", "health", "leisure", "clothing", "subscriptions",
  "gifts", "childcare", "professional", "savings", "other",
];

function periodDivider(period: EnvelopePeriod): number {
  return period === "weekly" ? 4.345 : 1;
}

function envelopeAmountForPeriod(amount: number, period: EnvelopePeriod): number {
  return amount / periodDivider(period);
}

function envelopeHealth(planned: number, spent: number): EnvelopeStatus["health"] {
  if (planned <= 0) return spent > 0 ? "danger" : "empty";
  const ratio = spent / planned;
  if (ratio >= 1) return "danger";
  if (ratio >= 0.75) return "watch";
  return "safe";
}

function buildEnvelopeStatus(category: ExpenseCategory, lines: MonthlyExpenseLine[], period: EnvelopePeriod, budgets: EnvelopeBudget[] = []): EnvelopeStatus {
  const categoryLines = lines.filter((line) => line.category === category && line.status !== "ignored");
  const configuredBudget = budgets.find((budget) => budget.category === category && budget.isActive);
  const plannedFromLines = categoryLines.reduce((sum, line) => sum + (line.plannedAmount ?? line.amount), 0);
  const plannedMonthly = configuredBudget ? configuredBudget.monthlyLimit : plannedFromLines;
  const spentMonthly = categoryLines.reduce((sum, line) => sum + line.amount, 0);
  const planned = envelopeAmountForPeriod(plannedMonthly, period);
  const spent = envelopeAmountForPeriod(spentMonthly, period);
  const percent = planned > 0 ? spent / planned : spent > 0 ? 1 : 0;
  const status: EnvelopeStatus = {
    category,
    label: CATEGORY_LABELS[category],
    planned,
    spent,
    remaining: planned - spent,
    percent,
    health: envelopeHealth(planned, spent),
    isSavingsEnvelope: category === "savings",
    isConfigured: configuredBudget !== undefined,
  };
  return status;
}

function buildMonthlyBudget(incomes: IncomeLine[], expenses: Array<ExpenseLine | MonthlyExpenseLine>): MonthlyBudget {
  const totalIncomeMonthly    = incomes.reduce((s, l) => s + l.monthlyAmount, 0);
  const totalIncomeAnnual     = incomes.reduce((s, l) => s + l.annualAmount,  0);
  const totalExpensesMonthly  = expenses.reduce((s, l) => s + ("monthlyAmount" in l ? l.monthlyAmount : l.amount), 0);
  const totalExpensesAnnual   = totalExpensesMonthly * 12;
  const fixedExpensesMonthly  = expenses.filter((l) => l.isFixed).reduce((s, l) => s + ("monthlyAmount" in l ? l.monthlyAmount : l.amount), 0);
  const variableExpensesMonthly = totalExpensesMonthly - fixedExpensesMonthly;
  const mandatoryExpenses     = expenses.filter((l) => l.isMandatory).reduce((s, l) => s + ("monthlyAmount" in l ? l.monthlyAmount : l.amount), 0);
  const optimizableAmount     = expenses.filter((l) => !l.isMandatory).reduce((s, l) => s + ("monthlyAmount" in l ? l.monthlyAmount : l.amount), 0);
  const balanceMonthly        = totalIncomeMonthly - totalExpensesMonthly;
  const balanceAnnual         = totalIncomeAnnual  - totalExpensesAnnual;
  const savingsRate           = totalIncomeMonthly > 0 ? Math.max(0, balanceMonthly) / totalIncomeMonthly : 0;

  const expenseByCategory = {} as Record<ExpenseCategory, number>;
  for (const l of expenses) {
    const amount = "monthlyAmount" in l ? l.monthlyAmount : l.amount;
    expenseByCategory[l.category] = (expenseByCategory[l.category] ?? 0) + amount;
  }
  const incomeByType = {} as Record<IncomeType, number>;
  for (const l of incomes) {
    incomeByType[l.type] = (incomeByType[l.type] ?? 0) + l.monthlyAmount;
  }
  const debtRatio = totalIncomeMonthly > 0
    ? expenses.filter((l) => l.category === "credit").reduce((s, l) => s + ("monthlyAmount" in l ? l.monthlyAmount : l.amount), 0) / totalIncomeMonthly
    : 0;
  const fixedChargesRatio = totalIncomeMonthly > 0 ? fixedExpensesMonthly / totalIncomeMonthly : 0;

  return {
    totalIncomeMonthly, totalIncomeAnnual, incomeByType,
    totalExpensesMonthly, totalExpensesAnnual, expenseByCategory,
    fixedExpensesMonthly, variableExpensesMonthly,
    balanceMonthly, balanceAnnual, savingsRate,
    optimizableAmount, mandatoryExpenses, fixedChargesRatio, debtRatio,
  };
}

function buildSnapshot(month: string, budget: MonthlyBudget): MonthlySnapshot {
  return {
    month,
    healthScore: Math.max(0, Math.min(100, Math.round(50 + budget.savingsRate * 120 - budget.debtRatio * 80))),
    realDisposableIncome: budget.balanceMonthly,
    totalIncomeMonthly: budget.totalIncomeMonthly,
    totalExpensesMonthly: budget.totalExpensesMonthly,
    balanceMonthly: budget.balanceMonthly,
    savingsRate: budget.savingsRate,
  };
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function computeAccountingScore(budget: MonthlyBudget, profile: UserProfile): number {
  const reserveScore = Math.min(1, Math.max(0, profile.savingsMonths / 3));
  const savingsScore = Math.min(1, Math.max(0, budget.savingsRate / 0.20));
  const debtScore = budget.debtRatio <= 0.20
    ? 1
    : budget.debtRatio <= 0.35
    ? 1 - ((budget.debtRatio - 0.20) / 0.15) * 0.45
    : Math.max(0, 0.55 - ((budget.debtRatio - 0.35) / 0.20) * 0.55);
  const fixedScore = budget.fixedChargesRatio <= 0.50
    ? 1
    : Math.max(0, 1 - ((budget.fixedChargesRatio - 0.50) / 0.35));
  const balanceScore = budget.balanceMonthly >= 0
    ? Math.min(1, budget.totalIncomeMonthly > 0 ? budget.balanceMonthly / (budget.totalIncomeMonthly * 0.20) : 0)
    : 0;
  const stabilityScore = profile.employmentType === "cdi" || profile.employmentType === "retired"
    ? 1
    : profile.employmentType === "cdd"
    ? 0.65
    : profile.variableEnabled
    ? 0.45
    : 0.55;
  return clampScore(savingsScore * 24 + reserveScore * 22 + debtScore * 20 + fixedScore * 16 + balanceScore * 12 + stabilityScore * 6);
}

function simulateBudgetWithSaving(budget: MonthlyBudget, saving: number | undefined): MonthlyBudget {
  if (saving === undefined || saving <= 0) return budget;
  const nextExpenses = Math.max(0, budget.totalExpensesMonthly - saving);
  const nextBalance = budget.totalIncomeMonthly - nextExpenses;
  const nextSavingsRate = budget.totalIncomeMonthly > 0 ? Math.max(0, nextBalance) / budget.totalIncomeMonthly : 0;
  const nextDebtRatio = budget.totalIncomeMonthly > 0 ? Math.max(0, (budget.expenseByCategory.credit ?? 0) - saving) / budget.totalIncomeMonthly : 0;
  return { ...budget, totalExpensesMonthly: nextExpenses, totalExpensesAnnual: nextExpenses * 12, balanceMonthly: nextBalance, balanceAnnual: nextBalance * 12, savingsRate: nextSavingsRate, debtRatio: nextDebtRatio };
}

function buildProfileContext(profile: UserProfile, budget: MonthlyBudget): string {
  const city = profile.city.trim();
  const household = profile.situation === "couple" ? "profil couple" : profile.children.length > 0 ? `foyer avec ${profile.children.length} enfant(s)` : "profil solo";
  const variable = profile.variableEnabled ? "revenus variables" : "revenus stables";
  const location = city.length > 0 ? ` à ${city}` : "";
  const reserve = profile.savingsMonths < 1 ? "coussin de sécurité faible" : profile.savingsMonths < 3 ? "coussin de sécurité à renforcer" : "coussin de sécurité solide";
  const balance = budget.balanceMonthly >= 0 ? "solde positif" : "solde négatif";
  return `${household}${location} · ${variable} · ${reserve} · ${balance}`;
}

function priorityFromRecommendation(rec: AccountingRecommendation, scoreGain: number): number {
  const levelBase: Record<string, number> = { critical: 0, danger: 20, vigilance: 40, info: 60, conseil: 80 };
  const savingBoost = rec.saving !== undefined ? Math.min(12, Math.round(rec.saving / 25)) : 0;
  const scoreBoost = Math.min(10, Math.max(0, scoreGain));
  return Math.max(0, (levelBase[rec.level] ?? 90) - savingBoost - scoreBoost);
}

function enrichRecommendations(recs: AccountingRecommendation[], budget: MonthlyBudget, profile: UserProfile): AccountingRecommendation[] {
  const scoreBefore = computeAccountingScore(budget, profile);
  const profileContext = buildProfileContext(profile, budget);
  return recs.map((rec) => {
    const simulatedBudget = simulateBudgetWithSaving(budget, rec.saving);
    const scoreAfter = Math.max(scoreBefore, computeAccountingScore(simulatedBudget, profile));
    const scoreGain = scoreAfter - scoreBefore;
    const enriched: AccountingRecommendation = { ...rec };
    enriched.scoreBefore = scoreBefore;
    enriched.scoreAfter = scoreAfter;
    enriched.priority = priorityFromRecommendation(rec, scoreGain);
    enriched.profileContext = profileContext;
    if (scoreGain > 0) {
      enriched.impactLabel = `+${scoreGain} point${scoreGain > 1 ? "s" : ""} estimé${scoreGain > 1 ? "s" : ""}`;
    } else if (rec.saving !== undefined && rec.saving > 0) {
      enriched.impactLabel = `+${Math.round(rec.saving).toLocaleString("fr-FR")} €/mois potentiel`;
    }
    return enriched;
  }).sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
}


const PROFILE_AUTO_NOTE = "profil:auto";

function isProfileAutoNote(notes: string | undefined): boolean {
  return typeof notes === "string" && notes.startsWith(PROFILE_AUTO_NOTE);
}

function personLabel(profile: UserProfile): string {
  const full = `${profile.holder?.firstName ?? ""} ${profile.holder?.lastName ?? ""}`.trim();
  return full.length > 0 ? full : "Personne A";
}

function partnerLabel(profile: UserProfile): string {
  if (!profile.partner) return "Personne B";
  const full = `${profile.partner.firstName ?? ""} ${profile.partner.lastName ?? ""}`.trim();
  return full.length > 0 ? full : profile.partner.name || "Personne B";
}

function buildAccountingFromProfile(profile: UserProfile): { incomes: IncomeLine[]; expenses: ExpenseLine[] } {
  const incomes: IncomeLine[] = [];
  const expenses: ExpenseLine[] = [];
  const meName = personLabel(profile);
  const partnerName = partnerLabel(profile);
  const partnerSalary = profile.partner?.salaryNet ?? profile.partnerSalaryNet ?? 0;
  const defaultFixedOwner = profile.situation === "couple" ? "shared" : "me";

  if (profile.salaryNet > 0) {
    incomes.push(makeIncomeLine({ label: `Salaire net — ${meName}`, type: "salary", amount: profile.salaryNet, frequency: "monthly", isTaxable: true, owner: "me", notes: `${PROFILE_AUTO_NOTE}:salary` }));
  }
  if (partnerSalary > 0) {
    incomes.push(makeIncomeLine({ label: `Salaire net — ${partnerName}`, type: "salary", amount: partnerSalary, frequency: "monthly", isTaxable: true, owner: "partner", notes: `${PROFILE_AUTO_NOTE}:partner_salary` }));
  }
  if ((profile.partner?.bonusAnnual ?? 0) > 0) {
    incomes.push(makeIncomeLine({ label: `Primes lissées — ${partnerName}`, type: "bonus", amount: profile.partner?.bonusAnnual ?? 0, frequency: "annual", isTaxable: true, owner: "partner", notes: `${PROFILE_AUTO_NOTE}:partner_bonus` }));
  }
  if ((profile.partner?.otherIncome ?? 0) > 0) {
    incomes.push(makeIncomeLine({ label: `Autres revenus — ${partnerName}`, type: "other", amount: profile.partner?.otherIncome ?? 0, frequency: "monthly", isTaxable: true, owner: "partner", notes: `${PROFILE_AUTO_NOTE}:partner_other_income` }));
  }
  if (profile.bonusAnnual > 0) {
    incomes.push(makeIncomeLine({ label: `Primes lissées — ${meName}`, type: "bonus", amount: profile.bonusAnnual, frequency: "annual", isTaxable: true, owner: "me", notes: `${PROFILE_AUTO_NOTE}:bonus` }));
  }
  if (profile.allocationsTotal > 0) {
    incomes.push(makeIncomeLine({ label: "Allocations", type: "allowance", amount: profile.allocationsTotal, frequency: "monthly", isTaxable: false, owner: "shared", notes: `${PROFILE_AUTO_NOTE}:allocations` }));
  }
  if (profile.pensionReceived > 0) {
    incomes.push(makeIncomeLine({ label: "Pension alimentaire reçue", type: "pension", amount: profile.pensionReceived, frequency: "monthly", isTaxable: true, owner: "me", notes: `${PROFILE_AUTO_NOTE}:pension_received` }));
  }
  if (profile.otherIncome > 0) {
    incomes.push(makeIncomeLine({ label: `Autres revenus — ${meName}`, type: "other", amount: profile.otherIncome, frequency: "monthly", isTaxable: true, owner: "me", notes: `${PROFILE_AUTO_NOTE}:other_income` }));
  }

  const housing = profile.currentHousing;
  if ((housing.rent ?? 0) > 0) {
    expenses.push(makeExpenseLine({ label: "Loyer hors charges", category: "housing", amount: housing.rent ?? 0, frequency: "monthly", isFixed: true, isMandatory: true, owner: defaultFixedOwner, notes: `${PROFILE_AUTO_NOTE}:rent` }));
  }
  if ((housing.charges ?? 0) > 0) {
    expenses.push(makeExpenseLine({ label: "Charges logement", category: "housing", amount: housing.charges ?? 0, frequency: "monthly", isFixed: true, isMandatory: true, owner: defaultFixedOwner, notes: `${PROFILE_AUTO_NOTE}:housing_charges` }));
  }
  if ((housing.purchaseLoanMonthly ?? 0) > 0) {
    expenses.push(makeExpenseLine({ label: "Crédit immobilier", category: "credit", amount: housing.purchaseLoanMonthly ?? 0, frequency: "monthly", isFixed: true, isMandatory: true, owner: defaultFixedOwner, notes: `${PROFILE_AUTO_NOTE}:mortgage` }));
  }
  if ((housing.condoFees ?? 0) > 0) {
    expenses.push(makeExpenseLine({ label: "Charges copropriété", category: "housing", amount: housing.condoFees ?? 0, frequency: "monthly", isFixed: true, isMandatory: true, owner: defaultFixedOwner, notes: `${PROFILE_AUTO_NOTE}:condo` }));
  }
  if (profile.phoneInternet > 0) {
    expenses.push(makeExpenseLine({ label: "Téléphone & Internet", category: "telecom", amount: profile.phoneInternet, frequency: "monthly", isFixed: true, isMandatory: true, owner: defaultFixedOwner, notes: `${PROFILE_AUTO_NOTE}:telecom` }));
  }
  if (profile.insuranceTotal > 0) {
    expenses.push(makeExpenseLine({ label: "Assurances", category: "insurance", amount: profile.insuranceTotal, frequency: "monthly", isFixed: true, isMandatory: true, owner: defaultFixedOwner, notes: `${PROFILE_AUTO_NOTE}:insurance` }));
  }
  if (profile.pensionPaid > 0) {
    expenses.push(makeExpenseLine({ label: "Pension alimentaire versée", category: "other", amount: profile.pensionPaid, frequency: "monthly", isFixed: true, isMandatory: true, owner: "me", notes: `${PROFILE_AUTO_NOTE}:pension_paid` }));
  }
  if (profile.otherFixed > 0) {
    expenses.push(makeExpenseLine({ label: "Autres charges fixes", category: "other", amount: profile.otherFixed, frequency: "monthly", isFixed: true, isMandatory: true, owner: "me", notes: `${PROFILE_AUTO_NOTE}:other_fixed` }));
  }

  // ── Crédits en cours (CreditItem[]) — Fix 1 + Phase 13 ──────────────────
  for (const credit of profile.credits ?? []) {
    if (credit.monthlyPayment > 0) {
      const creditLine: Omit<ExpenseLine, "id" | "monthlyAmount" | "annualAmount"> = {
        label:       credit.name.trim() || "Crédit en cours",
        category:    "credit",
        amount:      credit.monthlyPayment,
        frequency:   "monthly",
        isFixed:     true,
        isMandatory: true,
        owner:       defaultFixedOwner,
        notes:       `${PROFILE_AUTO_NOTE}:credit_${credit.type}_${credit.name.trim().replace(/\s+/g, "_")}`,
      };
      creditLine.creditType = credit.type;
      if (credit.remainingMonths > 0) creditLine.remainingMonths = credit.remainingMonths;
      if (credit.lender !== undefined && credit.lender.trim().length > 0) creditLine.lender = credit.lender.trim();
      expenses.push(makeExpenseLine(creditLine));
    }
  }
  // ── Revenus variables (champs plats) — Fix 1 ────────────────────────────
  if (profile.variableEnabled && profile.variableIncomeMin > 0) {
    const average = Math.round((profile.variableIncomeMin + profile.variableIncomeMax) / 2);
    incomes.push(makeIncomeLine({
      label:     `Revenus variables — ${meName} (moyenne)`,
      type:      "other",
      amount:    average,
      frequency: "monthly",
      isTaxable: true,
      owner:     "me",
      notes:     `${PROFILE_AUTO_NOTE}:variable_income`,
    }));
  }

  return { incomes, expenses };
}

export const useAccountingStore = create<AccountingStore>()(
  persist(
    (set, get) => ({
      incomes:   [],
      expenses:  [],
      monthlyExpenses: [],
      activeMonth: currentMonth(),
      closedMonths: [],
      snapshots: [],
      envelopeSettings: { enabled: true, period: "monthly" },
      envelopeBudgets: [],

      syncFromProfile: (profile) => set((s) => {
        const generated = buildAccountingFromProfile(profile);
        const manualIncomes = s.incomes.filter((line) => !isProfileAutoNote(line.notes));
        const manualExpenses = s.expenses.filter((line) => !isProfileAutoNote(line.notes));
        const activeMonth = s.activeMonth || currentMonth();
        const keepMonthly = s.monthlyExpenses.filter((line) => !isProfileAutoNote(line.notes));
        const generatedMonthly = s.closedMonths.includes(activeMonth)
          ? []
          : generated.expenses
              .map((expense) => monthlyFromRecurring(expense, activeMonth))
              .filter((line): line is MonthlyExpenseLine => line !== null);
        return {
          incomes: [...generated.incomes, ...manualIncomes],
          expenses: [...generated.expenses, ...manualExpenses],
          monthlyExpenses: [...keepMonthly, ...generatedMonthly],
          activeMonth,
        };
      }),

      resetAccounting: () => set({
        incomes: [],
        expenses: [],
        monthlyExpenses: [],
        activeMonth: currentMonth(),
        closedMonths: [],
        snapshots: [],
        envelopeSettings: { enabled: true, period: "monthly" },
        envelopeBudgets: [],
      }),


      addIncome: (line) => set((s) => ({
        incomes: [...s.incomes, makeIncomeLine({ ...line, owner: line.owner ?? "me" })],
      })),
      updateIncome: (id, patch) => set((s) => ({
        incomes: s.incomes.map((l) => l.id === id ? recompute({ ...l, ...patch }) as IncomeLine : l),
      })),
      removeIncome: (id) => set((s) => ({ incomes: s.incomes.filter((l) => l.id !== id) })),

      addExpense: (line) => set((s) => {
        const expense = makeExpenseLine({ ...line, owner: line.owner ?? "me" });
        const seededLine = !s.closedMonths.includes(s.activeMonth)
          ? monthlyFromRecurring(expense, s.activeMonth)
          : null;
        return {
          expenses: [...s.expenses, expense],
          monthlyExpenses: seededLine !== null
            ? [...s.monthlyExpenses, seededLine]
            : s.monthlyExpenses,
        };
      }),
      updateExpense: (id, patch) => set((s) => {
        const expenses = s.expenses.map((l) => l.id === id ? recompute({ ...l, ...patch }) as ExpenseLine : l);
        const updated = expenses.find((l) => l.id === id);
        if (!updated) return { expenses };
        const monthlyExpenses = s.monthlyExpenses.map((line) => {
          if (line.sourceExpenseId !== id || line.status === "validated" || line.status === "ignored") return line;
          const plannedAmount = recurringAmountForMonth(updated, line.month);
          const next: MonthlyExpenseLine = {
            ...line,
            label: updated.label,
            category: updated.category,
            amount: line.realAmount ?? plannedAmount,
            plannedAmount,
            isFixed: updated.isFixed,
            isMandatory: updated.isMandatory,
            owner: updated.owner,
          };
          if (updated.category === "credit" && updated.remainingMonths !== undefined) {
            next.creditRemainingMonths = updated.remainingMonths;
            next.creditEndsThisMonth = updated.remainingMonths <= 1;
          }
          if (updated.lender !== undefined) next.creditLender = updated.lender;
          return next;
        });
        return { expenses, monthlyExpenses };
      }),
      removeExpense: (id) => set((s) => ({
        expenses: s.expenses.filter((l) => l.id !== id),
        monthlyExpenses: s.monthlyExpenses.filter((l) => l.sourceExpenseId !== id || l.status === "validated" || l.status === "added"),
      })),

      setActiveMonth: (month) => {
        set({ activeMonth: month });
        get().ensureMonth(month);
      },
      shiftActiveMonth: (offset) => {
        const next = addMonths(get().activeMonth, offset);
        set({ activeMonth: next });
        get().ensureMonth(next);
      },
      ensureMonth: (month = get().activeMonth) => set((s) => {
        if (s.closedMonths.includes(month)) return {};
        const existing = s.monthlyExpenses.filter((line) => line.month === month);
        const existingSourceIds = new Set(existing.map((line) => line.sourceExpenseId).filter(Boolean));
        const generated = s.expenses
          .filter((expense) => !existingSourceIds.has(expense.id))
          .map((expense) => monthlyFromRecurring(expense, month))
          .filter((line): line is MonthlyExpenseLine => line !== null);
        if (generated.length === 0) return {};
        return { monthlyExpenses: [...s.monthlyExpenses, ...generated] };
      }),
      getMonthExpenses: (month = get().activeMonth) => {
        const lines = get().monthlyExpenses.filter((line) => line.month === month);
        return [...lines].sort((a, b) => {
          const categoryDiff = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
          if (categoryDiff !== 0) return categoryDiff;
          if (a.isMandatory !== b.isMandatory) return a.isMandatory ? -1 : 1;
          return a.label.localeCompare(b.label, "fr");
        });
      },
      validateMonthlyExpense: (id) => set((s) => ({
        monthlyExpenses: s.monthlyExpenses.map((line) => {
          if (line.id !== id) return line;
          return { ...line, status: "validated", validatedAt: new Date().toISOString() };
        }),
      })),
      ignoreMonthlyExpense: (id) => set((s) => ({
        monthlyExpenses: s.monthlyExpenses.map((line) => line.id === id ? { ...line, status: "ignored" } : line),
      })),
      restoreMonthlyExpense: (id) => set((s) => ({
        monthlyExpenses: s.monthlyExpenses.map((line) => line.id === id ? { ...line, status: "pending" } : line),
      })),
      deleteMonthlyExpense: (id) => set((s) => ({
        monthlyExpenses: s.monthlyExpenses.filter((line) => line.id !== id),
      })),
      updateMonthlyExpense: (id, patch) => set((s) => ({
        monthlyExpenses: s.monthlyExpenses.map((line) => {
          if (line.id !== id) return line;
          const next = { ...line, ...patch };
          if (patch.realAmount !== undefined) {
            next.amount = patch.realAmount;
          } else if (patch.amount !== undefined) {
            next.amount = patch.amount;
          }
          return next;
        }),
      })),
      addMonthlyExpense: (line) => set((s) => {
        const item: MonthlyExpenseLine = {
          ...line,
          id: crypto.randomUUID(),
          status: line.status ?? "added",
        };
        return { monthlyExpenses: [...s.monthlyExpenses, item] };
      }),
      upsertImportedMonthlyExpense: (line) => {
        const item: MonthlyExpenseLine = {
          ...line,
          status: line.status ?? "added",
        };
        set((s) => {
          const exists = s.monthlyExpenses.some((existing) => existing.id === item.id);
          return {
            monthlyExpenses: exists
              ? s.monthlyExpenses.map((existing) => existing.id === item.id ? { ...existing, ...item } : existing)
              : [...s.monthlyExpenses, item],
          };
        });
        return item.id;
      },
      closeMonth: (month = get().activeMonth) => {
        // Phase 12A — décrémenter les crédits avant de figer le snapshot
        get().decrementCreditMonths();
        set((s) => {
          const budget = get().getBudgetForMonth(month);
          const snapshots = [...s.snapshots.filter((snap) => snap.month !== month), buildSnapshot(month, budget)]
            .sort((a, b) => a.month.localeCompare(b.month));
          return {
            closedMonths: [...new Set([...s.closedMonths, month])].sort(),
            snapshots,
          };
        });
      },
      // Phase 12A — décrémente remainingMonths des crédits actifs et inactive les crédits terminés
      decrementCreditMonths: () => set((s) => {
        const updated = s.expenses.map((expense): typeof expense => {
          if (expense.category !== "credit") return expense;
          const rm = expense.remainingMonths;
          if (rm === undefined || rm <= 0) return expense;
          const newRm = rm - 1;
          return { ...expense, remainingMonths: newRm };
        });
        // Mettre à jour les snapshots creditRemainingMonths dans les monthlyExpenses en cours
        const updatedMonthly = s.monthlyExpenses.map((line) => {
          if (line.category !== "credit" || line.creditRemainingMonths === undefined) return line;
          return line; // Snapshot figé — on ne modifie pas le passé
        });
        return { expenses: updated, monthlyExpenses: updatedMonthly };
      }),

      reopenMonth: (month = get().activeMonth) => set((s) => ({
        closedMonths: s.closedMonths.filter((m) => m !== month),
      })),
      setEnvelopeMode: (enabled, period) => set((s) => ({
        envelopeSettings: { enabled, period: period ?? s.envelopeSettings.period },
      })),
      upsertEnvelopeBudget: (budget) => set((s) => {
        const monthlyLimit = Math.max(0, Math.round(budget.monthlyLimit * 100) / 100);
        if (monthlyLimit <= 0) return {};
        const existingId = budget.id ?? s.envelopeBudgets.find((item) => item.category === budget.category)?.id;
        const next: EnvelopeBudget = {
          id: existingId ?? crypto.randomUUID(),
          category: budget.category,
          label: budget.label.trim().length > 0 ? budget.label.trim() : CATEGORY_LABELS[budget.category],
          monthlyLimit,
          isActive: budget.isActive,
        };
        if (budget.notes !== undefined && budget.notes.trim().length > 0) next.notes = budget.notes.trim();
        const exists = s.envelopeBudgets.some((item) => item.id === next.id);
        return {
          envelopeBudgets: exists
            ? s.envelopeBudgets.map((item) => item.id === next.id ? next : item)
            : [...s.envelopeBudgets, next],
        };
      }),
      removeEnvelopeBudget: (id) => set((s) => ({
        envelopeBudgets: s.envelopeBudgets.filter((item) => item.id !== id),
      })),
      getEnvelopeStatuses: (month = get().activeMonth): EnvelopeStatus[] => {
        const period = get().envelopeSettings.period;
        const lines = get().getMonthExpenses(month);
        const budgets = get().envelopeBudgets;
        const categories = Array.from(new Set([...ENVELOPE_CATEGORIES, ...budgets.filter((budget) => budget.isActive).map((budget) => budget.category)]));
        return categories
          .map((category) => buildEnvelopeStatus(category, lines, period, budgets))
          .filter((status) => status.isConfigured || status.planned > 0 || status.spent > 0 || status.category === "savings");
      },
      getEnvelopeStatus: (category, month = get().activeMonth): EnvelopeStatus => {
        return buildEnvelopeStatus(category, get().getMonthExpenses(month), get().envelopeSettings.period, get().envelopeBudgets);
      },
      redistributeEnvelopeRemaining: (from, to, amount) => set((s) => {
        const safeAmount = Math.max(0, Math.round(amount * 100) / 100);
        if (safeAmount <= 0 || from === to) return {};
        const fromLine = makeExpenseLine({
          label: `Rééquilibrage enveloppe — ${CATEGORY_LABELS[from]}`,
          category: from,
          amount: -safeAmount,
          frequency: "monthly",
          isFixed: false,
          isMandatory: false,
          owner: "shared",
          notes: `envelope:rebalance:${from}->${to}`,
        });
        const toLine = makeExpenseLine({
          label: `Rééquilibrage enveloppe — ${CATEGORY_LABELS[to]}`,
          category: to,
          amount: safeAmount,
          frequency: "monthly",
          isFixed: false,
          isMandatory: false,
          owner: "shared",
          notes: `envelope:rebalance:${from}->${to}`,
        });
        const fromMonthly = monthlyFromRecurring(fromLine, s.activeMonth);
        const toMonthly = monthlyFromRecurring(toLine, s.activeMonth);
        const additions = [fromMonthly, toMonthly].filter((line): line is MonthlyExpenseLine => line !== null);
        return {
          expenses: [...s.expenses, fromLine, toLine],
          monthlyExpenses: [...s.monthlyExpenses, ...additions],
        };
      }),
      getMonthSummary: (month = get().activeMonth): MonthPilotSummary => {
        const { closedMonths } = get();
        const lines = get().getMonthExpenses(month);
        const usable = usableMonthExpenses(lines);
        const ignoredCount = lines.filter((l) => l.status === "ignored").length;
        const pendingCount = lines.filter((l) => l.status === "pending").length;
        const validatedCount = lines.filter((l) => l.status === "validated").length;
        const addedCount = lines.filter((l) => l.status === "added").length;
        const recurringTotal = lines.filter((l) => l.status !== "added" && l.status !== "ignored").length;
        const budget = get().getBudgetForMonth(month);
        const daysRemaining = daysRemainingInMonth(month);
        const projectedExtra = usable
          .filter((l) => !l.isFixed && !l.isMandatory)
          .reduce((s, l) => s + l.amount, 0) * (daysRemaining > 0 ? Math.min(0.35, daysRemaining / 90) : 0);
        return {
          month,
          isClosed: closedMonths.includes(month),
          pendingCount,
          validatedCount,
          ignoredCount,
          addedCount,
          daysRemaining,
          projectedBalance: budget.balanceMonthly - projectedExtra,
          projectedExpenses: budget.totalExpensesMonthly + projectedExtra,
          validationProgress: recurringTotal > 0 ? validatedCount / recurringTotal : 1,
        };
      },

      saveSnapshot: (snap) => set((s) => {
        const existing = s.snapshots.filter((x) => x.month !== snap.month);
        return { snapshots: [...existing, snap].sort((a, b) => a.month.localeCompare(b.month)) };
      }),
      getSnapshots: () => get().snapshots,

      getBudget: (): MonthlyBudget => get().getBudgetForMonth(get().activeMonth),
      getBudgetForMonth: (month): MonthlyBudget => {
        const { incomes, expenses, monthlyExpenses } = get();
        const monthLines = monthlyExpenses.filter((line) => line.month === month);
        if (monthLines.length === 0) return buildMonthlyBudget(incomes, expenses);
        return buildMonthlyBudget(incomes, usableMonthExpenses(monthLines));
      },

      getCoupleBudget: (personName = "Personne A", partnerName = "Personne B"): CoupleBudget | null => {
        const { incomes } = get();
        const expenses = usableMonthExpenses(get().getMonthExpenses());
        const hasPartner = incomes.some((l) => l.owner === "partner") || expenses.some((l) => l.owner === "partner");
        if (!hasPartner) return null;

        const myIncomes      = incomes.filter((l) => l.owner === "me");
        const partnerIncomes = incomes.filter((l) => l.owner === "partner");
        const sharedExpenses = expenses.filter((l) => l.owner === "shared");
        const sharedTotal    = sharedExpenses.reduce((s, l) => s + l.amount, 0);
        const myExpenses     = expenses.filter((l) => l.owner === "me");
        const partnerExpenses= expenses.filter((l) => l.owner === "partner");

        const myIncomeTotal      = myIncomes.reduce((s, l) => s + l.monthlyAmount, 0);
        const partnerIncomeTotal = partnerIncomes.reduce((s, l) => s + l.monthlyAmount, 0);
        const combinedIncome     = myIncomeTotal + partnerIncomeTotal;
        const myShare      = combinedIncome > 0 ? myIncomeTotal / combinedIncome : 0.5;
        const partnerShare = 1 - myShare;
        const myExpTotal      = myExpenses.reduce((s, l) => s + l.amount, 0) + sharedTotal * myShare;
        const partnerExpTotal = partnerExpenses.reduce((s, l) => s + l.amount, 0) + sharedTotal * partnerShare;
        const myBalance      = myIncomeTotal - myExpTotal;
        const partnerBalance = partnerIncomeTotal - partnerExpTotal;
        const myRate         = myIncomeTotal > 0 ? Math.max(0, myBalance) / myIncomeTotal : 0;
        const partnerRate    = partnerIncomeTotal > 0 ? Math.max(0, partnerBalance) / partnerIncomeTotal : 0;

        const me: PersonBudget = { label: personName, totalIncomeMonthly: myIncomeTotal, totalExpensesMonthly: myExpTotal, balanceMonthly: myBalance, savingsRate: myRate, shareOfCommonExpenses: myShare };
        const partner: PersonBudget = { label: partnerName, totalIncomeMonthly: partnerIncomeTotal, totalExpensesMonthly: partnerExpTotal, balanceMonthly: partnerBalance, savingsRate: partnerRate, shareOfCommonExpenses: partnerShare };
        const combined = buildMonthlyBudget(incomes, expenses);
        const whoSavesMore: CoupleBudget["whoSavesMore"] = Math.abs(myRate - partnerRate) < 0.02 ? "equal" : myRate > partnerRate ? "me" : "partner";
        const whoSpendMore: CoupleBudget["whoSpendMore"] = Math.abs(myExpTotal - partnerExpTotal) < 50 ? "equal" : myExpTotal > partnerExpTotal ? "me" : "partner";
        let rebalanceSuggestion: string | undefined;
        const incomeDiff = Math.abs(myRate - partnerRate);
        if (incomeDiff > 0.15 && combinedIncome > 0) {
          const lowestSaver = myRate < partnerRate ? personName : partnerName;
          const targetIncrease = Math.round(combined.totalIncomeMonthly * 0.05);
          rebalanceSuggestion = `${lowestSaver} pourrait augmenter son effort d'épargne de ${targetIncrease} EUR/mois pour équilibrer les taux.`;
        }
        const result: CoupleBudget = { me, partner, combined, sharedExpenses: sharedTotal, whoSavesMore, whoSpendMore };
        if (rebalanceSuggestion !== undefined) result.rebalanceSuggestion = rebalanceSuggestion;
        return result;
      },

      getRecommendations: (): AccountingRecommendation[] => {
        // ── Moteur 50/30/20 + référentiel INSEE 2024 — Fix 5 ─────────────────
        const budget  = get().getBudget();
        const profile = useProfileStore.getState().profile;
        const expenses = usableMonthExpenses(get().getMonthExpenses());
        const summary = get().getMonthSummary();
        const rev     = budget.totalIncomeMonthly;
        const recs: AccountingRecommendation[] = [];

        // Helper : formater en EUR arrondi
        const eur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;

        // Référentiel INSEE 2024 — part des revenus par catégorie
        const INSEE: Partial<Record<string, number>> = {
          housing:       0.27,
          food:          0.13,
          transport:     0.14,
          telecom:       0.025,
          insurance:     0.04,
          subscriptions: 0.02,
          leisure:       0.07,
          restaurants:   0.04,
          health:        0.03,
          education:     0.02,
          clothing:      0.03,
          credit:        0.18,
          childcare:     0.05,
          other:         0.03,
        };

        // ── 1. Charges en attente ──────────────────────────────────────────
        if (summary.pendingCount > 0) {
          recs.push({
            id: "M001", level: "info", category: "global",
            title: `${summary.pendingCount} charge(s) à valider ce mois`,
            detail: "Vos dépenses en attente ne sont pas encore comptabilisées dans votre bilan. Le solde affiché est incomplet.",
            action: "Ouvrez l'onglet Dépenses et validez ou ignorez chaque ligne avant la fin du mois.",
          });
        }

        if (rev <= 0) {
          recs.push({ id: "E001", level: "danger", category: "global", title: "Revenus non renseignés", detail: "Aucun revenu n'est enregistré. Les analyses budgétaires ne peuvent pas être calculées.", action: "Ajoutez vos revenus dans l'onglet Revenus ou complétez votre profil." });
          return enrichRecommendations(recs, budget, profile);
        }

        // ── 2. Solde négatif (CRITIQUE) ────────────────────────────────────
        if (budget.balanceMonthly < 0) {
          // Top 3 postes par montant
          const top3 = Object.entries(budget.expenseByCategory)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([cat, amt]) => `${cat} (${eur(amt)})`)
            .join(", ");
          recs.push({
            id: "R001", level: "critical", category: "global",
            title: `Solde négatif : −${eur(Math.abs(budget.balanceMonthly))}/mois`,
            detail: `Vos dépenses dépassent vos revenus de ${eur(Math.abs(budget.balanceMonthly))} chaque mois. Postes principaux : ${top3}.`,
            saving: Math.abs(budget.balanceMonthly),
            action: `Réduisez ces 3 postes de 15 % chacun pour retrouver l'équilibre. Commencez par le plus élevé.`,
          });
        }

        // ── 3. Taux d'endettement > 35 % HCSF (CRITIQUE) ─────────────────
        if (budget.debtRatio > 0.35) {
          const creditAmt = budget.expenseByCategory.credit ?? 0;
          const liberableAmt = Math.max(0, creditAmt - rev * 0.33);
          const r002: AccountingRecommendation = {
            id: "R002", level: budget.debtRatio > 0.45 ? "critical" : "danger", category: "credit",
            title: `Endettement ${(budget.debtRatio * 100).toFixed(0)} % — dépasse le plafond bancaire`,
            detail: `Vos crédits représentent ${(budget.debtRatio * 100).toFixed(1)} % de vos revenus. Le plafond HCSF est 35 %. Avec vos revenus actuels, le maximum acceptable est ${eur(rev * 0.35)}/mois.`,
            action: "Renseignez-vous sur le rachat de crédits ou le remboursement anticipé du crédit le plus court restant.",
          };
          if (liberableAmt > 0) r002.saving = liberableAmt;
          recs.push(r002);
        }

        // ── 4. Règle 50/30/20 (DANGER si dépasse) ─────────────────────────
        const NEEDS_CATS  = ["housing", "food", "transport", "credit", "insurance", "health", "childcare", "telecom"];
        const WANTS_CATS  = ["leisure", "restaurants", "subscriptions", "clothing", "gifts", "other"];
        const needsTotal  = NEEDS_CATS.reduce((s, c) => s + (budget.expenseByCategory[c as keyof typeof budget.expenseByCategory] ?? 0), 0);
        const wantsTotal  = WANTS_CATS.reduce((s, c) => s + (budget.expenseByCategory[c as keyof typeof budget.expenseByCategory] ?? 0), 0);
        const needsPct    = rev > 0 ? needsTotal / rev : 0;
        const wantsPct    = rev > 0 ? wantsTotal / rev : 0;
        const savingsPct  = Math.max(0, budget.savingsRate);

        if (needsPct > 0.55 && budget.balanceMonthly >= 0) {
          // Identifier le poste besoins le plus élevé vs benchmark INSEE
          const worstNeed = NEEDS_CATS
            .map(c => ({ c, amt: budget.expenseByCategory[c as keyof typeof budget.expenseByCategory] ?? 0, bench: (INSEE[c] ?? 0) * rev }))
            .sort((a, b) => (b.amt - b.bench) - (a.amt - a.bench))[0];
          const overshoot = worstNeed ? worstNeed.amt - worstNeed.bench : 0;
          const r003: AccountingRecommendation = {
            id: "R003", level: "danger", category: "global",
            title: `Besoins essentiels : ${(needsPct * 100).toFixed(0)} % de vos revenus (règle des 50 %)`,
            detail: `Vos charges incompressibles absorbent ${(needsPct * 100).toFixed(0)} % de vos revenus, au-dessus du seuil conseillé de 50 %. ${worstNeed && overshoot > 30 ? `Le poste "${worstNeed.c}" est ${eur(overshoot)} au-dessus de la médiane INSEE.` : ""}`,
            action: worstNeed ? `Concentrez-vous sur la réduction du poste "${worstNeed.c}" en priorité.` : "Renégociez ou optimisez vos charges fixes une par une.",
          };
          if (overshoot > 0) r003.saving = overshoot;
          recs.push(r003);
        }

        if (wantsPct > 0.30 && budget.balanceMonthly >= 0) {
          const targetWants = rev * 0.30;
          recs.push({
            id: "R004", level: "vigilance", category: "global",
            title: `Envies & loisirs : ${(wantsPct * 100).toFixed(0)} % — au-dessus des 30 % conseillés`,
            detail: `Vous dépensez ${eur(wantsTotal)}/mois en loisirs, sorties et abonnements. La règle 50/30/20 recommande de rester sous ${eur(targetWants)}/mois.`,
            saving: wantsTotal - targetWants,
            action: "Identifiez 2 ou 3 postes «envies» à réduire temporairement pour renforcer votre épargne.",
          });
        }

        // ── 5. Épargne insuffisante (DANGER / VIGILANCE) ───────────────────
        if (savingsPct < 0.03 && budget.balanceMonthly >= 0) {
          const target3m = budget.totalExpensesMonthly * 3;
          recs.push({
            id: "R005", level: "danger", category: "savings",
            title: `Épargne quasi nulle : ${(savingsPct * 100).toFixed(1)} % de vos revenus`,
            detail: `Vous n'épargnez que ${eur(Math.max(0, budget.balanceMonthly))}/mois. Sans coussin de sécurité, le moindre imprévu (réparation, chômage) fragilise votre budget. Objectif : 3 mois de charges = ${eur(target3m)}.`,
            saving: rev * 0.10 - Math.max(0, budget.balanceMonthly),
            action: "Ouvrez un Livret A ou LDDS et programmez un virement automatique de 50 € dès ce mois.",
          });
        } else if (savingsPct < 0.10 && budget.balanceMonthly >= 0) {
          recs.push({
            id: "R006", level: "vigilance", category: "savings",
            title: `Épargne faible : ${(savingsPct * 100).toFixed(1)} % (objectif : 10–15 %)`,
            detail: `Vous épargnez ${eur(Math.max(0, budget.balanceMonthly))}/mois. La règle 50/30/20 recommande au minimum 10 % de vos revenus, soit ${eur(rev * 0.10)}/mois.`,
            saving: rev * 0.10 - Math.max(0, budget.balanceMonthly),
            action: "Augmentez progressivement votre épargne automatique de 20–30 €/mois jusqu'à atteindre 10 %.",
          });
        }

        // ── 6. Analyse par catégorie vs benchmark INSEE (+30 %) ───────────
        const CATS_TO_ANALYZE: Array<keyof typeof INSEE> = [
          "housing", "food", "transport", "telecom", "insurance",
          "subscriptions", "leisure", "restaurants", "health", "clothing",
        ];
        for (const cat of CATS_TO_ANALYZE) {
          const catAmt   = (budget.expenseByCategory[cat as keyof typeof budget.expenseByCategory] ?? 0);
          const bench    = (INSEE[cat] ?? 0) * rev;
          const overshoot = catAmt - bench;
          const overPct  = bench > 0 ? overshoot / bench : 0;

          if (overshoot > 20 && overPct > 0.30 && catAmt > 40) {
            const label    = CATEGORY_LABELS[cat as ExpenseCategory] ?? cat;
            const benchPct = ((INSEE[cat] ?? 0) * 100).toFixed(0);
            const actualPct = (catAmt / rev * 100).toFixed(0);
            recs.push({
              id: `C_${cat}`, level: overPct > 0.80 ? "vigilance" : "info",
              category: cat as ExpenseCategory,
              title: `${label} : ${eur(catAmt)}/mois (médiane INSEE : ${eur(bench)})`,
              detail: `Vous consacrez ${actualPct} % de vos revenus au poste "${label}", contre ${benchPct} % en moyenne nationale. Écart : +${eur(overshoot)}/mois (${eur(overshoot * 12)}/an).`,
              saving: Math.round(overshoot * 0.5),
              action: cat === "telecom"
                ? "Comparez les offres opérateurs : Bouygues, SFR, Free — une économie de 20–40 €/mois est souvent possible."
                : cat === "subscriptions"
                ? "Auditez chaque abonnement : notez ceux non utilisés depuis 1 mois et annulez-les immédiatement."
                : cat === "restaurants"
                ? "Fixez un budget sorties mensuel et cuisinez 2 repas de plus par semaine — économie estimée : 40–80 €/mois."
                : cat === "leisure"
                ? "Établissez un budget loisirs fixe et consultez les offres locales gratuites ou peu coûteuses."
                : `Réduisez ce poste de 10–20 % pour économiser ${eur(Math.round(overshoot * 0.5))}/mois.`,
            });
          }
        }

        // ── 7. Abonnements : nombre et coût annuel ─────────────────────────
        const subs = expenses.filter((l) => l.category === "subscriptions");
        if (subs.length >= 3) {
          const subsTotal = subs.reduce((s, l) => s + l.amount, 0);
          const benchSubs = (INSEE.subscriptions ?? 0.02) * rev;
          const subsOver  = Math.max(0, subsTotal - benchSubs);
          recs.push({
            id: "R007", level: subs.length >= 6 ? "vigilance" : "info", category: "subscriptions",
            title: `${subs.length} abonnements actifs — ${eur(subsTotal)}/mois soit ${eur(subsTotal * 12)}/an`,
            detail: `La médiane INSEE est de ${eur(benchSubs)}/mois pour les abonnements. ${subsOver > 10 ? `Vous dépassez de ${eur(subsOver)}/mois.` : "Vous êtes dans la norme."}`,
            saving: subsOver > 0 ? Math.round(subsOver * 0.7) : Math.round(subsTotal * 0.2),
            action: "Listez tous vos abonnements et annulez ceux non utilisés dans les 30 derniers jours. Une seule plateforme de streaming suffit généralement.",
          });
        }

        // ── 8. Télécom > 80 €/mois ────────────────────────────────────────
        const telecomAmt = budget.expenseByCategory.telecom ?? 0;
        if (telecomAmt > 80) {
          recs.push({
            id: "R008", level: "info", category: "telecom",
            title: `Télécom & Internet : ${eur(telecomAmt)}/mois — optimisable`,
            detail: `Des offres équivalentes existent entre 20 et 50 €/mois (Free, Bouygues B&You, SFR Red). Vous pourriez économiser jusqu'à ${eur(Math.round(telecomAmt - 45))}/mois.`,
            saving: Math.max(0, Math.round(telecomAmt - 45)),
            action: "Comparez sur un comparateur (lelynx.fr, meilleurmobile.com) et renseignez-vous sur les frais de résiliation.",
          });
        }

        // ── 9. Renégociation crédit immobilier ────────────────────────────
        const mortgageExp = expenses.find((l) => l.sourceExpenseId !== undefined
          ? false : l.category === "credit" && l.label.toLowerCase().includes("immobilier"));
        if (mortgageExp && mortgageExp.amount > 400) {
          recs.push({
            id: "R009", level: "info", category: "credit",
            title: "Crédit immobilier : avez-vous envisagé la renégociation ?",
            detail: "Si votre taux est supérieur au marché actuel (~3,5 % sur 20 ans) et qu'il vous reste plus de 7 ans, une renégociation peut générer des économies significatives.",
            action: "Contactez un courtier (CAFPI, Meilleurtaux) pour une simulation gratuite. La règle : écart de taux > 0,7 % ET capital restant > 50 000 €.",
          });
        }

        // ── 10. Placement de l'épargne positive ───────────────────────────
        if (budget.balanceMonthly >= rev * 0.08) {
          recs.push({
            id: "R010", level: "info", category: "savings",
            title: `Épargne mensuelle de ${eur(budget.balanceMonthly)} — optimisez son placement`,
            detail: `À ${eur(budget.balanceMonthly)}/mois, vous constituez ${eur(budget.balanceMonthly * 12)}/an. Livret A (taux réglementé) pour l'épargne de précaution, puis PEA ou assurance-vie pour le long terme.`,
            action: "Ouvrez un PEA si vous n'en avez pas — plafond 150 000 € et fiscalité avantageuse après 5 ans.",
          });
        }

        // ── 11. Félicitations — épargne saine ────────────────────────────
        if (savingsPct >= 0.15 && budget.balanceMonthly > 0) {
          recs.push({
            id: "R011", level: "conseil", category: "savings",
            title: `Excellente épargne : ${(savingsPct * 100).toFixed(0)} % de vos revenus`,
            detail: `Vous épargnez ${eur(budget.balanceMonthly)}/mois, soit ${eur(budget.balanceMonthly * 12)}/an. À ce rythme, vous atteignez ${eur(budget.balanceMonthly * 12 * 5)} en 5 ans (hors rendements).`,
            action: "Diversifiez : épargne de précaution (3–6 mois de charges) + investissement long terme (PEA, assurance-vie, SCPI).",
          });
        } else if (savingsPct >= 0.10 && savingsPct < 0.15 && budget.balanceMonthly > 0) {
          recs.push({
            id: "R012", level: "conseil", category: "savings",
            title: `Bonne trajectoire : ${(savingsPct * 100).toFixed(0)} % d'épargne`,
            detail: `Vous êtes dans la bonne fourchette (10–15 %). En maintenant ce cap, vous constituez ${eur(budget.balanceMonthly * 12 * 3)} en 3 ans.`,
            action: "Prochaine étape : automatisez un virement en début de mois pour sécuriser cette épargne avant les dépenses.",
          });
        }

        // ── ZIP 5 — Contextualisation par profil actif ────────────────────────
        if (profile.situation === "couple" && budget.balanceMonthly > 0) {
          recs.push({
            id: "P_COUPLE_BALANCE", level: "info", category: "global",
            title: "Profil couple : vérifiez l'équilibre A/B avant d'optimiser",
            detail: "Les recommandations sont priorisées sur le budget global. Pour éviter qu'un membre du couple porte trop de charges, contrôlez aussi l'onglet Couple avant d'augmenter l'épargne.",
            action: "Ouvrez l'onglet Couple et comparez le reste à vivre de chaque personne avant de fixer un nouveau virement d'épargne.",
          });
        }

        if (profile.variableEnabled && budget.balanceMonthly > 0) {
          recs.push({
            id: "P_VARIABLE_INCOME", level: "vigilance", category: "savings",
            title: "Revenus variables : priorité au coussin de sécurité",
            detail: "Votre profil indique des revenus variables. Les économies détectées doivent d'abord sécuriser 3 mois de charges avant les placements long terme.",
            saving: Math.max(0, Math.min(budget.balanceMonthly, budget.totalExpensesMonthly * 3 / 12)),
            action: "Affectez les économies récurrentes au Livret A/LDDS jusqu'à couvrir 3 mois de charges.",
          });
        }

        if (profile.children.length > 0 && budget.savingsRate < 0.12) {
          recs.push({
            id: "P_CHILDREN_RESERVE", level: "vigilance", category: "savings",
            title: "Foyer avec enfant(s) : marge de sécurité à renforcer",
            detail: "Avec enfant(s), les dépenses imprévues sont plus fréquentes. L'objectif minimal conseillé est 10 à 15 % d'épargne tant que le coussin reste inférieur à 3 mois.",
            saving: Math.max(0, rev * 0.12 - Math.max(0, budget.balanceMonthly)),
            action: "Créez un objectif d'épargne de précaution dédié famille et automatisez le versement en début de mois.",
          });
        }

        // ── Phase 12A — Alertes crédits intelligents ─────────────────────────
        // Crédits se terminant dans 1 à 3 mois
        const creditsEndingSoon = get().expenses.filter(
          (e) => e.category === "credit"
            && (e.remainingMonths ?? 999) > 0
            && (e.remainingMonths ?? 999) <= 3
        );
        for (const credit of creditsEndingSoon) {
          const rm = credit.remainingMonths ?? 0;
          const endDate = new Date();
          endDate.setMonth(endDate.getMonth() + rm);
          const endLabel = endDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
          const r_ce: AccountingRecommendation = {
            id:       `CREDIT_END_${credit.id}`,
            level:    rm <= 1 ? "conseil" : "info",
            category: "credit",
            title:    `Crédit "${credit.label}" — encore ${rm} mois`,
            detail:   `Ce crédit se termine en ${endLabel}${credit.lender ? ` (${credit.lender})` : ""}. Il libère ${eur(credit.monthlyAmount)}/mois, soit ${eur(credit.monthlyAmount * 12)}/an de capacité retrouvée.`,
            action:   "Anticipez l'affectation : épargne automatique, remboursement d'un autre crédit, ou projet d'achat.",
          };
          if (credit.monthlyAmount > 0) r_ce.saving = credit.monthlyAmount;
          recs.push(r_ce);
        }

        // Crédits tout juste terminés (remainingMonths === 0)
        const creditsJustFreed = get().expenses.filter(
          (e) => e.category === "credit" && (e.remainingMonths ?? -1) === 0
        );
        for (const credit of creditsJustFreed) {
          const r_cf: AccountingRecommendation = {
            id:       `CREDIT_FREED_${credit.id}`,
            level:    "conseil",
            category: "credit",
            title:    `🎉 Crédit "${credit.label}" terminé — ${eur(credit.monthlyAmount)}/mois libérés`,
            detail:   `Votre crédit est soldé. Vous récupérez ${eur(credit.monthlyAmount)}/mois de capacité financière, soit ${eur(credit.monthlyAmount * 12)}/an.`,
            action:   "Affectez ces fonds : Livret A, PEA, remboursement d'un autre crédit, ou augmentez votre épargne de précaution.",
          };
          if (credit.monthlyAmount > 0) r_cf.saving = credit.monthlyAmount;
          recs.push(r_cf);
        }

        // ── Phase 13 — Méthode des enveloppes : dépassements et réajustements ──
        if (get().envelopeSettings.enabled) {
          const envelopeStatuses = get().getEnvelopeStatuses();
          const overspent = envelopeStatuses
            .filter((status) => status.remaining < -1 && !status.isSavingsEnvelope)
            .sort((a, b) => a.remaining - b.remaining);
          for (const envelope of overspent.slice(0, 4)) {
            recs.push({
              id: `ENV_OVER_${envelope.category}`,
              level: envelope.percent >= 1.25 ? "danger" : "vigilance",
              category: envelope.category,
              title: `Enveloppe ${envelope.label} dépassée de ${eur(Math.abs(envelope.remaining))}`,
              detail: `Vous avez consommé ${eur(envelope.spent)} sur ${eur(envelope.planned)} prévus. La méthode des enveloppes recommande de compenser ce dépassement avant d'augmenter les autres dépenses variables.`,
              saving: Math.abs(envelope.remaining),
              action: "Réduisez les prochains achats de cette catégorie ou rééquilibrez depuis une enveloppe encore positive.",
            });
          }
          const positiveEnvelopes = envelopeStatuses
            .filter((status) => status.remaining > 10 && !status.isSavingsEnvelope)
            .sort((a, b) => b.remaining - a.remaining);
          if (positiveEnvelopes.length > 0 && budget.balanceMonthly > 0) {
            const totalRemaining = positiveEnvelopes.reduce((sum, status) => sum + status.remaining, 0);
            recs.push({
              id: "ENV_REMAINING_TO_SAVINGS",
              level: "conseil",
              category: "savings",
              title: `Enveloppes positives : ${eur(totalRemaining)} à orienter`,
              detail: `Il reste ${eur(totalRemaining)} dans vos enveloppes variables. La méthode recommande de mettre ce reste de côté plutôt que de le consommer en fin de mois.`,
              saving: totalRemaining,
              action: "Transférez tout ou partie du reste vers l'enveloppe Épargne & Placements.",
            });
          }
        }

        return enrichRecommendations(recs, budget, profile);
      },

      getDriftAlerts: (): AccountingRecommendation[] => {
        const { snapshots } = get();
        if (snapshots.length < 2) return [];
        const alerts: AccountingRecommendation[] = [];
        const budget = get().getBudget();
        const recent = snapshots.slice(-3);
        const avgBalance = recent.reduce((s, x) => s + x.balanceMonthly, 0) / recent.length;
        if (avgBalance > 0 && budget.balanceMonthly < avgBalance * 0.7) {
          alerts.push({ id: "D001", level: "vigilance", category: "global", title: "Détérioration du solde ce mois", detail: `Votre solde (${budget.balanceMonthly.toFixed(0)} EUR) est inférieur à votre moyenne récente (${avgBalance.toFixed(0)} EUR).`, action: "Identifiez les dépenses inhabituelles du mois." });
        }
        const avgSavingsRate = recent.reduce((s, x) => s + x.savingsRate, 0) / recent.length;
        if (avgSavingsRate > 0.08 && budget.savingsRate < avgSavingsRate * 0.6) {
          alerts.push({ id: "D002", level: "vigilance", category: "savings", title: "Taux d'épargne en baisse", detail: `Votre taux d'épargne ce mois (${(budget.savingsRate * 100).toFixed(1)}%) est bien en dessous de votre moyenne (${(avgSavingsRate * 100).toFixed(1)}%).` });
        }
        return alerts;
      },
    }),
    {
      name: "simubudget-accounting",
      storage: createJSONStorage(() => profileScopedStorage()),
      version: 12,
      migrate: (persisted) => {
        const state = persisted as Partial<AccountingStore> | undefined;
        if (!state) return persisted;
        return {
          ...state,
          monthlyExpenses: state.monthlyExpenses ?? [],
          activeMonth: state.activeMonth ?? currentMonth(),
          closedMonths: state.closedMonths ?? [],
          snapshots: state.snapshots ?? [],
          envelopeSettings: state.envelopeSettings ?? { enabled: true, period: "monthly" },
          envelopeBudgets: state.envelopeBudgets ?? [],
        };
      },
    }
  )
);
