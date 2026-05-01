// =============================================================================
// Fichier  : src/components/Accounting/CSVImportModal.tsx
// Auteur   : KREMER Regis
// Desc.    : Interface d'import CSV bancaire - glisser-deposer + apercu
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation du fichier Phase 4
// =============================================================================

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx } from "clsx";
import { parseCSV, transactionsToExpenses } from "../../services/csvImport";
import { useAccountingStore } from "@/store/accountingStore";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/types/accounting";
import type { ImportResult, BankTransaction } from "../../services/csvImport";
import type { ExpenseCategory } from "@/types/accounting";
import { formatEur } from "@/utils/formatCurrency";

interface Props {
  onClose: () => void;
}

type Step = "upload" | "preview" | "done";

export function CSVImportModal({ onClose }: Props) {
  const [step,       setStep]       = useState<Step>("upload");
  const [result,     setResult]     = useState<ImportResult | null>(null);
  const [importing,  setImporting]  = useState(false);
  const [dragOver,   setDragOver]   = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const addExpense = useAccountingStore((s) => s.addExpense);

  function handleFile(file: File) {
    if (!file.name.endsWith(".csv") && !file.name.endsWith(".txt")) {
      setError("Format non supporté. Exportez un fichier .csv depuis votre banque.");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      try {
        const parsed = parseCSV(content);
        setResult(parsed);
        setStep("preview");
      } catch (err) {
        setError("Impossible de lire ce fichier. Vérifiez qu'il s'agit d'un export CSV bancaire.");
      }
    };
    reader.readAsText(file, "UTF-8");
  }

  function handleImport() {
    if (!result) return;
    setImporting(true);

    const expenses = transactionsToExpenses(result.transactions);
    for (const exp of expenses) {
      addExpense({ ...exp, owner: "me" as const });
    }

    setTimeout(() => {
      setImporting(false);
      setStep("done");
    }, 600);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="[background:var(--bg-surface)]  rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 ">
          <h2 className="font-bold text-ink-primary ">
            Import CSV bancaire
          </h2>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-ink-muted hover:text-ink-secondary hover:[background:var(--bg-surface-2)]  transition-colors">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"/>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">

          {/* Etape 1 : Upload */}
          {step === "upload" && (
            <div className="space-y-5">
              <p className="text-sm text-ink-muted dark:text-ink-muted">
                Exportez votre historique bancaire au format CSV depuis votre espace en ligne, puis deposez-le ici.
                Formats supportes : <strong>Boursorama, BNP, Credit Agricole, LCL, Societe Generale, Caisse d'Epargne, La Banque Postale</strong>.
              </p>

              {/* Zone de drop */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                onClick={() => fileRef.current?.click()}
                className={clsx(
                  "border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all",
                  dragOver
                    ? "border-brand-400 bg-brand-50 dark:bg-brand-900/20"
                    : "[border-color:var(--border)]  hover:border-brand-300 hover:[background:var(--bg-surface-2)] /30"
                )}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
                  className="w-10 h-10 mx-auto text-ink-muted dark:text-ink-secondary mb-3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/>
                </svg>
                <p className="text-sm font-medium text-ink-secondary dark:text-ink-muted">
                  Glissez votre fichier CSV ici
                </p>
                <p className="text-xs text-ink-muted mt-1">ou cliquez pour selectionner</p>
                <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              </div>

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 px-4 py-3 rounded-xl">
                  {error}
                </p>
              )}

              {/* Guide d'export par banque */}
              <details className="text-xs text-ink-muted space-y-1">
                <summary className="cursor-pointer hover:text-ink-secondary dark:hover:text-ink-muted font-medium">
                  Comment exporter depuis ma banque ?
                </summary>
                <div className="mt-2 space-y-1 pl-3 border-l-2 border-slate-100 ">
                  <p><strong>Boursorama :</strong> Mes comptes → Telechargements → CSV</p>
                  <p><strong>BNP :</strong> Mes comptes → Telecharger mes operations → CSV</p>
                  <p><strong>Credit Agricole :</strong> Mes operations → Exporter → CSV</p>
                  <p><strong>LCL :</strong> Mes comptes → Exporter les operations → CSV</p>
                  <p><strong>Societe Generale :</strong> Mes comptes → Exporter → Fichier CSV</p>
                </div>
              </details>
            </div>
          )}

          {/* Etape 2 : Apercu */}
          {step === "preview" && result && (
            <div className="space-y-5">
              {/* Resume import */}
              <div className="bg-brand-50 dark:bg-brand-900/20 rounded-2xl p-4">
                <p className="text-sm font-semibold text-brand-800 dark:text-brand-200 mb-2">
                  {result.detectedBank} — {result.transactions.length} transactions détectées
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-xs text-brand-700 dark:text-brand-300">
                    <span className="font-medium">Total debits :</span> {formatEur(result.totalDebit)}
                  </div>
                  <div className="text-xs text-brand-700 dark:text-brand-300">
                    <span className="font-medium">Total credits :</span> {formatEur(result.totalCredit)}
                  </div>
                  <div className="text-xs text-brand-700 dark:text-brand-300 col-span-2">
                    <span className="font-medium">Periode :</span> {result.monthsDetected.join(", ")}
                  </div>
                </div>
              </div>

              {/* Repartition par catégorie */}
              <div>
                <p className="text-sm font-semibold text-ink-secondary  mb-3">
                  Dépenses par catégorie (mensuelles estimees)
                </p>
                <div className="space-y-2">
                  {(Object.entries(result.byCategory) as [ExpenseCategory, number][])
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 10)
                    .map(([cat, total]) => {
                      const monthly = total / Math.max(result.monthsDetected.length, 1);
                      return (
                        <div key={cat} className="flex items-center gap-3">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ background: CATEGORY_COLORS[cat] }} />
                          <span className="text-xs text-ink-secondary dark:text-ink-muted flex-1">
                            {CATEGORY_LABELS[cat]}
                          </span>
                          <span className="text-xs font-mono text-ink-secondary dark:text-ink-muted">
                            {formatEur(monthly)}/mois
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Erreurs eventuelles */}
              {result.errors.length > 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-950 rounded-xl p-3">
                  <p className="text-xs font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                    {result.errors.length} ligne(s) ignoree(s) :
                  </p>
                  {result.errors.slice(0, 3).map((e: string, i: number) => (
                    <p key={i} className="text-xs text-yellow-700 dark:text-yellow-300">{e}</p>
                  ))}
                </div>
              )}

              {/* Apercu transactions */}
              <div>
                <p className="text-xs font-semibold text-ink-muted uppercase tracking-widest mb-2">
                  Apercu des 5 premieres transactions
                </p>
                <div className="space-y-1">
                  {result.transactions.slice(0, 5).map((t: BankTransaction, i: number) => (
                    <TransactionRow key={i} tx={t} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Etape 3 : Done */}
          {step === "done" && (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-8 h-8 text-green-600 dark:text-green-400">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd"/>
                </svg>
              </div>
              <p className="font-bold text-ink-primary  text-lg">Import reussi !</p>
              <p className="text-sm text-ink-muted">
                Vos transactions ont ete importees et categorisees dans "Mes Comptes".
                Vérifiez et ajustez les catégories si necessaire.
              </p>
              <button onClick={onClose}
                className="px-6 py-2.5 bg-brand-500 text-white rounded-xl text-sm font-semibold hover:bg-brand-600 transition-colors">
                Voir mes comptes
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === "preview" && (
          <div className="px-6 py-4 border-t border-slate-100  flex gap-3">
            <button onClick={() => { setStep("upload"); setResult(null); }}
              className="flex-1 py-2.5 rounded-xl border [border-color:var(--border)]  text-sm font-medium text-ink-secondary dark:text-ink-muted hover:[background:var(--bg-surface-2)]  transition-colors">
              Recommencer
            </button>
            <button onClick={handleImport} disabled={importing}
              className="flex-1 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 disabled:opacity-50 transition-colors">
              {importing ? "Import en cours..." : `Importer ${result?.transactions.length} transactions`}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function TransactionRow({ tx }: { tx: BankTransaction }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-xl [background:var(--bg-surface-2)] /50">
      <span className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: CATEGORY_COLORS[tx.category as ExpenseCategory] }} />
      <span className="text-xs text-ink-muted flex-shrink-0 w-20">
        {tx.date.toLocaleDateString("fr-FR")}
      </span>
      <span className="text-xs text-ink-secondary dark:text-ink-muted flex-1 truncate">
        {tx.label}
      </span>
      <span className={clsx("text-xs font-mono font-semibold flex-shrink-0",
        tx.isDebit ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
      )}>
        {tx.isDebit ? "-" : "+"}{formatEur(Math.abs(tx.amount))}
      </span>
    </div>
  );
}
