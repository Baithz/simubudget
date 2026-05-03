// =============================================================================
// Fichier  : src/components/Dashboard/ScoreNarrative.tsx
// Auteur   : KREMER Régis
// Desc.    : Explication narrative du Score de Santé Financière avec tendance,
//            leviers positifs et points de vigilance.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-05-03 | KREMER Régis | Création — Phase 18 score SSF narratif
// =============================================================================

import { useMemo } from "react";
import { useAccountingStore } from "@/store/accountingStore";
import { useSimulationStore } from "@/store/simulationStore";
import { CATEGORY_LABELS } from "@/types/accounting";
import { formatEur } from "@/utils/formatCurrency";
import type { ExpenseCategory } from "@/types/accounting";

interface NarrativeFactor {
  id: string;
  points: number;
  title: string;
  detail: string;
  tone: "positive" | "warning" | "neutral";
}

interface NarrativeModel {
  score: number;
  delta: number;
  trend: string;
  nextTarget: number;
  factors: NarrativeFactor[];
  summary: string;
}

const SCORE_TARGETS = [50, 60, 75, 85, 95] as const;

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function signedPoints(points: number): string {
  if (points > 0) return `+${points}`;
  return `${points}`;
}

function factorColor(tone: NarrativeFactor["tone"]): string {
  switch (tone) {
    case "positive":
      return "var(--fin-green)";
    case "warning":
      return "var(--fin-amber)";
    case "neutral":
      return "var(--fin-blue)";
  }
}

function findNextTarget(score: number): number {
  return SCORE_TARGETS.find((target) => target > score) ?? 100;
}

function trendLabel(delta: number, score: number): string {
  if (delta >= 5) return "amélioration nette";
  if (delta >= 2) return "amélioration progressive";
  if (delta <= -5) return "dégradation à traiter";
  if (delta <= -2) return "légère baisse";
  if (score >= 75) return "niveau solide à maintenir";
  return "situation stable";
}

function strongestEnvelopeDrift(envelopes: ReturnType<typeof useAccountingStore.getState>["getEnvelopeStatuses"] extends (month?: string) => infer R ? R : never): { category: ExpenseCategory; delta: number } | null {
  const drift = envelopes
    .filter((status) => status.planned > 0 && status.spent > status.planned && !status.isSavingsEnvelope)
    .map((status) => ({ category: status.category, delta: status.spent - status.planned }))
    .sort((a, b) => b.delta - a.delta)[0];

  return drift ?? null;
}

function buildNarrative(): NarrativeModel | null {
  const simulation = useSimulationStore.getState().result;
  const accounting = useAccountingStore.getState();

  if (simulation === null) return null;

  const score = clampScore(simulation.healthScore);
  const snapshots = [...accounting.snapshots].sort((a, b) => a.month.localeCompare(b.month));
  const previousSnapshot = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : snapshots[snapshots.length - 1];
  const previousScore = previousSnapshot !== undefined ? clampScore(previousSnapshot.healthScore) : score;
  const delta = score - previousScore;
  const factors: NarrativeFactor[] = [];

  const currentBudget = accounting.getBudgetForMonth(accounting.activeMonth);
  const previousBudget = previousSnapshot !== undefined ? previousSnapshot.balanceMonthly : undefined;
  const balanceDelta = previousBudget !== undefined ? currentBudget.balanceMonthly - previousBudget : 0;

  if (currentBudget.savingsRate >= 0.2) {
    factors.push({
      id: "savings-strong",
      points: 4,
      tone: "positive",
      title: "Épargne très saine",
      detail: `Taux d'épargne estimé : ${Math.round(currentBudget.savingsRate * 100)} % du revenu mensuel.`,
    });
  } else if (currentBudget.savingsRate >= 0.1) {
    factors.push({
      id: "savings-present",
      points: 2,
      tone: "positive",
      title: "Épargne maintenue",
      detail: `Tu conserves une capacité d'épargne d'environ ${formatEur(Math.max(0, currentBudget.balanceMonthly))}.`,
    });
  } else if (currentBudget.balanceMonthly <= 0) {
    factors.push({
      id: "balance-negative",
      points: -5,
      tone: "warning",
      title: "Reste à vivre sous pression",
      detail: `Le solde mensuel ressort à ${formatEur(currentBudget.balanceMonthly)} après dépenses.`,
    });
  } else {
    factors.push({
      id: "savings-low",
      points: -2,
      tone: "warning",
      title: "Épargne fragile",
      detail: "La marge positive existe, mais elle reste faible pour absorber un imprévu.",
    });
  }

  const creditEnding = accounting.expenses
    .filter((expense) => expense.category === "credit" && (expense.remainingMonths ?? 999) > 0 && (expense.remainingMonths ?? 999) <= 3)
    .sort((a, b) => (a.remainingMonths ?? 999) - (b.remainingMonths ?? 999))[0];

  if (creditEnding !== undefined) {
    factors.push({
      id: `credit-ending-${creditEnding.id}`,
      points: 3,
      tone: "positive",
      title: "Crédit bientôt libéré",
      detail: `${creditEnding.label} libérera ${formatEur(creditEnding.monthlyAmount)}/mois dans ${creditEnding.remainingMonths ?? 0} mois.`,
    });
  }

  if (currentBudget.debtRatio > 0.35) {
    factors.push({
      id: "debt-high",
      points: -5,
      tone: "warning",
      title: "Endettement élevé",
      detail: `Le taux de crédits atteint ${Math.round(currentBudget.debtRatio * 100)} % des revenus mensuels.`,
    });
  } else if (currentBudget.debtRatio <= 0.15) {
    factors.push({
      id: "debt-controlled",
      points: 2,
      tone: "positive",
      title: "Endettement maîtrisé",
      detail: `Les crédits représentent ${Math.round(currentBudget.debtRatio * 100)} % des revenus mensuels.`,
    });
  }

  const drift = strongestEnvelopeDrift(accounting.getEnvelopeStatuses(accounting.activeMonth));
  if (drift !== null) {
    factors.push({
      id: `drift-${drift.category}`,
      points: -2,
      tone: "warning",
      title: `${CATEGORY_LABELS[drift.category]} dépasse le prévu`,
      detail: `Écart constaté : ${formatEur(drift.delta)} sur le mois actif.`,
    });
  }

  if (balanceDelta >= 150) {
    factors.push({
      id: "balance-up",
      points: 2,
      tone: "positive",
      title: "Marge mensuelle en hausse",
      detail: `${formatEur(balanceDelta)} de mieux que le dernier mois clôturé.`,
    });
  } else if (balanceDelta <= -150) {
    factors.push({
      id: "balance-down",
      points: -2,
      tone: "warning",
      title: "Marge mensuelle en baisse",
      detail: `${formatEur(Math.abs(balanceDelta))} de moins que le dernier mois clôturé.`,
    });
  }

  const uniqueFactors = factors.filter(
    (factor, index, list) => list.findIndex((candidate) => candidate.id === factor.id) === index
  );
  const sortedFactors = uniqueFactors.sort((a, b) => Math.abs(b.points) - Math.abs(a.points)).slice(0, 4);
  const nextTarget = findNextTarget(score);
  const missingPoints = Math.max(0, nextTarget - score);
  const summary =
    missingPoints === 0
      ? "Le score est déjà dans une zone très robuste. L'objectif est maintenant de maintenir la régularité."
      : `${missingPoints} point${missingPoints > 1 ? "s" : ""} à gagner pour atteindre le prochain palier (${nextTarget}).`;

  return {
    score,
    delta,
    nextTarget,
    trend: trendLabel(delta, score),
    factors: sortedFactors,
    summary,
  };
}

