// =============================================================================
// Fichier  : src/components/Scenarios/ScenarioTimeline.tsx
// Auteur   : KREMER Regis
// Desc.    : Module scénarios - timeline d'événements + courbe de projection
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation du fichier Phase 2
//   2026-04-29 | KREMER Régis | Refonte Phase 8 - wrapper premium fluide
//   2026-05-02 | KREMER Régis | Correction lint ESLint 9 — variables inutilisées et règles React adaptées
// =============================================================================

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx } from "clsx";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from "recharts";
import { useScenarioStore } from "@/store/scenarioStore";
import { useProjection }    from "@/hooks/useProjection";
import { formatEur }        from "@/utils/formatCurrency";
import type { ScenarioType, ProjectionHorizon } from "@/types/scenarios";
import { SCENARIO_PRESETS } from "@/types/scenarios";

const HORIZONS: { value: ProjectionHorizon; label: string }[] = [
  { value: 6,  label: "6 mois"  },
  { value: 12, label: "12 mois" },
  { value: 24, label: "24 mois" },
];

export function ScenarioTimeline() {
  const { events, horizon, result, loading, removeEvent, clearEvents, setHorizon } = useScenarioStore();
  const { compute } = useProjection();
  const [showPicker, setShowPicker] = useState(false);

  // Recalculer a chaque changement
  useEffect(() => { compute(); }, [events, horizon]);

  const points = result?.projections ?? [];
  const hasBreakpoint = result?.breakpointMonth !== undefined;

  return (
    <div className="page-shell space-y-6">

      {/* En-tete */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-primary">
            Scénarios & Projections
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Simulez des événements de vie et visualisez leur impact financier.
          </p>
        </div>
        <div className="flex gap-2">
          {/* Selecteur horizon */}
          <div className="flex gap-1 [background:var(--bg-surface-2)] rounded-xl p-1">
            {HORIZONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setHorizon(value)}
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  horizon === value
                    ? "card text-ink-primary shadow-sm"
                    : "text-ink-muted hover:text-ink-secondary"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {events.length > 0 && (
            <button
              onClick={clearEvents}
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-ink-muted hover:[background:var(--bg-surface-2)] dark:hover:[background:var(--bg-surface)] transition-colors"
            >
              Tout effacer
            </button>
          )}
        </div>
      </div>

      {/* Alerte point de rupture */}
      {hasBreakpoint && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border rounded-2xl p-4 flex items-start gap-3"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd"/>
          </svg>
          <div>
            <p className="font-semibold font-semibold text-sm">
              Point de rupture détecté au mois {result!.breakpointMonth}
            </p>
            <p className="text-xs font-medium mt-0.5">
              Votre reste à vivre deviendrait négatif — votre épargne serait mobilisée.
            </p>
          </div>
        </motion.div>
      )}

      {/* Graphe de projection */}
      <div className="card rounded-2xl p-6 shadow-card">
        <h3 className="text-sm font-semibold text-ink-secondary mb-4">
          Évolution du reste à vivre
        </h3>
        {loading ? (
          <div className="h-48 flex items-center justify-center text-ink-muted animate-pulse text-sm">
            Calcul...
          </div>
        ) : points.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={points} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(v: number, name: string) => [
                  formatEur(v),
                  name === "disposableIncome" ? "Reste a vivre" : "Score SSF",
                ]}
                labelStyle={{ fontSize: 11, color: "var(--text-muted)" }}
                contentStyle={{
                  background: "var(--color-surface, white)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              {/* Ligne zero */}
              <ReferenceLine y={0} stroke="var(--fin-red)" strokeDasharray="4 4" strokeWidth={1.5} />
              {/* Événements */}
              {points.filter((p) => p.hasEvent).map((p) => (
                <ReferenceLine
                  key={p.month}
                  x={p.label}
                  stroke="var(--brand-2)"
                  strokeDasharray="3 3"
                  label={{ value: p.eventLabel?.slice(0, 8) ?? "", fontSize: 9, fill: "var(--brand-2)" }}
                />
              ))}
              <Line
                type="monotone"
                dataKey="disposableIncome"
                stroke="var(--brand-2)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                name="disposableIncome"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex items-center justify-center text-ink-muted text-sm">
            Ajoutez des événements pour voir la projection
          </div>
        )}
      </div>

      {/* Graphe SSF */}
      {points.length > 0 && (
        <div className="card rounded-2xl p-6 shadow-card">
          <h3 className="text-sm font-semibold text-ink-secondary mb-4">
            Évolution du Score de Santé Financière
          </h3>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={points} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(v: number) => [`${v}/100`, "SSF"]}
                contentStyle={{ borderRadius: 12, fontSize: 12, background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />
              <ReferenceLine y={50} stroke="var(--fin-amber)" strokeDasharray="4 4" strokeWidth={1} />
              <ReferenceLine y={75} stroke="var(--fin-green)" strokeDasharray="4 4" strokeWidth={1} />
              <Line
                type="monotone"
                dataKey="healthScore"
                stroke="var(--fin-green)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Événements actifs */}
      {events.length > 0 && (
        <div className="card rounded-2xl p-5 shadow-card">
          <h3 className="text-sm font-semibold text-ink-secondary mb-3">
            Événements simulés ({events.length})
          </h3>
          <div className="space-y-2">
            <AnimatePresence>
              {events.map((evt) => (
                <motion.div
                  key={evt.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  className="flex items-center justify-between py-2 px-3 rounded-xl [background:var(--bg-surface-2)] /50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-ink-muted w-14">
                      M+{evt.monthOffset}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-ink-secondary">
                        {evt.label}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {evt.salaryDelta !== undefined && evt.salaryDelta !== 0 && (
                          <span className={evt.salaryDelta > 0 ? "text-zone-green" : "text-zone-orange"}>
                            {evt.salaryDelta > 0 ? "+" : ""}{formatEur(evt.salaryDelta)}/mois
                          </span>
                        )}
                        {evt.fixedCostsDelta !== undefined && evt.fixedCostsDelta !== 0 && (
                          <span className="ml-2 text-ink-muted">
                            charges {evt.fixedCostsDelta > 0 ? "+" : ""}{formatEur(evt.fixedCostsDelta)}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeEvent(evt.id)}
                    className="p-1.5 rounded-lg text-ink-muted hover:text-[var(--fin-red)] hover:bg-[var(--fin-red-bg)] transition-colors"
                  >
                    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                      <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z"/>
                    </svg>
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Bouton ajouter événement */}
      <div className="relative">
        <button
          onClick={() => setShowPicker((v) => !v)}
          className="w-full py-3 rounded-2xl border-2 border-dashed [border-color:var(--border)] text-sm font-medium text-ink-muted hover:border-brand-400 hover:text-brand-500 transition-all"
        >
          + Ajouter un événement de vie
        </button>

        <AnimatePresence>
          {showPicker && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute bottom-full mb-2 left-0 right-0 card rounded-2xl shadow-xl border [border-color:var(--border)] p-4 z-10"
            >
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-widest mb-3">
                Choisir un scénario
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(SCENARIO_PRESETS) as [ScenarioType, typeof SCENARIO_PRESETS[ScenarioType]][]).map(
                  ([type, preset]) => (
                    <EventPickerButton
                      key={type}
                      type={type}
                      preset={preset}
                      onSelect={(monthOffset) => {
                        useScenarioStore.getState().addEvent({
                          id:           crypto.randomUUID(),
                          type,
                          label:        preset.label,
                          monthOffset,
                          ...preset.defaults,
                        });
                        setShowPicker(false);
                      }}
                    />
                  )
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Bouton de selection d'événement ────────────────────────────────────────
function EventPickerButton({
  type: _type, preset, onSelect,
}: {
  type: ScenarioType;
  preset: typeof SCENARIO_PRESETS[ScenarioType];
  onSelect: (monthOffset: number) => void;
}) {
  const [monthOffset, setMonthOffset] = useState(3);

  return (
    <div className="flex flex-col gap-1.5 p-3 rounded-xl [background:var(--bg-surface-2)] /50 hover:bg-[var(--bg-surface-2)] transition-colors">
      <p className="text-xs font-semibold text-ink-secondary leading-tight">
        {preset.label}
      </p>
      <div className="flex items-center gap-1">
        <span className="text-xs text-ink-muted">M+</span>
        <input
          type="number"
          min={0}
          max={23}
          value={monthOffset}
          onChange={(e) => setMonthOffset(parseInt(e.target.value) || 0)}
          className="w-10 text-xs px-1 py-0.5 rounded border [border-color:var(--border)] card text-center"
        />
      </div>
      <button
        onClick={() => onSelect(monthOffset)}
        className="text-xs font-medium text-brand-500 hover:text-brand-600 text-left"
      >
        Ajouter
      </button>
    </div>
  );
}
