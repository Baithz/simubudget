// =============================================================================
// Fichier  : src/components/Accounting/GoalsPanel.tsx
// Auteur   : KREMER Regis
// Desc.    : Objectifs d'epargne - creation, suivi, projection, financement intelligent
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-27 | KREMER Regis | Creation Phase 6
//   2026-04-28 | KREMER Regis | Correction TS strict - GoalForm initialGoal IIFE guard strict
//   2026-04-28 | KREMER Regis | Phase 7 - actions cliquables, analyse depenses non-essentielles
//   2026-05-01 | KREMER Régis | Patch 8.1 — stabilité interactions objectifs
//   2026-05-02 | KREMER Régis | Correction lint ESLint 9 — variables inutilisées et règles React adaptées
// =============================================================================

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx } from "clsx";
import { useProfileStore }    from "@/store/profileStore";
import { useAccountingStore } from "@/store/accountingStore";
import { formatEur }          from "@/utils/formatCurrency";
import type { SavingsGoal }   from "@/types/profile";
import type { ExpenseLine }   from "@/types/accounting";

// ── Catégories considérées comme non-essentielles (optimisables) ──────────────
const NON_ESSENTIAL_CATEGORIES = new Set([
  "leisure", "clothing", "gifts", "subscriptions", "other",
]);

// Catégories partiellement optimisables (on suggère 30% de réduction)
const PARTIAL_CATEGORIES = new Set([
  "food", "transport", "telecom",
]);

const GOAL_COLORS = [
  "var(--brand-2)", "#8b5cf6", "var(--fin-green)", "var(--fin-amber)", "#ec4899",
  "#f59e0b", "#06b6d4", "#84cc16",
];

const GOAL_PRESETS = [
  { label: "Apport immobilier",     icon: "🏠", amount: 30000, color: "var(--brand-2)" },
  { label: "Vacances",              icon: "✈️", amount: 2000,  color: "var(--fin-amber)" },
  { label: "Voiture",               icon: "🚗", amount: 10000, color: "#8b5cf6" },
  { label: "Épargne de précaution", icon: "🛡️", amount: 5000,  color: "var(--fin-green)" },
  { label: "Travaux",               icon: "🔨", amount: 15000, color: "#f59e0b" },
  { label: "Retraite anticipée",    icon: "🌅", amount: 50000, color: "#ec4899" },
];

// ── Analyse des dépenses optimisables ─────────────────────────────────────────
function analyzeOptimizable(
  expenses: ExpenseLine[],
  _targetMonthly: number,
): {
  totalOptimizable: number;
  items: { label: string; category: string; current: number; suggested: number; saving: number }[];
} {
  const items: { label: string; category: string; current: number; suggested: number; saving: number }[] = [];
  let totalOptimizable = 0;

  for (const exp of expenses) {
    if (exp.monthlyAmount <= 0) continue;

    if (NON_ESSENTIAL_CATEGORIES.has(exp.category)) {
      // Suggérer de supprimer ou réduire de 50%
      const saving = exp.monthlyAmount * 0.5;
      items.push({
        label:     exp.label,
        category:  exp.category,
        current:   exp.monthlyAmount,
        suggested: exp.monthlyAmount * 0.5,
        saving,
      });
      totalOptimizable += saving;
    } else if (PARTIAL_CATEGORIES.has(exp.category)) {
      // Suggérer 15% de réduction
      const saving = exp.monthlyAmount * 0.15;
      if (saving >= 10) {
        items.push({
          label:     exp.label,
          category:  exp.category,
          current:   exp.monthlyAmount,
          suggested: exp.monthlyAmount * 0.85,
          saving,
        });
        totalOptimizable += saving;
      }
    }
  }

  // Trier par économie potentielle décroissante
  items.sort((a, b) => b.saving - a.saving);

  return { totalOptimizable, items };
}

