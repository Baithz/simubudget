// =============================================================================
// Fichier  : src/services/scenarioImpact.ts
// Auteur   : KREMER Régis
// Desc.    : Moteur local d'impact des scénarios financiers avancés.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-05-03 | KREMER Régis | Création — scénarios réels pour assistant et conseiller expert
// =============================================================================

import type { ExpenseCategory, MonthlyBudget } from "@/types/accounting";
import { CATEGORY_LABELS } from "@/types/accounting";
import { formatEur, formatPct } from "@/utils/formatCurrency";

export type ScenarioImpactKind =
  | "job_loss"
  | "inflation"
  | "job_loss_inflation"
  | "birth"
  | "move"
  | "unknown";

export type ScenarioSeverity = "critical" | "danger" | "vigilance" | "conseil";

export interface ScenarioImpactResult {
  kind: ScenarioImpactKind;
  title: string;
  severity: ScenarioSeverity;
  incomeBefore: number;
  incomeAfter: number;
  expensesBefore: number;
  expensesAfter: number;
  balanceBefore: number;
  balanceAfter: number;
  delta: number;
  sustainableMonths: number | null;
  lines: string[];
  actions: string[];
  metrics: Array<{ label: string; value: string; detail?: string }>;
}

const VARIABLE_CATEGORIES = new Set<ExpenseCategory>([
  "food",
  "transport",
  "health",
  "childcare",
  "leisure",
  "clothing",
  "gifts",
  "subscriptions",
  "professional",
  "other",
]);

