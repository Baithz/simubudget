// =============================================================================
// Fichier  : src/components/Scenarios/ScenarioTimeline.tsx
// Auteur   : KREMER Regis
// Desc.    : Module scénarios complexes, stress tests et projections financières.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation du fichier Phase 2
//   2026-04-29 | KREMER Régis | Refonte Phase 8 - wrapper premium fluide
//   2026-05-02 | KREMER Régis | Correction lint ESLint 9
//   2026-05-03 | KREMER Régis | Phase 18 — scénarios complexes et stress tests
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx } from "clsx";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from "recharts";
import { useScenarioStore } from "@/store/scenarioStore";
import { useProjection } from "@/hooks/useProjection";
import { formatEur } from "@/utils/formatCurrency";
import type { ProjectionHorizon, ScenarioEvent, ScenarioResult, ScenarioSeverity, ScenarioType } from "@/types/scenarios";
import { SCENARIO_PRESETS, STRESS_TEST_PRESETS } from "@/types/scenarios";

const HORIZONS: { value: ProjectionHorizon; label: string }[] = [
  { value: 6, label: "6 mois" },
  { value: 12, label: "12 mois" },
  { value: 24, label: "24 mois" },
];

const QUICK_SCENARIOS: ScenarioType[] = [
  "job_loss",
  "baby",
  "inflation",
  "move",
  "vehicle_purchase",
  "salary_raise",
];

const ADVANCED_SCENARIOS: ScenarioType[] = [
  "separation",
  "part_time",
  "energy_shock",
  "childcare_start",
  "purchase",
  "loan_renegotiation",
  "retirement",
  "job_change",
];

function severityLabel(severity: ScenarioSeverity): string {
  switch (severity) {
    case "opportunity": return "Opportunité";
    case "danger": return "Stress fort";
    case "watch": return "À surveiller";
    case "neutral": return "Neutre";
  }
}

function severityStyle(severity: ScenarioSeverity): CSSProperties {
  switch (severity) {
    case "opportunity": return { color: "var(--fin-green)", background: "var(--fin-green-bg)" };
    case "danger": return { color: "var(--fin-red)", background: "var(--fin-red-bg)" };
    case "watch": return { color: "var(--fin-amber)", background: "var(--fin-amber-bg)" };
    case "neutral": return { color: "var(--text-muted)", background: "var(--bg-surface-2)" };
  }
}

function makeScenarioEvent(type: ScenarioType, monthOffset: number, overrides: Partial<ScenarioEvent> = {}): ScenarioEvent {
  const preset = SCENARIO_PRESETS[type];
  const defaults = preset.defaults;
  const event: ScenarioEvent = {
    id: crypto.randomUUID(),
    type,
    label: overrides.label ?? preset.label,
    monthOffset,
  };

  const merged: Partial<ScenarioEvent> = { ...defaults, ...overrides };
  if (merged.salaryDelta !== undefined) event.salaryDelta = merged.salaryDelta;
  if (merged.fixedCostsDelta !== undefined) event.fixedCostsDelta = merged.fixedCostsDelta;
  if (merged.oneTimeCost !== undefined) event.oneTimeCost = merged.oneTimeCost;
  if (merged.newRent !== undefined) event.newRent = merged.newRent;
  if (merged.durationMonths !== undefined) event.durationMonths = merged.durationMonths;
  if (merged.monthlyInflationRate !== undefined) event.monthlyInflationRate = merged.monthlyInflationRate;
  if (merged.foodDelta !== undefined) event.foodDelta = merged.foodDelta;
  if (merged.transportDelta !== undefined) event.transportDelta = merged.transportDelta;
  if (merged.explanation !== undefined) event.explanation = merged.explanation;
  event.severity = overrides.severity ?? preset.severity;
  return event;
}

