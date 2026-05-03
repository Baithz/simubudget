// =============================================================================
// Fichier  : src/components/Accounting/CSVImportModal.tsx
// Auteur   : KREMER Régis
// Desc.    : Interface d'import CSV bancaire — glisser-déposer, aperçu,
//            validation par transaction et intégration dans le rapprochement.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Régis | Création du fichier Phase 4
//   2026-05-02 | KREMER Régis | Correction lint ESLint 9
//   2026-05-03 | KREMER Régis | Phase 15.1 — pipeline enrichi ImportedTransaction,
//                               validation individuelle, catégorisation modifiable,
//                               intégration reconciliationStore
// =============================================================================

import { useState, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx } from "clsx";
import { parseOFX, parseQIF } from "@/services/ofxImport";
import {
  buildTransactionsFromMapping,
  cellToDisplay,
  getPreviewRows,
  parseExcelImportTable,
  parseTextImportTable,
  type ImportColumnMapping,
  type ImportTableAnalysis,
} from "@/services/bankImportMapping";
import { useReconciliationStore } from "@/store/reconciliationStore";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/types/accounting";
import { formatEur } from "@/utils/formatCurrency";
import type { ImportedTransaction } from "@/types/reconciliation";
import type { ExpenseCategory } from "@/types/accounting";

interface Props {
  onClose: () => void;
  /** Mois actif (YYYY-MM) pour pré-filtrer la vue après import */
  activeMonth?: string;
}

