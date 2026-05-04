// =============================================================================
// Fichier  : src/components/shared/AffordabilityModal.tsx
// Auteur   : KREMER Régis
// Desc.    : Modal de simulation instantanée "Puis-je me permettre ça ?" avec
//            achat comptant, achat à crédit, TAEG, mensualité et capital estimé.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-05-03 | KREMER Régis | Création Phase 17 — simulation d'achat instantanée
//   2026-05-04 | KREMER Régis | Phase 5 — Ajout TAEG, modes crédit cohérents et calculs automatiques
// =============================================================================

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAccountingStore } from "@/store/accountingStore";
import { useSimulationStore } from "@/store/simulationStore";
import { formatEur, formatPct, formatPctFromHundred } from "@/utils/formatCurrency";

type PurchaseMode = "one_time" | "credit";
type CreditInputMode = "known_price" | "known_monthly";
type Tone = "success" | "warning" | "danger";

interface AffordabilityModalProps {
  open: boolean;
  onClose: () => void;
}

interface CreditComputation {
  inputMode: CreditInputMode;
  financedCapital: number;
  monthlyPayment: number;
  durationMonths: number;
  annualRate: number;
  totalPaid: number;
  totalInterest: number;
  upfrontImpact: number;
  monthlyImpact: number;
  consistencyWarning: string | null;
}

