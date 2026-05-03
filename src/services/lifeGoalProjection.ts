// =============================================================================
// Fichier  : src/services/lifeGoalProjection.ts
// Auteur   : KREMER Régis
// Desc.    : Projection réelle des objectifs de vie à partir du budget, des crédits
//            et des dépenses optimisables.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-05-03 | KREMER Régis | Création — moteur objectifs de vie + projection réelle
// =============================================================================

import type { ExpenseCategory, ExpenseLine, MonthlyBudget } from "@/types/accounting";
import type { SavingsGoal } from "@/types/profile";

export type LifeGoalKind = "savings" | "purchase" | "debt" | "safety" | "travel" | "other";
export type LifeGoalRisk = "blocked" | "tight" | "on_track" | "comfortable";

export interface LifeGoalAction {
  id: string;
  label: string;
  detail: string;
  monthlyGain: number;
  kind: "expense_cut" | "credit_release" | "allocation";
}

export interface LifeGoalProjection {
  goalKind: LifeGoalKind;
  remainingAmount: number;
  currentMonthlyContribution: number;
  realMonthlyCapacity: number;
  realisticMonthlyContribution: number;
  projectedMonths: number | null;
  projectedDateLabel: string | null;
  targetMonths: number | null;
  requiredMonthlyForTarget: number | null;
  monthlyGapForTarget: number | null;
  optimizedMonthlyContribution: number;
  optimizedMonths: number | null;
  optimizedDateLabel: string | null;
  firstCreditReliefMonth: number | null;
  firstCreditReliefAmount: number;
  risk: LifeGoalRisk;
  headline: string;
  explanation: string;
  actions: LifeGoalAction[];
}

const MAX_PROJECTION_MONTHS = 240;

const NON_ESSENTIAL_CATEGORIES = new Set<ExpenseCategory>([
  "leisure",
  "clothing",
  "gifts",
  "subscriptions",
  "other",
]);

const PARTIAL_OPTIMIZATION_CATEGORIES = new Set<ExpenseCategory>([
  "food",
  "transport",
  "telecom",
  "insurance",
]);

const GOAL_KIND_PATTERNS: Array<{ kind: LifeGoalKind; words: string[] }> = [
  { kind: "purchase", words: ["apport", "maison", "appartement", "immobilier", "achat", "voiture"] },
  { kind: "debt", words: ["credit", "crédit", "dette", "rembourser", "pret", "prêt"] },
  { kind: "safety", words: ["precaution", "précaution", "securite", "sécurité", "urgence"] },
  { kind: "travel", words: ["vacances", "voyage", "weekend", "week-end"] },
  { kind: "savings", words: ["epargne", "épargne", "livret", "placement"] },
];

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function detectGoalKind(label: string): LifeGoalKind {
  const normalized = normalizeText(label);
  for (const item of GOAL_KIND_PATTERNS) {
    if (item.words.some((word) => normalized.includes(normalizeText(word)))) {
      return item.kind;
    }
  }
  return "other";
}

function addMonthsToToday(months: number): Date {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + Math.max(0, months));
  return d;
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function monthsUntilTarget(targetDate?: string): number | null {
  if (!targetDate) return null;
  const target = new Date(targetDate);
  if (Number.isNaN(target.getTime())) return null;

  const now = new Date();
  const months = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
  return Math.max(1, months);
}

function monthsToReachWithCredits(
  remainingAmount: number,
  monthlyContribution: number,
  expenses: ExpenseLine[],
): { months: number | null; firstCreditReliefMonth: number | null; firstCreditReliefAmount: number } {
  if (remainingAmount <= 0) {
    return { months: 0, firstCreditReliefMonth: null, firstCreditReliefAmount: 0 };
  }

  let saved = 0;
  let cumulativeCreditRelief = 0;
  let firstCreditReliefMonth: number | null = null;
  let firstCreditReliefAmount = 0;

  for (let month = 1; month <= MAX_PROJECTION_MONTHS; month += 1) {
    const creditsEndingThisMonth = expenses.filter((expense) =>
      expense.category === "credit" &&
      typeof expense.remainingMonths === "number" &&
      expense.remainingMonths === month &&
      expense.monthlyAmount > 0,
    );

    const newRelief = creditsEndingThisMonth.reduce((sum, expense) => sum + expense.monthlyAmount, 0);
    if (newRelief > 0) {
      cumulativeCreditRelief += newRelief;
      if (firstCreditReliefMonth === null) {
        firstCreditReliefMonth = month;
        firstCreditReliefAmount = newRelief;
      }
    }

    const effectiveContribution = Math.max(0, monthlyContribution + cumulativeCreditRelief);
    saved += effectiveContribution;

    if (saved >= remainingAmount) {
      return { months: month, firstCreditReliefMonth, firstCreditReliefAmount };
    }
  }

  return { months: null, firstCreditReliefMonth, firstCreditReliefAmount };
}

