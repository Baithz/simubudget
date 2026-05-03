// =============================================================================
// Fichier  : src/services/localAssistant.ts
// Auteur   : KREMER Régis
// Desc.    : Moteur local déterministe de l'assistant conversationnel financier.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-05-03 | KREMER Régis | Création — assistant conversationnel utile local-first
//   2026-05-03 | KREMER Régis | Correction — compatibilité exactOptionalPropertyTypes sur durationMonths
//   2026-05-03 | KREMER Régis | Ajout — assistant avancé avec mémoire de session et raisonnement contextuel
// =============================================================================

import type { BudgetResult, AlertLevel } from "@/types/simulation";
import type {
  AccountingRecommendation,
  EnvelopeStatus,
  ExpenseCategory,
  ExpenseLine,
  MonthlyBudget,
  MonthlyExpenseLine,
  MonthPilotSummary,
} from "@/types/accounting";
import { CATEGORY_LABELS } from "@/types/accounting";
import type { MonthlySnapshot } from "@/types/profile";
import { formatEur, formatPct } from "@/utils/formatCurrency";
import { detectScenarioImpactKind, simulateScenarioImpact } from "@/services/scenarioImpact";

export type AssistantToneLevel = "critical" | "danger" | "vigilance" | "info" | "conseil";
export type AssistantActionKind = "route" | "prompt";
export type AssistantContextFocus = "budget" | "savings" | "affordability" | "credits" | "envelopes" | "timeline" | "priorities";

export interface AssistantMetric {
  label: string;
  value: string;
  detail?: string;
}

export interface AssistantAction {
  kind: AssistantActionKind;
  label: string;
  value: string;
}

export interface AssistantAnswer {
  id: string;
  level: AssistantToneLevel;
  title: string;
  summary: string;
  lines: string[];
  metrics: AssistantMetric[];
  actions: AssistantAction[];
  followUps: string[];
  reasoningSteps: string[];
  contextNote?: string;
}

export interface LocalAssistantContext {
  activeMonth: string;
  result: BudgetResult | null;
  budget: MonthlyBudget;
  summary: MonthPilotSummary;
  envelopes: EnvelopeStatus[];
  recommendations: AccountingRecommendation[];
  monthExpenses: MonthlyExpenseLine[];
  recurringExpenses: ExpenseLine[];
  snapshots: MonthlySnapshot[];
}

export interface AssistantSessionMemory {
  turnCount: number;
  lastQuestion: string | null;
  lastIntent: Intent | null;
  lastAnswerId: string | null;
  focus: AssistantContextFocus | null;
  lastAmount: number | null;
  lastSavingsTarget: number | null;
  pendingActionPlan: string[];
}

export interface AssistantResponse {
  answer: AssistantAnswer;
  memory: AssistantSessionMemory;
}

type Intent =
  | "affordability"
  | "savings"
  | "negative"
  | "priorities"
  | "credits"
  | "envelopes"
  | "timeline"
  | "scenario"
  | "action_plan"
  | "explain"
  | "summary";

interface ParsedQuestion {
  intent: Intent;
  amount?: number;
  monthlyPayment?: number;
  durationMonths?: number;
  savingsTarget?: number;
}

interface SavingCandidate {
  label: string;
  amount: number;
  reason: string;
}

const DEFAULT_SAVINGS_TARGET = 200;
const MONTH_LABEL = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });

