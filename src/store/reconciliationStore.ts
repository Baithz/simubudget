// =============================================================================
// Fichier  : src/store/reconciliationStore.ts
// Auteur   : KREMER Régis
// Desc.    : Store Zustand pour l'import bancaire et le rapprochement prévu/réel.
//            Gère les transactions importées, les règles apprises et les sessions.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-05-03 | KREMER Régis | Création Phase 15.1 — import CSV et rapprochement
//   2026-05-04 | KREMER Régis | Phase 1 — rapprochement prévu/réel complet avec suggestions non destructives
//   2026-05-04 | KREMER Régis | Phase 2 — détection doublons import et verrouillage intégration
//   2026-05-04 | KREMER Régis | Phase 3 — enrichissement des libellés bancaires humains
// =============================================================================

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { profileScopedStorage } from "@/store/profileListStore";
import type {
  ImportedTransaction, CategoryRule, ImportSession,
  ReconciliationStatus, ReconciliationSummary, ReconciliationPair,
  EnvelopeReconciliationReport, ManualSide, ImportedSide,
} from "@/types/reconciliation";
import type { ExpenseCategory } from "@/types/accounting";
import { CATEGORY_LABELS } from "@/types/accounting";
import { getHumanBankLabel, shouldReplaceCategoryFromBankLabel } from "@/services/bankLabelDisplay";

// ─── Helpers internes ────────────────────────────────────────────────────────