export function ScoreNarrative() {
  const result = useSimulationStore((state) => state.result);
  const activeMonth = useAccountingStore((state) => state.activeMonth);
  const snapshots = useAccountingStore((state) => state.snapshots);
  const expenses = useAccountingStore((state) => state.expenses);
  const monthlyExpenses = useAccountingStore((state) => state.monthlyExpenses);

  const narrative = useMemo(() => buildNarrative(), [result, activeMonth, snapshots, expenses, monthlyExpenses]);

  if (narrative === null) return null;

  const deltaColor =
    narrative.delta > 0
      ? "var(--fin-green)"
      : narrative.delta < 0
        ? "var(--fin-amber)"
        : "var(--text-muted)";

  return (
    <div className="card p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              Lecture du score
            </h3>
            <span className="badge-soft">Tendance : {narrative.trend}</span>
          </div>
          <p className="mt-1 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
            Explication courte basée sur le mois actif, les dépenses réelles et l'historique clôturé.
          </p>
        </div>
        <div className="rounded-2xl px-4 py-3 text-right" style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
          <p className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Score SSF
          </p>
          <div className="mt-1 flex items-baseline justify-end gap-2">
            <span className="font-mono text-3xl font-extrabold" style={{ color: "var(--text-primary)" }}>
              {narrative.score}
            </span>
            <span className="font-mono text-sm font-extrabold" style={{ color: deltaColor }}>
              {narrative.delta === 0 ? "stable" : `${signedPoints(narrative.delta)} pts`}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        {narrative.factors.map((factor) => (
          <div key={factor.id} className="rounded-2xl px-4 py-3" style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
            <div className="flex items-start gap-3">
              <span className="font-mono text-sm font-extrabold tabular-nums" style={{ color: factorColor(factor.tone) }}>
                {signedPoints(factor.points)} pts
              </span>
              <div className="min-w-0">
                <p className="text-xs font-extrabold" style={{ color: "var(--text-primary)" }}>
                  {factor.title}
                </p>
                <p className="mt-1 text-xs font-medium leading-5" style={{ color: "var(--text-secondary)" }}>
                  {factor.detail}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2 rounded-2xl px-4 py-3 md:flex-row md:items-center md:justify-between" style={{ background: "var(--bg-surface-3)", border: "1px solid var(--border)" }}>
        <p className="text-xs font-semibold leading-5" style={{ color: "var(--text-secondary)" }}>
          {narrative.summary}
        </p>
        <span className="text-xs font-extrabold" style={{ color: "var(--text-primary)" }}>
          Prochain palier : {narrative.nextTarget}
        </span>
      </div>
    </div>
  );
}
