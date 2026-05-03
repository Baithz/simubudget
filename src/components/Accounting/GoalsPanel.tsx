// =============================================================================
// Fichier  : src/components/Accounting/GoalsPanel.tsx
// Auteur   : KREMER Regis
// Desc.    : Objectifs de vie avec projection réelle, capacité mensuelle,
//            date cible, actions et accélération.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-27 | KREMER Regis | Creation Phase 6
//   2026-04-28 | KREMER Regis | Correction TS strict - GoalForm initialGoal IIFE guard strict
//   2026-04-28 | KREMER Regis | Phase 7 - actions cliquables, analyse depenses non-essentielles
//   2026-05-01 | KREMER Régis | Patch 8.1 — stabilité interactions objectifs
//   2026-05-02 | KREMER Régis | Correction lint ESLint 9 — variables inutilisées et règles React adaptées
//   2026-05-03 | KREMER Régis | Objectifs de vie + projection réelle
// =============================================================================

import { useMemo, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx } from "clsx";
import { useProfileStore } from "@/store/profileStore";
import { useAccountingStore } from "@/store/accountingStore";
import { formatEur } from "@/utils/formatCurrency";
import type { SavingsGoal } from "@/types/profile";
import {
  buildLifeGoalProjection,
  goalKindLabel,
  goalRiskTone,
  type LifeGoalProjection,
} from "@/services/lifeGoalProjection";

const GOAL_COLORS = [
  "var(--brand-2)",
  "#8b5cf6",
  "var(--fin-green)",
  "var(--fin-amber)",
  "#ec4899",
  "#f59e0b",
  "#06b6d4",
  "#84cc16",
];

const GOAL_PRESETS = [
  { label: "Apport immobilier",     icon: "🏠", amount: 30000, color: "var(--brand-2)", months: 36 },
  { label: "Épargne de précaution", icon: "🛡️", amount: 5000,  color: "var(--fin-green)", months: 18 },
  { label: "Voiture",               icon: "🚗", amount: 10000, color: "#8b5cf6", months: 30 },
  { label: "Vacances",              icon: "✈️", amount: 2000,  color: "var(--fin-amber)", months: 12 },
  { label: "Travaux",               icon: "🔨", amount: 15000, color: "#f59e0b", months: 36 },
  { label: "Remboursement crédit",  icon: "🏦", amount: 6000,  color: "#06b6d4", months: 24 },
];

