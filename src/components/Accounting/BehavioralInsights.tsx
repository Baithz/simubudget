// =============================================================================
// Fichier  : src/components/Accounting/BehavioralInsights.tsx
// Auteur   : KREMER Régis
// Desc.    : Analyse comportementale simple à partir de l'historique comptable.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-05-03 | KREMER Régis | Création Phase 17 — lecture comportementale
// =============================================================================

import { CATEGORY_LABELS, type ExpenseCategory, type ExpenseLine, type MonthlyExpenseLine } from "@/types/accounting";
import type { MonthlySnapshot } from "@/types/profile";
import { formatEur, formatPct } from "@/utils/formatCurrency";

interface BehavioralInsightsProps {
  snapshots: MonthlySnapshot[];
  expenses: ExpenseLine[];
  monthlyExpenses: MonthlyExpenseLine[];
}

interface InsightLine {
  id: string;
  title: string;
  detail: string;
  tone: "positive" | "warning" | "neutral";
}

function getAmount(line: MonthlyExpenseLine): number {
  return line.realAmount ?? line.amount;
}

function buildCategoryTotals(lines: MonthlyExpenseLine[]): Array<{ category: ExpenseCategory; amount: number }> {
  const totals = new Map<ExpenseCategory, number>();
  for (const line of lines) {
    if (line.status === "ignored") continue;
    totals.set(line.category, (totals.get(line.category) ?? 0) + getAmount(line));
  }
  return Array.from(totals.entries()).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}

export function BehavioralInsights({ snapshots, expenses, monthlyExpenses }: BehavioralInsightsProps) {
  const sortedSnapshots = [...snapshots].sort((a, b) => a.month.localeCompare(b.month));
  const latest = sortedSnapshots[sortedSnapshots.length - 1];
  const previous = sortedSnapshots[sortedSnapshots.length - 2];

  if (sortedSnapshots.length < 2) {
    return (
      <div className="rounded-3xl border p-5" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
        <p className="text-sm font-extrabold" style={{ color: "var(--text-primary)" }}>Analyse comportementale</p>
        <p className="mt-2 text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
          Disponible après deux mois d'historique. Clôturez ou sauvegardez au moins deux mois pour détecter les tendances.
        </p>
      </div>
    );
  }

  const latestLines = latest ? monthlyExpenses.filter((line) => line.month === latest.month) : [];
  const previousLines = previous ? monthlyExpenses.filter((line) => line.month === previous.month) : [];
  const latestTop = buildCategoryTotals(latestLines)[0];
  const previousTop = buildCategoryTotals(previousLines)[0];
  const recurringNonEssential = expenses.filter((line) => !line.isMandatory && !line.isFixed).reduce((sum, line) => sum + line.monthlyAmount, 0);
  const balanceDelta = latest && previous ? latest.balanceMonthly - previous.balanceMonthly : 0;

  const insights: InsightLine[] = [
    {
      id: "balance-trend",
      title: balanceDelta >= 0 ? "Solde en amélioration" : "Solde en baisse",
      detail: `${balanceDelta >= 0 ? "+" : ""}${formatEur(balanceDelta)} par rapport au mois précédent.`,
      tone: balanceDelta >= 0 ? "positive" : "warning",
    },
    {
      id: "savings-rate",
      title: "Régularité d'épargne",
      detail: latest ? `Dernier taux d'épargne connu : ${formatPct(latest.savingsRate)}.` : "Taux d'épargne indisponible.",
      tone: latest && latest.savingsRate >= 0.1 ? "positive" : "warning",
    },
    {
      id: "main-category",
      title: "Poste dominant",
      detail: latestTop
        ? `${CATEGORY_LABELS[latestTop.category]} domine le dernier mois avec ${formatEur(latestTop.amount)}.${previousTop ? ` Mois précédent : ${CATEGORY_LABELS[previousTop.category]}.` : ""}`
        : "Aucune dépense mensuelle exploitable sur le dernier mois.",
      tone: "neutral",
    },
  ];

  return (
    <section className="rounded-3xl border p-5" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold" style={{ color: "var(--text-primary)" }}>Analyse comportementale</p>
          <p className="mt-1 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
            Lecture simple des deux derniers mois et des charges non essentielles.
          </p>
        </div>
        <span className="rounded-full px-3 py-1 text-[11px] font-extrabold" style={{ background: "var(--bg-surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
          {formatEur(recurringNonEssential)}/mois compressibles
        </span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {insights.map((insight) => (
          <div key={insight.id} className="rounded-2xl border p-3" style={{ background: "var(--bg-surface-2)", borderColor: "var(--border)" }}>
            <p className="text-xs font-extrabold" style={{ color: insight.tone === "positive" ? "var(--fin-green)" : insight.tone === "warning" ? "var(--fin-amber)" : "var(--text-primary)" }}>{insight.title}</p>
            <p className="mt-1 text-xs font-semibold leading-5" style={{ color: "var(--text-secondary)" }}>{insight.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