type Step = "upload" | "mapping" | "preview" | "validate" | "done";

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y?.slice(2)}`;
}

// ─── Ligne transaction dans la prévisualisation ───────────────────────────────

function TransactionRow({
  tx,
  selected,
  onToggle,
  onCategoryChange,
}: {
  tx: ImportedTransaction;
  selected: boolean;
  onToggle: () => void;
  onCategoryChange: (cat: ExpenseCategory) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div
      className={clsx(
        "rounded-lg transition-all",
        selected ? "opacity-100" : "opacity-40",
      )}
      style={{
        background: selected ? "var(--bg-surface)" : "var(--bg-surface-2)",
        border: `1px solid ${selected ? "var(--border-brand)" : "var(--border)"}`,
      }}
    >
      <div className="flex items-center gap-3 p-3">
        {/* Checkbox */}
        <button
          type="button"
          onClick={onToggle}
          className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded"
          style={{
            background: selected ? "var(--brand-1)" : "var(--bg-surface-3)",
            border: `1.5px solid ${selected ? "var(--brand-1)" : "var(--border)"}`,
          }}
        >
          {selected && (
            <svg viewBox="0 0 10 10" fill="white" className="h-2.5 w-2.5">
              <path
                d="M8.5 2.5 4 7 1.5 4.5"
                stroke="white"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>

        {/* Date */}
        <span
          className="w-14 flex-shrink-0 font-mono text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          {formatDate(tx.date)}
        </span>

        {/* Libellé */}
        <span
          className="min-w-0 flex-1 truncate text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          {tx.labelRaw}
        </span>

        {/* Catégorie */}
        <button
          type="button"
          onClick={() => setShowPicker((v) => !v)}
          className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors hover:opacity-80"
          style={{
            background: `${CATEGORY_COLORS[tx.category]}22`,
            color: CATEGORY_COLORS[tx.category],
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: CATEGORY_COLORS[tx.category] }}
          />
          {CATEGORY_LABELS[tx.category]}
          <svg viewBox="0 0 10 10" fill="currentColor" className="h-2.5 w-2.5">
            <path
              d="M2.5 3.5 5 6l2.5-2.5"
              stroke="currentColor"
              strokeWidth="1.2"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        </button>

        {/* Montant */}
        <span
          className="w-20 flex-shrink-0 text-right font-mono text-sm font-bold"
          style={{ color: tx.isDebit ? "var(--fin-red)" : "var(--fin-green)" }}
        >
          {tx.isDebit ? "-" : "+"}
          {formatEur(Math.abs(tx.amountEur))}
        </span>
      </div>

      {/* Picker catégorie */}
      <AnimatePresence>
        {showPicker && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden border-t"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="flex flex-wrap gap-1.5 p-3">
              {(Object.keys(CATEGORY_LABELS) as ExpenseCategory[]).map(
                (cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      onCategoryChange(cat);
                      setShowPicker(false);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors hover:opacity-80"
                    style={{
                      background:
                        tx.category === cat
                          ? `${CATEGORY_COLORS[cat]}22`
                          : "var(--bg-surface-2)",
                      color:
                        tx.category === cat
                          ? CATEGORY_COLORS[cat]
                          : "var(--text-secondary)",
                    }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: CATEGORY_COLORS[cat] }}
                    />
                    {CATEGORY_LABELS[cat]}
                  </button>
                ),
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Badge doublon possible */}
      {tx.status === "possible_duplicate" && (
        <div
          className="flex items-center gap-1.5 border-t px-3 py-1.5"
          style={{
            borderColor: "var(--fin-amber-border)",
            background: "var(--fin-amber-bg)",
          }}
        >
          <svg
            viewBox="0 0 12 12"
            fill="currentColor"
            className="h-3 w-3"
            style={{ color: "var(--fin-amber)" }}
          >
            <path d="M5.148 1.584a1 1 0 0 1 1.704 0l4.5 7.5A1 1 0 0 1 10.5 10.5h-9a1 1 0 0 1-.852-1.416l4.5-7.5ZM6 5.25a.75.75 0 0 0-1.5 0v1.5a.75.75 0 0 0 1.5 0v-1.5ZM6 8.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z" />
          </svg>
          <span
            className="text-xs font-medium"
            style={{ color: "var(--fin-amber)" }}
          >
            Doublon possible — déjà importé précédemment
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Sélecteur de colonne stable (hors rendu parent) ─────────────────────────

interface ColumnOption {
  index: number;
  label: string;
}

interface SelectColumnProps {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  columnOptions: ColumnOption[];
  allowNone?: boolean;
}

function SelectColumn({
  label,
  value,
  onChange,
  columnOptions,
  allowNone = false,
}: SelectColumnProps) {
  return (
    <label
      className="space-y-1 text-xs font-bold uppercase tracking-wider"
      style={{ color: "var(--text-muted)" }}
    >
      {label}
      <select
        value={value ?? ""}
        onChange={(event) =>
          onChange(event.target.value === "" ? null : Number(event.target.value))
        }
        className="w-full rounded-lg px-3 py-2 text-sm font-semibold outline-none"
        style={{
          background: "var(--bg-surface-2)",
          color: "var(--text-primary)",
          border: "1px solid var(--border)",
        }}
      >
        {allowNone && <option value="">Non utilisé</option>}
        {columnOptions.map((option) => (
          <option key={option.index} value={option.index}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// ─── Mapping manuel des colonnes ─────────────────────────────────────────────

function ColumnMappingStep({
  analysis,
  mapping,
  onMappingChange,
  onBack,
  onConfirm,
}: {
  analysis: ImportTableAnalysis;
  mapping: ImportColumnMapping;
  onMappingChange: (mapping: ImportColumnMapping) => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const headerRow = analysis.rows[mapping.headerRowIndex] ?? [];
  const previewRows = getPreviewRows(analysis, mapping, 5);
  const columnCount = Math.max(
    ...analysis.rows.slice(0, 20).map((row) => row.length),
    0,
  );
  const columnOptions = Array.from({ length: columnCount }, (_, index) => {
    const header = cellToDisplay(headerRow[index] ?? null);
    return {
      index,
      label: header
        ? `${index + 1} — ${header}`
        : `${index + 1} — colonne ${index + 1}`,
    };
  });

  function update<K extends keyof ImportColumnMapping>(
    key: K,
    value: ImportColumnMapping[K],
  ) {
    onMappingChange({ ...mapping, [key]: value });
  }


  const canConfirm =
    mapping.dateCol >= 0 &&
    mapping.labelCol >= 0 &&
    (mapping.amountCol !== null ||
      (mapping.debitCol !== null && mapping.creditCol !== null));

  return (
    <motion.div
      key="mapping"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-4"
    >
      <div
        className="rounded-xl p-4"
        style={{
          background: "var(--fin-amber-bg)",
          border: "1px solid var(--fin-amber-border)",
        }}
      >
        <p className="text-sm font-bold" style={{ color: "var(--fin-amber)" }}>
          Vérification du mapping des colonnes
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          SimuBudget a analysé le fichier, mais certains exports bancaires
          utilisent des colonnes atypiques. Sélectionnez les colonnes à utiliser
          puis validez l'aperçu.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label
          className="space-y-1 text-xs font-bold uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          Ligne d'en-têtes
          <select
            value={mapping.headerRowIndex}
            onChange={(event) =>
              update("headerRowIndex", Number(event.target.value))
            }
            className="w-full rounded-lg px-3 py-2 text-sm font-semibold outline-none"
            style={{
              background: "var(--bg-surface-2)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
            }}
          >
            <option value={-1}>
              Aucune ligne d'en-têtes — données dès la première ligne
            </option>
            {analysis.rows.slice(0, 30).map((row, index) => (
              <option key={index} value={index}>
                Ligne {index + 1} —{" "}
                {row
                  .map(cellToDisplay)
                  .filter(Boolean)
                  .slice(0, 4)
                  .join(" | ") || "vide"}
              </option>
            ))}
          </select>
        </label>
        <label
          className="space-y-1 text-xs font-bold uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          Format date
          <select
            value={mapping.dateFormat}
            onChange={(event) =>
              update(
                "dateFormat",
                event.target.value as ImportColumnMapping["dateFormat"],
              )
            }
            className="w-full rounded-lg px-3 py-2 text-sm font-semibold outline-none"
            style={{
              background: "var(--bg-surface-2)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
            }}
          >
            <option value="auto">Auto</option>
            <option value="dd/mm/yyyy">JJ/MM/AAAA</option>
            <option value="yyyy-mm-dd">AAAA-MM-JJ</option>
            <option value="dd-mm-yyyy">JJ-MM-AAAA</option>
            <option value="mm/dd/yyyy">MM/JJ/AAAA</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SelectColumn
          label="Date"
          value={mapping.dateCol}
          columnOptions={columnOptions}
          onChange={(value) => value !== null && update("dateCol", value)}
        />
        <SelectColumn
          label="Libellé"
          value={mapping.labelCol}
          columnOptions={columnOptions}
          onChange={(value) => value !== null && update("labelCol", value)}
        />
        <SelectColumn
          label="Montant signé"
          value={mapping.amountCol}
          columnOptions={columnOptions}
          onChange={(value) => update("amountCol", value)}
          allowNone
        />
        <SelectColumn
          label="Débit"
          value={mapping.debitCol}
          columnOptions={columnOptions}
          onChange={(value) => update("debitCol", value)}
          allowNone
        />
        <SelectColumn
          label="Crédit"
          value={mapping.creditCol}
          columnOptions={columnOptions}
          onChange={(value) => update("creditCol", value)}
          allowNone
        />
      </div>

      <div
        className="overflow-hidden rounded-xl"
        style={{ border: "1px solid var(--border)" }}
      >
        <div
          className="px-3 py-2 text-xs font-bold uppercase tracking-wider"
          style={{
            background: "var(--bg-surface-2)",
            color: "var(--text-muted)",
          }}
        >
          Aperçu après mapping
        </div>
        <div className="max-h-48 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead
              style={{
                background: "var(--bg-surface-2)",
                color: "var(--text-muted)",
              }}
            >
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Libellé</th>
                <th className="px-3 py-2 text-right">
                  Montant / Débit / Crédit
                </th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, index) => (
                <tr
                  key={index}
                  style={{ borderTop: "1px solid var(--border)" }}
                >
                  <td className="px-3 py-2 font-mono">
                    {cellToDisplay(row[mapping.dateCol] ?? null)}
                  </td>
                  <td className="px-3 py-2">
                    {cellToDisplay(row[mapping.labelCol] ?? null)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {mapping.amountCol !== null
                      ? cellToDisplay(row[mapping.amountCol] ?? null)
                      : `${cellToDisplay(row[mapping.debitCol ?? -1] ?? null)} / ${cellToDisplay(row[mapping.creditCol ?? -1] ?? null)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-between gap-3">
        <button type="button" onClick={onBack} className="btn-mini">
          Retour
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!canConfirm}
          className="btn-mini-green disabled:opacity-40"
        >
          Valider ce mapping
        </button>
      </div>
    </motion.div>
  );
}