function resultStatus(result: ScenarioResult | null): {
  title: string;
  detail: string;
  tone: "safe" | "watch" | "danger";
} {
  if (!result || result.projections.length === 0) {
    return {
      title: "Aucune projection active",
      detail: "Ajoutez un scénario pour visualiser son impact.",
      tone: "watch",
    };
  }
  if (result.breakpointMonth !== undefined) {
    return {
      title: `Point de rupture à M+${result.breakpointMonth}`,
      detail: "Le reste à vivre devient négatif dans la projection. Il faut corriger avant cet horizon.",
      tone: "danger",
    };
  }
  const lowest = result.lowestDisposableIncome ?? 0;
  if (lowest < 150) {
    return {
      title: "Projection fragile",
      detail: `Le mois le plus tendu descend à ${formatEur(lowest)}. Une marge de sécurité est nécessaire.`,
      tone: "watch",
    };
  }
  return {
    title: "Projection soutenable",
    detail: `Le mois le plus bas reste à ${formatEur(lowest)}. Le scénario semble absorbable.`,
    tone: "safe",
  };
}

function statusStyle(tone: "safe" | "watch" | "danger"): CSSProperties {
  if (tone === "safe") return { color: "var(--fin-green)", background: "var(--fin-green-bg)", borderColor: "var(--fin-green)" };
  if (tone === "danger") return { color: "var(--fin-red)", background: "var(--fin-red-bg)", borderColor: "var(--fin-red)" };
  return { color: "var(--fin-amber)", background: "var(--fin-amber-bg)", borderColor: "var(--fin-amber)" };
}

function EventDelta({ event }: { event: ScenarioEvent }) {
  const items: string[] = [];
  if (event.salaryDelta !== undefined && event.salaryDelta !== 0) items.push(`Revenus ${event.salaryDelta > 0 ? "+" : ""}${formatEur(event.salaryDelta)}/mois`);
  if (event.fixedCostsDelta !== undefined && event.fixedCostsDelta !== 0) items.push(`Charges ${event.fixedCostsDelta > 0 ? "+" : ""}${formatEur(event.fixedCostsDelta)}/mois`);
  if (event.foodDelta !== undefined && event.foodDelta !== 0) items.push(`Alimentation ${event.foodDelta > 0 ? "+" : ""}${formatEur(event.foodDelta)}/mois`);
  if (event.transportDelta !== undefined && event.transportDelta !== 0) items.push(`Transport ${event.transportDelta > 0 ? "+" : ""}${formatEur(event.transportDelta)}/mois`);
  if (event.oneTimeCost !== undefined && event.oneTimeCost !== 0) items.push(`Ponctuel -${formatEur(event.oneTimeCost)}`);
  if (event.newRent !== undefined && event.newRent > 0) items.push(`Loyer cible ${formatEur(event.newRent)}`);
  if (event.monthlyInflationRate !== undefined) items.push(`Inflation +${(event.monthlyInflationRate * 100).toFixed(1)}%/mois`);
  if (event.durationMonths !== undefined) items.push(`Durée ${event.durationMonths} mois`);

  if (items.length === 0) {
    return <span className="text-xs font-medium text-ink-muted">Aucun impact chiffré</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span key={item} className="rounded-full px-2 py-1 text-[10px] font-bold" style={{ background: "var(--bg-surface-2)", color: "var(--text-muted)" }}>
          {item}
        </span>
      ))}
    </div>
  );
}

function ScenarioButton({ type, onAdd }: { type: ScenarioType; onAdd: (type: ScenarioType) => void }) {
  const preset = SCENARIO_PRESETS[type];
  return (
    <button
      type="button"
      onClick={() => onAdd(type)}
      className="group rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-card"
      style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold text-ink-primary">{preset.label}</p>
          <p className="mt-1 text-xs font-medium leading-relaxed text-ink-muted">{preset.description}</p>
        </div>
        <span className="shrink-0 rounded-full px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider" style={severityStyle(preset.severity)}>
          {severityLabel(preset.severity)}
        </span>
      </div>
    </button>
  );
}

function ProjectionSummary() {
  const result = useScenarioStore((s) => s.result);
  const status = resultStatus(result);

  return (
    <div className="grid gap-3 md:grid-cols-4">
      <div className="card rounded-2xl border p-4 md:col-span-2" style={statusStyle(status.tone)}>
        <p className="text-xs font-extrabold uppercase tracking-widest">Diagnostic</p>
        <h2 className="mt-1 text-lg font-extrabold">{status.title}</h2>
        <p className="mt-1 text-sm font-semibold opacity-90">{status.detail}</p>
      </div>
      <div className="card rounded-2xl border p-4" style={{ borderColor: "var(--border)" }}>
        <p className="text-xs font-extrabold uppercase tracking-widest text-ink-muted">Reste à vivre final</p>
        <p className="mt-2 text-2xl font-black text-ink-primary">{formatEur(result?.finalDisposableIncome ?? 0)}</p>
      </div>
      <div className="card rounded-2xl border p-4" style={{ borderColor: "var(--border)" }}>
        <p className="text-xs font-extrabold uppercase tracking-widest text-ink-muted">Score final</p>
        <p className="mt-2 text-2xl font-black text-ink-primary">{result?.finalHealthScore ?? 0}/100</p>
      </div>
    </div>
  );
}

