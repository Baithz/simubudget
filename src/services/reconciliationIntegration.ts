// =============================================================================
// Fichier  : src/services/reconciliationIntegration.ts
// Auteur   : KREMER Régis
// Desc.    : Intégration contrôlée des transactions bancaires rapprochées dans
//            Mes Comptes, avec anti-doublon et traçabilité complète.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-05-03 | KREMER Régis | Création Phase 15.4 — intégration import bancaire
//   2026-05-04 | KREMER Régis | Phase 1 — intégration limitée aux rapprochements explicitement validés
//   2026-05-04 | KREMER Régis | Phase 2 — anti-doublons stricts et protection charges fixes
//   2026-05-04 | KREMER Régis | Phase 3 — intégration des libellés bancaires humains
// =============================================================================

import { useAccountingStore } from "@/store/accountingStore";
import { useReconciliationStore } from "@/store/reconciliationStore";
import type { MonthlyExpenseLine } from "@/types/accounting";
import type { ImportedTransaction, ManualSide, ReconciliationPair } from "@/types/reconciliation";
import { normalizeLabel } from "@/store/reconciliationStore";
import { getHumanBankLabel } from "@/services/bankLabelDisplay";

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

function sameCentAmount(a: number, b: number): boolean {
  return Math.round(Math.abs(a) * 100) === Math.round(Math.abs(b) * 100);
}

function lineLooksLikeImportedTransaction(line: MonthlyExpenseLine, tx: ImportedTransaction): boolean {
  if (line.month !== tx.month) return false;
  if (line.status === "ignored") return false;
  if (line.importedTransactionId === tx.id || line.matchedTransactionId === tx.id) return true;
  if (line.notes?.includes(`${IMPORT_NOTE_PREFIX}:${tx.id}`) === true) return true;

  const amountToCompare = line.realAmount ?? line.amount;
  if (!sameCentAmount(amountToCompare, Math.abs(tx.amountEur))) return false;

  const normalizedLineLabel = normalizeLabel(`${line.label} ${line.displayLabel ?? ""} ${line.rawBankLabel ?? ""}`);
  const normalizedBankLabel = normalizeLabel(`${tx.labelDisplay ?? ""} ${tx.labelRaw} ${tx.labelNormalized}`);
  if (normalizedLineLabel.length === 0 || normalizedBankLabel.length === 0) return false;

  if (normalizedLineLabel === normalizedBankLabel) return true;
  if (normalizedBankLabel.includes(normalizedLineLabel) || normalizedLineLabel.includes(normalizedBankLabel)) return true;

  const lineTokens = new Set(normalizedLineLabel.split(" ").filter((token) => token.length >= 4));
  const bankTokens = new Set(normalizedBankLabel.split(" ").filter((token) => token.length >= 4));
  let common = 0;
  for (const token of lineTokens) {
    if (bankTokens.has(token)) common += 1;
  }

  return common >= 2 && line.category === tx.category;
}

function findExistingImportedLine(tx: ImportedTransaction): MonthlyExpenseLine | null {
  return useAccountingStore.getState().monthlyExpenses.find((line) => lineLooksLikeImportedTransaction(line, tx)) ?? null;
}

function isLineAlreadyReconciledWithAnotherTransaction(line: MonthlyExpenseLine, tx: ImportedTransaction): boolean {
  return line.matchedTransactionId !== undefined && line.matchedTransactionId !== tx.id;
}

function buildProtectedReconciledPatch(
  targetLine: MonthlyExpenseLine,
  tx: ImportedTransaction,
  importedAt: string,
): Partial<Omit<MonthlyExpenseLine, "id" | "month">> {
  const humanLabel = tx.labelDisplay ?? getHumanBankLabel(tx.labelRaw, tx.category).displayLabel;
  const plannedReferenceAmount = targetLine.plannedReferenceAmount
    ?? targetLine.plannedAmount
    ?? targetLine.amount;
  const realAmount = Math.abs(tx.amountEur);
  const isRecurringProtected = targetLine.isFixed || targetLine.isMandatory || targetLine.sourceExpenseId !== undefined;

  return {
    amount: realAmount,
    realAmount,
    plannedReferenceAmount,
    reconciliationDelta: realAmount - plannedReferenceAmount,
    reconciliationStatus: "reconciled",
    matchedTransactionId: tx.id,
    status: "validated",
    importedTransactionId: tx.id,
    importedAt,
    importSource: tx.source,
    rawBankLabel: tx.labelRaw,
    importedRawLabel: tx.labelRaw,
    displayLabel: targetLine.label,
    notes: mergeNotes(mergeNotes(targetLine.notes, buildImportNote(tx)), `Libellé bancaire affiché : ${humanLabel}`),
    isRecurringProtected,
  };
}