interface SimulationView {
  title: string;
  verdict: string;
  tone: Tone;
  disposableAfter: number;
  disposableDelta: number;
  scoreAfter: number;
  scoreDelta: number;
  debtAfter: number;
  monthlyImpact: number;
  upfrontImpact: number;
  suggestion: string;
  credit: CreditComputation | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function rounded(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseMoney(value: string): number {
  return Math.max(0, Number.parseFloat(value.replace(",", ".")) || 0);
}

function parsePositiveInteger(value: string, fallback: number): number {
  return Math.max(1, Math.round(Number.parseFloat(value.replace(",", ".")) || fallback));
}

function parseRate(value: string): number {
  return Math.max(0, Number.parseFloat(value.replace(",", ".")) || 0);
}

function monthlyRate(annualRatePercent: number): number {
  return annualRatePercent / 12 / 100;
}

function computeMonthlyPayment(capital: number, annualRatePercent: number, durationMonths: number): number {
  if (capital <= 0 || durationMonths <= 0) return 0;
  const rate = monthlyRate(annualRatePercent);
  if (rate === 0) return capital / durationMonths;
  return capital * (rate / (1 - (1 + rate) ** -durationMonths));
}

function computeCapitalFromMonthly(monthlyPayment: number, annualRatePercent: number, durationMonths: number): number {
  if (monthlyPayment <= 0 || durationMonths <= 0) return 0;
  const rate = monthlyRate(annualRatePercent);
  if (rate === 0) return monthlyPayment * durationMonths;
  return monthlyPayment * ((1 - (1 + rate) ** -durationMonths) / rate);
}

function computeScoreAfter(
  currentScore: number,
  disposableDelta: number,
  baseDisposable: number,
  debtAfter: number,
): number {
  const base = Math.max(1, Math.abs(baseDisposable));
  const disposablePenalty = clamp((Math.abs(disposableDelta) / base) * 18, 0, 32);
  const negativePenalty = baseDisposable + disposableDelta < 0 ? 20 : 0;
  const debtPenalty = debtAfter > 0.35 ? (debtAfter - 0.35) * 150 : 0;
  return Math.round(clamp(currentScore - disposablePenalty - negativePenalty - debtPenalty, 0, 100));
}

function toneLabel(tone: Tone): string {
  if (tone === "success") return "Faisable";
  if (tone === "warning") return "Faisable avec prudence";
  return "Déconseillé avec la situation actuelle";
}

function toneColor(tone: Tone): string {
  if (tone === "success") return "var(--fin-green)";
  if (tone === "warning") return "var(--fin-amber)";
  return "var(--fin-red)";
}

function buildCreditSuggestion(credit: CreditComputation, disposableAfter: number, debtAfter: number): string {
  if (disposableAfter < 0) {
    return "Décision déconseillée : le crédit mettrait le mois en négatif dès le premier mois.";
  }
  if (debtAfter > 0.35) {
    return "Décision risquée : le taux d'endettement passerait au-dessus du seuil de 35 %. Réduire la mensualité, augmenter l'apport ou attendre une fin de crédit.";
  }
  if (credit.totalInterest > credit.financedCapital * 0.15) {
    return "Le crédit reste possible, mais le coût des intérêts devient significatif. Comparez avec une durée plus courte ou un apport plus élevé.";
  }
  if (disposableAfter < 200) {
    return "Faisable mais fragile : conserver une marge de sécurité avant de signer.";
  }
  return `Faisable si vous pouvez absorber ${formatEur(credit.monthlyImpact)}/mois pendant ${credit.durationMonths} mois.`;
}

function buildOneTimeSuggestion(amount: number, disposableAfter: number): string {
  if (disposableAfter < 0) {
    return "Décision déconseillée : cet achat rendrait le mois négatif. Reporter ou réduire le montant.";
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
  const [creditInputMode, setCreditInputMode] = useState<CreditInputMode>("known_price");
  const [amount, setAmount] = useState<string>("350");
  const [downPayment, setDownPayment] = useState<string>("0");
  const [monthlyPayment, setMonthlyPayment] = useState<string>("80");
  const [durationMonths, setDurationMonths] = useState<string>("12");
  const [annualRate, setAnnualRate] = useState<string>("6,90");

  const simulation = useMemo<SimulationView | null>(() => {
    if (!result) return null;

    const parsedAmount = parseMoney(amount);
    const parsedDownPayment = parseMoney(downPayment);
    const parsedMonthlyPayment = parseMoney(monthlyPayment);
    const parsedDuration = parsePositiveInteger(durationMonths, 12);
    const parsedAnnualRate = parseRate(annualRate);

    let credit: CreditComputation | null = null;
    let title = `Achat ponctuel de ${formatEur(parsedAmount)}`;
    let monthlyImpact = 0;
    let upfrontImpact = parsedAmount;
    let consistencyWarning: string | null = null;

    if (mode === "credit") {
      if (creditInputMode === "known_price") {
        const financedCapital = Math.max(0, parsedAmount - parsedDownPayment);
        const computedMonthlyPayment = rounded(computeMonthlyPayment(financedCapital, parsedAnnualRate, parsedDuration));
        const totalPaid = rounded(computedMonthlyPayment * parsedDuration);
        const totalInterest = rounded(Math.max(0, totalPaid - financedCapital));

        monthlyImpact = computedMonthlyPayment;
        upfrontImpact = Math.min(parsedDownPayment, parsedAmount);
        title = `Crédit estimé de ${formatEur(computedMonthlyPayment)}/mois`;

        credit = {
          inputMode: creditInputMode,
          financedCapital: rounded(financedCapital),
          monthlyPayment: computedMonthlyPayment,
          durationMonths: parsedDuration,
          annualRate: parsedAnnualRate,
          totalPaid,
          totalInterest,
          upfrontImpact,
          monthlyImpact,
          consistencyWarning: null,
        };
      } else {
        const financedCapital = rounded(computeCapitalFromMonthly(parsedMonthlyPayment, parsedAnnualRate, parsedDuration));
        const totalPaid = rounded(parsedMonthlyPayment * parsedDuration);
        const totalInterest = rounded(Math.max(0, totalPaid - financedCapital));

        monthlyImpact = parsedMonthlyPayment;
        upfrontImpact = 0;
        title = `Crédit de ${formatEur(parsedMonthlyPayment)}/mois`;

        if (parsedAmount > 0) {
          const difference = Math.abs(parsedAmount - financedCapital);
          if (difference > Math.max(25, parsedAmount * 0.05)) {
            consistencyWarning = `Avec ${formatEur(parsedMonthlyPayment)}/mois pendant ${parsedDuration} mois à ${formatPctFromHundred(parsedAnnualRate)}, le capital finançable estimé est ${formatEur(financedCapital)}, pas ${formatEur(parsedAmount)}.`;
          }
        }

        credit = {
          inputMode: creditInputMode,
          financedCapital,
          monthlyPayment: parsedMonthlyPayment,
          durationMonths: parsedDuration,
          annualRate: parsedAnnualRate,
          totalPaid,
          totalInterest,
          upfrontImpact,
          monthlyImpact,
          consistencyWarning,
        };
      }
    } else {
      monthlyImpact = 0;
      upfrontImpact = parsedAmount;
    }

    const disposableDelta = -(upfrontImpact + monthlyImpact);
    const disposableAfter = rounded(result.realDisposableIncome + disposableDelta);
    const debtAfter = mode === "credit" && budget.totalIncomeMonthly > 0
      ? budget.debtRatio + monthlyImpact / budget.totalIncomeMonthly
      : budget.debtRatio;
    const scoreAfter = computeScoreAfter(result.healthScore, disposableDelta, result.realDisposableIncome, debtAfter);
    const scoreDelta = scoreAfter - result.healthScore;

    let tone: Tone = "success";
    if (disposableAfter < 0 || debtAfter > 0.35) {
      tone = "danger";
    } else if (disposableAfter < 200 || scoreDelta <= -10) {
      tone = "warning";
    }

    return {
      title,
      verdict: toneLabel(tone),
      tone,
      disposableAfter,
      disposableDelta,
      scoreAfter,
      scoreDelta,
      debtAfter,
      monthlyImpact,
      upfrontImpact,
      suggestion: credit === null
        ? buildOneTimeSuggestion(parsedAmount, disposableAfter)
        : buildCreditSuggestion(credit, disposableAfter, debtAfter),
      credit,
    };
  }, [amount, annualRate, budget.debtRatio, budget.totalIncomeMonthly, creditInputMode, downPayment, durationMonths, mode, monthlyPayment, result]);

  const currentToneColor = simulation === null ? "var(--text-muted)" : toneColor(simulation.tone);

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
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border p-5 shadow-card"
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
                  La simulation ne modifie aucune donnée. Elle mesure l'impact immédiat, le crédit, le score et l'endettement.
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

              {mode === "credit" && (
                <label className="rounded-2xl border p-3 md:col-span-2" style={{ borderColor: "var(--border)", background: "var(--bg-surface-2)" }}>
                  <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>Mode de calcul</span>
                  <select className="input-premium mt-2 w-full" value={creditInputMode} onChange={(event) => setCreditInputMode(event.target.value as CreditInputMode)}>
                    <option value="known_price">Je connais le prix total</option>
                    <option value="known_monthly">Je connais la mensualité</option>
                  </select>
                </label>
              )}

              {(mode === "one_time" || creditInputMode === "known_price") && (
                <label className="rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "var(--bg-surface-2)" }}>
                  <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>{mode === "one_time" ? "Montant" : "Prix total"}</span>
                  <input className="input-premium mt-2 w-full" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
                </label>
              )}

              {mode === "credit" && creditInputMode === "known_price" && (
                <label className="rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "var(--bg-surface-2)" }}>
                  <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>Apport payé maintenant</span>
                  <input className="input-premium mt-2 w-full" inputMode="decimal" value={downPayment} onChange={(event) => setDownPayment(event.target.value)} />
                </label>
              )}

              {mode === "credit" && creditInputMode === "known_monthly" && (
                <label className="rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "var(--bg-surface-2)" }}>
                  <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>Mensualité connue</span>
                  <input className="input-premium mt-2 w-full" inputMode="decimal" value={monthlyPayment} onChange={(event) => setMonthlyPayment(event.target.value)} />
                </label>
              )}

              {mode === "credit" && (
                <label className="rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "var(--bg-surface-2)" }}>
                  <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>Durée</span>
                  <input className="input-premium mt-2 w-full" inputMode="numeric" value={durationMonths} onChange={(event) => setDurationMonths(event.target.value)} />
                  <span className="mt-1 block text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>mois</span>
                </label>
              )}

              {mode === "credit" && (
                <label className="rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "var(--bg-surface-2)" }}>
                  <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>TAEG</span>
                  <input className="input-premium mt-2 w-full" inputMode="decimal" value={annualRate} onChange={(event) => setAnnualRate(event.target.value)} />
                  <span className="mt-1 block text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>% annuel</span>
                </label>
              )}
            </div>

            {simulation !== null && (
              <div className="mt-5 rounded-3xl border p-4" style={{ borderColor: "var(--border)", background: "var(--bg-surface-2)" }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-extrabold" style={{ color: "var(--text-primary)" }}>{simulation.title}</p>
                    <p className="mt-1 text-xs font-bold" style={{ color: currentToneColor }}>{simulation.verdict}</p>
                  </div>
                  <div className="rounded-2xl px-3 py-2 text-sm font-mono font-extrabold" style={{ background: "var(--bg-surface-3)", color: currentToneColor }}>
                    {formatEur(simulation.disposableAfter)} après impact
                  </div>
                </div>

                {simulation.credit !== null && (
                  <CreditSummary credit={simulation.credit} />
                )}

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <ImpactCell label="Reste à vivre" before={result?.realDisposableIncome ?? 0} after={simulation.disposableAfter} mode="currency" />
                  <ImpactCell label="Score SSF" before={result?.healthScore ?? 0} after={simulation.scoreAfter} mode="score" />
                  <ImpactCell label="Endettement" before={budget.debtRatio} after={simulation.debtAfter} mode="percent" />
                </div>

                <p className="mt-4 rounded-2xl border px-3 py-3 text-sm font-semibold" style={{ background: "var(--bg-surface)", color: "var(--text-secondary)", borderColor: "var(--border)" }}>
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

function CreditSummary({ credit }: { credit: CreditComputation }) {
  const modeLabel = credit.inputMode === "known_price" ? "Prix connu" : "Mensualité connue";
  return (
    <div className="mt-4 rounded-2xl border p-3" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
          Crédit · {modeLabel}
        </p>
        <p className="text-xs font-bold" style={{ color: "var(--text-secondary)" }}>
          TAEG {formatPctFromHundred(credit.annualRate)} · {credit.durationMonths} mois
        </p>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <MiniMetric label="Capital financé" value={formatEur(credit.financedCapital)} />
        <MiniMetric label="Mensualité" value={`${formatEur(credit.monthlyPayment)}/mois`} />
        <MiniMetric label="Total payé" value={formatEur(credit.totalPaid)} />
        <MiniMetric label="Intérêts estimés" value={formatEur(credit.totalInterest)} />
      </div>
      {credit.upfrontImpact > 0 && (
        <p className="mt-3 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
          Impact immédiat apport : {formatEur(credit.upfrontImpact)}. Impact mensuel crédit : {formatEur(credit.monthlyImpact)}.
        </p>
      )}
      {credit.consistencyWarning !== null && (
        <p className="mt-3 rounded-2xl border px-3 py-2 text-xs font-bold" style={{ color: "var(--fin-amber)", borderColor: "var(--border)", background: "var(--bg-surface-2)" }}>
          {credit.consistencyWarning}
        </p>
      )}
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border p-3" style={{ background: "var(--bg-surface-2)", borderColor: "var(--border)" }}>
      <p className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="mt-2 text-sm font-mono font-extrabold" style={{ color: "var(--text-primary)" }}>{value}</p>
    </div>
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
