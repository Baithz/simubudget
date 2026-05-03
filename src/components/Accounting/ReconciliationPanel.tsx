// =============================================================================
// Fichier  : src/components/Accounting/ReconciliationPanel.tsx
// Auteur   : KREMER Régis
// Desc.    : Module de rapprochement prévu/réel — vue côte à côte, synthèse
//            par enveloppe, actions de validation et d'appairage.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-05-03 | KREMER Régis | Création Phase 15.1 — rapprochement import bancaire
// =============================================================================

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx } from "clsx";
import { useReconciliationStore } from "@/store/reconciliationStore";
import { useAccountingStore } from "@/store/accountingStore";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/types/accounting";
import { getReconciliationIntegrationState, integrateReconciliationMonth } from "@/services/reconciliationIntegration";
import { formatEur } from "@/utils/formatCurrency";
import type { ReconciliationPair, ManualSide } from "@/types/reconciliation";
import type { ExpenseCategory } from "@/types/accounting";

// ─── Helpers ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ReconciliationPair["status"], string> = {
  reconciled:         "Rapproché",
  manual_only:        "Prévu sans réel",
  imported_only:      "Non planifié",
  possible_duplicate: "Doublon possible",
};

const STATUS_COLORS: Record<ReconciliationPair["status"], { bg: string; border: string; text: string }> = {
  reconciled:         { bg: "var(--fin-green-bg)",  border: "var(--fin-green-border)",  text: "var(--fin-green)"  },
  manual_only:        { bg: "var(--fin-blue-bg)",   border: "var(--fin-blue-border)",   text: "var(--fin-blue)"   },
  imported_only:      { bg: "var(--fin-amber-bg)",  border: "var(--fin-amber-border)",  text: "var(--fin-amber)"  },
  possible_duplicate: { bg: "var(--fin-red-bg)",    border: "var(--fin-red-border)",    text: "var(--fin-red)"    },
};

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y?.slice(2)}`;
}

function CategoryDot({ category }: { category: ExpenseCategory }) {
  return (
    <span
      className="inline-block h-2 w-2 flex-shrink-0 rounded-full"
      style={{ background: CATEGORY_COLORS[category] }}
    />
  );
}
// ─── Intégration contrôlée dans Mes Comptes ──────────────────────────────────

function IntegrationBar({ month }: { month: string }) {
  const transactions = useReconciliationStore((s) => s.transactions);
  const monthlyExpenses = useAccountingStore((s) => s.monthlyExpenses);
  const [message, setMessage] = useState<string | null>(null);

  const state = useMemo(
    () => getReconciliationIntegrationState(month),
    [month, transactions, monthlyExpenses]
  );

  if (state.totalIntegrable === 0) return null;

  const remaining = Math.max(0, state.totalIntegrable - state.alreadyIntegrated);

  function handleIntegrate() {
    const result = integrateReconciliationMonth(month);
    const parts: string[] = [];
    if (result.updatedManualLines > 0) parts.push(`${result.updatedManualLines} ligne(s) prévue(s) mise(s) à jour`);
    if (result.createdImportedLines > 0) parts.push(`${result.createdImportedLines} dépense(s) réelle(s) ajoutée(s)`);
    if (result.alreadyIntegrated > 0) parts.push(`${result.alreadyIntegrated} déjà intégrée(s)`);
    if (result.skippedDuplicates > 0) parts.push(`${result.skippedDuplicates} doublon(s) ignoré(s)`);
    if (result.errors.length > 0) parts.push(`${result.errors.length} erreur(s)`);
    setMessage(parts.length > 0 ? parts.join(" · ") : "Aucune modification nécessaire");
  }

  return (
    <div
      className="mb-4 rounded-xl p-4"
      style={{ background: "var(--fin-blue-bg)", border: "1px solid var(--fin-blue-border)" }}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            Intégration dans Mes Comptes
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
            Les lignes rapprochées mettent à jour le réel des dépenses prévues. Les transactions non planifiées deviennent des dépenses réelles ajoutées. Les doublons et éléments ignorés ne sont jamais intégrés.
          </p>
          {message !== null && (
            <p className="mt-2 text-xs font-semibold" style={{ color: "var(--fin-blue)" }}>
              {message}
            </p>
          )}
        </div>
        <button
          type="button"
          className="btn-brand inline-flex items-center justify-center gap-2 whitespace-nowrap"
          onClick={handleIntegrate}
          disabled={remaining === 0}
          style={remaining === 0 ? { opacity: 0.55, cursor: "not-allowed" } : undefined}
        >
          <svg viewBox="0 0 14 14" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M2 2.5A1.5 1.5 0 0 1 3.5 1h7A1.5 1.5 0 0 1 12 2.5v9a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 2 11.5v-9Zm2 1v2h6v-2H4Zm0 3.5v1h6V7H4Zm0 2.5v1h4v-1H4Z" />
          </svg>
          {remaining === 0 ? "Déjà intégré" : `Intégrer ${remaining} élément${remaining > 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );
}