function findTransaction(id: string): ImportedTransaction | null {
  return useReconciliationStore.getState().transactions.find((tx) => tx.id === id) ?? null;
}

function buildManualSides(month: string): ManualSide[] {
  return useAccountingStore.getState()
    .getMonthExpenses(month)
    .filter((line) =>
      line.amount > 0
      && line.status !== "ignored"
      && line.importedTransactionId === undefined
      && line.reconciliationStatus !== "real"
    )
    .map((line) => ({
      expenseId: line.id,
      label: line.label,
      category: line.category,
      amount: line.plannedReferenceAmount ?? line.plannedAmount ?? line.amount,
      date: `${month}-15`,
      reconciliationStatus: line.reconciliationStatus === "reconciled" ? "reconciled" as const : "manual" as const,
      isFixed: line.isFixed,
      isMandatory: line.isMandatory,
      ...(line.notes !== undefined ? { notes: line.notes } : {}),
    }));
}

function shouldSkipPair(pair: ReconciliationPair, tx: ImportedTransaction): "ignored" | "duplicate" | "credit" | null {
  if (tx.status === "ignored") return "ignored";
  if (pair.status === "possible_duplicate" || tx.status === "possible_duplicate") return "duplicate";
  if (!tx.isDebit) return "credit";
  return null;
}

function baseImportedLine(tx: ImportedTransaction, id: string, importedAt: string): Omit<MonthlyExpenseLine, "status"> & { status?: MonthlyExpenseLine["status"] } {
  const humanLabel = tx.labelDisplay ?? getHumanBankLabel(tx.labelRaw, tx.category).displayLabel;
  return {
    id,
    month: tx.month,
    label: humanLabel,
    displayLabel: humanLabel,
    category: tx.category,
    amount: Math.abs(tx.amountEur),
    realAmount: Math.abs(tx.amountEur),
    plannedReferenceAmount: 0,
    reconciliationDelta: Math.abs(tx.amountEur),
    reconciliationStatus: "real",
    isFixed: false,
    isMandatory: false,
    owner: "me",
    status: "added",
    notes: buildImportNote(tx),
    importedTransactionId: tx.id,
    importedAt,
    importSource: tx.source,
    rawBankLabel: tx.labelRaw,
    importedRawLabel: tx.labelRaw,
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

    const existingImportedLine = findExistingImportedLine(tx);
    if (existingImportedLine !== null) {
      useReconciliationStore.getState().markIntegrated(tx.id, existingImportedLine.id);
      result.alreadyIntegrated += 1;
      continue;
    }

    const importedAt = new Date().toISOString();

    if (pair.status === "reconciled" && tx.status === "reconciled" && pair.manual !== null) {
      const targetLine = accounting.monthlyExpenses.find((line) => line.id === pair.manual?.expenseId);
      if (targetLine === undefined) {
        result.errors.push(`Ligne manuelle introuvable : ${pair.manual.expenseId}`);
        continue;
      }

      if (isLineAlreadyReconciledWithAnotherTransaction(targetLine, tx)) {
        result.skippedDuplicates += 1;
        continue;
      }

      accounting.updateMonthlyExpense(
        pair.manual.expenseId,
        buildProtectedReconciledPatch(targetLine, tx, importedAt),
      );
      useReconciliationStore.getState().markIntegrated(tx.id, pair.manual.expenseId);
      result.updatedManualLines += 1;
      continue;
    }

    if (pair.status === "imported_only") {
      const id = importedMonthlyExpenseId(tx.id);
      const duplicateLine = findExistingImportedLine(tx);
      if (monthlyLineExists(id) || duplicateLine !== null) {
        useReconciliationStore.getState().markIntegrated(tx.id, duplicateLine?.id ?? id);
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
    if (pair.status === "reconciled" && tx.status !== "reconciled") continue;
    if (pair.status !== "reconciled" && pair.status !== "imported_only") continue;
    totalIntegrable += 1;
    if (tx.integratedMonthlyExpenseId !== undefined && monthlyLineExists(tx.integratedMonthlyExpenseId)) {
      alreadyIntegrated += 1;
    } else if (findExistingImportedLine(tx) !== null) {
      alreadyIntegrated += 1;
    }
  }

  return { totalIntegrable, alreadyIntegrated };
}