function monthToLabel(month: string): string {
  const [yearRaw, monthRaw] = month.split("-");
  const year = Number.parseInt(yearRaw ?? `${new Date().getFullYear()}`, 10);
  const m = Number.parseInt(monthRaw ?? `${new Date().getMonth() + 1}`, 10) - 1;
  return MONTH_LABEL.format(new Date(year, m, 1));
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractAmounts(text: string): number[] {
  const matches = [...text.matchAll(/(\d{1,3}(?:[\s.]\d{3})*|\d+)(?:[,.](\d{1,2}))?\s*(?:€|eur|euros)?/gi)];
  return matches
    .map((match) => {
      const integer = (match[1] ?? "0").replace(/[\s.]/g, "");
      const decimal = match[2] ?? "0";
      return Number.parseFloat(`${integer}.${decimal.padEnd(2, "0")}`);
    })
    .filter((value) => Number.isFinite(value) && value > 0);
}

function extractDurationMonths(normalizedQuestion: string): number | undefined {
  const monthMatch = normalizedQuestion.match(/(?:sur|pendant)\s+(\d{1,3})\s*mois/);
  if (monthMatch?.[1]) return Number.parseInt(monthMatch[1], 10);
  const yearMatch = normalizedQuestion.match(/(?:sur|pendant)\s+(\d{1,2})\s*ans?/);
  if (yearMatch?.[1]) return Number.parseInt(yearMatch[1], 10) * 12;
  return undefined;
}

function createEmptyAssistantMemory(): AssistantSessionMemory {
  return {
    turnCount: 0,
    lastQuestion: null,
    lastIntent: null,
    lastAnswerId: null,
    focus: null,
    lastAmount: null,
    lastSavingsTarget: null,
    pendingActionPlan: [],
  };
}

export function initialAssistantMemory(): AssistantSessionMemory {
  return createEmptyAssistantMemory();
}

function parseQuestion(question: string, memory?: AssistantSessionMemory): ParsedQuestion {
  const q = normalize(question);
  const amounts = extractAmounts(question);
  const firstAmount = amounts[0];
  const durationMonths = extractDurationMonths(q);
  const hasMonthlyMarker = /par mois|\/mois|mensualite|mensuel|chaque mois/.test(q);

  const scenarioKind = detectScenarioImpactKind(question);
  if (scenarioKind !== "unknown") {
    return { intent: "scenario" };
  }

  if (/plan|etapes|comment faire|que faire maintenant|detaille|detailler/.test(q) && memory?.pendingActionPlan.length) {
    return { intent: "action_plan" };
  }

  if (/pourquoi|explique|origine|cause|detail/.test(q) && memory?.lastIntent) {
    return { intent: "explain" };
  }

  if (/economis|epargn|mettre de cote|gagner|reduire|baisser/.test(q)) {
    return { intent: "savings", savingsTarget: firstAmount ?? DEFAULT_SAVINGS_TARGET };
  }

  if (/negatif|rouge|deficit|decouvert|pourquoi.*moins|pourquoi.*-/.test(q)) {
    return { intent: "negative" };
  }

  if (/priorit|quoi faire|faire en premier|urgence|action/.test(q)) {
    return { intent: "priorities" };
  }

  if (/credit|mensualite|pret|emprunt/.test(q) && !/acheter|achat|permettre|possible/.test(q)) {
    return { intent: "credits" };
  }

  if (/enveloppe|categorie|depasse|budget.*categorie|alim|loisir|transport/.test(q)) {
    return { intent: "envelopes" };
  }

  if (/mois prochain|prochains mois|timeline|projection|avenir|dans \d/.test(q)) {
    return { intent: "timeline" };
  }

  if (/acheter|achat|permettre|vacances|voiture|moto|telephone|ordinateur|payer|depense/.test(q) && firstAmount !== undefined) {
    if (hasMonthlyMarker) {
      return durationMonths === undefined
        ? { intent: "affordability", monthlyPayment: firstAmount }
        : { intent: "affordability", monthlyPayment: firstAmount, durationMonths };
    }
    return durationMonths === undefined
      ? { intent: "affordability", amount: firstAmount }
      : { intent: "affordability", amount: firstAmount, durationMonths };
  }

  return { intent: "summary" };
}

function levelFromBalance(balance: number): AssistantToneLevel {
  if (balance < 0) return "critical";
  if (balance < 200) return "danger";
  if (balance < 600) return "vigilance";
  return "conseil";
}

function topExpenseCategories(budget: MonthlyBudget, limit: number): Array<[ExpenseCategory, number]> {
  return Object.entries(budget.expenseByCategory)
    .map(([category, amount]) => [category as ExpenseCategory, amount] as [ExpenseCategory, number])
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function topRecommendations(recommendations: AccountingRecommendation[], limit: number): AccountingRecommendation[] {
  return [...recommendations]
    .sort((a, b) => (a.priority ?? 9) - (b.priority ?? 9))
    .slice(0, limit);
}

function buildSavingsCandidates(ctx: LocalAssistantContext): SavingCandidate[] {
  const recCandidates = ctx.recommendations
    .filter((rec) => (rec.saving ?? 0) > 0)
    .map((rec) => ({
      label: rec.title,
      amount: rec.saving ?? 0,
      reason: rec.detail,
    }));

  const envelopeCandidates = ctx.envelopes
    .filter((env) => !env.isSavingsEnvelope && env.spent > 0 && (env.health === "danger" || env.health === "watch"))
    .map((env) => {
      const overrun = Math.max(0, env.spent - env.planned);
      const fallback = Math.max(20, env.spent * 0.12);
      return {
        label: env.label,
        amount: Math.round(Math.min(Math.max(overrun, fallback), env.spent * 0.25)),
        reason: env.remaining < 0
          ? `Dépassement actuel de ${formatEur(Math.abs(env.remaining))}.`
          : `Enveloppe déjà consommée à ${formatPct(env.percent)}.`,
      };
    });

  const variableCategories: ExpenseCategory[] = ["leisure", "restaurants" as ExpenseCategory, "subscriptions", "clothing", "gifts", "other"]
    .filter((category): category is ExpenseCategory => category in CATEGORY_LABELS);
  const monthlyLines = ctx.monthExpenses.filter((line) => line.status !== "ignored" && !line.isMandatory && line.amount > 0);
  const variableCandidates = variableCategories
    .map((category) => {
      const total = monthlyLines
        .filter((line) => line.category === category)
        .reduce((sum, line) => sum + line.amount, 0);
      return {
        label: CATEGORY_LABELS[category],
        amount: Math.round(total * 0.15),
        reason: "Poste variable compressible sans toucher aux charges vitales.",
      };
    })
    .filter((candidate) => candidate.amount >= 15);

  const byLabel = new Map<string, SavingCandidate>();
  [...recCandidates, ...envelopeCandidates, ...variableCandidates].forEach((candidate) => {
    const previous = byLabel.get(candidate.label);
    if (!previous || candidate.amount > previous.amount) byLabel.set(candidate.label, candidate);
  });

  return [...byLabel.values()].sort((a, b) => b.amount - a.amount).slice(0, 6);
}

function makeAction(kind: AssistantActionKind, label: string, value: string): AssistantAction {
  return { kind, label, value };
}

function makeAnswer(params: {
  id: string;
  level: AssistantToneLevel;
  title: string;
  summary: string;
  lines: string[];
  metrics?: AssistantMetric[];
  actions?: AssistantAction[];
  followUps?: string[];
  reasoningSteps?: string[];
  contextNote?: string;
}): AssistantAnswer {
  return {
    id: params.id,
    level: params.level,
    title: params.title,
    summary: params.summary,
    lines: params.lines,
    metrics: params.metrics ?? [],
    actions: params.actions ?? [],
    followUps: params.followUps ?? [
      "Comment économiser 200 € ce mois ?",
      "Quelles sont mes priorités ?",
      "Pourquoi mon solde est négatif ?",
    ],
    reasoningSteps: params.reasoningSteps ?? [],
    ...(params.contextNote !== undefined ? { contextNote: params.contextNote } : {}),
  };
}

function answerSummary(ctx: LocalAssistantContext): AssistantAnswer {
  const balance = ctx.budget.balanceMonthly;
  const level = levelFromBalance(balance);
  const topCats = topExpenseCategories(ctx.budget, 3);
  const firstRec = topRecommendations(ctx.recommendations, 1)[0];
  const lines = [
    `Sur ${monthToLabel(ctx.activeMonth)}, tes revenus mensuels sont estimés à ${formatEur(ctx.budget.totalIncomeMonthly)} pour ${formatEur(ctx.budget.totalExpensesMonthly)} de dépenses.`,
    topCats.length > 0
      ? `Les postes les plus lourds sont ${topCats.map(([cat, amount]) => `${CATEGORY_LABELS[cat]} (${formatEur(amount)})`).join(", ")}.`
      : "Aucun poste de dépense significatif n'est détecté pour ce mois.",
  ];
  if (firstRec) lines.push(`Priorité détectée : ${firstRec.title}. ${firstRec.detail}`);

  return makeAnswer({
    id: "summary",
    level,
    title: "Lecture immédiate de ta situation",
    summary: balance >= 0
      ? `Ton solde prévisionnel est positif : ${formatEur(balance)}.`
      : `Ton solde prévisionnel est négatif : ${formatEur(balance)}.`,
    lines,
    metrics: [
      { label: "Reste à vivre", value: formatEur(balance) },
      { label: "Taux d'épargne", value: formatPct(ctx.budget.savingsRate) },
      { label: "Dépenses fixes", value: formatPct(ctx.budget.fixedChargesRatio) },
    ],
    actions: [
      makeAction("route", "Ouvrir Mes comptes", "/accounting"),
      makeAction("prompt", "Voir les priorités", "Quelles sont mes priorités ?"),
    ],
  });
}

function answerNegative(ctx: LocalAssistantContext): AssistantAnswer {
  const deficit = Math.abs(Math.min(0, ctx.budget.balanceMonthly));
  const topCats = topExpenseCategories(ctx.budget, 4);
  const candidates = buildSavingsCandidates(ctx);
  const immediate = candidates.slice(0, 3);
  const possible = immediate.reduce((sum, candidate) => sum + candidate.amount, 0);
  const lines = [
    `Le déficit vient de l'écart entre ${formatEur(ctx.budget.totalIncomeMonthly)} de revenus et ${formatEur(ctx.budget.totalExpensesMonthly)} de dépenses mensuelles.`,
    topCats.length > 0
      ? `Les postes qui pèsent le plus : ${topCats.map(([cat, amount]) => `${CATEGORY_LABELS[cat]} ${formatEur(amount)}`).join(" · ")}.`
      : "Aucun poste dominant n'est détecté, il faut vérifier les lignes du mois.",
  ];
  if (immediate.length > 0) {
    lines.push(`Plan immédiat : ${immediate.map((item) => `${item.label} ${formatEur(item.amount)}`).join(" + ")} = ${formatEur(possible)} de potentiel.`);
  }

  return makeAnswer({
    id: "negative",
    level: deficit > 500 ? "critical" : "danger",
    title: "Pourquoi le solde est négatif",
    summary: deficit > 0
      ? `Il manque ${formatEur(deficit)} pour équilibrer le mois.`
      : "Le mois n'est pas négatif actuellement.",
    lines,
    metrics: [
      { label: "Déficit", value: formatEur(deficit) },
      { label: "Potentiel rapide", value: formatEur(possible) },
      { label: "Après actions", value: formatEur(ctx.budget.balanceMonthly + possible) },
    ],
    actions: [
      makeAction("route", "Analyser les dépenses", "/accounting"),
      makeAction("prompt", "Plan d'économie", `Comment économiser ${Math.max(DEFAULT_SAVINGS_TARGET, Math.ceil(deficit / 50) * 50)} € ce mois ?`),
    ],
  });
}

function answerSavings(ctx: LocalAssistantContext, target: number): AssistantAnswer {
  const candidates = buildSavingsCandidates(ctx);
  const selected: SavingCandidate[] = [];
  let total = 0;
  for (const candidate of candidates) {
    if (total >= target) break;
    selected.push(candidate);
    total += candidate.amount;
  }
  const remaining = Math.max(0, target - total);
  const lines = selected.length > 0
    ? selected.map((candidate) => `${candidate.label} : ${formatEur(candidate.amount)}. ${candidate.reason}`)
    : ["Je ne détecte pas encore assez de postes compressibles. Il faut d'abord catégoriser ou valider les dépenses du mois."];
  if (remaining > 0) lines.push(`Il reste ${formatEur(remaining)} à trouver pour atteindre l'objectif de ${formatEur(target)}.`);

  return makeAnswer({
    id: "savings",
    level: total >= target ? "conseil" : "vigilance",
    title: `Plan pour économiser ${formatEur(target)}`,
    summary: total >= target
      ? `Objectif atteignable avec ${formatEur(total)} de potentiel détecté.`
      : `Potentiel détecté : ${formatEur(total)} sur ${formatEur(target)} demandés.`,
    lines,
    metrics: [
      { label: "Objectif", value: formatEur(target) },
      { label: "Potentiel", value: formatEur(total) },
      { label: "Solde après action", value: formatEur(ctx.budget.balanceMonthly + total) },
    ],
    actions: [
      makeAction("route", "Ouvrir les enveloppes", "/accounting"),
      makeAction("prompt", "Voir les priorités", "Quelles sont mes priorités ?"),
    ],
  });
}

function answerAffordability(ctx: LocalAssistantContext, parsed: ParsedQuestion): AssistantAnswer {
  const balance = ctx.budget.balanceMonthly;
  const isCredit = parsed.monthlyPayment !== undefined;
  const impact = parsed.monthlyPayment ?? parsed.amount ?? 0;
  const nextBalance = balance - impact;
  const income = Math.max(1, ctx.budget.totalIncomeMonthly);
  const debtAfter = isCredit ? (ctx.budget.expenseByCategory.credit + impact) / income : ctx.budget.debtRatio;
  const scoreBefore = ctx.result?.healthScore ?? 0;
  const scoreLoss = isCredit ? Math.round((impact / income) * 45) : Math.round((impact / income) * 18);
  const scoreAfter = Math.max(0, scoreBefore - scoreLoss);
  const level: AssistantToneLevel = nextBalance < 0 || debtAfter > 0.35
    ? "danger"
    : nextBalance < 200
      ? "vigilance"
      : "conseil";
  const durationText = isCredit && parsed.durationMonths
    ? ` pendant ${parsed.durationMonths} mois`
    : "";
  const lines = [
    isCredit
      ? `Simulation d'une nouvelle mensualité de ${formatEur(impact)}${durationText}.`
      : `Simulation d'un achat comptant de ${formatEur(impact)} sur le mois courant.`,
    `Ton reste à vivre passerait de ${formatEur(balance)} à ${formatEur(nextBalance)}.`,
  ];
  if (isCredit) {
    lines.push(`Le taux de crédits estimé passerait à ${formatPct(debtAfter)} des revenus mensuels.`);
    if (debtAfter > 0.35) lines.push("Le seuil de 35 % est dépassé : l'achat à crédit est déconseillé dans cette configuration.");
  }
  if (nextBalance < 0) lines.push("Le mois passerait en négatif : il faut reporter, réduire le montant ou compenser par une économie équivalente.");

  return makeAnswer({
    id: "affordability",
    level,
    title: isCredit ? "Simulation d'achat à crédit" : "Simulation d'achat comptant",
    summary: level === "conseil"
      ? "Faisable sans déséquilibre majeur détecté."
      : "Impact significatif : décision à sécuriser avant achat.",
    lines,
    metrics: [
      { label: "Avant", value: formatEur(balance) },
      { label: "Après", value: formatEur(nextBalance) },
      { label: "SSF estimé", value: `${Math.round(scoreBefore)} → ${Math.round(scoreAfter)}` },
    ],
    actions: [
      makeAction("prompt", "Comment compenser ?", `Comment économiser ${Math.ceil(impact / 50) * 50} € ce mois ?`),
      makeAction("route", "Voir Mes comptes", "/accounting"),
    ],
    followUps: [
      `Comment économiser ${Math.ceil(impact / 50) * 50} € ce mois ?`,
      "Quelles sont mes priorités ?",
      "Que donnent les prochains mois ?",
    ],
  });
}

function answerPriorities(ctx: LocalAssistantContext): AssistantAnswer {
  const recs = topRecommendations(ctx.recommendations, 3);
  const lines = recs.length > 0
    ? recs.map((rec, index) => `${index + 1}. ${rec.title} — ${rec.detail}`)
    : ["Aucune recommandation critique détectée. Le meilleur levier est de surveiller les enveloppes variables et l'épargne."];

  return makeAnswer({
    id: "priorities",
    level: recs.some((rec) => rec.level === "critical" || rec.level === "danger") ? "danger" : "conseil",
    title: "Priorités financières immédiates",
    summary: recs.length > 0 ? "Voici les 3 actions les plus utiles maintenant." : "Situation sans urgence majeure détectée.",
    lines,
    metrics: [
      { label: "Actions", value: `${recs.length}` },
      { label: "Solde", value: formatEur(ctx.budget.balanceMonthly) },
      { label: "Validation du mois", value: formatPct(ctx.summary.validationProgress) },
    ],
    actions: [
      makeAction("route", "Ouvrir le tableau de bord", "/"),
      makeAction("route", "Ouvrir Mes comptes", "/accounting"),
    ],
  });
}

function answerCredits(ctx: LocalAssistantContext): AssistantAnswer {
  const credits = ctx.recurringExpenses
    .filter((expense) => expense.category === "credit" && expense.remainingMonths !== undefined && expense.amount > 0)
    .sort((a, b) => (a.remainingMonths ?? 999) - (b.remainingMonths ?? 999));
  const soon = credits.filter((credit) => (credit.remainingMonths ?? 999) <= 6);
  const lines = credits.length > 0
    ? credits.slice(0, 5).map((credit) => {
      const months = credit.remainingMonths ?? 0;
      return `${credit.label} : ${formatEur(credit.monthlyAmount)}/mois, encore ${months} mois.`;
    })
    : ["Aucun crédit actif avec durée restante n'est détecté dans Mes comptes."];
  const releaseSoon = soon.reduce((sum, credit) => sum + credit.monthlyAmount, 0);

  return makeAnswer({
    id: "credits",
    level: soon.length > 0 ? "conseil" : "info",
    title: "Lecture des crédits en cours",
    summary: soon.length > 0
      ? `${formatEur(releaseSoon)}/mois peuvent être libérés dans les 6 prochains mois.`
      : "Aucune fin de crédit proche détectée.",
    lines,
    metrics: [
      { label: "Crédits actifs", value: `${credits.length}` },
      { label: "Mensualités crédits", value: formatEur(ctx.budget.expenseByCategory.credit) },
      { label: "Libération proche", value: formatEur(releaseSoon) },
    ],
    actions: [
      makeAction("route", "Voir les charges", "/accounting"),
      makeAction("prompt", "Simuler l'effet", "Quelles sont mes priorités ?"),
    ],
  });
}

function answerEnvelopes(ctx: LocalAssistantContext): AssistantAnswer {
  const watched = ctx.envelopes
    .filter((env) => env.health === "danger" || env.health === "watch")
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 5);
  const lines = watched.length > 0
    ? watched.map((env) => `${env.label} : ${formatEur(env.spent)} consommés sur ${formatEur(env.planned)} (${formatPct(env.percent)}), reste ${formatEur(env.remaining)}.`)
    : ["Aucune enveloppe en dépassement ou en zone de vigilance n'est détectée."];

  return makeAnswer({
    id: "envelopes",
    level: watched.some((env) => env.health === "danger") ? "danger" : "conseil",
    title: "Contrôle des enveloppes",
    summary: watched.length > 0 ? `${watched.length} enveloppe(s) à surveiller.` : "Les enveloppes sont sous contrôle.",
    lines,
    metrics: [
      { label: "À surveiller", value: `${watched.length}` },
      { label: "Solde", value: formatEur(ctx.budget.balanceMonthly) },
      { label: "Dépenses variables", value: formatEur(ctx.budget.variableExpensesMonthly) },
    ],
    actions: [makeAction("route", "Ouvrir les enveloppes", "/accounting")],
  });
}

function addMonths(month: string, offset: number): string {
  const [yearRaw, monthRaw] = month.split("-");
  const year = Number.parseInt(yearRaw ?? `${new Date().getFullYear()}`, 10);
  const m = Number.parseInt(monthRaw ?? "1", 10) - 1;
  const d = new Date(year, m + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function answerTimeline(ctx: LocalAssistantContext): AssistantAnswer {
  const base = ctx.budget.balanceMonthly;
  const creditLines = ctx.recurringExpenses.filter((expense) => expense.category === "credit" && expense.remainingMonths !== undefined);
  const rows = Array.from({ length: 6 }, (_, index) => {
    const month = addMonths(ctx.activeMonth, index);
    const released = creditLines
      .filter((credit) => (credit.remainingMonths ?? 999) === index)
      .reduce((sum, credit) => sum + credit.monthlyAmount, 0);
    return { month, projected: base + released, released };
  });
  const lines = rows.map((row) => {
    const release = row.released > 0 ? ` — libération crédit ${formatEur(row.released)}/mois` : "";
    return `${monthToLabel(row.month)} : ${formatEur(row.projected)}${release}.`;
  });

  return makeAnswer({
    id: "timeline",
    level: rows.some((row) => row.projected < 0) ? "vigilance" : "conseil",
    title: "Projection rapide sur 6 mois",
    summary: "Projection locale basée sur le mois courant et les fins de crédits connues.",
    lines,
    metrics: [
      { label: "Mois actuel", value: formatEur(rows[0]?.projected ?? base) },
      { label: "Dans 6 mois", value: formatEur(rows[5]?.projected ?? base) },
      { label: "Base mensuelle", value: formatEur(base) },
    ],
    actions: [makeAction("route", "Voir les scénarios", "/scenarios")],
  });
}


function answerScenario(ctx: LocalAssistantContext, question: string): AssistantAnswer {
  const kind = detectScenarioImpactKind(question);
  const impact = simulateScenarioImpact(kind, ctx.budget);
  const level: AssistantToneLevel = impact.severity;

  return makeAnswer({
    id: `scenario-${impact.kind}`,
    level,
    title: impact.title,
    summary: impact.balanceAfter < 0
      ? `Après scénario, le reste à vivre estimé tombe à ${formatEur(impact.balanceAfter)}.`
      : `Après scénario, le reste à vivre estimé serait de ${formatEur(impact.balanceAfter)}.`,
    lines: [
      ...impact.lines,
      ...impact.actions.map((action) => `Action : ${action}`),
    ],
    metrics: impact.metrics,
    actions: [
      makeAction("route", "Ouvrir les scénarios", "/scenarios"),
      makeAction("prompt", "Plan d'action", "Que faire maintenant ?"),
    ],
    followUps: [
      "Perte d’emploi + inflation",
      "Comment économiser 200 € ce mois ?",
      "Explique ton raisonnement",
    ],
    reasoningSteps: [
      "Je détecte le scénario demandé dans la question.",
      "J'applique une hypothèse chiffrée locale et prudente au budget du mois.",
      "Je compare le reste à vivre avant/après pour mesurer la dégradation réelle.",
    ],
  });
}


function focusFromIntent(intent: Intent): AssistantContextFocus {
  if (intent === "savings") return "savings";
  if (intent === "affordability") return "affordability";
  if (intent === "credits") return "credits";
  if (intent === "envelopes") return "envelopes";
  if (intent === "timeline" || intent === "scenario") return "timeline";
  if (intent === "priorities" || intent === "action_plan") return "priorities";
  return "budget";
}

function contextNote(memory?: AssistantSessionMemory): string | undefined {
  if (!memory?.focus || memory.turnCount === 0) return undefined;
  const label: Record<AssistantContextFocus, string> = {
    budget: "budget du mois",
    savings: "plan d'économie",
    affordability: "simulation d'achat",
    credits: "crédits",
    envelopes: "enveloppes",
    timeline: "projection",
    priorities: "priorités",
  };
  return `Contexte conservé : ${label[memory.focus]}.`;
}

function buildPendingActionPlan(answer: AssistantAnswer): string[] {
  const actionable = answer.lines
    .filter((line) => /:|→|—|\d/.test(line))
    .slice(0, 4);
  if (actionable.length > 0) return actionable;
  return answer.actions.map((action) => action.label).slice(0, 3);
}

function updateAssistantMemory(
  previous: AssistantSessionMemory | undefined,
  question: string,
  parsed: ParsedQuestion,
  answer: AssistantAnswer,
): AssistantSessionMemory {
  const base = previous ?? createEmptyAssistantMemory();
  const amount = parsed.amount ?? parsed.monthlyPayment ?? base.lastAmount;
  const savingsTarget = parsed.savingsTarget ?? base.lastSavingsTarget;
  return {
    turnCount: base.turnCount + 1,
    lastQuestion: question,
    lastIntent: parsed.intent,
    lastAnswerId: answer.id,
    focus: focusFromIntent(parsed.intent),
    lastAmount: amount ?? null,
    lastSavingsTarget: savingsTarget ?? null,
    pendingActionPlan: buildPendingActionPlan(answer),
  };
}

function enrichAnswer(answer: AssistantAnswer, memory?: AssistantSessionMemory): AssistantAnswer {
  const note = contextNote(memory);
  if (!note || answer.contextNote) return answer;
  return { ...answer, contextNote: note };
}

function answerActionPlan(ctx: LocalAssistantContext, memory?: AssistantSessionMemory): AssistantAnswer {
  const plan = memory?.pendingActionPlan.length ? memory.pendingActionPlan : topRecommendations(ctx.recommendations, 3).map((rec) => `${rec.title} — ${rec.detail}`);
  const lines = plan.length > 0
    ? plan.map((item, index) => `${index + 1}. ${item}`)
    : ["Aucune action prioritaire assez fiable n'est détectée. Commence par valider les dépenses du mois et contrôler les enveloppes variables."];

  return makeAnswer({
    id: "action-plan",
    level: plan.length > 0 ? "conseil" : "info",
    title: "Plan d'action immédiat",
    summary: "Je reprends le contexte de la question précédente et je le transforme en étapes concrètes.",
    lines,
    metrics: [
      { label: "Étapes", value: `${lines.length}` },
      { label: "Solde", value: formatEur(ctx.budget.balanceMonthly) },
      { label: "Mois", value: monthToLabel(ctx.activeMonth) },
    ],
    actions: [
      makeAction("route", "Ouvrir Mes comptes", "/accounting"),
      makeAction("prompt", "Recalculer les priorités", "Quelles sont mes priorités ?"),
    ],
    reasoningSteps: [
      "Je reprends le dernier sujet traité dans cette session.",
      "Je conserve uniquement les actions chiffrées ou directement vérifiables.",
      "Je limite le plan aux étapes exécutables maintenant.",
    ],
  });
}

function answerExplain(ctx: LocalAssistantContext, memory?: AssistantSessionMemory): AssistantAnswer {
  const focus = memory?.focus ?? "budget";
  const topCats = topExpenseCategories(ctx.budget, 3);
  const lines = [
    `J'analyse ${monthToLabel(ctx.activeMonth)} avec ${formatEur(ctx.budget.totalIncomeMonthly)} de revenus et ${formatEur(ctx.budget.totalExpensesMonthly)} de dépenses.`,
    topCats.length > 0
      ? `Les postes dominants sont ${topCats.map(([cat, amount]) => `${CATEGORY_LABELS[cat]} (${formatEur(amount)})`).join(", ")}.`
      : "Aucun poste dominant n'est encore suffisamment renseigné.",
    `Le contexte suivi est : ${focus}.`,
  ];

  return makeAnswer({
    id: "explain",
    level: levelFromBalance(ctx.budget.balanceMonthly),
    title: "Explication du raisonnement",
    summary: "Je détaille les signaux utilisés, sans inventer de données.",
    lines,
    metrics: [
      { label: "Reste à vivre", value: formatEur(ctx.budget.balanceMonthly) },
      { label: "Fixes", value: formatPct(ctx.budget.fixedChargesRatio) },
      { label: "Épargne", value: formatPct(ctx.budget.savingsRate) },
    ],
    actions: [makeAction("prompt", "Transformer en plan", "Que faire maintenant ?")],
    reasoningSteps: [
      "Je compare revenus et dépenses du mois actif.",
      "Je trie les postes par poids budgétaire.",
      "Je conserve les alertes et recommandations déjà calculées localement.",
    ],
  });
}

export function answerLocalQuestion(question: string, ctx: LocalAssistantContext, memory?: AssistantSessionMemory): AssistantResponse {
  const parsed = parseQuestion(question, memory);
  let answer: AssistantAnswer;
  switch (parsed.intent) {
    case "affordability":
      answer = answerAffordability(ctx, parsed);
      break;
    case "savings":
      answer = answerSavings(ctx, parsed.savingsTarget ?? DEFAULT_SAVINGS_TARGET);
      break;
    case "negative":
      answer = answerNegative(ctx);
      break;
    case "priorities":
      answer = answerPriorities(ctx);
      break;
    case "credits":
      answer = answerCredits(ctx);
      break;
    case "envelopes":
      answer = answerEnvelopes(ctx);
      break;
    case "timeline":
      answer = answerTimeline(ctx);
      break;
    case "scenario":
      answer = answerScenario(ctx, question);
      break;
    case "action_plan":
      answer = answerActionPlan(ctx, memory);
      break;
    case "explain":
      answer = answerExplain(ctx, memory);
      break;
    case "summary":
      answer = answerSummary(ctx);
      break;
  }

  const contextualAnswer = enrichAnswer(answer, memory);
  return { answer: contextualAnswer, memory: updateAssistantMemory(memory, question, parsed, contextualAnswer) };
}

export function initialAssistantAnswer(ctx: LocalAssistantContext): AssistantAnswer {
  const critical = ctx.result?.alerts.find((alert) => alert.level === "critical" || alert.level === "danger");
  if (critical) {
    const level = critical.level as AlertLevel;
    return makeAnswer({
      id: "initial-alert",
      level: level === "critical" ? "critical" : "danger",
      title: "Point d'attention prioritaire",
      summary: critical.message,
      lines: [critical.detail ?? "Une alerte prioritaire est présente sur ton profil.", "Je peux détailler l'origine du problème ou proposer un plan d'action chiffré."],
      metrics: [
        { label: "Reste à vivre", value: formatEur(ctx.budget.balanceMonthly) },
        { label: "Dépenses", value: formatEur(ctx.budget.totalExpensesMonthly) },
      ],
      actions: [makeAction("prompt", "Expliquer", "Pourquoi mon solde est négatif ?")],
    });
  }
  return answerSummary(ctx);
}