// ─── Modal principale ─────────────────────────────────────────────────────────

export function CSVImportModal({ onClose }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);

  // Transactions parsées — modifiables avant validation
  const [parsedTxs, setParsedTxs] = useState<ImportedTransaction[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detectedBank, setDetectedBank] = useState("");
  const [sessionErrors, setSessionErrors] = useState<string[]>([]);
  const [importAnalysis, setImportAnalysis] =
    useState<ImportTableAnalysis | null>(null);
  const [columnMapping, setColumnMapping] =
    useState<ImportColumnMapping | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  const addTransactions = useReconciliationStore((s) => s.addTransactions);
  const addSession = useReconciliationStore((s) => s.addSession);
  const categoryRules = useReconciliationStore((s) => s.categoryRules);

  // Transactions sélectionnées (débit uniquement par défaut)
  const debitTxs = useMemo(
    () => parsedTxs.filter((t) => t.isDebit),
    [parsedTxs],
  );
  const creditTxs = useMemo(
    () => parsedTxs.filter((t) => !t.isDebit),
    [parsedTxs],
  );
  const selectedCount = selectedIds.size;

  // Totaux des sélectionnées
  const totals = useMemo(() => {
    const selected = parsedTxs.filter((t) => selectedIds.has(t.id));
    return {
      debit: selected
        .filter((t) => t.isDebit)
        .reduce((s, t) => s + Math.abs(t.amountEur), 0),
      credit: selected
        .filter((t) => !t.isDebit)
        .reduce((s, t) => s + t.amountEur, 0),
    };
  }, [parsedTxs, selectedIds]);

  // ── Parsing du fichier — routage selon l'extension ───────────────────────

  function handleFile(file: File) {
    const name = file.name.toLowerCase();
    const isCSV = name.endsWith(".csv") || name.endsWith(".txt");
    const isXLSX = name.endsWith(".xlsx");
    const isXLS = name.endsWith(".xls");
    const isOFX = name.endsWith(".ofx") || name.endsWith(".qfx");
    const isQIF = name.endsWith(".qif");

    if (!isCSV && !isXLSX && !isXLS && !isOFX && !isQIF) {
      setError(
        "Format non supporté. Formats acceptés : CSV, Excel (.xlsx / .xls), OFX, QFX, QIF.",
      );
      return;
    }

    setError(null);
    setImportAnalysis(null);
    setColumnMapping(null);

    if (isXLSX || isXLS) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer;
          const analysis = parseExcelImportTable(buffer, file.name);
          routeAnalysisResult(analysis);
        } catch (_err) {
          setError(
            "Impossible de lire ce fichier Excel. Vérifiez qu'il n'est pas protégé par un mot de passe.",
          );
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      try {
        if (isOFX) {
          applyParseResult(parseOFX(content, file.name, categoryRules));
          return;
        }
        if (isQIF) {
          applyParseResult(parseQIF(content, file.name, categoryRules));
          return;
        }
        const analysis = parseTextImportTable(content, file.name);
        routeAnalysisResult(analysis);
      } catch (_err) {
        setError(
          "Impossible de lire ce fichier. Vérifiez qu'il s'agit d'un export de relevé bancaire.",
        );
      }
    };
    reader.readAsText(file, "UTF-8");
  }

  function routeAnalysisResult(analysis: ImportTableAnalysis) {
    setImportAnalysis(analysis);
    const mapping = analysis.suggestedMapping ?? {
      headerRowIndex: 0,
      dateCol: 0,
      labelCol: 1,
      amountCol: 2,
      debitCol: null,
      creditCol: null,
      dateFormat: "auto" as const,
    };
    setColumnMapping(mapping);

    if (analysis.suggestedMapping && analysis.confidence >= 0.72) {
      const result = buildTransactionsFromMapping(
        analysis,
        analysis.suggestedMapping,
        categoryRules,
      );
      if (result.transactions.length > 0) {
        applyParseResult(result);
        return;
      }
    }

    setDetectedBank(analysis.detectedBank);
    setSessionErrors(analysis.warnings);
    setStep("mapping");
  }

  function confirmManualMapping() {
    if (!importAnalysis || !columnMapping) return;
    const result = buildTransactionsFromMapping(
      importAnalysis,
      columnMapping,
      categoryRules,
    );
    if (result.transactions.length === 0) {
      setError(
        "Aucune transaction détectée avec ce mapping. Vérifiez les colonnes Date, Libellé et Montant.",
      );
      return;
    }
    applyParseResult(result);
  }

  function applyParseResult(result: {
    transactions: ImportedTransaction[];
    detectedBank: string;
    errors: string[];
  }) {
    setParsedTxs(result.transactions);
    setDetectedBank(result.detectedBank);
    setSessionErrors(result.errors);
    const defaultSelected = new Set(
      result.transactions
        .filter((t) => t.isDebit && t.status !== "possible_duplicate")
        .map((t) => t.id),
    );
    setSelectedIds(defaultSelected);
    setStep("preview");
  }

  // ── Modification locale avant validation ──────────────────────────────────

  function toggleTx(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === debitTxs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(debitTxs.map((t) => t.id)));
    }
  }

  function updateCategory(id: string, category: ExpenseCategory) {
    setParsedTxs((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              category,
              categoryConfidence: 1.0,
            }
          : t,
      ),
    );
  }

  // ── Validation finale → store ─────────────────────────────────────────────

  function handleValidate() {
    if (selectedCount === 0) return;
    setImporting(true);

    const selectedTxs = parsedTxs.filter((t) => selectedIds.has(t.id));
    const months = [...new Set(selectedTxs.map((t) => t.month))].sort();
    const sessionId =
      selectedTxs[0]?.id.split("_").slice(0, 2).join("_") ??
      `sess_${Date.now()}`;

    addSession({
      id: sessionId,
      importedAt: new Date().toISOString(),
      detectedBank,
      totalDebits: selectedTxs
        .filter((t) => t.isDebit)
        .reduce((s, t) => s + Math.abs(t.amountEur), 0),
      totalCredits: selectedTxs
        .filter((t) => !t.isDebit)
        .reduce((s, t) => s + t.amountEur, 0),
      transactionCount: selectedTxs.length,
      months,
      errors: sessionErrors,
      status: "validated",
    });

    addTransactions(selectedTxs);

    setTimeout(() => {
      setImporting(false);
      setStep("done");
    }, 400);
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,.5)", backdropFilter: "blur(4px)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        className="relative z-10 flex w-full max-w-2xl flex-col rounded-2xl overflow-hidden"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-lg)",
          maxHeight: "90vh",
        }}
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2 }}
      >
        {/* Header */}
        <div
          className="flex flex-shrink-0 items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div>
            <h2
              className="text-base font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              Import bancaire
            </h2>
            {step !== "upload" && (
              <p
                className="text-xs font-medium"
                style={{ color: "var(--text-muted)" }}
              >
                {detectedBank} · {parsedTxs.length} transaction
                {parsedTxs.length > 1 ? "s" : ""} détectée
                {parsedTxs.length > 1 ? "s" : ""}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:opacity-70"
            style={{
              background: "var(--bg-surface-2)",
              color: "var(--text-muted)",
            }}
          >
            <svg viewBox="0 0 12 12" fill="currentColor" className="h-3 w-3">
              <path
                d="M10.5 1.5 1.5 10.5M1.5 1.5l9 9"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Corps — scrollable */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <AnimatePresence mode="wait">
            {/* ── Étape 1 : Upload ─────────────────────────────────────────── */}
            {step === "upload" && (
              <motion.div
                key="upload"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {/* Zone de dépôt */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const file = e.dataTransfer.files[0];
                    if (file) handleFile(file);
                  }}
                  onClick={() => fileRef.current?.click()}
                  className={clsx(
                    "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-all",
                    dragOver
                      ? "border-brand-DEFAULT"
                      : "border-[var(--border-hover)]",
                  )}
                  style={{
                    background: dragOver
                      ? "var(--fin-blue-bg)"
                      : "var(--bg-surface-2)",
                  }}
                >
                  <svg
                    viewBox="0 0 32 32"
                    fill="currentColor"
                    className="h-10 w-10"
                    style={{ color: "var(--brand-1)" }}
                  >
                    <path d="M16 4 8 12h5v10h6V12h5L16 4ZM8 24h16v2H8v-2Z" />
                  </svg>
                  <div>
                    <p
                      className="font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      Glissez votre relevé bancaire ici
                    </p>
                    <p
                      className="mt-1 text-sm"
                      style={{ color: "var(--text-muted)" }}
                    >
                      ou cliquez pour sélectionner un fichier
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {[
                      "CSV",
                      "Excel .xlsx",
                      "Excel .xls",
                      "OFX / QFX",
                      "QIF",
                    ].map((fmt) => (
                      <span
                        key={fmt}
                        className="rounded-md px-2 py-0.5 text-xs font-semibold"
                        style={{
                          background: "var(--bg-surface-3)",
                          color: "var(--text-muted)",
                        }}
                      >
                        {fmt}
                      </span>
                    ))}
                  </div>
                  <p
                    className="text-xs"
                    style={{ color: "var(--text-placeholder)" }}
                  >
                    Boursorama · BNP · Crédit Agricole · LCL · Société Générale
                    · Caisse d'Épargne · La Banque Postale · Revolut · N26 ·
                    Fortuneo · CIC
                  </p>
                </div>

                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.txt,.xlsx,.xls,.ofx,.qfx,.qif"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />

                {error && (
                  <div
                    className="rounded-lg p-3 text-sm font-medium"
                    style={{
                      background: "var(--fin-red-bg)",
                      color: "var(--fin-red)",
                      border: "1px solid var(--fin-red-border)",
                    }}
                  >
                    {error}
                  </div>
                )}

                {/* Notice sécurité */}
                <div
                  className="flex items-start gap-2 rounded-lg p-3"
                  style={{ background: "var(--bg-surface-2)" }}
                >
                  <svg
                    viewBox="0 0 12 12"
                    fill="currentColor"
                    className="mt-0.5 h-3 w-3 flex-shrink-0"
                    style={{ color: "var(--fin-green)" }}
                  >
                    <path d="M6 .5 1.5 2v4c0 2.8 2 5.3 4.5 5.9C8.5 11.3 10.5 8.8 10.5 6V2L6 .5Zm1.78 4.72-2 2a.75.75 0 0 1-1.06 0l-1-1a.75.75 0 0 1 1.06-1.06l.47.47 1.47-1.47a.75.75 0 1 1 1.06 1.06Z" />
                  </svg>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Aucune donnée n'est transmise sur internet. Le fichier est
                    lu localement sur votre appareil.
                  </p>
                </div>
              </motion.div>
            )}

            {step === "mapping" && importAnalysis && columnMapping && (
              <ColumnMappingStep
                analysis={importAnalysis}
                mapping={columnMapping}
                onMappingChange={setColumnMapping}
                onBack={() => setStep("upload")}
                onConfirm={confirmManualMapping}
              />
            )}

            {/* ── Étape 2 : Aperçu et validation ───────────────────────────── */}
            {step === "preview" && (
              <motion.div
                key="preview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {/* Résumé */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    {
                      label: "Débits",
                      value: totals.debit,
                      color: "var(--fin-red)",
                      prefix: "-",
                    },
                    {
                      label: "Crédits",
                      value: totals.credit,
                      color: "var(--fin-green)",
                      prefix: "+",
                    },
                    {
                      label: "Sélectionnés",
                      value: selectedCount,
                      color: "var(--brand-1)",
                      isCount: true,
                    },
                  ].map(({ label, value, color, prefix, isCount }) => (
                    <div
                      key={label}
                      className="rounded-xl p-3 text-center"
                      style={{ background: "var(--bg-surface-2)" }}
                    >
                      <div
                        className="font-mono text-lg font-extrabold"
                        style={{ color }}
                      >
                        {isCount
                          ? value
                          : `${prefix}${formatEur(value as number)}`}
                      </div>
                      <div
                        className="text-xs font-medium"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Erreurs de parsing */}
                {sessionErrors.length > 0 && (
                  <div
                    className="rounded-lg p-3"
                    style={{
                      background: "var(--fin-amber-bg)",
                      border: "1px solid var(--fin-amber-border)",
                    }}
                  >
                    <p
                      className="text-xs font-semibold mb-1"
                      style={{ color: "var(--fin-amber)" }}
                    >
                      {sessionErrors.length} ligne
                      {sessionErrors.length > 1 ? "s" : ""} ignorée
                      {sessionErrors.length > 1 ? "s" : ""}
                    </p>
                    {sessionErrors.slice(0, 3).map((e, i) => (
                      <p
                        key={i}
                        className="text-xs"
                        style={{ color: "var(--fin-amber)" }}
                      >
                        {e}
                      </p>
                    ))}
                  </div>
                )}

                {/* En-tête liste */}
                {debitTxs.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p
                        className="text-sm font-semibold"
                        style={{ color: "var(--text-primary)" }}
                      >
                        Dépenses à importer ({debitTxs.length})
                      </p>
                      <button
                        type="button"
                        onClick={toggleAll}
                        className="text-xs font-medium transition-colors hover:opacity-70"
                        style={{ color: "var(--brand-1)" }}
                      >
                        {selectedIds.size === debitTxs.length
                          ? "Tout désélectionner"
                          : "Tout sélectionner"}
                      </button>
                    </div>

                    <div className="space-y-2">
                      {debitTxs.map((tx) => (
                        <TransactionRow
                          key={tx.id}
                          tx={tx}
                          selected={selectedIds.has(tx.id)}
                          onToggle={() => toggleTx(tx.id)}
                          onCategoryChange={(cat) => updateCategory(tx.id, cat)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Crédits (informatif, non importables comme dépenses) */}
                {creditTxs.length > 0 && (
                  <div
                    className="rounded-lg p-3"
                    style={{ background: "var(--bg-surface-2)" }}
                  >
                    <p
                      className="text-xs font-medium"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {creditTxs.length} crédit{creditTxs.length > 1 ? "s" : ""}{" "}
                      détecté{creditTxs.length > 1 ? "s" : ""} (salaire,
                      remboursements...) — non inclus dans les dépenses.
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Étape 3 : Confirmation ────────────────────────────────────── */}
            {step === "done" && (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-4 py-10 text-center"
              >
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-full"
                  style={{ background: "var(--fin-green-bg)" }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-7 w-7"
                    style={{ color: "var(--fin-green)" }}
                  >
                    <path d="M20.28 5.72a.75.75 0 0 0-1.06 0L9 15.94l-4.22-4.22a.75.75 0 0 0-1.06 1.06l4.75 4.75a.75.75 0 0 0 1.06 0l10.75-10.75a.75.75 0 0 0 0-1.06Z" />
                  </svg>
                </div>
                <div>
                  <p
                    className="text-base font-bold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {selectedCount} transaction{selectedCount > 1 ? "s" : ""}{" "}
                    importée{selectedCount > 1 ? "s" : ""}
                  </p>
                  <p
                    className="mt-1 text-sm"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Consultez l'onglet Rapprochement pour valider le prévu vs
                    réel.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer actions */}
        <div
          className="flex flex-shrink-0 items-center justify-end gap-3 px-5 py-4"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          {step === "done" ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--brand-1)" }}
            >
              Fermer
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={step === "preview" ? () => setStep("upload") : onClose}
                className="rounded-xl px-4 py-2 text-sm font-semibold transition-colors hover:opacity-70"
                style={{
                  background: "var(--bg-surface-2)",
                  color: "var(--text-secondary)",
                }}
              >
                {step === "preview" ? "Retour" : "Annuler"}
              </button>

              {step === "preview" && (
                <button
                  type="button"
                  onClick={handleValidate}
                  disabled={selectedCount === 0 || importing}
                  className="inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                  style={{ background: "var(--brand-1)" }}
                >
                  {importing ? (
                    <>
                      <svg
                        className="h-3.5 w-3.5 animate-spin"
                        viewBox="0 0 12 12"
                        fill="none"
                      >
                        <circle
                          cx="6"
                          cy="6"
                          r="4.5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeDasharray="14 7"
                        />
                      </svg>
                      Importation…
                    </>
                  ) : (
                    <>
                      Valider {selectedCount} transaction
                      {selectedCount > 1 ? "s" : ""}
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
