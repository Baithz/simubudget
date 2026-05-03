// =============================================================================
// Fichier  : src/services/reconciliationIntegration.ts
// Auteur   : KREMER Régis
// Desc.    : Intégration contrôlée des transactions bancaires rapprochées dans
//            Mes Comptes, avec anti-doublon et traçabilité complète.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-05-03 | KREMER Régis | Création Phase 15.4 — intégration import bancaire
// =============================================================================

import { useAccountingStore } from "@/store/accountingStore";
import { useReconciliationStore } from "@/store/reconciliationStore";
import type { MonthlyExpenseLine } from "@/types/accounting";
import type { ImportedTransaction, ManualSide, ReconciliationPair } from "@/types/reconciliation";

export interface ReconciliationIntegrationResult {
  month: string;
  createdImportedLines: number;
  updatedManualLines: number;
  alreadyIntegrated: number;
  skippedIgnored: number;
  skippedDuplicates: number;
  skippedCredits: number;
  errors: string[];
}

const IMPORT_NOTE_PREFIX = "import:bancaire";

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
}

function importedMonthlyExpenseId(transactionId: string): string {
  return `bank_import_${safeId(transactionId)}`;
}

function buildImportNote(tx: ImportedTransaction): string {
  return `${IMPORT_NOTE_PREFIX}:${tx.id} · ${tx.source} · ${tx.date}`;
}

function mergeNotes(current: string | undefined, addition: string): string {
  if (current === undefined || current.trim().length === 0) return addition;
  if (current.includes(addition)) return current;
  return `${current}\n${addition}`;
}

function monthlyLineExists(id: string): boolean {
  return useAccountingStore.getState().monthlyExpenses.some((line) => line.id === id);
}

function findTransaction(id: string): ImportedTransaction | null {
  return useReconciliationStore.getState().transactions.find((tx) => tx.id === id) ?? null;
}

function buildManualSides(month: string): ManualSide[] {
  return useAccountingStore.getState()
    .getMonthExpenses(month)
    .filter((line) => line.amount > 0 && line.status !== "ignored")
    .map((line) => ({
      expenseId: line.id,
      label: line.label,
      category: line.category,
      amount: line.plannedAmount ?? line.amount,
      date: `${month}-15`,
      reconciliationStatus: "manual" as const,
    }));
}

function shouldSkipPair(pair: ReconciliationPair, tx: ImportedTransaction): "ignored" | "duplicate" | "credit" | null {
  if (tx.status === "ignored") return "ignored";
  if (pair.status === "possible_duplicate" || tx.status === "possible_duplicate") return "duplicate";
  if (!tx.isDebit) return "credit";
  return null;
}

function baseImportedLine(tx: ImportedTransaction, id: string, importedAt: string): Omit<MonthlyExpenseLine, "status"> & { status?: MonthlyExpenseLine["status"] } {
  return {
    id,
    month: tx.month,
    label: tx.labelRaw.trim().length > 0 ? tx.labelRaw.trim() : "Transaction bancaire importée",
    category: tx.category,
    amount: Math.abs(tx.amountEur),
    realAmount: Math.abs(tx.amountEur),
    isFixed: false,
    isMandatory: false,
    owner: "me",
    status: "added",
    notes: buildImportNote(tx),
    importedTransactionId: tx.id,
    importedAt,
    importSource: tx.source,
  };
}

export function integrateReconciliationMonth(month: string): ReconciliationIntegrationResult {
  const accounting = useAccountingStore.getState();
  const reconciliation = useReconciliationStore.getState();
  const manualSides = buildManualSides(month);
  const pairs = reconciliation.getPairs(month, manualSides);
  const result: ReconciliationIntegrationResult = {
    month,
    createdImportedLines: 0,
    updatedManualLines: 0,
    alreadyIntegrated: 0,
    skippedIgnored: 0,
    skippedDuplicates: 0,
    skippedCredits: 0,
    errors: [],
  };

  const importedPairs = pairs.filter((pair) => pair.imported !== null);

  for (const pair of importedPairs) {
    const imported = pair.imported;
    if (imported === null) continue;
    const tx = findTransaction(imported.transactionId);
    if (tx === null) {
      result.errors.push(`Transaction introuvable : ${imported.transactionId}`);
      continue;
    }

    const skip = shouldSkipPair(pair, tx);
    if (skip === "ignored") {
      result.skippedIgnored += 1;
      continue;
    }
    if (skip === "duplicate") {
      result.skippedDuplicates += 1;
      continue;
    }
    if (skip === "credit") {
      result.skippedCredits += 1;
      continue;
    }

    if (tx.integratedMonthlyExpenseId !== undefined && monthlyLineExists(tx.integratedMonthlyExpenseId)) {
      result.alreadyIntegrated += 1;
      continue;
    }

    const importedAt = new Date().toISOString();

    if (pair.status === "reconciled" && pair.manual !== null) {
      const targetLine = accounting.monthlyExpenses.find((line) => line.id === pair.manual?.expenseId);
      if (targetLine === undefined) {
        result.errors.push(`Ligne manuelle introuvable : ${pair.manual.expenseId}`);
        continue;
      }

      accounting.updateMonthlyExpense(pair.manual.expenseId, {
        amount: Math.abs(tx.amountEur),
        realAmount: Math.abs(tx.amountEur),
        status: "validated",
        notes: mergeNotes(targetLine.notes, buildImportNote(tx)),
        importedTransactionId: tx.id,
        importedAt,
        importSource: tx.source,
      });
      useReconciliationStore.getState().markIntegrated(tx.id, pair.manual.expenseId);
      result.updatedManualLines += 1;
      continue;
    }

    if (pair.status === "imported_only") {
      const id = importedMonthlyExpenseId(tx.id);
      if (monthlyLineExists(id)) {
        useReconciliationStore.getState().markIntegrated(tx.id, id);
        result.alreadyIntegrated += 1;
        continue;
      }
      const createdId = accounting.upsertImportedMonthlyExpense(baseImportedLine(tx, id, importedAt));
      useReconciliationStore.getState().markIntegrated(tx.id, createdId);
      result.createdImportedLines += 1;
    }
  }

  return result;
}

export function getReconciliationIntegrationState(month: string): { totalIntegrable: number; alreadyIntegrated: number } {
  const reconciliation = useReconciliationStore.getState();
  const manualSides = buildManualSides(month);
  const pairs = reconciliation.getPairs(month, manualSides);
  let totalIntegrable = 0;
  let alreadyIntegrated = 0;

  for (const pair of pairs) {
    if (pair.imported === null) continue;
    const tx = findTransaction(pair.imported.transactionId);
    if (tx === null) continue;
    const skip = shouldSkipPair(pair, tx);
    if (skip !== null) continue;
    if (pair.status !== "reconciled" && pair.status !== "imported_only") continue;
    totalIntegrable += 1;
    if (tx.integratedMonthlyExpenseId !== undefined && monthlyLineExists(tx.integratedMonthlyExpenseId)) {
      alreadyIntegrated += 1;
    }
  }

  return { totalIntegrable, alreadyIntegrated };
}