function buildOptimizationActions(expenses: ExpenseLine[]): LifeGoalAction[] {
  const actions: LifeGoalAction[] = [];

  for (const expense of expenses) {
    if (expense.monthlyAmount <= 0) continue;

    if (NON_ESSENTIAL_CATEGORIES.has(expense.category)) {
      const gain = Math.round(expense.monthlyAmount * 0.5);
      if (gain >= 10) {
        actions.push({
          id: `cut_${expense.id}`,
          label: `Réduire ${expense.label}`,
          detail: "Réduction réaliste de 50 % sur un poste non essentiel.",
          monthlyGain: gain,
          kind: "expense_cut",
        });
      }
    } else if (PARTIAL_OPTIMIZATION_CATEGORIES.has(expense.category)) {
      const gain = Math.round(expense.monthlyAmount * 0.15);
      if (gain >= 10) {
        actions.push({
          id: `opt_${expense.id}`,
          label: `Optimiser ${expense.label}`,
          detail: "Réduction prudente de 15 % sans supprimer le poste.",
          monthlyGain: gain,
          kind: "expense_cut",
        });
      }
    }

    if (
      expense.category === "credit" &&
      typeof expense.remainingMonths === "number" &&
      expense.remainingMonths > 0 &&
      expense.remainingMonths <= 6 &&
      expense.monthlyAmount > 0
    ) {
      actions.push({
        id: `credit_${expense.id}`,
        label: `Réaffecter ${expense.label}`,
        detail: `Crédit terminé dans ${expense.remainingMonths} mois : capacité récupérée ensuite.`,
        monthlyGain: Math.round(expense.monthlyAmount),
        kind: "credit_release",
      });
    }
  }

  return actions
    .sort((a, b) => b.monthlyGain - a.monthlyGain)
    .slice(0, 5);
}

function riskFromProjection(params: {
  remainingAmount: number;
  realisticMonthlyContribution: number;
  targetMonths: number | null;
  projectedMonths: number | null;
  monthlyGapForTarget: number | null;
}): LifeGoalRisk {
  if (params.remainingAmount <= 0) return "comfortable";
  if (params.realisticMonthlyContribution <= 0) return "blocked";

  if (params.targetMonths !== null && params.projectedMonths !== null) {
    if (params.projectedMonths <= params.targetMonths) return "on_track";
    if ((params.monthlyGapForTarget ?? 0) <= params.realisticMonthlyContribution * 0.25) return "tight";
    return "blocked";
  }

  if (params.projectedMonths !== null && params.projectedMonths <= 12) return "comfortable";
  if (params.projectedMonths !== null && params.projectedMonths <= 36) return "on_track";
  return "tight";
}

function headlineForRisk(risk: LifeGoalRisk): string {
  if (risk === "comfortable") return "Objectif confortable";
  if (risk === "on_track") return "Objectif réaliste";
  if (risk === "tight") return "Objectif atteignable avec effort";
  return "Objectif bloqué pour l’instant";
}

