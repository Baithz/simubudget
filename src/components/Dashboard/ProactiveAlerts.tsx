// =============================================================================
// Fichier  : src/components/Dashboard/ProactiveAlerts.tsx
// Auteur   : KREMER Régis
// Desc.    : Alertes proactives dashboard avec anti-spam hebdomadaire.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-05-03 | KREMER Régis | Phase 16 — Création des alertes proactives
// =============================================================================

import { useMemo } from "react";
import { useAccountingStore } from "@/store/accountingStore";
import { useUIStore } from "@/store/uiStore";
import { CATEGORY_LABELS, type ExpenseLine } from "@/types/accounting";
import { formatEur } from "@/utils/formatCurrency";

interface ProactiveAlert {
  id: string;
  level: "danger" | "warning" | "opportunity" | "info";
  title: string;
  detail: string;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function isSnoozed(lastShownAt: Record<string, string>, id: string): boolean {
  const raw = lastShownAt[id];
  if (raw === undefined) return false;
  const date = new Date(raw).getTime();
  if (Number.isNaN(date)) return false;
  return Date.now() - date < WEEK_MS;
}

function buildCreditEndingAlerts(expenses: ExpenseLine[]): ProactiveAlert[] {
  return expenses
    .filter((expense) => expense.category === "credit" && (expense.remainingMonths ?? 999) > 0 && (expense.remainingMonths ?? 999) <= 3)
    .slice(0, 2)
    .map((expense) => ({
      id: `credit-ending-${expense.id}-${expense.remainingMonths ?? 0}`,
      level: "opportunity",
      title: `${expense.label} se termine bientôt`,
      detail: `Encore ${expense.remainingMonths ?? 0} mois : ${formatEur(expense.monthlyAmount)}/mois seront libérés.`,
    }));
}

export function ProactiveAlerts() {
  const activeMonth = useAccountingStore((s) => s.activeMonth);
  const expenses = useAccountingStore((s) => s.expenses);
  const snapshots = useAccountingStore((s) => s.snapshots);
  const envelopes = useAccountingStore((s) => s.getEnvelopeStatuses(activeMonth));
  const alertSnooze = useUIStore((s) => s.alertSnooze);
  const snoozeAlert = useUIStore((s) => s.snoozeAlert);

  const alerts = useMemo<ProactiveAlert[]>(() => {
    const next: ProactiveAlert[] = [];
    const day = new Date().getDate();

    if (day < 20) {
      const earlyEnvelope = envelopes
        .filter((status) => status.planned > 0 && status.percent >= 80 && !status.isSavingsEnvelope)
        .sort((a, b) => b.percent - a.percent)[0];
      if (earlyEnvelope !== undefined) {
        next.push({
          id: `envelope-early-${activeMonth}-${earlyEnvelope.category}`,
          level: earlyEnvelope.percent >= 100 ? "danger" : "warning",
          title: `${earlyEnvelope.label} sous tension`,
          detail: `${formatEur(Math.max(0, earlyEnvelope.remaining))} restants avant la fin du mois (${Math.round(earlyEnvelope.percent)} % utilisé).`,
        });
      }
    }

    next.push(...buildCreditEndingAlerts(expenses));

    const lastTwo = snapshots.slice(-2);
    if (lastTwo.length === 2 && lastTwo.every((snapshot) => snapshot.savingsRate < 0.01)) {
      next.push({
        id: `no-savings-${lastTwo[0]?.month ?? "n"}-${lastTwo[1]?.month ?? "n1"}`,
        level: "warning",
        title: "Aucune épargne depuis 2 mois",
        detail: "Même 50 €/mois permet de recréer une marge de sécurité progressive.",
      });
    }

    if (lastTwo.length === 2) {
      const previous = lastTwo[0];
      const current = lastTwo[1];
      if (previous !== undefined && current !== undefined) {
        const delta = current.realDisposableIncome - previous.realDisposableIncome;
        if (delta >= 150) {
          next.push({
            id: `rdv-up-${current.month}`,
            level: "opportunity",
            title: "Reste à vivre en hausse",
            detail: `${formatEur(delta)} de plus que le mois précédent : opportunité d'augmenter l'épargne.`,
          });
        }
      }
    }

    const drift = envelopes
      .filter((status) => status.planned > 0 && status.spent > status.planned && !status.isSavingsEnvelope)
      .sort((a, b) => b.spent - b.planned - (a.spent - a.planned))[0];
    if (drift !== undefined) {
      next.push({
        id: `drift-${activeMonth}-${drift.category}`,
        level: "warning",
        title: `${CATEGORY_LABELS[drift.category]} dépasse le prévu`,
        detail: `Écart constaté : ${formatEur(drift.spent - drift.planned)} sur le mois.`,
      });
    }

    return next.filter((alert, index, list) => list.findIndex((item) => item.id === alert.id) === index).slice(0, 4);
  }, [activeMonth, envelopes, expenses, snapshots]);

  const visibleAlerts = alerts.filter((alert) => !isSnoozed(alertSnooze, alert.id));

  if (visibleAlerts.length === 0) return null;

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            Alertes intelligentes
          </h3>
          <p className="mt-0.5 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
            Signaux calculés depuis le mois actif, les enveloppes et l'historique.
          </p>
        </div>
        <span className="badge-soft">{visibleAlerts.length}</span>
      </div>
      <div className="space-y-2">
        {visibleAlerts.map((alert) => (
          <ProactiveAlertCard key={alert.id} alert={alert} onSnooze={() => snoozeAlert(alert.id)} />
        ))}
      </div>
    </div>
  );
}

function ProactiveAlertCard({ alert, onSnooze }: { alert: ProactiveAlert; onSnooze: () => void }) {
  const color =
    alert.level === "danger"
      ? "var(--fin-red)"
      : alert.level === "warning"
        ? "var(--fin-amber)"
        : alert.level === "opportunity"
          ? "var(--fin-green)"
          : "var(--fin-blue)";

  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl px-3 py-3" style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
      <div className="min-w-0">
        <p className="text-xs font-extrabold" style={{ color }}>
          {alert.title}
        </p>
        <p className="mt-1 text-xs font-medium leading-5" style={{ color: "var(--text-secondary)" }}>
          {alert.detail}
        </p>
      </div>
      <button type="button" className="btn-mini flex-shrink-0" onClick={onSnooze} title="Masquer cette alerte pendant 7 jours">
        Masquer
      </button>
    </div>
  );
}