function generateId(): string {
  return `rec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Normalise un libellé pour le matching : majuscules, sans accents, sans ponctuation */
export function normalizeLabel(label: string): string {
  return label
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface ReconciliationScoreDetails {
  score: number;
  reason: string;
}

function labelTokens(value: string): Set<string> {
  const ignored = new Set(["PRELEVEMENT", "PRLV", "CB", "CARTE", "PAIEMENT", "VIR", "SEPA", "FACTURE", "FR", "C"]);
  return new Set(
    normalizeLabel(value)
      .split(" ")
      .filter((token) => token.length >= 3 && !ignored.has(token) && !/^\d+$/.test(token))
  );
}

function labelSimilarity(manualLabel: string, importedLabel: string): number {
  const manualTokens = labelTokens(manualLabel);
  const importedTokens = labelTokens(importedLabel);
  if (manualTokens.size === 0 || importedTokens.size === 0) return 0;
  let common = 0;
  for (const token of manualTokens) {
    if (importedTokens.has(token)) common += 1;
  }
  return common / Math.max(manualTokens.size, importedTokens.size);
}

function dateDiffDays(a: string, b: string): number {
  const d1 = new Date(a).getTime();
  const d2 = new Date(b).getTime();
  if (!Number.isFinite(d1) || !Number.isFinite(d2)) return 99;
  return Math.abs(d1 - d2) / (1000 * 60 * 60 * 24);
}

function transactionComparableAmount(tx: ImportedTransaction): number {
  return Math.round(Math.abs(tx.amountCents));
}

function transactionDateDiffDays(a: ImportedTransaction, b: ImportedTransaction): number {
  return dateDiffDays(a.date, b.date);
}

function importedLabelSimilarity(a: ImportedTransaction, b: ImportedTransaction): number {
  return labelSimilarity(a.labelRaw || a.labelNormalized, b.labelRaw || b.labelNormalized);
}

function getDuplicateDetails(
  tx: ImportedTransaction,
  existingTransactions: ImportedTransaction[],
): { duplicateOfTransactionId: string; duplicateReason: string } | null {
  for (const existing of existingTransactions) {
    if (existing.id === tx.id) {
      return {
        duplicateOfTransactionId: existing.id,
        duplicateReason: "identifiant bancaire déjà importé",
      };
    }

    if (existing.status === "ignored") continue;
    if (transactionComparableAmount(existing) !== transactionComparableAmount(tx)) continue;

    const days = transactionDateDiffDays(existing, tx);
    if (days > 2) continue;

    const similarity = importedLabelSimilarity(existing, tx);
    const sameNormalized = existing.labelNormalized === tx.labelNormalized;
    const sameSourceMonth = existing.source === tx.source && existing.month === tx.month;

    if (sameNormalized || similarity >= 0.35 || sameSourceMonth) {
      return {
        duplicateOfTransactionId: existing.id,
        duplicateReason: days === 0
          ? "même montant et même date déjà importés"
          : `même montant et date proche déjà importés (${Math.round(days)} j)`,
      };
    }
  }
  return null;
}


function enrichTransactionDisplayLabel(tx: ImportedTransaction): ImportedTransaction {
  const display = getHumanBankLabel(tx.labelRaw || tx.labelNormalized, tx.category);
  return {
    ...tx,
    labelDisplay: display.displayLabel,
    merchantLabel: display.merchantLabel,
    category: shouldReplaceCategoryFromBankLabel(tx.category, display.categoryHint) ? display.categoryHint! : tx.category,
  };
}

function markPossibleDuplicates(
  currentTransactions: ImportedTransaction[],
  incomingTransactions: ImportedTransaction[],
): ImportedTransaction[] {
  const checked: ImportedTransaction[] = [...currentTransactions];
  const result: ImportedTransaction[] = [];

  for (const tx of incomingTransactions) {
    const duplicate = getDuplicateDetails(tx, checked);
    const next = duplicate === null
      ? tx
      : {
          ...tx,
          status: "possible_duplicate" as const,
          matchedExpenseId: null,
          duplicateOfTransactionId: duplicate.duplicateOfTransactionId,
          duplicateReason: duplicate.duplicateReason,
        };
    result.push(next);
    checked.push(next);
  }

  return result;
}

/**
 * Score de rapprochement prévu/réel.
 * Seuils Phase 1 : >= 0.75 = suggestion forte, 0.55 à 0.74 = suggestion utilisateur,
 * < 0.55 = transaction non planifiée.
 */
export function getReconciliationScoreDetails(
  manual: ManualSide,
  tx: Pick<ImportedTransaction, "amountEur" | "date" | "category" | "labelRaw" | "labelNormalized">,
): ReconciliationScoreDetails {
  let score = 0;
  const reasons: string[] = [];
  const manualAmount = manual.amount;
  const importedAmount = Math.abs(tx.amountEur);
  const amountDiff = Math.abs(manualAmount - importedAmount);
  const maxAmount = Math.max(manualAmount, importedAmount, 1);
  const amountRatio = amountDiff / maxAmount;

  if (amountDiff < 0.01) {
    score += 0.45;
    reasons.push("montant identique");
  } else if (amountDiff <= 2) {
    score += 0.38;
    reasons.push("montant très proche");
  } else if (amountRatio <= 0.10) {
    score += 0.30;
    reasons.push("montant proche");
  } else if (amountRatio <= 0.25) {
    score += 0.18;
    reasons.push("écart de montant acceptable");
  }

  const daysDiff = dateDiffDays(manual.date, tx.date);
  if (daysDiff === 0) {
    score += 0.25;
    reasons.push("même date");
  } else if (daysDiff <= 3) {
    score += 0.15;
    reasons.push(`date proche (${Math.round(daysDiff)} j)`);
  } else if (manual.date.slice(0, 7) === tx.date.slice(0, 7)) {
    score += 0.08;
    reasons.push("même mois");
  }

  if (manual.category === tx.category) {
    score += 0.15;
    reasons.push("même catégorie");
  }

  const similarity = labelSimilarity(manual.label, tx.labelRaw || tx.labelNormalized);
  if (similarity >= 0.5) {
    score += 0.20;
    reasons.push("libellé proche");
  } else if (similarity > 0) {
    score += 0.10;
    reasons.push("mot-clé commun");
  }

  if (manual.isFixed === true || manual.isMandatory === true) {
    if (manual.category === tx.category || similarity > 0) {
      score += 0.10;
      reasons.push("charge récurrente compatible");
    }
  }

  return {
    score: Math.min(1, Number(score.toFixed(3))),
    reason: reasons.length > 0 ? reasons.join(" · ") : "aucun signal fort",
  };
}

export function scoreReconciliation(
  manualAmount: number,
  manualDate: string,
  importedAmount: number,
  importedDate: string,
  manualCategory: ExpenseCategory,
  importedCategory: ExpenseCategory,
): number {
  const manual: ManualSide = {
    expenseId: "score_preview",
    label: "",
    category: manualCategory,
    amount: manualAmount,
    date: manualDate,
    reconciliationStatus: "manual",
  };
  return getReconciliationScoreDetails(manual, {
    amountEur: importedAmount,
    date: importedDate,
    category: importedCategory,
    labelRaw: "",
    labelNormalized: "",
  }).score;
}

// ─── Interface du store ──────────────────────────────────────────────────────

interface ReconciliationStore {
  // ── Données
  transactions:  ImportedTransaction[];
  sessions:      ImportSession[];
  categoryRules: CategoryRule[];

  // ── Sélection active
  activeMonth: string | null;  // "YYYY-MM" — mois affiché dans le rapprochement

  // ── État UI
  isImporting: boolean;
  importError: string | null;

  // ── Actions — Import
  setImporting:        (v: boolean) => void;
  setImportError:      (e: string | null) => void;
  addSession:          (session: ImportSession) => void;
  addTransactions:     (txs: ImportedTransaction[]) => void;
  cancelSession:       (sessionId: string) => void;
  clearMonth:          (month: string) => void;

  // ── Actions — Statuts
  setStatus:           (id: string, status: ReconciliationStatus) => void;
  reconcileManual:     (transactionId: string, manualExpenseId: string) => void;
  unreconcile:         (transactionId: string) => void;
  ignoreTransaction:   (id: string) => void;
  setCategory:         (id: string, category: ExpenseCategory) => void;
  markIntegrated:      (transactionId: string, monthlyExpenseId: string) => void;
  unmarkIntegrated:    (transactionId: string) => void;

  // ── Actions — Règles apprises
  learnRule:           (labelPattern: string, category: ExpenseCategory) => void;
  deleteRule:          (id: string) => void;

  // ── Actions — Navigation
  setActiveMonth:      (month: string | null) => void;

  // ── Sélecteurs calculés
  getTransactionsForMonth:  (month: string) => ImportedTransaction[];
  getDebitTransactions:     (month: string) => ImportedTransaction[];
  getSummary:               (month: string, manualExpenses: ManualSide[]) => ReconciliationSummary;
  getPairs:                 (month: string, manualExpenses: ManualSide[]) => ReconciliationPair[];
  applyLearnedRules:        (label: string) => ExpenseCategory | null;
  getAvailableMonths:       () => string[];
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useReconciliationStore = create<ReconciliationStore>()(
  persist(
    (set, get) => ({
      transactions:  [],
      sessions:      [],
      categoryRules: [],
      activeMonth:   null,
      isImporting:   false,
      importError:   null,

      // ── Import ────────────────────────────────────────────────────────────

      setImporting: (v) => set({ isImporting: v }),
      setImportError: (e) => set({ importError: e }),

      addSession: (session) =>
        set((s) => ({ sessions: [...s.sessions, session] })),

      addTransactions: (txs) =>
        set((s) => {
          // Phase 2 : un import ne doit jamais créer silencieusement des doublons.
          // Un ID déjà présent est ignoré. Une transaction ressemblante est conservée,
          // mais marquée possible_duplicate pour décision utilisateur.
          const existingIds = new Set(s.transactions.map((t) => t.id));
          const unknownTxs = txs.filter((t) => !existingIds.has(t.id)).map(enrichTransactionDisplayLabel);
          const newTxs = markPossibleDuplicates(s.transactions, unknownTxs);
          return { transactions: [...s.transactions, ...newTxs] };
        }),

      cancelSession: (sessionId) =>
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === sessionId ? { ...sess, status: "cancelled" as const } : sess
          ),
          // Supprimer les transactions de cette session (non encore validées)
          transactions: s.transactions.filter((t) => !t.id.startsWith(sessionId)),
        })),

      clearMonth: (month) =>
        set((s) => ({
          transactions: s.transactions.filter((t) => t.month !== month),
        })),

      // ── Statuts ───────────────────────────────────────────────────────────

      setStatus: (id, status) =>
        set((s) => ({
          transactions: s.transactions.map((t) =>
            t.id === id ? { ...t, status } : t
          ),
        })),

      reconcileManual: (transactionId, manualExpenseId) =>
        set((s) => ({
          transactions: s.transactions.map((t) => {
            if (t.id === transactionId) {
              return { ...t, status: "reconciled" as const, matchedExpenseId: manualExpenseId };
            }
            if (t.matchedExpenseId === manualExpenseId && t.id !== transactionId) {
              return { ...t, status: "unmatched" as const, matchedExpenseId: null };
            }
            return t;
          }),
        })),

      unreconcile: (transactionId) =>
        set((s) => ({
          transactions: s.transactions.map((t) =>
            t.id === transactionId
              ? { ...t, status: "unmatched" as const, matchedExpenseId: null }
              : t
          ),
        })),

      ignoreTransaction: (id) =>
        set((s) => ({
          transactions: s.transactions.map((t) =>
            t.id === id ? { ...t, status: "ignored" as const } : t
          ),
        })),

      setCategory: (id, category) =>
        set((s) => ({
          transactions: s.transactions.map((t) =>
            t.id === id ? { ...t, category } : t
          ),
        })),

      markIntegrated: (transactionId, monthlyExpenseId) =>
        set((s) => ({
          transactions: s.transactions.map((t) =>
            t.id === transactionId
              ? { ...t, integratedMonthlyExpenseId: monthlyExpenseId, integratedAt: new Date().toISOString() }
              : t
          ),
        })),

      unmarkIntegrated: (transactionId) =>
        set((s) => ({
          transactions: s.transactions.map((t) => {
            if (t.id !== transactionId) return t;
            const { integratedMonthlyExpenseId: _integratedMonthlyExpenseId, integratedAt: _integratedAt, ...rest } = t;
            return rest;
          }),
        })),

      // ── Règles apprises ───────────────────────────────────────────────────

      learnRule: (labelPattern, category) => {
        const normalized = normalizeLabel(labelPattern);
        set((s) => {
          // Mise à jour si la règle existe déjà pour ce pattern
          const existing = s.categoryRules.find(
            (r) => r.labelPattern === normalized
          );
          if (existing) {
            return {
              categoryRules: s.categoryRules.map((r) =>
                r.id === existing.id
                  ? { ...r, category, usageCount: r.usageCount + 1 }
                  : r
              ),
            };
          }
          const newRule: CategoryRule = {
            id:           generateId(),
            labelPattern: normalized,
            category,
            confidence:   1.0,
            learnedAt:    new Date().toISOString().slice(0, 10),
            usageCount:   1,
          };
          return { categoryRules: [...s.categoryRules, newRule] };
        });
      },

      deleteRule: (id) =>
        set((s) => ({
          categoryRules: s.categoryRules.filter((r) => r.id !== id),
        })),

      // ── Navigation ────────────────────────────────────────────────────────

      setActiveMonth: (month) => set({ activeMonth: month }),

      // ── Sélecteurs ────────────────────────────────────────────────────────

      getTransactionsForMonth: (month) =>
        get().transactions.filter((t) => t.month === month),

      getDebitTransactions: (month) =>
        get().transactions.filter((t) => t.month === month && t.isDebit && t.status !== "ignored"),

      applyLearnedRules: (label) => {
        const normalized = normalizeLabel(label);
        const rules = get().categoryRules;
        // Priorité aux règles avec le plus grand usageCount
        const sorted = [...rules].sort((a, b) => b.usageCount - a.usageCount);
        for (const rule of sorted) {
          if (normalized.includes(rule.labelPattern)) {
            return rule.category;
          }
        }
        return null;
      },

      getAvailableMonths: () => {
        const months = new Set(get().transactions.map((t) => t.month));
        return [...months].sort().reverse();
      },

      getPairs: (month, manualExpenses) => {
        const txs = get().transactions.filter(
          (t) => t.month === month && t.isDebit
        );
        const pairs: ReconciliationPair[] = [];
        const usedManualIds = new Set<string>();
        const usedTxIds = new Set<string>();

        // 1. Rapprochements explicitement validés par l'utilisateur
        for (const tx of txs) {
          if (tx.status === "reconciled" && tx.matchedExpenseId) {
            const manual = manualExpenses.find((m) => m.expenseId === tx.matchedExpenseId);
            if (manual) {
              const importedSide: ImportedSide = {
                transactionId: tx.id,
                labelRaw: tx.labelRaw,
                labelDisplay: tx.labelDisplay,
                merchantLabel: tx.merchantLabel,
                category: tx.category,
                amount: Math.abs(tx.amountEur),
                date: tx.date,
                status: tx.status,
                score: tx.reconciliationScore,
              };
              const details = getReconciliationScoreDetails(manual, tx);
              pairs.push({
                manual: { ...manual, reconciliationStatus: "reconciled" },
                imported: importedSide,
                status: "reconciled",
                delta: Math.abs(tx.amountEur) - manual.amount,
                score: tx.reconciliationScore ?? details.score,
                reason: details.reason,
              });
              usedManualIds.add(manual.expenseId);
              usedTxIds.add(tx.id);
            }
          }
        }

        // 2. Transactions ignorées → hors rapprochement actif
        const activeTxs = txs.filter(
          (t) => !usedTxIds.has(t.id) && t.status !== "ignored"
        );

        // 3. Suggestions non destructives : aucune ligne prévue n'est modifiée tant que l'utilisateur ne clique pas sur Rapprocher.
        const freeManuals = manualExpenses.filter((m) => !usedManualIds.has(m.expenseId));

        for (const tx of activeTxs) {
          if (usedTxIds.has(tx.id)) continue;

          let best: { manual: ManualSide; score: number; reason: string } | null = null;

          for (const manual of freeManuals) {
            if (usedManualIds.has(manual.expenseId)) continue;
            const details = getReconciliationScoreDetails(manual, tx);
            if (best === null || details.score > best.score) {
              best = { manual, score: details.score, reason: details.reason };
            }
          }

          const importedSide: ImportedSide = {
            transactionId: tx.id,
            labelRaw: tx.labelRaw,
            labelDisplay: tx.labelDisplay,
            merchantLabel: tx.merchantLabel,
            category: tx.category,
            amount: Math.abs(tx.amountEur),
            date: tx.date,
            status: tx.status,
            score: best?.score,
          };

          if (tx.status === "possible_duplicate") {
            pairs.push({
              manual: best !== null ? { ...best.manual, reconciliationStatus: "manual" } : null,
              imported: importedSide,
              status: "possible_duplicate",
              delta: best !== null ? Math.abs(tx.amountEur) - best.manual.amount : undefined,
              score: best?.score,
              reason: best?.reason ?? "doublon bancaire possible",
            });
            usedTxIds.add(tx.id);
            continue;
          }

          if (best !== null && best.score >= 0.55) {
            pairs.push({
              manual: { ...best.manual, reconciliationStatus: "manual" },
              imported: importedSide,
              status: "suggested_match",
              delta: Math.abs(tx.amountEur) - best.manual.amount,
              score: best.score,
              reason: best.reason,
            });
            // On réserve le manuel dans l'affichage pour éviter plusieurs suggestions concurrentes.
            usedManualIds.add(best.manual.expenseId);
            usedTxIds.add(tx.id);
            continue;
          }

          pairs.push({
            manual: null,
            imported: importedSide,
            status: "imported_only",
          });
          usedTxIds.add(tx.id);
        }

        // 4. Dépenses manuelles sans réel correspondant
        for (const manual of freeManuals) {
          if (!usedManualIds.has(manual.expenseId)) {
            pairs.push({
              manual: { ...manual, reconciliationStatus: "unmatched" },
              imported: null,
              status: "manual_only",
            });
          }
        }

        const ORDER = { possible_duplicate: 0, suggested_match: 1, reconciled: 2, imported_only: 3, manual_only: 4 };
        pairs.sort((a, b) => ORDER[a.status] - ORDER[b.status]);

        return pairs;
      },

      getSummary: (month, manualExpenses) => {
        const txs = get().transactions.filter(
          (t) => t.month === month && t.isDebit
        );

        const totalImported   = txs.filter((t) => t.status !== "ignored").length;
        const totalReconciled = txs.filter((t) => t.status === "reconciled").length;
        const totalUnmatched  = txs.filter((t) => t.status === "unmatched").length;
        const totalIgnored    = txs.filter((t) => t.status === "ignored").length;
        const possibleDuplicates = txs.filter((t) => t.status === "possible_duplicate").length;

        const reconciledManualIds = new Set(
          txs.filter((t) => t.matchedExpenseId).map((t) => t.matchedExpenseId!)
        );
        const totalManualOnly = manualExpenses.filter(
          (m) => !reconciledManualIds.has(m.expenseId)
        ).length;

        // Rapport par enveloppe
        const categories = new Set<ExpenseCategory>([
          ...txs.map((t) => t.category),
          ...manualExpenses.map((m) => m.category),
        ]);

        const envelopes: EnvelopeReconciliationReport[] = [...categories].map((cat) => {
          const catTxs = txs.filter((t) => t.category === cat && t.status !== "ignored");
          const catManuals = manualExpenses.filter((m) => m.category === cat);

          const real = catTxs.reduce((s, t) => s + Math.abs(t.amountEur), 0);
          const planned = catManuals.reduce((s, m) => s + m.amount, 0);
          const reconciledTxs = catTxs.filter((t) => t.status === "reconciled");
          const reconciledIds = new Set(
            reconciledTxs.map((t) => t.matchedExpenseId).filter(Boolean)
          );
          const reconciled = reconciledTxs.reduce((s, t) => s + Math.abs(t.amountEur), 0);
          const unplanned = catTxs
            .filter((t) => !t.matchedExpenseId)
            .reduce((s, t) => s + Math.abs(t.amountEur), 0);
          const unreal = catManuals
            .filter((m) => !reconciledIds.has(m.expenseId))
            .reduce((s, m) => s + m.amount, 0);

          return {
            category: cat,
            label: CATEGORY_LABELS[cat],
            planned,
            real,
            reconciled,
            unplanned,
            unreal,
            delta: real - planned,
            transactionCount: catTxs.length,
          };
        });

        // Trier : dépassements d'abord
        envelopes.sort((a, b) => b.delta - a.delta);

        return {
          month,
          totalImported,
          totalReconciled,
          totalUnmatched,
          totalManualOnly,
          totalIgnored,
          possibleDuplicates,
          envelopes,
        };
      },
    }),

    {
      name: "simubudget-reconciliation",
      storage: createJSONStorage(() => profileScopedStorage()),
    }
  )
);
