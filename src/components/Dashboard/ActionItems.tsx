// =============================================================================
// Fichier  : src/components/Dashboard/ActionItems.tsx
// Auteur   : KREMER Régis
// Desc.    : Bloc d'actions recommandées priorisées pour le tableau de bord.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-05-03 | KREMER Régis | Création Phase 17 — actions recommandées
// =============================================================================

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAccountingStore } from "@/store/accountingStore";
import { useSimulationStore } from "@/store/simulationStore";
import type { AccountingRecommendation } from "@/types/accounting";
import { formatEur } from "@/utils/formatCurrency";

interface ActionItem {
  id: string;
  title: string;
  detail: string;
  level: "urgent" | "warning" | "opportunity";
  button: string;
  target: string;
}

const LEVEL_META: Record<ActionItem["level"], { label: string; color: string }> = {
  urgent: { label: "Urgent", color: "var(--fin-red)" },
  warning: { label: "À surveiller", color: "var(--fin-amber)" },
  opportunity: { label: "Opportunité", color: "var(--fin-green)" },
};

function recommendationToAction(rec: AccountingRecommendation): ActionItem {
  const level: ActionItem["level"] = rec.level === "critical" || rec.level === "danger" ? "urgent" : rec.level === "vigilance" ? "warning" : "opportunity";
  return {
    id: rec.id,
    title: rec.title,
    detail: rec.saving !== undefined && rec.saving > 0
      ? `${rec.detail} Potentiel estimé : ${formatEur(rec.saving)}/mois.`
      : rec.detail,
    level,
    button: "Voir dans Mes comptes",
    target: "/accounting",
  };
}

export function ActionItems() {
  const navigate = useNavigate();
  const result = useSimulationStore((state) => state.result);
  const activeMonth = useAccountingStore((state) => state.activeMonth);
  const envelopes = useAccountingStore((state) => state.getEnvelopeStatuses(activeMonth));
  const recommendations = useAccountingStore((state) => state.getRecommendations());
  const expenses = useAccountingStore((state) => state.expenses);

  const actions = useMemo<ActionItem[]>(() => {
    const built: ActionItem[] = [];
    const criticalEnvelope = envelopes
      .filter((item) => item.planned > 0 && item.spent > item.planned && !item.isSavingsEnvelope)
      .sort((a, b) => b.spent - b.planned - (a.spent - a.planned))[0];
    if (criticalEnvelope !== undefined) {
      built.push({
        id: `envelope-${criticalEnvelope.category}`,
        title: `${criticalEnvelope.label} dépassé de ${formatEur(criticalEnvelope.spent - criticalEnvelope.planned)}`,
        detail: `Budget prévu : ${formatEur(criticalEnvelope.planned)}. Réel constaté : ${formatEur(criticalEnvelope.spent)}.`,
        level: "urgent",
        button: "Analyser l'enveloppe",
        target: "/accounting",
      });
    }

    const endingCredit = expenses
      .filter((expense) => expense.category === "credit" && (expense.remainingMonths ?? 999) > 0 && (expense.remainingMonths ?? 999) <= 3)
      .sort((a, b) => (a.remainingMonths ?? 999) - (b.remainingMonths ?? 999))[0];
    if (endingCredit !== undefined) {
      built.push({
        id: `credit-${endingCredit.id}`,
        title: `${endingCredit.label} se termine bientôt`,
        detail: `${formatEur(endingCredit.monthlyAmount)}/mois pourront être réaffectés dans ${endingCredit.remainingMonths ?? 0} mois.`,
        level: "opportunity",
        button: "Préparer l'allocation",
        target: "/accounting",
      });
    }

    if (result !== null && result.realDisposableIncome < 0) {
      built.push({
        id: "negative-balance",
        title: "Solde mensuel négatif",
        detail: `Il manque ${formatEur(Math.abs(result.realDisposableIncome))} pour équilibrer le mois. Priorité aux charges compressibles.`,
        level: "urgent",
        button: "Voir les dépenses",
        target: "/accounting",
      });
    }

    for (const rec of recommendations.slice(0, 5)) {
      if (!built.some((item) => item.id === rec.id)) built.push(recommendationToAction(rec));
    }

    const ranked = built.sort((a, b) => {
      const order = { urgent: 0, warning: 1, opportunity: 2 } as const;
      return order[a.level] - order[b.level];
    });
    return ranked.slice(0, 3);
  }, [envelopes, expenses, recommendations, result]);

  if (actions.length === 0) return null;

  return (
    <section className="premium-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Actions recommandées
          </p>
          <p className="mt-0.5 text-[11px] font-semibold" style={{ color: "var(--text-placeholder)" }}>
            Maximum trois priorités, triées par urgence et impact.
          </p>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {actions.map((action) => {
          const meta = LEVEL_META[action.level];
          return (
            <article key={action.id} className="rounded-2xl border p-3" style={{ background: "var(--bg-surface-2)", borderColor: "var(--border)" }}>
              <p className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: meta.color }}>{meta.label}</p>
              <h3 className="mt-2 text-sm font-extrabold" style={{ color: "var(--text-primary)" }}>{action.title}</h3>
              <p className="mt-1 min-h-[44px] text-xs font-semibold leading-5" style={{ color: "var(--text-secondary)" }}>{action.detail}</p>
              <button type="button" className="btn-mini-green mt-3" onClick={() => navigate(action.target)}>
                {action.button}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