function addMonthsIso(months: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function monthCountLabel(months: number | null): string {
  if (months === null) return "Horizon trop long";
  if (months === 0) return "Déjà atteint";
  if (months < 12) return `${months} mois`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (rest === 0) return years === 1 ? "1 an" : `${years} ans`;
  return `${years} an${years > 1 ? "s" : ""} et ${rest} mois`;
}

function riskClass(tone: ReturnType<typeof goalRiskTone>): string {
  switch (tone) {
    case "green": return "text-fin-green";
    case "amber": return "text-fin-amber";
    case "red": return "text-fin-red";
    case "blue": return "text-brand-mid";
  }
}

function riskStyle(tone: ReturnType<typeof goalRiskTone>): { background: string; border: string } {
  switch (tone) {
    case "green": return { background: "var(--fin-green-dim)", border: "1px solid rgba(16,217,168,0.22)" };
    case "amber": return { background: "var(--fin-amber-dim)", border: "1px solid rgba(245,158,11,0.24)" };
    case "red": return { background: "var(--fin-red-dim)", border: "1px solid rgba(244,63,94,0.22)" };
    case "blue": return { background: "rgba(14,165,233,0.08)", border: "1px solid var(--border-brand)" };
  }
}

function dateLabel(value?: string): string {
  if (!value) return "Aucune date cible";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Date cible invalide";
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function buildGoalPayload(params: {
  label: string;
  targetAmount: number;
  currentAmount: number;
  monthlyContribution: number;
  targetDate: string;
  color: string;
}): Omit<SavingsGoal, "id"> {
  const base = {
    label: params.label.trim(),
    targetAmount: Math.max(0, params.targetAmount),
    currentAmount: Math.max(0, params.currentAmount),
    monthlyContribution: Math.max(0, params.monthlyContribution),
    color: params.color,
  };

  if (params.targetDate.trim().length > 0) {
    return { ...base, targetDate: params.targetDate };
  }

  return base;
}

export function GoalsPanel() {
  const { profile, addGoal, updateGoal, removeGoal } = useProfileStore();
  const accounting = useAccountingStore();
  const budget = accounting.getBudget();
  const expenses = accounting.expenses;
  const goals = profile.savingsGoals ?? [];

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);

  const projections = useMemo(() => {
    const map = new Map<string, LifeGoalProjection>();
    for (const goal of goals) {
      map.set(goal.id, buildLifeGoalProjection(goal, budget, expenses));
    }
    return map;
  }, [budget, expenses, goals]);

  const totalAllocated = goals.reduce((sum, goal) => sum + goal.monthlyContribution, 0);
  const realCapacity = Math.max(0, budget.balanceMonthly);
  const availableAfterGoals = realCapacity - totalAllocated;
  const editingGoal = editId ? goals.find((goal) => goal.id === editId) : undefined;

  return (
    <div className="space-y-5">
      <section className="card p-5 overflow-hidden relative">
        <div
          className="absolute inset-x-0 top-0 h-1"
          style={{ background: "linear-gradient(90deg, var(--brand-1), var(--brand-2), var(--fin-green))" }}
        />
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-ink-muted">Objectifs de vie</p>
            <h2 className="mt-1 text-xl font-black text-ink-primary">Projeter ce que tu veux atteindre</h2>
            <p className="mt-1 text-sm text-ink-secondary max-w-2xl">
              La projection utilise le reste à vivre réel, les dépenses importées, les crédits qui se terminent et les économies possibles.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setEditId(null);
              setShowForm(true);
              setExpandedGoalId(null);
            }}
            className="btn-brand text-sm self-start xl:self-auto"
          >
            Nouvel objectif
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
          <MetricCard label="Capacité réelle" value={`${formatEur(realCapacity)}/mois`} tone={realCapacity > 0 ? "green" : "red"} />
          <MetricCard label="Alloué aux objectifs" value={`${formatEur(totalAllocated)}/mois`} tone="blue" />
          <MetricCard
            label="Disponible après objectifs"
            value={`${formatEur(availableAfterGoals)}/mois`}
            tone={availableAfterGoals >= 0 ? "green" : "amber"}
          />
        </div>
      </section>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <GoalForm
              initialGoal={editingGoal}
              realCapacity={realCapacity}
              onSave={(data) => {
                if (editId) {
                  updateGoal(editId, data);
                } else {
                  addGoal(data);
                }
                setShowForm(false);
                setEditId(null);
              }}
              onCancel={() => {
                setShowForm(false);
                setEditId(null);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {goals.length === 0 && !showForm && (
        <PresetGrid
          realCapacity={realCapacity}
          onCreate={(preset) => {
            const monthlyContribution = realCapacity > 0
              ? Math.max(25, Math.min(Math.round(realCapacity * 0.35), Math.ceil(preset.amount / preset.months)))
              : 0;

            addGoal({
              label: preset.label,
              targetAmount: preset.amount,
              currentAmount: 0,
              monthlyContribution,
              targetDate: addMonthsIso(preset.months),
              color: preset.color,
            });
          }}
        />
      )}

      <div className="space-y-4">
        {goals.map((goal) => {
          const projection = projections.get(goal.id);
          if (!projection) return null;
          const remaining = projection.remainingAmount;
          const pct = goal.targetAmount > 0 ? Math.min(1, goal.currentAmount / goal.targetAmount) : 0;
          const isExpanded = expandedGoalId === goal.id;
          const tone = goalRiskTone(projection.risk);

          return (
            <motion.article
              key={goal.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.16 }}
              className="card overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setExpandedGoalId(isExpanded ? null : goal.id)}
                className="w-full text-left px-5 py-4"
              >
                <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: goal.color }} />
                      <h3 className="text-base font-black text-ink-primary truncate">{goal.label}</h3>
                      <span className="badge-base text-2xs" style={riskStyle(tone)}>
                        {goalKindLabel(projection.goalKind)}
                      </span>
                      <span className={clsx("badge-base text-2xs", riskClass(tone))} style={riskStyle(tone)}>
                        {projection.headline}
                      </span>
                    </div>

                    <div className="progress-track">
                      <motion.div
                        className="progress-fill"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct * 100}%` }}
                        transition={{ duration: 0.7, ease: "easeOut" }}
                        style={{ background: `linear-gradient(90deg, ${goal.color}88, ${goal.color})` }}
                      />
                    </div>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
                      <span>{Math.round(pct * 100)} % atteint</span>
                      <span>{formatEur(remaining)} restant</span>
                      <span>Date cible : {dateLabel(goal.targetDate)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-2 gap-2 xl:w-[360px]">
                    <MiniMetric label="Actuel" value={`${formatEur(goal.currentAmount)} / ${formatEur(goal.targetAmount)}`} />
                    <MiniMetric label="Rythme réel" value={`${formatEur(projection.realisticMonthlyContribution)}/mois`} />
                    <MiniMetric label="Projection" value={monthCountLabel(projection.projectedMonths)} />
                    <MiniMetric label="Date estimée" value={projection.projectedDateLabel ?? "Non atteignable"} />
                  </div>
                </div>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 space-y-4" style={{ borderTop: "1px solid var(--border)" }}>
                      <ProjectionDetails projection={projection} />

                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <TargetDateCard projection={projection} />
                        <CreditReliefCard projection={projection} />
                      </div>

                      <ActionsCard projection={projection} />

                      <div className="flex flex-col sm:flex-row gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditId(goal.id);
                            setShowForm(true);
                            setExpandedGoalId(null);
                          }}
                          className="btn-secondary flex-1 text-xs"
                        >
                          Modifier l’objectif
                        </button>
                        <button
                          type="button"
                          onClick={() => removeGoal(goal.id)}
                          className="px-4 py-2.5 text-xs font-bold rounded-lg transition-all"
                          style={{
                            background: "var(--fin-red-dim)",
                            color: "var(--fin-red)",
                            border: "1px solid rgba(244,63,94,0.22)",
                          }}
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.article>
          );
        })}
      </div>
    </div>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: "green" | "amber" | "red" | "blue" }) {
  const colorClass = tone === "green"
    ? "text-fin-green"
    : tone === "amber"
      ? "text-fin-amber"
      : tone === "red"
        ? "text-fin-red"
        : "text-brand-mid";

  return (
    <div className="card-alt rounded-xl p-4">
      <p className="text-2xs font-bold uppercase tracking-widest text-ink-muted">{label}</p>
      <p className={clsx("mt-1 font-mono text-lg font-black", colorClass)}>{value}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">{label}</p>
      <p className="mt-1 text-xs font-bold text-ink-primary leading-snug">{value}</p>
    </div>
  );
}

function PresetGrid({
  realCapacity,
  onCreate,
}: {
  realCapacity: number;
  onCreate: (preset: (typeof GOAL_PRESETS)[number]) => void;
}) {
  return (
    <section className="card p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-black text-ink-primary">Démarrer avec un objectif type</h3>
          <p className="text-xs text-ink-muted mt-1">
            Contribution proposée selon ta capacité réelle actuelle : {formatEur(Math.max(0, realCapacity * 0.35))}/mois environ.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        {GOAL_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => onCreate(preset)}
            className="card-alt p-4 text-left hover:border-brand-mid transition-all group rounded-xl"
          >
            <span className="text-2xl block mb-2">{preset.icon}</span>
            <p className="text-sm font-bold text-ink-primary">{preset.label}</p>
            <p className="text-xs text-ink-muted mt-1">{formatEur(preset.amount)} · cible {monthCountLabel(preset.months)}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

function ProjectionDetails({ projection }: { projection: LifeGoalProjection }) {
  const tone = goalRiskTone(projection.risk);

  return (
    <div className="pt-4 rounded-xl p-4" style={riskStyle(tone)}>
      <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
        <div>
          <p className={clsx("text-sm font-black", riskClass(tone))}>{projection.headline}</p>
          <p className="mt-1 text-sm text-ink-secondary">{projection.explanation}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 xl:min-w-[320px]">
          <MiniMetric label="Manque" value={formatEur(projection.remainingAmount)} />
          <MiniMetric label="Capacité réelle" value={`${formatEur(projection.realMonthlyCapacity)}/mois`} />
          <MiniMetric label="Optimisé" value={`${formatEur(projection.optimizedMonthlyContribution)}/mois`} />
          <MiniMetric label="Gain possible" value={formatEur(Math.max(0, projection.optimizedMonthlyContribution - projection.realisticMonthlyContribution))} />
        </div>
      </div>
    </div>
  );
}

function TargetDateCard({ projection }: { projection: LifeGoalProjection }) {
  if (projection.targetMonths === null || projection.requiredMonthlyForTarget === null) {
    return (
      <div className="card-alt rounded-xl p-4">
        <p className="text-xs font-black text-ink-primary">Projection sans date cible</p>
        <p className="mt-1 text-sm text-ink-secondary">
          Ajoute une date cible pour savoir combien il faudrait épargner chaque mois.
        </p>
      </div>
    );
  }

  const gap = projection.monthlyGapForTarget ?? 0;

  return (
    <div className="card-alt rounded-xl p-4">
      <p className="text-xs font-black text-ink-primary">Date cible</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <MiniMetric label="Temps restant" value={monthCountLabel(projection.targetMonths)} />
        <MiniMetric label="Requis" value={`${formatEur(projection.requiredMonthlyForTarget)}/mois`} />
      </div>
      <p className={clsx("mt-3 text-sm", gap > 0 ? "text-fin-amber" : "text-fin-green")}>
        {gap > 0
          ? `Il manque environ ${formatEur(gap)}/mois pour tenir cette date.`
          : "La contribution réaliste actuelle permet de tenir la date cible."
        }
      </p>
    </div>
  );
}

function CreditReliefCard({ projection }: { projection: LifeGoalProjection }) {
  return (
    <div className="card-alt rounded-xl p-4">
      <p className="text-xs font-black text-ink-primary">Projection optimisée</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <MiniMetric label="Durée optimisée" value={monthCountLabel(projection.optimizedMonths)} />
        <MiniMetric label="Date optimisée" value={projection.optimizedDateLabel ?? "Non atteignable"} />
      </div>
      <p className="mt-3 text-sm text-ink-secondary">
        {projection.firstCreditReliefMonth !== null && projection.firstCreditReliefAmount > 0
          ? `Un crédit libère ${formatEur(projection.firstCreditReliefAmount)}/mois dans ${projection.firstCreditReliefMonth} mois.`
          : "Aucune fin de crédit proche n’est actuellement détectée pour accélérer automatiquement cet objectif."
        }
      </p>
    </div>
  );
}

function ActionsCard({ projection }: { projection: LifeGoalProjection }) {
  return (
    <div className="card-alt rounded-xl p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <div>
          <p className="text-xs font-black text-ink-primary">Actions proposées</p>
          <p className="text-xs text-ink-muted mt-0.5">Maximum 5 pistes, triées par impact mensuel.</p>
        </div>
        <span className="badge-base badge-green text-2xs">
          + {formatEur(projection.actions.reduce((sum, action) => sum + action.monthlyGain, 0))}/mois
        </span>
      </div>

      {projection.actions.length > 0 ? (
        <div className="space-y-2">
          {projection.actions.map((action) => (
            <div
              key={action.id}
              className="flex items-start justify-between gap-3 rounded-xl p-3"
              style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border)" }}
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink-primary">{action.label}</p>
                <p className="text-xs text-ink-muted mt-0.5">{action.detail}</p>
              </div>
              <span className="text-sm font-mono font-black text-fin-green whitespace-nowrap">
                + {formatEur(action.monthlyGain)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-ink-secondary">
          Aucune action automatique fiable n’est détectée. La priorité est de stabiliser le solde mensuel avant d’accélérer cet objectif.
        </p>
      )}
    </div>
  );
}

function GoalForm({
  initialGoal,
  realCapacity,
  onSave,
  onCancel,
}: {
  initialGoal: SavingsGoal | undefined;
  realCapacity: number;
  onSave: (data: Omit<SavingsGoal, "id">) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(initialGoal?.label ?? "");
  const [targetAmount, setTargetAmount] = useState(initialGoal?.targetAmount ?? 5000);
  const [currentAmount, setCurrentAmount] = useState(initialGoal?.currentAmount ?? 0);
  const [monthlyContribution, setMonthlyContribution] = useState(
    initialGoal?.monthlyContribution ?? Math.max(0, Math.round(realCapacity * 0.35)),
  );
  const [targetDate, setTargetDate] = useState(initialGoal?.targetDate ?? "");
  const [color, setColor] = useState(initialGoal?.color ?? GOAL_COLORS[0] ?? "var(--brand-2)");

  const remaining = Math.max(0, targetAmount - currentAmount);
  const monthsLeft = monthlyContribution > 0 ? Math.ceil(remaining / monthlyContribution) : null;
  const canSave = label.trim().length > 1 && targetAmount > 0 && currentAmount >= 0 && monthlyContribution >= 0;

  return (
    <form
      className="card p-5 space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSave) return;
        onSave(buildGoalPayload({ label, targetAmount, currentAmount, monthlyContribution, targetDate, color }));
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-ink-muted">
            {initialGoal ? "Modifier" : "Nouvel objectif"}
          </p>
          <h3 className="text-lg font-black text-ink-primary">Objectif de vie</h3>
        </div>
        <button type="button" onClick={onCancel} className="btn-mini">Fermer</button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <FormField label="Nom de l’objectif">
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            className="input-premium"
            placeholder="Ex : Apport immobilier"
          />
        </FormField>

        <FormField label="Date cible optionnelle">
          <input
            type="date"
            value={targetDate}
            onChange={(event) => setTargetDate(event.target.value)}
            className="input-premium"
          />
        </FormField>

        <FormField label="Montant cible">
          <input
            type="number"
            min={0}
            value={targetAmount}
            onChange={(event) => setTargetAmount(Number(event.target.value))}
            className="input-premium"
          />
        </FormField>

        <FormField label="Déjà constitué">
          <input
            type="number"
            min={0}
            value={currentAmount}
            onChange={(event) => setCurrentAmount(Number(event.target.value))}
            className="input-premium"
          />
        </FormField>

        <FormField label="Contribution mensuelle prévue">
          <input
            type="number"
            min={0}
            value={monthlyContribution}
            onChange={(event) => setMonthlyContribution(Number(event.target.value))}
            className="input-premium"
          />
        </FormField>

        <FormField label="Couleur">
          <div className="flex flex-wrap gap-2 pt-1">
            {GOAL_COLORS.map((goalColor) => (
              <button
                key={goalColor}
                type="button"
                onClick={() => setColor(goalColor)}
                className={clsx(
                  "h-8 w-8 rounded-full border-2 transition-all",
                  color === goalColor ? "scale-110" : "opacity-75 hover:opacity-100",
                )}
                style={{ background: goalColor, borderColor: color === goalColor ? "var(--ink-primary)" : "transparent" }}
                aria-label={`Choisir la couleur ${goalColor}`}
              />
            ))}
          </div>
        </FormField>
      </div>

      <div className="rounded-xl p-4" style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
        <p className="text-sm text-ink-secondary">
          Projection simple : il reste <strong className="text-ink-primary">{formatEur(remaining)}</strong>. À {formatEur(monthlyContribution)}/mois,
          l’objectif serait atteint en <strong className="text-ink-primary">{monthCountLabel(monthsLeft)}</strong>.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 justify-end">
        <button type="button" onClick={onCancel} className="btn-secondary">Annuler</button>
        <button type="submit" className="btn-brand" disabled={!canSave}>Enregistrer</button>
      </div>
    </form>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-widest text-ink-muted">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