function normalizeScenarioQuery(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectScenarioImpactKind(question: string): ScenarioImpactKind {
  const q = normalizeScenarioQuery(question);
  const hasJobLoss = /perte d.?emploi|chomage|licenciement|emploi perdu|sans emploi|are\b/.test(q);
  const hasInflation = /inflation|hausse des prix|prix augment|charges augment|\+\s*\d+\s*%/.test(q);
  const hasBirth = /naissance|bebe|enfant|conge parental|garde/.test(q);
  const hasMove = /demenagement|demanager|changer de ville|autre ville/.test(q);

  if (hasJobLoss && hasInflation) return "job_loss_inflation";
  if (hasJobLoss) return "job_loss";
  if (hasInflation) return "inflation";
  if (hasBirth) return "birth";
  if (hasMove) return "move";
  return "unknown";
}

function variableExpenseTotal(budget: MonthlyBudget): number {
  return Object.entries(budget.expenseByCategory).reduce((sum, [category, amount]) => {
    return VARIABLE_CATEGORIES.has(category as ExpenseCategory) ? sum + amount : sum;
  }, 0);
}

function topCategoriesAfterInflation(budget: MonthlyBudget, limit: number): string[] {
  return Object.entries(budget.expenseByCategory)
    .map(([category, amount]) => ({ category: category as ExpenseCategory, amount }))
    .filter(({ category, amount }) => VARIABLE_CATEGORIES.has(category) && amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)
    .map(({ category, amount }) => `${CATEGORY_LABELS[category]} (${formatEur(amount)})`);
}

function severityFromBalance(balance: number): ScenarioSeverity {
  if (balance < -500) return "critical";
  if (balance < 0) return "danger";
  if (balance < 300) return "vigilance";
  return "conseil";
}

function sustainableMonths(balanceAfter: number, emergencyReserve = 0): number | null {
  if (balanceAfter >= 0) return null;
  if (emergencyReserve <= 0) return 0;
  return Math.max(0, emergencyReserve / Math.abs(balanceAfter));
}

function buildActions(result: Pick<ScenarioImpactResult, "balanceAfter" | "kind" | "delta">): string[] {
  const actions: string[] = [];
  if (result.balanceAfter < 0) {
    actions.push(`Réduire ou reporter au minimum ${formatEur(Math.abs(result.balanceAfter))} de dépenses mensuelles pour revenir à l'équilibre.`);
  }
  if (result.kind === "job_loss" || result.kind === "job_loss_inflation") {
    actions.push("Lister les charges fixes non vitales : abonnements, assurances doublons, crédits à renégocier.");
    actions.push("Construire un budget de crise sur 3 mois avec uniquement logement, alimentation, transport et assurances obligatoires.");
  }
  if (result.kind === "inflation" || result.kind === "job_loss_inflation") {
    actions.push("Bloquer une enveloppe courses hebdomadaire et isoler les postes variables qui montent le plus vite.");
  }
  if (actions.length === 0) {
    actions.push("Conserver ce scénario comme stress test et surveiller la marge de sécurité chaque mois.");
  }
  return actions.slice(0, 4);
}

export function simulateScenarioImpact(kind: ScenarioImpactKind, budget: MonthlyBudget): ScenarioImpactResult {
  const incomeBefore = budget.totalIncomeMonthly;
  const expensesBefore = budget.totalExpensesMonthly;
  const balanceBefore = budget.balanceMonthly;
  const variables = variableExpenseTotal(budget);

  let incomeAfter = incomeBefore;
  let expensesAfter = expensesBefore;
  let title = "Scénario financier";
  const lines: string[] = [];

  if (kind === "job_loss" || kind === "job_loss_inflation") {
    title = kind === "job_loss_inflation" ? "Stress test : perte d'emploi + inflation" : "Scénario : perte d'emploi";
    incomeAfter = Math.round(incomeBefore * 0.6);
    lines.push(`Revenus simulés à 60 % du niveau actuel pour approximer une indemnisation type ARE : ${formatEur(incomeBefore)} → ${formatEur(incomeAfter)}.`);
  }

  if (kind === "inflation" || kind === "job_loss_inflation") {
    if (kind === "inflation") title = "Scénario : inflation forte";
    const inflationImpact = Math.round(variables * 0.1);
    expensesAfter = expensesBefore + inflationImpact;
    const top = topCategoriesAfterInflation(budget, 3);
    lines.push(`Dépenses variables augmentées de 10 % : impact estimé ${formatEur(inflationImpact)}/mois.`);
    if (top.length > 0) lines.push(`Postes les plus exposés : ${top.join(", ")}.`);
  }

  if (kind === "birth") {
    title = "Scénario : naissance d'un enfant";
    const extraCosts = 320;
    expensesAfter = expensesBefore + extraCosts;
    lines.push(`Coût mensuel prudent ajouté pour garde, alimentation, santé et équipement : ${formatEur(extraCosts)}.`);
  }

  if (kind === "move") {
    title = "Scénario : déménagement";
    const transitionCosts = 180;
    expensesAfter = expensesBefore + transitionCosts;
    lines.push(`Provision mensuelle temporaire ajoutée pour frais de transition, transport et installation : ${formatEur(transitionCosts)}.`);
  }

  if (kind === "unknown") {
    lines.push("Aucun scénario reconnu. Les chiffres restent basés sur le mois courant.");
  }

  const balanceAfter = incomeAfter - expensesAfter;
  const delta = balanceAfter - balanceBefore;
  const months = sustainableMonths(balanceAfter, 0);
  const severity = severityFromBalance(balanceAfter);

  if (delta !== 0) {
    lines.push(`Impact net sur le reste à vivre : ${formatEur(delta)} par mois.`);
  }
  if (balanceAfter < 0) {
    lines.push("Le scénario met le mois en déficit : il faut déclencher un plan d'action avant de considérer la situation soutenable.");
  } else {
    lines.push("Le scénario reste soutenable sur le mois courant, mais la marge doit être suivie dans la durée.");
  }

  const result: ScenarioImpactResult = {
    kind,
    title,
    severity,
    incomeBefore,
    incomeAfter,
    expensesBefore,
    expensesAfter,
    balanceBefore,
    balanceAfter,
    delta,
    sustainableMonths: months,
    lines,
    actions: [],
    metrics: [
      { label: "Revenus", value: `${formatEur(incomeBefore)} → ${formatEur(incomeAfter)}` },
      { label: "Dépenses", value: `${formatEur(expensesBefore)} → ${formatEur(expensesAfter)}` },
      { label: "Reste à vivre", value: `${formatEur(balanceBefore)} → ${formatEur(balanceAfter)}` },
      { label: "Dégradation", value: formatEur(delta) },
      { label: "Écart dépenses/revenus", value: formatPct(expensesAfter / Math.max(1, incomeAfter)) },
    ],
  };

  return { ...result, actions: buildActions(result) };
}