// ── Composant principal ───────────────────────────────────────────────────────
export function GoalsPanel() {
  const { profile, addGoal, updateGoal, removeGoal } = useProfileStore();
  const accounting   = useAccountingStore();
  const budget       = accounting.getBudget();
  const expenses     = accounting.expenses;
  const goals        = profile.savingsGoals ?? [];

  const [showForm,        setShowForm]        = useState(false);
  const [editId,          setEditId]          = useState<string | null>(null);
  const [expandedGoalId,  setExpandedGoalId]  = useState<string | null>(null);
  const [showOptimizer,   setShowOptimizer]   = useState<string | null>(null);

  // Budget disponible non alloué
  const totalAllocated = goals.reduce((s, g) => s + g.monthlyContribution, 0);
  const available = Math.max(0, budget.balanceMonthly - totalAllocated);

  return (
    <div className="space-y-5">

      {/* ── En-tête ── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-ink-primary">
            {goals.length} objectif{goals.length !== 1 ? "s" : ""} actif{goals.length !== 1 ? "s" : ""}
          </p>
          <p className="text-xs text-ink-muted mt-0.5">
            Solde disponible non alloué : <span className={clsx(
              "font-mono font-semibold",
              available >= 0 ? "text-fin-green" : "text-fin-red"
            )}>{formatEur(available)}/mois</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setShowForm(true); setEditId(null); }}
          className="btn-brand text-sm"
        >
          <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M7 1.75a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5H1.75a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 7 1.75Z"/>
          </svg>
          Nouvel objectif
        </button>
      </div>

      {/* ── Formulaire création/édition ── */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <GoalForm
              {...(() => { const g = editId ? goals.find((x) => x.id === editId) : undefined; return g ? { initialGoal: g } : {}; })()}
              availableMonthly={available}
              onSave={(data) => {
                if (editId) updateGoal(editId, data);
                else addGoal(data);
                setShowForm(false);
                setEditId(null);
              }}
              onCancel={() => { setShowForm(false); setEditId(null); }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Presets si aucun objectif ── */}
      {goals.length === 0 && !showForm && (
        <div>
          <p className="text-xs text-ink-muted mb-3">Choisissez un objectif type pour démarrer :</p>
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
            {GOAL_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  const safeContribution = Math.max(0, Math.min(Math.round(available * 0.3), Math.round(preset.amount / 12)));
                  setShowForm(false);
                  setEditId(null);
                  setExpandedGoalId(null);
                  setShowOptimizer(null);
                  addGoal({
                    label:               preset.label,
                    targetAmount:        preset.amount,
                    currentAmount:       0,
                    monthlyContribution: safeContribution,
                    color:               preset.color,
                  });
                }}
                className="card p-4 text-left hover:border-brand-mid transition-all group"
              >
                <span className="text-2xl block mb-2">{preset.icon}</span>
                <p className="text-sm font-semibold text-ink-primary">{preset.label}</p>
                <p className="text-xs text-ink-muted mt-0.5">{formatEur(preset.amount)}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Liste des objectifs ── */}
      <div className="space-y-3">
        {goals.map((goal) => {
          const remaining  = Math.max(0, goal.targetAmount - goal.currentAmount);
          const pct        = goal.targetAmount > 0 ? Math.min(1, goal.currentAmount / goal.targetAmount) : 0;
          const monthsLeft = goal.monthlyContribution > 0
            ? Math.ceil(remaining / goal.monthlyContribution)
            : null;
          const isExpanded = expandedGoalId === goal.id;

          // Analyse optimizer pour ce goal
          const optimizer = showOptimizer === goal.id
            ? analyzeOptimizable(expenses, goal.monthlyContribution)
            : null;

          // Date estimée d'atteinte
          let targetDateStr = "–";
          if (monthsLeft !== null && monthsLeft < 999) {
            const d = new Date();
            d.setMonth(d.getMonth() + monthsLeft);
            targetDateStr = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
          }

          // Combien manque-t-il par rapport au budget dispo ?
          const shortfall = goal.monthlyContribution - available;
          const needsMore = shortfall > 10 && goal.monthlyContribution > 0;

          return (
            <motion.div
              key={goal.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.16 }}
              className="card overflow-hidden"
            >
              {/* ── Ligne principale ── */}
              <div
                className="px-5 py-4 cursor-pointer"
                onClick={() => setExpandedGoalId(isExpanded ? null : goal.id)}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: goal.color }} />
                    <p className="text-sm font-semibold text-ink-primary">{goal.label}</p>
                    {pct >= 1 && (
                      <span className="badge-base badge-green text-2xs">Atteint !</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-mono text-ink-muted">
                      {formatEur(goal.currentAmount)} / {formatEur(goal.targetAmount)}
                    </span>
                    <svg
                      viewBox="0 0 14 14" fill="currentColor"
                      className={clsx("w-3.5 h-3.5 text-ink-muted transition-transform", isExpanded && "rotate-180")}
                    >
                      <path d="M2 4.5L7 9.5L12 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                    </svg>
                  </div>
                </div>

                {/* Barre de progression */}
                <div className="progress-track">
                  <motion.div
                    className="progress-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${pct * 100}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    style={{ background: `linear-gradient(90deg, ${goal.color}88, ${goal.color})` }}
                  />
                </div>
                <div className="flex justify-between text-2xs text-ink-muted mt-1.5">
                  <span>{(pct * 100).toFixed(0)}% atteint</span>
                  <span>{formatEur(remaining)} restant</span>
                </div>
              </div>

              {/* ── Détail expansible ── */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-4 space-y-4" style={{ borderTop: "1px solid var(--border)" }}>

                      {/* Infos projection */}
                      <div className="pt-3 grid grid-cols-2 gap-3">
                        <div className="card-alt rounded-lg p-3">
                          <p className="text-2xs text-ink-muted">Contribution mensuelle</p>
                          <p className="text-sm font-mono font-semibold text-ink-primary mt-0.5">
                            {formatEur(goal.monthlyContribution)}/mois
                          </p>
                        </div>
                        <div className="card-alt rounded-lg p-3">
                          <p className="text-2xs text-ink-muted">Date d'atteinte estimée</p>
                          <p className="text-sm font-semibold text-ink-primary mt-0.5">
                            {monthsLeft !== null
                              ? `${targetDateStr} (${monthsLeft} mois)`
                              : "Non définie"
                            }
                          </p>
                        </div>
                      </div>

                      {/* Alerte si on n'a pas assez de budget */}
                      {needsMore && (
                        <div
                          className="rounded-lg p-3 text-sm"
                          style={{ background: "var(--fin-amber-dim)", border: "1px solid rgba(245,158,11,0.2)" }}
                        >
                          <p className="font-semibold text-fin-amber text-xs">
                            Manque {formatEur(shortfall)}/mois pour financer cet objectif
                          </p>
                          <p className="text-xs text-ink-secondary mt-1">
                            Votre solde disponible actuel ne couvre pas la contribution prévue.
                          </p>
                        </div>
                      )}

                      {/* ── OPTIMISEUR : Trouver comment financer ── */}
                      {expenses.length > 0 && (
                        <div>
                          <button
                            type="button"
                            onClick={() => setShowOptimizer(showOptimizer === goal.id ? null : goal.id)}
                            className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-all"
                            style={{
                              background: "linear-gradient(135deg, rgba(6,214,160,0.07), rgba(14,165,233,0.07))",
                              border: "1px solid var(--border-brand)",
                            }}
                          >
                            <span className="flex items-center gap-2">
                              <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-brand-mid flex-shrink-0">
                                <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1ZM6.5 6.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM8 11a3 3 0 0 1-2.83-2H5a.5.5 0 0 1 0-1h.17A3.001 3.001 0 0 1 11 9.5h.5a.5.5 0 0 1 0 1H11A3 3 0 0 1 8 11Z"/>
                              </svg>
                              <span className="text-ink-primary">
                                Comment financer <strong>{goal.label}</strong> ?
                              </span>
                            </span>
                            <svg
                              viewBox="0 0 14 14" fill="currentColor"
                              className={clsx("w-3.5 h-3.5 text-ink-muted transition-transform flex-shrink-0", showOptimizer === goal.id && "rotate-180")}
                            >
                              <path d="M2 4.5L7 9.5L12 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                            </svg>
                          </button>

                          {/* Résultats de l'optimiseur */}
                          <AnimatePresence>
                            {optimizer && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="mt-3 space-y-3">
                                  {/* Résumé */}
                                  <div
                                    className="rounded-lg p-4"
                                    style={{ background: "var(--fin-green-dim)", border: "1px solid rgba(16,217,168,0.2)" }}
                                  >
                                    <p className="text-xs font-semibold text-fin-green mb-1">
                                      Potentiel d'économies identifié
                                    </p>
                                    <p className="text-2xl font-mono font-bold text-fin-green">
                                      {formatEur(optimizer.totalOptimizable)}<span className="text-sm font-normal text-ink-secondary">/mois</span>
                                    </p>
                                    {optimizer.totalOptimizable >= goal.monthlyContribution ? (
                                      <p className="text-xs text-ink-secondary mt-1">
                                        ✓ Suffisant pour financer {formatEur(goal.monthlyContribution)}/mois vers <strong>{goal.label}</strong>
                                      </p>
                                    ) : (
                                      <p className="text-xs text-ink-secondary mt-1">
                                        Couvre {Math.round(optimizer.totalOptimizable / goal.monthlyContribution * 100)}% de votre objectif de {formatEur(goal.monthlyContribution)}/mois
                                      </p>
                                    )}
                                  </div>

                                  {/* Liste des dépenses à optimiser */}
                                  {optimizer.items.length > 0 ? (
                                    <div className="space-y-2">
                                      <p className="text-xs font-semibold text-ink-secondary">
                                        Dépenses à réduire en priorité :
                                      </p>
                                      {optimizer.items.slice(0, 5).map((item, i) => (
                                        <div
                                          key={i}
                                          className="flex items-center justify-between px-3 py-2.5 rounded-lg"
                                          style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border)" }}
                                        >
                                          <div className="min-w-0 flex-1">
                                            <p className="text-xs font-medium text-ink-primary truncate">{item.label}</p>
                                            <p className="text-2xs text-ink-muted">
                                              {NON_ESSENTIAL_CATEGORIES.has(item.category as string)
                                                ? `Réduire de 50% : ${formatEur(item.current)} → ${formatEur(item.suggested)}/mois`
                                                : `Réduire de 15% : ${formatEur(item.current)} → ${formatEur(item.suggested)}/mois`
                                              }
                                            </p>
                                          </div>
                                          <span className="text-sm font-mono font-bold text-fin-green ml-3 flex-shrink-0">
                                            − {formatEur(item.saving)}/mois
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-ink-muted text-center py-3">
                                      Aucune dépense non-essentielle détectée dans vos comptes.
                                      Ajoutez vos dépenses dans l'onglet "Dépenses" pour une analyse complète.
                                    </p>
                                  )}

                                  {/* Accélération possible */}
                                  {monthsLeft !== null && monthsLeft > 1 && optimizer.totalOptimizable > 0 && (
                                    <div
                                      className="rounded-lg px-4 py-3"
                                      style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border)" }}
                                    >
                                      <p className="text-xs text-ink-secondary">
                                        En économisant ces <strong className="text-fin-green">{formatEur(optimizer.totalOptimizable)}/mois</strong>, vous atteindriez <strong>{goal.label}</strong> en{" "}
                                        <strong className="text-ink-primary">
                                          {Math.ceil(remaining / (goal.monthlyContribution + optimizer.totalOptimizable))} mois
                                        </strong>{" "}
                                        au lieu de {monthsLeft} mois.
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}

                      {/* ── Actions : Modifier / Supprimer ── */}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditId(goal.id);
                            setShowForm(true);
                            setExpandedGoalId(null);
                          }}
                          className="btn-secondary flex-1 text-xs"
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          onClick={() => removeGoal(goal.id)}
                          className="px-4 py-2.5 text-xs font-medium rounded-lg transition-all"
                          style={{
                            background: "var(--fin-red-dim)",
                            color: "var(--fin-red)",
                            border: "1px solid rgba(244,63,94,0.2)",
                          }}
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* ── Total alloué ── */}
      {goals.length > 0 && (
        <div
          className="rounded-xl px-5 py-4"
          style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border)" }}
        >
          <div className="flex justify-between text-sm mb-2">
            <span className="text-ink-secondary">Total alloué aux objectifs</span>
            <span className="font-mono font-semibold text-ink-primary">{formatEur(totalAllocated)}/mois</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-ink-muted">Disponible non alloué</span>
            <span className={clsx(
              "font-mono font-semibold",
              available >= 0 ? "text-fin-green" : "text-fin-red"
            )}>
              {formatEur(available)}/mois
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Formulaire création/édition ───────────────────────────────────────────────
function GoalForm({
  initialGoal,
  availableMonthly,
  onSave,
  onCancel,
}: {
  initialGoal?:      SavingsGoal;
  availableMonthly:  number;
  onSave:            (data: Omit<SavingsGoal, "id">) => void;
  onCancel:          () => void;
}) {
  const [label,         setLabel]        = useState(initialGoal?.label         ?? "");
  const [targetAmount,  setTargetAmount] = useState(initialGoal?.targetAmount  ?? 5000);
  const [currentAmount, setCurrent]      = useState(initialGoal?.currentAmount ?? 0);
  const [monthly,       setMonthly]      = useState<number>(
    initialGoal?.monthlyContribution ?? Math.max(50, Math.round(availableMonthly * 0.3))
  );
  const [color,         setColor]        = useState<string>(
    initialGoal?.color ?? GOAL_COLORS[0] ?? "var(--brand-2)"
  );

  const remaining  = Math.max(0, targetAmount - currentAmount);
  const monthsLeft = monthly > 0 ? Math.ceil(remaining / monthly) : null;

  return (
    <div
      className="rounded-xl p-5 space-y-4"
      style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border)" }}
    >
      <p className="text-sm font-semibold text-ink-primary">
        {initialGoal ? "Modifier l'objectif" : "Nouvel objectif"}
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-ink-secondary mb-1.5">Nom de l'objectif</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex : Voyage au Japon, Apport immobilier..."
            className="input-premium"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1.5">Montant cible (€)</label>
            <input
              type="number" min={0} value={targetAmount}
              onChange={(e) => setTargetAmount(parseFloat(e.target.value) || 0)}
              className="input-premium"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1.5">Déjà épargné (€)</label>
            <input
              type="number" min={0} value={currentAmount}
              onChange={(e) => setCurrent(parseFloat(e.target.value) || 0)}
              className="input-premium"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-secondary mb-1.5">
            Contribution mensuelle — disponible : {formatEur(availableMonthly)}
          </label>
          <input
            type="range"
            min={0}
            max={Math.max(monthly + 50, availableMonthly, 500)}
            step={10}
            value={monthly}
            onChange={(e) => setMonthly(parseFloat(e.target.value))}
            className="w-full accent-brand-mid"
          />
          <div className="flex justify-between text-2xs text-ink-muted mt-1">
            <span>0 €</span>
            <span className="font-mono font-semibold text-ink-primary">{formatEur(monthly)}/mois</span>
            <span>{formatEur(Math.max(monthly + 50, availableMonthly, 500))}</span>
          </div>
        </div>

        {/* Couleur */}
        <div>
          <label className="block text-xs font-medium text-ink-secondary mb-2">Couleur</label>
          <div className="flex gap-2 flex-wrap">
            {GOAL_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={clsx("w-7 h-7 rounded-full border-2 transition-all", color === c ? "scale-110" : "border-transparent")}
                style={{ backgroundColor: c, borderColor: color === c ? "var(--text-primary)" : "transparent" }}
              />
            ))}
          </div>
        </div>

        {/* Projection temps réel */}
        {monthsLeft !== null && targetAmount > currentAmount && (
          <div
            className="rounded-lg px-4 py-3"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
          >
            <p className="text-xs text-ink-secondary">
              À ce rythme, objectif atteint dans{" "}
              <span className="font-semibold text-ink-primary">{monthsLeft} mois</span>
              {monthsLeft > 0 && (
                <>
                  {" "}(
                  {(() => {
                    const d = new Date();
                    d.setMonth(d.getMonth() + monthsLeft);
                    return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
                  })()}
                  )
                </>
              )}
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
        <button type="button" onClick={onCancel} className="btn-secondary">Annuler</button>
        <button
          type="button"
          onClick={() => {
            if (!label.trim()) return;
            onSave({ label, targetAmount, currentAmount, monthlyContribution: monthly, color: color ?? "var(--brand-2)" });
          }}
          disabled={!label.trim()}
          className="btn-brand disabled:opacity-40"
        >
          {initialGoal ? "Enregistrer" : "Créer l'objectif"}
        </button>
      </div>
    </div>
  );
}
