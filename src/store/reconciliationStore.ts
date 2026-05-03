// =============================================================================
// Fichier  : src/store/reconciliationStore.ts
// Auteur   : KREMER Régis
// Desc.    : Store Zustand pour l'import bancaire et le rapprochement prévu/réel.
//            Gère les transactions importées, les règles apprises et les sessions.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-05-03 | KREMER Régis | Création Phase 15.1 — import CSV et rapprochement
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

/**
 * Score de rapprochement entre une dépense manuelle et une transaction importée.
 * Retourne un score 0.0 → 1.0.
 * Score >= 0.7 → rapprochement automatique proposé.
 */
export function scoreReconciliation(
  manualAmount: number,  // en €
  manualDate:   string,  // "YYYY-MM-DD"
  importedAmount: number, // en € positif (abs)
  importedDate:   string, // "YYYY-MM-DD"
  manualCategory:   ExpenseCategory,
  importedCategory: ExpenseCategory,
): number {
  let score = 0.0;

  // Montant exact → signal fort
  if (Math.abs(manualAmount - importedAmount) < 0.01) {
    score += 0.6;
  } else if (Math.abs(manualAmount - importedAmount) <= 2) {
    // Écart ≤ 2 € (frais CB, arrondis) → signal fort partiel
    score += 0.4;
  }

  // Proximité de date
  const d1 = new Date(manualDate).getTime();
  const d2 = new Date(importedDate).getTime();
  const daysDiff = Math.abs(d1 - d2) / (1000 * 60 * 60 * 24);
  if (daysDiff === 0)       score += 0.3;
  else if (daysDiff <= 1)   score += 0.22;
  else if (daysDiff <= 3)   score += 0.15;
  else if (daysDiff <= 7)   score += 0.05;

  // Catégorie identique → signal complémentaire
  if (manualCategory === importedCategory) score += 0.1;

  return Math.min(1.0, score);
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
          // Déduplication : on ne réimporte pas un id déjà présent
          const existingIds = new Set(s.transactions.map((t) => t.id));
          const newTxs = txs.filter((t) => !existingIds.has(t.id));
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
          transactions: s.transactions.map((t) =>
            t.id === transactionId
              ? { ...t, status: "reconciled" as const, matchedExpenseId: manualExpenseId }
              : // Si une autre transaction était déjà appairée à ce manuel → on la libère
              t.matchedExpenseId === manualExpenseId && t.id !== transactionId
              ? { ...t, status: "unmatched" as const, matchedExpenseId: null }
              : t
          ),
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

        // 1. Transactions déjà appairées explicitement
        for (const tx of txs) {
          if (tx.status === "reconciled" && tx.matchedExpenseId) {
            const manual = manualExpenses.find((m) => m.expenseId === tx.matchedExpenseId);
            if (manual) {
              const importedSide: ImportedSide = {
                transactionId: tx.id,
                labelRaw: tx.labelRaw,
                category: tx.category,
                amount: Math.abs(tx.amountEur),
                date: tx.date,
                status: tx.status,
              };
              pairs.push({
                manual: { ...manual, reconciliationStatus: "reconciled" },
                imported: importedSide,
                status: "reconciled",
                delta: Math.abs(tx.amountEur) - manual.amount,
              });
              usedManualIds.add(manual.expenseId);
              usedTxIds.add(tx.id);
            }
          }
        }

        // 2. Transactions ignorées → pas dans les pairs
        const activeTxs = txs.filter(
          (t) => !usedTxIds.has(t.id) && t.status !== "ignored"
        );

        // 3. Rapprochement automatique pour les non-traitées
        const freeManuals = manualExpenses.filter((m) => !usedManualIds.has(m.expenseId));

        for (const tx of activeTxs) {
          if (usedTxIds.has(tx.id)) continue;

          let bestScore = 0;
          let bestManual: ManualSide | null = null;

          for (const manual of freeManuals) {
            if (usedManualIds.has(manual.expenseId)) continue;
            const score = scoreReconciliation(
              manual.amount, manual.date,
              Math.abs(tx.amountEur), tx.date,
              manual.category, tx.category
            );
            if (score > bestScore) {
              bestScore = score;
              bestManual = manual;
            }
          }

          const importedSide: ImportedSide = {
            transactionId: tx.id,
            labelRaw: tx.labelRaw,
            category: tx.category,
            amount: Math.abs(tx.amountEur),
            date: tx.date,
            status: tx.status,
          };

          if (bestScore >= 0.7 && bestManual) {
            // Rapprochement automatique proposé (score suffisant)
            pairs.push({
              manual: { ...bestManual, reconciliationStatus: "reconciled" },
              imported: importedSide,
              status: "reconciled",
              delta: Math.abs(tx.amountEur) - bestManual.amount,
            });
            usedManualIds.add(bestManual.expenseId);
            usedTxIds.add(tx.id);
          } else if (tx.status === "possible_duplicate") {
            pairs.push({
              manual: null,
              imported: importedSide,
              status: "possible_duplicate",
            });
            usedTxIds.add(tx.id);
          } else {
            // Pas de correspondance → transaction orpheline
            pairs.push({
              manual: null,
              imported: importedSide,
              status: "imported_only",
            });
            usedTxIds.add(tx.id);
          }
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

        // Tri : d'abord doublons possibles, puis appairés, puis orphelins
        const ORDER = { possible_duplicate: 0, reconciled: 1, imported_only: 2, manual_only: 3 };
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