function explanationForProjection(params: {
  risk: LifeGoalRisk;
  projectedMonths: number | null;
  targetMonths: number | null;
  monthlyGapForTarget: number | null;
  realisticMonthlyContribution: number;
}): string {
  if (params.risk === "blocked") {
    return "Le budget actuel ne dégage pas assez de capacité mensuelle pour avancer sereinement vers cet objectif.";
  }

  if (params.targetMonths !== null && params.projectedMonths !== null) {
    if (params.projectedMonths <= params.targetMonths) {
      return "Au rythme actuel, l’objectif reste compatible avec la date cible.";
    }
    return `La date cible demande un effort supplémentaire d’environ ${Math.ceil(params.monthlyGapForTarget ?? 0)} €/mois.`;
  }

  if (params.projectedMonths !== null) {
    return `Au rythme réaliste actuel, l’objectif peut être atteint en ${params.projectedMonths} mois.`;
  }

  return "La projection dépasse l’horizon raisonnable de simulation. Il faut augmenter la contribution ou réduire certains postes.";
}

export function buildLifeGoalProjection(
  goal: SavingsGoal,
  budget: MonthlyBudget,
  expenses: ExpenseLine[],
): LifeGoalProjection {
  const goalKind = detectGoalKind(goal.label);
  const remainingAmount = Math.max(0, goal.targetAmount - goal.currentAmount);
  const realMonthlyCapacity = Math.max(0, budget.balanceMonthly);
  const currentMonthlyContribution = Math.max(0, goal.monthlyContribution);

  const defaultContribution = realMonthlyCapacity > 0
    ? Math.max(50, Math.round(realMonthlyCapacity * 0.45))
    : 0;

  const realisticMonthlyContribution = Math.max(
    0,
    Math.min(
      Math.max(currentMonthlyContribution, defaultContribution),
      realMonthlyCapacity,
    ),
  );

  const targetMonths = monthsUntilTarget(goal.targetDate);
  const requiredMonthlyForTarget = targetMonths !== null && remainingAmount > 0
    ? Math.ceil(remainingAmount / targetMonths)
    : null;

  const monthlyGapForTarget = requiredMonthlyForTarget !== null
    ? Math.max(0, requiredMonthlyForTarget - realisticMonthlyContribution)
    : null;

  const baseProjection = monthsToReachWithCredits(
    remainingAmount,
    realisticMonthlyContribution,
    expenses,
  );

  const actions = buildOptimizationActions(expenses);
  const actionGain = actions.reduce((sum, action) => sum + action.monthlyGain, 0);
  const optimizedMonthlyContribution = realisticMonthlyContribution + actionGain;
  const optimizedProjection = monthsToReachWithCredits(
    remainingAmount,
    optimizedMonthlyContribution,
    expenses,
  );

  const risk = riskFromProjection({
    remainingAmount,
    realisticMonthlyContribution,
    targetMonths,
    projectedMonths: baseProjection.months,
    monthlyGapForTarget,
  });

  return {
    goalKind,
    remainingAmount,
    currentMonthlyContribution,
    realMonthlyCapacity,
    realisticMonthlyContribution,
    projectedMonths: baseProjection.months,
    projectedDateLabel: baseProjection.months !== null
      ? formatMonthYear(addMonthsToToday(baseProjection.months))
      : null,
    targetMonths,
    requiredMonthlyForTarget,
    monthlyGapForTarget,
    optimizedMonthlyContribution,
    optimizedMonths: optimizedProjection.months,
    optimizedDateLabel: optimizedProjection.months !== null
      ? formatMonthYear(addMonthsToToday(optimizedProjection.months))
      : null,
    firstCreditReliefMonth: baseProjection.firstCreditReliefMonth,
    firstCreditReliefAmount: baseProjection.firstCreditReliefAmount,
    risk,
    headline: headlineForRisk(risk),
    explanation: explanationForProjection({
      risk,
      projectedMonths: baseProjection.months,
      targetMonths,
      monthlyGapForTarget,
      realisticMonthlyContribution,
    }),
    actions,
  };
}

export function goalKindLabel(kind: LifeGoalKind): string {
  switch (kind) {
    case "purchase": return "Achat";
    case "debt": return "Remboursement";
    case "safety": return "Sécurité";
    case "travel": return "Projet";
    case "savings": return "Épargne";
    case "other": return "Objectif";
  }
}

export function goalRiskTone(risk: LifeGoalRisk): "green" | "amber" | "red" | "blue" {
  switch (risk) {
    case "comfortable": return "green";
    case "on_track": return "blue";
    case "tight": return "amber";
    case "blocked": return "red";
  }
}