// ─── Bandeau de synthèse ──────────────────────────────────────────────────────

function SummaryBar({ month }: { month: string }) {
  const getDebitTransactions = useReconciliationStore((s) => s.getDebitTransactions);
  const getSummary           = useReconciliationStore((s) => s.getSummary);
  const monthlyExpenses      = useAccountingStore((s) => s.monthlyExpenses);

  const manualExpenses: ManualSide[] = useMemo(() =>
    monthlyExpenses
      .filter((e) => e.month === month && e.amount > 0)
      .map((e) => ({
        expenseId:            e.id,
        label:                e.label,
        category:             e.category,
        amount:               e.plannedAmount ?? e.amount,
        date:                 `${month}-15`,   // date approximative pour matching
        reconciliationStatus: "manual" as const,
      })),
  [monthlyExpenses, month]);

  const summary = useMemo(
    () => getSummary(month, manualExpenses),
    [getSummary, month, manualExpenses]
  );

  const txs = getDebitTransactions(month);
  if (txs.length === 0) return null;

  const pct = summary.totalImported > 0
    ? Math.round((summary.totalReconciled / summary.totalImported) * 100)
    : 0;

  return (
    <div
      className="mb-4 rounded-xl p-4"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex flex-wrap items-center gap-4">
        {/* Barre de progression rapprochement */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Rapprochement {month}
            </span>
            <span className="font-mono text-sm font-bold" style={{ color: "var(--fin-green)" }}>
              {pct}%
            </span>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full"
            style={{ background: "var(--bg-surface-2)" }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ background: "var(--fin-green)" }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Compteurs */}
        <div className="flex flex-shrink-0 flex-wrap gap-3">
          {[
            { label: "Appairés",       value: summary.totalReconciled,    color: "var(--fin-green)"  },
            { label: "Non planifiés",  value: summary.totalUnmatched,     color: "var(--fin-amber)"  },
            { label: "Sans réel",      value: summary.totalManualOnly,    color: "var(--fin-blue)"   },
            { label: "Doublons",       value: summary.possibleDuplicates, color: "var(--fin-red)"    },
          ].map(({ label, value, color }) => (
            value > 0 && (
              <div key={label} className="text-center">
                <div className="font-mono text-lg font-extrabold" style={{ color }}>{value}</div>
                <div className="text-2xs font-medium" style={{ color: "var(--text-muted)" }}>{label}</div>
              </div>
            )
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Vue synthèse par enveloppe ───────────────────────────────────────────────

function EnvelopeSummary({ month }: { month: string }) {
  const getSummary      = useReconciliationStore((s) => s.getSummary);
  const monthlyExpenses = useAccountingStore((s) => s.monthlyExpenses);

  const manualExpenses: ManualSide[] = useMemo(() =>
    monthlyExpenses
      .filter((e) => e.month === month && e.amount > 0)
      .map((e) => ({
        expenseId:            e.id,
        label:                e.label,
        category:             e.category,
        amount:               e.plannedAmount ?? e.amount,
        date:                 `${month}-15`,
        reconciliationStatus: "manual" as const,
      })),
  [monthlyExpenses, month]);

  const summary = useMemo(
    () => getSummary(month, manualExpenses),
    [getSummary, month, manualExpenses]
  );

  if (summary.envelopes.length === 0) return null;

  return (
    <div
      className="mb-4 rounded-xl"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
    >
      <div
        className="flex items-center gap-2 border-b px-4 py-3"
        style={{ borderColor: "var(--border)" }}
      >
        <svg viewBox="0 0 14 14" fill="currentColor" className="h-3.5 w-3.5" style={{ color: "var(--text-muted)" }}>
          <path d="M7 1a6 6 0 1 0 0 12A6 6 0 0 0 7 1Zm-.75 3.25a.75.75 0 0 1 1.5 0v3.5a.75.75 0 0 1-1.5 0v-3.5ZM7 9.5a.875.875 0 1 1 0 1.75.875.875 0 0 1 0-1.75Z" />
        </svg>
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Synthèse par enveloppe
        </span>
      </div>

      <div className="divide-y" style={{ borderColor: "var(--border)" }}>
        {summary.envelopes.map((env) => {
          const isOver = env.delta > 0;
          const deltaColor = isOver ? "var(--fin-red)" : "var(--fin-green)";
          const pct = env.planned > 0 ? Math.min(100, (env.real / env.planned) * 100) : 100;

          return (
            <div key={env.category} className="px-4 py-3">
              <div className="flex items-center gap-2 mb-1.5">
                <CategoryDot category={env.category} />
                <span className="flex-1 text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {env.label}
                </span>
                <span className="font-mono text-sm font-bold" style={{ color: deltaColor }}>
                  {isOver ? "+" : ""}{formatEur(env.delta)}
                </span>
              </div>

              {/* Barre prévu vs réel */}
              <div className="relative h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--bg-surface-2)" }}>
                <div
                  className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    background: isOver ? "var(--fin-red)" : "var(--fin-green)",
                  }}
                />
              </div>

              <div className="mt-1 flex gap-3 text-2xs" style={{ color: "var(--text-muted)" }}>
                <span>Prévu : {formatEur(env.planned)}</span>
                <span>Réel : {formatEur(env.real)}</span>
                {env.transactionCount > 0 && (
                  <span>{env.transactionCount} transaction{env.transactionCount > 1 ? "s" : ""}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Carte de paire de rapprochement ─────────────────────────────────────────

function PairCard({ pair }: { pair: ReconciliationPair }) {
  const reconcileManual  = useReconciliationStore((s) => s.reconcileManual);
  const unreconcile      = useReconciliationStore((s) => s.unreconcile);
  const ignoreTransaction = useReconciliationStore((s) => s.ignoreTransaction);
  const setCategory      = useReconciliationStore((s) => s.setCategory);
  const learnRule        = useReconciliationStore((s) => s.learnRule);

  const cfg = STATUS_COLORS[pair.status];
  const [showCatPicker, setShowCatPicker] = useState(false);

  function handleReconcile() {
    if (pair.imported && pair.manual) {
      reconcileManual(pair.imported.transactionId, pair.manual.expenseId);
    }
  }

  function handleUnreconcile() {
    if (pair.imported) unreconcile(pair.imported.transactionId);
  }

  function handleIgnore() {
    if (pair.imported) ignoreTransaction(pair.imported.transactionId);
  }

  function handleCategoryChange(cat: ExpenseCategory) {
    if (!pair.imported) return;
    setCategory(pair.imported.transactionId, cat);
    learnRule(pair.imported.labelRaw, cat);
    setShowCatPicker(false);
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18 }}
      className="rounded-xl overflow-hidden"
      style={{
        background:  cfg.bg,
        border:      `1px solid ${cfg.border}`,
      }}
    >
      {/* Header statut */}
      <div
        className="flex items-center gap-2 px-3 py-1.5"
        style={{ borderBottom: `1px solid ${cfg.border}` }}
      >
        <span className="text-2xs font-bold uppercase tracking-wider" style={{ color: cfg.text }}>
          {STATUS_LABELS[pair.status]}
        </span>
        {pair.delta !== undefined && Math.abs(pair.delta) > 0.01 && (
          <span className="ml-auto font-mono text-xs font-bold" style={{ color: pair.delta > 0 ? "var(--fin-red)" : "var(--fin-green)" }}>
            {pair.delta > 0 ? "+" : ""}{formatEur(pair.delta)}
          </span>
        )}
      </div>

      {/* Corps — colonnes prévu / réel */}
      <div className="grid grid-cols-2 gap-px" style={{ background: cfg.border }}>

        {/* Côté prévu */}
        <div className="p-3" style={{ background: "var(--bg-surface)" }}>
          <p className="mb-1.5 text-2xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Prévu
          </p>
          {pair.manual ? (
            <>
              <div className="flex items-start gap-2">
                <CategoryDot category={pair.manual.category} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {pair.manual.label}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {formatDate(pair.manual.date)} · {CATEGORY_LABELS[pair.manual.category]}
                  </p>
                </div>
              </div>
              <p className="mt-1 font-mono text-base font-bold" style={{ color: "var(--text-primary)" }}>
                {formatEur(pair.manual.amount)}
              </p>
            </>
          ) : (
            <p className="text-sm italic" style={{ color: "var(--text-muted)" }}>
              Aucune dépense prévue correspondante
            </p>
          )}
        </div>

        {/* Côté réel */}
        <div className="p-3" style={{ background: "var(--bg-surface)" }}>
          <p className="mb-1.5 text-2xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Réel
          </p>
          {pair.imported ? (
            <>
              <div className="flex items-start gap-2">
                <CategoryDot category={pair.imported.category} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {pair.imported.labelRaw}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {formatDate(pair.imported.date)} · {CATEGORY_LABELS[pair.imported.category]}
                  </p>
                </div>
              </div>
              <p className="mt-1 font-mono text-base font-bold" style={{ color: "var(--text-primary)" }}>
                {formatEur(Math.abs(pair.imported.amount))}
              </p>
            </>
          ) : (
            <p className="text-sm italic" style={{ color: "var(--text-muted)" }}>
              Aucune transaction bancaire trouvée
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      {pair.imported && pair.status !== "reconciled" && (
        <div
          className="flex flex-wrap items-center gap-2 px-3 py-2"
          style={{ borderTop: `1px solid ${cfg.border}` }}
        >
          {pair.manual && (
            <button
              type="button"
              onClick={handleReconcile}
              className="btn-mini-green"
            >
              <svg viewBox="0 0 12 12" fill="currentColor" className="h-3 w-3">
                <path d="M10.28 2.72a.75.75 0 0 0-1.06 0L4.75 7.19 2.78 5.22A.75.75 0 0 0 1.72 6.28l2.5 2.5a.75.75 0 0 0 1.06 0l5-5a.75.75 0 0 0 0-1.06Z" />
              </svg>
              Rapprocher ✓
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowCatPicker((v) => !v)}
            className="btn-mini"
          >
            Recatégoriser
          </button>
          <button
            type="button"
            onClick={handleIgnore}
            className="btn-mini ml-auto"
          >
            Ignorer
          </button>
        </div>
      )}

      {pair.imported && pair.status === "reconciled" && (
        <div
          className="flex items-center gap-2 px-3 py-2"
          style={{ borderTop: `1px solid ${cfg.border}` }}
        >
          <button
            type="button"
            onClick={handleUnreconcile}
            className="btn-mini"
          >
            Annuler le rapprochement
          </button>
        </div>
      )}

      {/* Picker de catégorie */}
      <AnimatePresence>
        {showCatPicker && pair.imported && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
            style={{ borderTop: `1px solid ${cfg.border}` }}
          >
            <div className="flex flex-wrap gap-1.5 p-3">
              {(Object.keys(CATEGORY_LABELS) as ExpenseCategory[]).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleCategoryChange(cat)}
                  className={clsx(
                    "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                    pair.imported!.category === cat
                      ? "ring-2"
                      : "hover:opacity-80"
                  )}
                  style={{
                    background: pair.imported!.category === cat
                      ? `${CATEGORY_COLORS[cat]}22`
                      : "var(--bg-surface-2)",
                    color: pair.imported!.category === cat
                      ? CATEGORY_COLORS[cat]
                      : "var(--text-secondary)",
                    outline: pair.imported!.category === cat
                      ? `2px solid ${CATEGORY_COLORS[cat]}`
                      : "none",
                    outlineOffset: "1px",
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                    style={{ background: CATEGORY_COLORS[cat] }}
                  />
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Panel principal ──────────────────────────────────────────────────────────

type FilterTab = "all" | "reconciled" | "unmatched" | "manual_only" | "possible_duplicate";

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all",                label: "Tout"            },
  { key: "reconciled",         label: "Rapprochés"      },
  { key: "unmatched",          label: "Non planifiés"   },
  { key: "manual_only",        label: "Sans réel"       },
  { key: "possible_duplicate", label: "Doublons"        },
];

interface Props {
  month: string;   // "YYYY-MM"
}

export function ReconciliationPanel({ month }: Props) {
  const [filter, setFilter] = useState<FilterTab>("all");

  const getPairs        = useReconciliationStore((s) => s.getPairs);
  const monthlyExpenses = useAccountingStore((s) => s.monthlyExpenses);

  const manualExpenses: ManualSide[] = useMemo(() =>
    monthlyExpenses
      .filter((e) => e.month === month && e.amount > 0)
      .map((e) => ({
        expenseId:            e.id,
        label:                e.label,
        category:             e.category,
        amount:               e.plannedAmount ?? e.amount,
        date:                 `${month}-15`,
        reconciliationStatus: "manual" as const,
      })),
  [monthlyExpenses, month]);

  const allPairs = useMemo(
    () => getPairs(month, manualExpenses),
    [getPairs, month, manualExpenses]
  );

  const filteredPairs = useMemo(() => {
    if (filter === "all") return allPairs;
    if (filter === "unmatched") return allPairs.filter((p) => p.status === "imported_only");
    return allPairs.filter((p) => p.status === filter);
  }, [allPairs, filter]);

  const counts = useMemo(() => ({
    all:                allPairs.length,
    reconciled:         allPairs.filter((p) => p.status === "reconciled").length,
    unmatched:          allPairs.filter((p) => p.status === "imported_only").length,
    manual_only:        allPairs.filter((p) => p.status === "manual_only").length,
    possible_duplicate: allPairs.filter((p) => p.status === "possible_duplicate").length,
  }), [allPairs]);

  if (allPairs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <svg viewBox="0 0 32 32" fill="currentColor" className="h-8 w-8" style={{ color: "var(--text-muted)" }}>
          <path d="M6 8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8Zm2 0v16h16V8H8Zm6 4h4v4h-4v-4Zm0 6h4v2h-4v-2Zm-3-6h1.5v4H11v-4Zm0 6h1.5v2H11v-2Zm8-6H20v4h-1.5v-4Zm0 6H20v2h-1.5v-2Z" />
        </svg>
        <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
          Aucune donnée à rapprocher pour ce mois.
        </p>
        <p className="text-xs" style={{ color: "var(--text-placeholder)" }}>
          Importez un relevé bancaire ou saisissez des dépenses dans Mes Comptes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SummaryBar month={month} />
      <IntegrationBar month={month} />
      <EnvelopeSummary month={month} />

      {/* Filtres */}
      <div className="flex flex-wrap gap-1.5">
        {FILTER_TABS.map(({ key, label }) => {
          const count = counts[key];
          if (key !== "all" && count === 0) return null;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={clsx(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                filter === key
                  ? "text-white"
                  : "hover:opacity-80"
              )}
              style={{
                background: filter === key ? "var(--brand-1)" : "var(--bg-surface-2)",
                color:      filter === key ? "white" : "var(--text-secondary)",
              }}
            >
              {label}
              {count > 0 && (
                <span
                  className="rounded-full px-1.5 py-0.5 font-mono text-2xs"
                  style={{
                    background: filter === key ? "rgba(255,255,255,.25)" : "var(--bg-surface-3)",
                    color:      filter === key ? "white" : "var(--text-muted)",
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Liste des paires */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {filteredPairs.map((pair, idx) => (
            <PairCard
              key={
                pair.imported?.transactionId ??
                pair.manual?.expenseId ??
                `pair-${idx}`
              }
              pair={pair}
            />
          ))}
        </AnimatePresence>

        {filteredPairs.length === 0 && (
          <p className="py-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
            Aucune transaction dans cette catégorie.
          </p>
        )}
      </div>
    </div>
  );
}
