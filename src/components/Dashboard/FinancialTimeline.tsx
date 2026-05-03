// =============================================================================
// Fichier  : src/components/Dashboard/FinancialTimeline.tsx
// Auteur   : KREMER Régis
// Desc.    : Timeline financière prévisionnelle sur six mois.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-05-03 | KREMER Régis | Phase 16 — Création de la timeline financière
// =============================================================================

import { useMemo } from "react";
import { useSimulationStore } from "@/store/simulationStore";
import { useAccountingStore } from "@/store/accountingStore";
import { formatEur } from "@/utils/formatCurrency";

interface TimelineMonth {
  month: string;
  label: string;
  projectedBalance: number;
  events: string[];
}

function addMonths(month: string, offset: number): string {
  const [yearRaw, monthRaw] = month.split("-");
  const year = Number.parseInt(yearRaw ?? `${new Date().getFullYear()}`, 10);
  const monthIndex = Number.parseInt(monthRaw ?? "1", 10) - 1;
  const date = new Date(year, monthIndex + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  const [yearRaw, monthRaw] = month.split("-");
  const year = Number.parseInt(yearRaw ?? `${new Date().getFullYear()}`, 10);
  const monthIndex = Number.parseInt(monthRaw ?? "1", 10) - 1;
  return new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric" }).format(new Date(year, monthIndex, 1));
}

function monthNumber(month: string): number {
  const [, rawMonth] = month.split("-");
  return Number.parseInt(rawMonth ?? "0", 10);
}

export function FinancialTimeline() {
  const result = useSimulationStore((s) => s.result);
  const activeMonth = useAccountingStore((s) => s.activeMonth);
  const expenses = useAccountingStore((s) => s.expenses);

  const months = useMemo<TimelineMonth[]>(() => {
    if (!result) return [];
    return Array.from({ length: 6 }, (_, index) => {
      const month = addMonths(activeMonth, index);
      const targetMonthNumber = monthNumber(month);
      const events: string[] = [];

      const creditRelief = expenses
        .filter((expense) => expense.category === "credit" && (expense.remainingMonths ?? 9999) === index)
        .reduce((sum, expense) => {
          events.push(`${expense.label} terminé`);
          return sum + expense.monthlyAmount;
        }, 0);

      const annualImpact = expenses
        .filter((expense) => expense.frequency === "annual" && expense.annualMonth === targetMonthNumber)
        .reduce((sum, expense) => {
          events.push(`${expense.label} annuel`);
          return sum + expense.amount;
        }, 0);

      return {
        month,
        label: monthLabel(month),
        projectedBalance: result.realDisposableIncome + creditRelief - annualImpact,
        events,
      };
    });
  }, [activeMonth, expenses, result]);

  if (!result || months.length === 0) return null;

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            Timeline financière
          </h3>
          <p className="mt-0.5 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
            Projection simple sur 6 mois : reste à vivre, fins de crédits et charges annuelles.
          </p>
        </div>
        <span className="badge-soft">6 mois</span>
      </div>

      <div className="grid gap-2 md:grid-cols-6">
        {months.map((item) => {
          const color = item.projectedBalance >= 300 ? "var(--fin-green)" : item.projectedBalance >= 0 ? "var(--fin-amber)" : "var(--fin-red)";
          return (
            <div key={item.month} className="rounded-2xl px-3 py-3" style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
              <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                {item.label}
              </p>
              <p className="mt-2 font-mono text-sm font-extrabold tabular-nums" style={{ color }}>
                {formatEur(item.projectedBalance)}
              </p>
              <div className="mt-2 min-h-[34px] space-y-1">
                {item.events.length > 0 ? (
                  item.events.slice(0, 2).map((event) => (
                    <p key={event} className="text-[10px] font-semibold leading-4" style={{ color: "var(--text-secondary)" }}>
                      {event}
                    </p>
                  ))
                ) : (
                  <p className="text-[10px] font-semibold" style={{ color: "var(--text-placeholder)" }}>
                    Stable
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