function ProjectionChart() {
  const result = useScenarioStore((s) => s.result);
  const loading = useScenarioStore((s) => s.loading);
  const points = result?.projections ?? [];

  return (
    <div className="card rounded-2xl p-6 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-extrabold text-ink-primary">Projection financière</h3>
          <p className="mt-1 text-xs font-semibold text-ink-muted">Reste à vivre et points de rupture sur l'horizon sélectionné.</p>
        </div>
        {result?.isStressTest === true && (
          <span className="rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider" style={{ color: "var(--fin-red)", background: "var(--fin-red-bg)" }}>
            Stress test
          </span>
        )}
      </div>

      {loading ? (
        <div className="mt-6 flex h-64 items-center justify-center rounded-2xl text-sm font-semibold text-ink-muted" style={{ background: "var(--bg-surface-2)" }}>
          Calcul de la projection...
        </div>
      ) : points.length > 0 ? (
        <div className="mt-6 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 16, bottom: 8, left: 12 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
              <Tooltip
                formatter={(value: number, name: string) => [name === "healthScore" ? `${value}/100` : formatEur(value), name === "healthScore" ? "Score" : "Reste à vivre"]}
                contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, fontSize: 12 }}
              />
              <ReferenceLine y={0} stroke="var(--fin-red)" strokeDasharray="4 4" strokeWidth={1.5} />
              {points.filter((point) => point.hasEvent).map((point) => (
                <ReferenceLine key={`${point.month}-${point.label}`} x={point.label} stroke="var(--brand-2)" strokeDasharray="3 3" />
              ))}
              <Line type="monotone" dataKey="disposableIncome" stroke="var(--brand-2)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="healthScore" stroke="var(--fin-green)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed p-8 text-center" style={{ borderColor: "var(--border)", background: "var(--bg-surface-2)" }}>
          <p className="text-sm font-extrabold text-ink-primary">Ajoutez un scénario pour démarrer</p>
          <p className="mt-1 text-xs font-semibold text-ink-muted">La projection s'actualise automatiquement.</p>
        </div>
      )}
    </div>
  );
}

