// =============================================================================
// Fichier  : src/components/shared/AffordabilityModal.tsx
// Auteur   : KREMER Régis
// Desc.    : Modal de simulation instantanée "Puis-je me permettre ça ?" sans
//            modification des données utilisateur.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-05-03 | KREMER Régis | Création Phase 17 — simulation d'achat instantanée
// =============================================================================

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccountingStore } from "@/store/accountingStore";
import { useSimulationStore } from "@/store/simulationStore";
import { formatEur, formatPct } from "@/utils/formatCurrency";

type PurchaseMode = "one_time" | "credit";

interface AffordabilityModalProps {
  open: boolean;
  onClose: () => void;
}

interface SimulationView {
  title: string;
  verdict: string;
  tone: "success" | "warning" | "danger";
  disposableAfter: number;
  disposableDelta: number;
  scoreAfter: number;
  scoreDelta: number;
  debtAfter: number;
  monthlyImpact: number;
  suggestion: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function rounded(value: number): number {
  return Math.round(value * 100) / 100;
}

function computeScoreAfter(currentScore: number, disposableDelta: number, baseDisposable: number, debtAfter: number): number {
  const disposablePenalty = baseDisposable <= 0
    ? Math.abs(disposableDelta) > 0 ? 12 : 0
    : clamp((Math.abs(disposableDelta) / Math.max(1, baseDisposable)) * 16, 0, 28);
  const debtPenalty = debtAfter > 0.35 ? (debtAfter - 0.35) * 140 : 0;
  return Math.round(clamp(currentScore - disposablePenalty - debtPenalty, 0, 100));
}

function buildSuggestion(mode: PurchaseMode, monthlyImpact: number, durationMonths: number, disposableAfter: number): string {
  if (disposableAfter < 0) {
    return "Décision déconseillée : ce choix mettrait le mois en négatif. Reporter ou réduire le montant.";
  }
  if (mode === "credit" && durationMonths > 0) {
    return `À crédit, sécurisez au moins ${formatEur(monthlyImpact)} par mois pendant ${durationMonths} mois avant de signer.`;
  }
  if (disposableAfter < 200) {
    return "Faisable mais fragile : conserver une marge de sécurité ou attendre le prochain mois.";
  }
  return `Faisable sans alerte majeure. Après achat, il resterait ${formatEur(disposableAfter)} sur le mois.`;
}

export function AffordabilityModal({ open, onClose }: AffordabilityModalProps) {
  const result = useSimulationStore((state) => state.result);
  const budget = useAccountingStore((state) => state.getBudget());
  const [mode, setMode] = useState<PurchaseMode>("one_time");
  const [amount, setAmount] = useState<string>("350");
  const [monthlyPayment, setMonthlyPayment] = useState<string>("80");
  const [durationMonths, setDurationMonths] = useState<string>("12");

  const simulation = useMemo<SimulationView | null>(() => {
    if (!result) return null;
    const parsedAmount = Math.max(0, Number.parseFloat(amount.replace(",", ".")) || 0);
    const parsedMonthly = Math.max(0, Number.parseFloat(monthlyPayment.replace(",", ".")) || 0);
    const parsedDuration = Math.max(1, Math.round(Number.parseFloat(durationMonths.replace(",", ".")) || 1));
    const monthlyImpact = mode === "one_time" ? parsedAmount : parsedMonthly;
    const disposableAfter = rounded(result.realDisposableIncome - monthlyImpact);
    const debtAfter = mode === "credit" && budget.totalIncomeMonthly > 0
      ? (budget.expenseByCategory.credit ?? 0) / budget.totalIncomeMonthly + parsedMonthly / budget.totalIncomeMonthly
      : budget.debtRatio;
    const scoreAfter = computeScoreAfter(result.healthScore, -monthlyImpact, result.realDisposableIncome, debtAfter);
    const scoreDelta = scoreAfter - result.healthScore;
    const tone: SimulationView["tone"] = disposableAfter < 0 || debtAfter > 0.35
      ? "danger"
      : disposableAfter < 200 || scoreDelta <= -10
        ? "warning"
        : "success";
    const verdict = tone === "success"
      ? "Faisable"
      : tone === "warning"
        ? "Faisable avec prudence"
        : "Déconseillé avec la situation actuelle";
    return {
      title: mode === "one_time" ? `Achat ponctuel de ${formatEur(parsedAmount)}` : `Crédit de ${formatEur(parsedMonthly)}/mois`,
      verdict,
      tone,
      disposableAfter,
      disposableDelta: -monthlyImpact,
      scoreAfter,
      scoreDelta,
      debtAfter,
      monthlyImpact,
      suggestion: buildSuggestion(mode, monthlyImpact, parsedDuration, disposableAfter),
    };
  }, [amount, budget.debtRatio, budget.expenseByCategory.credit, budget.totalIncomeMonthly, durationMonths, mode, monthlyPayment, result]);

  const toneColor = simulation?.tone === "success"
    ? "var(--fin-green)"
    : simulation?.tone === "warning"
      ? "var(--fin-amber)"
      : "var(--fin-red)";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ background: "rgba(15, 23, 42, .48)", backdropFilter: "blur(10px)" }}
          onMouseDown={onClose}
        >
          <motion.div
            className="w-full max-w-2xl rounded-3xl border p-5 shadow-card"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                  Simulation instantanée
                </p>
                <h2 className="mt-1 text-xl font-extrabold" style={{ color: "var(--text-primary)" }}>
                  Puis-je me permettre ça ?
                </h2>
                <p className="mt-1 text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
                  La simulation ne modifie aucune donnée. Elle mesure seulement l'impact sur le mois, le score et l'endettement.
                </p>
              </div>
              <button type="button" className="btn-mini" onClick={onClose}>Fermer</button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <label className="rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "var(--bg-surface-2)" }}>
                <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>Type</span>
                <select className="input-premium mt-2 w-full" value={mode} onChange={(event) => setMode(event.target.value as PurchaseMode)}>
                  <option value="one_time">Achat comptant</option>
                  <option value="credit">Achat à crédit</option>
                </select>
              </label>
              <label className="rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "var(--bg-surface-2)" }}>
                <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>{mode === "one_time" ? "Montant" : "Montant total indicatif"}</span>
                <input className="input-premium mt-2 w-full" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
              </label>
              {mode === "credit" && (
                <label className="rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "var(--bg-surface-2)" }}>
                  <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>Mensualité</span>
                  <input className="input-premium mt-2 w-full" inputMode="decimal" value={monthlyPayment} onChange={(event) => setMonthlyPayment(event.target.value)} />
                </label>
              )}
              {mode === "credit" && (
                <label className="rounded-2xl border p-3 md:col-span-3" style={{ borderColor: "var(--border)", background: "var(--bg-surface-2)" }}>
                  <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>Durée en mois</span>
                  <input className="input-premium mt-2 w-full" inputMode="numeric" value={durationMonths} onChange={(event) => setDurationMonths(event.target.value)} />
                </label>
              )}
            </div>

            {simulation && (
              <div className="mt-5 rounded-3xl border p-4" style={{ borderColor: "var(--border)", background: "var(--bg-surface-2)" }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-extrabold" style={{ color: "var(--text-primary)" }}>{simulation.title}</p>
                    <p className="mt-1 text-xs font-bold" style={{ color: toneColor }}>{simulation.verdict}</p>
                  </div>
                  <div className="rounded-2xl px-3 py-2 text-sm font-mono font-extrabold" style={{ background: "var(--bg-surface-3)", color: toneColor }}>
                    {formatEur(simulation.disposableAfter)} après impact
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <ImpactCell label="Reste à vivre" before={result?.realDisposableIncome ?? 0} after={simulation.disposableAfter} mode="currency" />
                  <ImpactCell label="Score SSF" before={result?.healthScore ?? 0} after={simulation.scoreAfter} mode="score" />
                  <ImpactCell label="Endettement" before={budget.debtRatio} after={simulation.debtAfter} mode="percent" />
                </div>

                <p className="mt-4 rounded-2xl px-3 py-3 text-sm font-semibold" style={{ background: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                  {simulation.suggestion}
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ImpactCell({ label, before, after, mode }: { label: string; before: number; after: number; mode: "currency" | "score" | "percent" }) {
  const delta = after - before;
  const valueBefore = mode === "currency" ? formatEur(before) : mode === "percent" ? formatPct(before) : `${Math.round(before)} pts`;
  const valueAfter = mode === "currency" ? formatEur(after) : mode === "percent" ? formatPct(after) : `${Math.round(after)} pts`;
  const color = delta >= 0 ? "var(--fin-green)" : "var(--fin-red)";
  return (
    <div className="rounded-2xl border p-3" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
      <p className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="mt-2 text-sm font-mono font-extrabold" style={{ color: "var(--text-primary)" }}>{valueBefore}</p>
      <p className="text-xs font-bold" style={{ color }}>→ {valueAfter}</p>
    </div>
  );
}
