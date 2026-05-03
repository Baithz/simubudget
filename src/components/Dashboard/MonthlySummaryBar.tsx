// =============================================================================
// Fichier  : src/components/Dashboard/MonthlySummaryBar.tsx
// Auteur   : KREMER Régis
// Desc.    : Résumé mensuel proactif en trois lignes pour lecture immédiate.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-05-03 | KREMER Régis | Phase 16 — Création du résumé mensuel dashboard
// =============================================================================

import { useMemo } from "react";
import { useSimulationStore } from "@/store/simulationStore";
import { useAccountingStore } from "@/store/accountingStore";
import type { EnvelopeStatus } from "@/types/accounting";
import { formatEur } from "@/utils/formatCurrency";

function pickMainEnvelope(envelopes: EnvelopeStatus[]): EnvelopeStatus | null {
  const exceeded = envelopes
    .filter((item) => item.planned > 0 && item.spent > item.planned && !item.isSavingsEnvelope)
    .sort((a, b) => b.spent - b.planned - (a.spent - a.planned));
  if (exceeded[0] !== undefined) return exceeded[0];

  const watched = envelopes
    .filter((item) => item.planned > 0 && item.percent >= 80 && !item.isSavingsEnvelope)
    .sort((a, b) => b.percent - a.percent);
  return watched[0] ?? null;
}

function lineTone(value: number): "success" | "warning" | "danger" {
  if (value < 0) return "danger";
  if (value < 200) return "warning";
  return "success";
}

export function MonthlySummaryBar() {
  const result = useSimulationStore((s) => s.result);
  const activeMonth = useAccountingStore((s) => s.activeMonth);
  const envelopes = useAccountingStore((s) => s.getEnvelopeStatuses(activeMonth));
  const recommendations = useAccountingStore((s) => s.getRecommendations());

  const summary = useMemo(() => {
    if (!result) return null;

    const mainTone = lineTone(result.realDisposableIncome);
    const mainLine =
      result.realDisposableIncome >= 0
        ? `Reste à vivre ce mois : ${formatEur(result.realDisposableIncome)}`
        : `Reste à vivre négatif : ${formatEur(result.realDisposableIncome)}`;

    const mainEnvelope = pickMainEnvelope(envelopes);
    const warningLine = mainEnvelope
      ? mainEnvelope.spent > mainEnvelope.planned
        ? `${mainEnvelope.label} dépassé de ${formatEur(mainEnvelope.spent - mainEnvelope.planned)}.`
        : `${mainEnvelope.label} déjà utilisé à ${Math.round(mainEnvelope.percent)} %.`
      : result.alerts.find((alert) => alert.level === "critical" || alert.level === "danger")?.message ??
        "Aucun dépassement majeur détecté ce mois.";

    const bestRecommendation = recommendations[0];
    const opportunityLine = bestRecommendation?.saving !== undefined && bestRecommendation.saving > 0
      ? `${bestRecommendation.title} — potentiel ${formatEur(bestRecommendation.saving)}/mois.`
      : bestRecommendation?.action ?? bestRecommendation?.detail ??
        (result.realDisposableIncome > 150
          ? `Capacité disponible : affecter jusqu'à ${formatEur(Math.max(0, result.realDisposableIncome * 0.3))} à l'épargne.`
          : "Priorité : sécuriser les charges essentielles avant d'épargner.");

    return { mainLine, warningLine, opportunityLine, mainTone };
  }, [envelopes, recommendations, result]);

  if (!summary) return null;

  const mainColor =
    summary.mainTone === "success"
      ? "var(--fin-green)"
      : summary.mainTone === "warning"
        ? "var(--fin-amber)"
        : "var(--fin-red)";

  return (
    <div className="premium-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Résumé du mois
          </p>
          <p className="mt-0.5 text-[11px] font-semibold" style={{ color: "var(--text-placeholder)" }}>
            Lecture rapide de la situation réelle et prévue
          </p>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <SummaryLine icon="✓" text={summary.mainLine} color={mainColor} />
        <SummaryLine icon="!" text={summary.warningLine} color="var(--fin-amber)" />
        <SummaryLine icon="→" text={summary.opportunityLine} color="var(--fin-blue)" />
      </div>
    </div>
  );
}

function SummaryLine({ icon, text, color }: { icon: string; text: string; color: string }) {
  return (
    <div className="flex items-start gap-2 rounded-2xl px-3 py-2.5" style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-xs font-extrabold" style={{ background: "var(--bg-surface-3)", color }}>
        {icon}
      </span>
      <p className="text-xs font-semibold leading-5" style={{ color: "var(--text-primary)" }}>
        {text}
      </p>
    </div>
  );
}