function ActiveEvents() {
  const events = useScenarioStore((s) => s.events);
  const removeEvent = useScenarioStore((s) => s.removeEvent);
  const clearEvents = useScenarioStore((s) => s.clearEvents);

  if (events.length === 0) return null;

  return (
    <div className="card rounded-2xl p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-extrabold text-ink-primary">Scénarios actifs</h3>
          <p className="mt-1 text-xs font-semibold text-ink-muted">Chaque ligne est intégrée à la projection.</p>
        </div>
        <button type="button" onClick={clearEvents} className="btn-mini">Tout effacer</button>
      </div>

      <div className="mt-4 space-y-2">
        <AnimatePresence>
          {events.map((event) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              className="rounded-2xl border p-4"
              style={{ borderColor: "var(--border)", background: "var(--bg-surface-2)" }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider" style={severityStyle(event.severity ?? "neutral")}>M+{event.monthOffset}</span>
                    <p className="text-sm font-extrabold text-ink-primary">{event.label}</p>
                  </div>
                  {event.explanation !== undefined && (
                    <p className="mt-2 text-xs font-semibold leading-relaxed text-ink-muted">{event.explanation}</p>
                  )}
                  <div className="mt-3"><EventDelta event={event} /></div>
                </div>
                <button type="button" onClick={() => removeEvent(event.id)} className="btn-mini" aria-label={`Supprimer ${event.label}`}>Supprimer</button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StressTests({ onApply }: { onApply: (id: string) => void }) {
  return (
    <div className="card rounded-2xl p-5 shadow-card">
      <div>
        <h3 className="text-sm font-extrabold text-ink-primary">Stress tests prêts à l'emploi</h3>
        <p className="mt-1 text-xs font-semibold text-ink-muted">Combine plusieurs événements pour tester les mois difficiles.</p>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {STRESS_TEST_PRESETS.map((test) => (
          <button
            type="button"
            key={test.id}
            onClick={() => onApply(test.id)}
            className="rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-card"
            style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
          >
            <p className="text-sm font-extrabold text-ink-primary">{test.label}</p>
            <p className="mt-1 text-xs font-semibold leading-relaxed text-ink-muted">{test.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ScenarioTimeline() {
  const { events, horizon, result, setHorizon, addEvent, clearEvents } = useScenarioStore();
  const { compute } = useProjection();
  const [startMonth, setStartMonth] = useState(1);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => { compute(); }, [events, horizon, compute]);

  const status = useMemo(() => resultStatus(result), [result]);

  function addScenario(type: ScenarioType): void {
    addEvent(makeScenarioEvent(type, startMonth));
  }

  function applyStressTest(id: string): void {
    const test = STRESS_TEST_PRESETS.find((item) => item.id === id);
    if (!test) return;
    clearEvents();
    for (const event of test.events) {
      addEvent(makeScenarioEvent(event.type, event.monthOffset, event));
    }
  }

  return (
    <div className="page-shell space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-ink-muted">Simulation avancée</p>
          <h1 className="mt-2 text-3xl font-black text-ink-primary">Scénarios complexes</h1>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-ink-muted">
            Testez les événements importants avant qu'ils arrivent : perte d'emploi, naissance, inflation, déménagement ou combinaison de plusieurs chocs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-xl p-1" style={{ background: "var(--bg-surface-2)" }}>
            {HORIZONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setHorizon(value)}
                className={clsx("rounded-lg px-3 py-1.5 text-xs font-extrabold transition-all", horizon === value ? "card text-ink-primary shadow-sm" : "text-ink-muted hover:text-ink-secondary")}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-extrabold" style={{ background: "var(--bg-surface-2)", color: "var(--text-muted)" }}>
            Démarrage M+
            <input
              type="number"
              min={0}
              max={24}
              value={startMonth}
              onChange={(event) => setStartMonth(Math.max(0, Math.min(24, Number(event.target.value))))}
              className="w-14 rounded-lg border px-2 py-1 text-center font-black text-ink-primary"
              style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
            />
          </label>
        </div>
      </div>

      <ProjectionSummary />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <ProjectionChart />
          <ActiveEvents />
          <StressTests onApply={applyStressTest} />
        </div>

        <div className="space-y-6">
          <div className="card rounded-2xl p-5 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-ink-primary">Ajouter un scénario</h3>
                <p className="mt-1 text-xs font-semibold text-ink-muted">Choisissez un événement, puis ajustez l'horizon si besoin.</p>
              </div>
              <span className="rounded-full px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider" style={statusStyle(status.tone)}>{status.tone === "safe" ? "Stable" : status.tone === "danger" ? "Risque" : "Vigilance"}</span>
            </div>

            <div className="mt-4 grid gap-3">
              {QUICK_SCENARIOS.map((type) => (
                <ScenarioButton key={type} type={type} onAdd={addScenario} />
              ))}
            </div>

            <button type="button" onClick={() => setShowAdvanced((value) => !value)} className="mt-4 w-full rounded-2xl border px-4 py-3 text-sm font-extrabold transition-colors hover:bg-[var(--bg-surface-2)]" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
              {showAdvanced ? "Masquer les scénarios avancés" : "Afficher plus de scénarios"}
            </button>

            {showAdvanced && (
              <div className="mt-3 grid gap-3">
                {ADVANCED_SCENARIOS.map((type) => (
                  <ScenarioButton key={type} type={type} onAdd={addScenario} />
                ))}
              </div>
            )}
          </div>

          <div className="card rounded-2xl p-5 shadow-card">
            <h3 className="text-sm font-extrabold text-ink-primary">Lecture rapide</h3>
            <div className="mt-4 space-y-3 text-sm font-semibold text-ink-muted">
              <p>Le graphique bleu suit le reste à vivre. S'il passe sous zéro, le scénario n'est pas soutenable sans action.</p>
              <p>Le graphique vert suit le score. Une baisse forte signale un risque même si le solde reste positif.</p>
              <p>Les stress tests combinent plusieurs événements pour mesurer la résistance réelle du budget.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
