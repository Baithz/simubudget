// =============================================================================
// Fichier  : src/services/bankImportMapping.ts
// Auteur   : KREMER Régis
// Desc.    : Moteur générique d'analyse d'exports bancaires CSV/Excel avec
//            détection intelligente des colonnes et mapping manuel de secours.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-05-03 | KREMER Régis | Création — analyse générique multi-banques,
//                               fallback mapping manuel, parsing robuste montants/dates
//   2026-05-03 | KREMER Régis | Correction — typage strict du format de date auto
// =============================================================================

import * as XLSX from "xlsx";
import type { ExpenseCategory } from "@/types/accounting";
import type {
  CategoryRule,
  ImportedTransaction,
  ImportSession,
} from "@/types/reconciliation";
import type { EnrichedImportResult } from "@/services/csvImport";
import { categorizeLabel } from "@/services/csvImport";
import { normalizeLabel } from "@/store/reconciliationStore";

export type RawImportCell = string | number | boolean | Date | null;
export type RawImportRow = RawImportCell[];

export type ImportDateFormat =
  | "auto"
  | "dd/mm/yyyy"
  | "yyyy-mm-dd"
  | "dd-mm-yyyy"
  | "mm/dd/yyyy";

export interface ImportColumnMapping {
  headerRowIndex: number;
  dateCol: number;
  labelCol: number;
  amountCol: number | null;
  debitCol: number | null;
  creditCol: number | null;
  dateFormat: ImportDateFormat;
}

export interface ImportTableAnalysis {
  rows: RawImportRow[];
  detectedBank: string;
  sourceKey: string;
  suggestedMapping: ImportColumnMapping | null;
  confidence: number;
  warnings: string[];
}

interface CandidateScore {
  mapping: ImportColumnMapping;
  score: number;
  rowScore: number;
  sampleHits: number;
}

const DATE_HEADERS = [
  "date",
  "date operation",
  "date d operation",
  "date comptable",
  "date de valeur",
  "valeur",
  "jour",
  "operation date",
  "booking date",
  "value date",
  "transaction date",
  "posted date",
];
const LABEL_HEADERS = [
  "libelle",
  "libelle operation",
  "operation",
  "operations",
  "description",
  "details",
  "detail",
  "intitule",
  "intitule operation",
  "reference",
  "motif",
  "payee",
  "beneficiaire",
  "nom",
  "label",
  "transaction",
  "merchant",
  "name",
  "memo",
  "wording",
];
const AMOUNT_HEADERS = [
  "montant",
  "montant eur",
  "montant euro",
  "amount",
  "transaction amount",
  "valeur",
  "somme",
  "net amount",
  "montant net",
  "montant de l operation",
];
const DEBIT_HEADERS = [
  "debit",
  "debits",
  "retrait",
  "sortie",
  "depense",
  "paid out",
  "withdrawal",
  "debit eur",
  "debit euros",
];
const CREDIT_HEADERS = [
  "credit",
  "credits",
  "versement",
  "entree",
  "recette",
  "paid in",
  "deposit",
  "credit eur",
  "credit euros",
];

const BANK_PATTERNS: Array<{ name: string; source: string; keys: string[] }> = [
  {
    name: "Crédit Agricole",
    source: "csv_credit_agricole",
    keys: ["credit agricole", "ca ", "ca-", "caisse regionale"],
  },
  {
    name: "Boursorama",
    source: "csv_boursorama",
    keys: ["boursorama", "bourso"],
  },
  { name: "BNP Paribas", source: "csv_bnp", keys: ["bnp", "paribas"] },
  {
    name: "Société Générale",
    source: "csv_societe_generale",
    keys: ["societe generale", "socgen", "sg "],
  },
  { name: "LCL", source: "csv_lcl", keys: ["lcl", "credit lyonnais"] },
  {
    name: "Caisse d'Épargne",
    source: "csv_caisse_epargne",
    keys: ["caisse d epargne", "cepargne", "caisse epargne"],
  },
  {
    name: "La Banque Postale",
    source: "csv_la_banque_postale",
    keys: ["banque postale", "la poste"],
  },
  { name: "Fortuneo", source: "csv_fortuneo", keys: ["fortuneo"] },
  {
    name: "Hello Bank",
    source: "csv_hello_bank",
    keys: ["hello bank", "hellobank"],
  },
  { name: "Revolut", source: "csv_revolut", keys: ["revolut"] },
  { name: "N26", source: "csv_n26", keys: ["n26"] },
  { name: "CIC", source: "csv_cic", keys: ["cic"] },
  {
    name: "Crédit Mutuel",
    source: "csv_credit_mutuel",
    keys: ["credit mutuel", "cmut"],
  },
  { name: "Monabanq", source: "csv_monabanq", keys: ["monabanq"] },
  { name: "Nickel", source: "csv_nickel", keys: ["nickel"] },
];

export function parseTextImportTable(
  content: string,
  fileName: string,
): ImportTableAnalysis {
  const separator = detectBestSeparator(content);
  const rows = parseDelimitedRows(content, separator);
  return analyzeRows(rows, fileName, "csv_generique");
}

export function parseExcelImportTable(
  buffer: ArrayBuffer,
  fileName: string,
): ImportTableAnalysis {
  try {
    const workbook = XLSX.read(buffer, {
      type: "array",
      cellDates: true,
      raw: true,
    });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName)
      return emptyAnalysis(fileName, [
        "Fichier Excel sans feuille de données.",
      ]);
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return emptyAnalysis(fileName, ["Feuille Excel introuvable."]);
    const rows = XLSX.utils.sheet_to_json<RawImportRow>(sheet, {
      header: 1,
      defval: null,
      raw: true,
    });
    return analyzeRows(
      rows,
      fileName,
      fileName.toLowerCase().endsWith(".xls")
        ? "xls_generique"
        : "xlsx_generique",
    );
  } catch (_err) {
    return emptyAnalysis(fileName, [
      "Impossible de lire ce fichier Excel. Il est peut-être protégé ou corrompu.",
    ]);
  }
}

export function buildTransactionsFromMapping(
  analysis: ImportTableAnalysis,
  mapping: ImportColumnMapping,
  learnedRules?: CategoryRule[],
  existingFingerprints?: Set<string>,
): EnrichedImportResult {
  const errors: string[] = [...analysis.warnings];
  const transactions: ImportedTransaction[] = [];
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const importedAt = new Date().toISOString();
  const seenFingerprints = new Set<string>(existingFingerprints);
  const rows = analysis.rows.slice(mapping.headerRowIndex + 1);

  rows.forEach((row, index) => {
    const dateRaw = row[mapping.dateCol] ?? null;
    const labelRaw = row[mapping.labelCol] ?? null;
    const labelStr = cleanLabel(String(labelRaw ?? ""));

    let amountEur: number | null = null;
    if (mapping.debitCol !== null && mapping.creditCol !== null) {
      const debit = parseAmountCell(row[mapping.debitCol] ?? null);
      const credit = parseAmountCell(row[mapping.creditCol] ?? null);
      if (debit !== null && Math.abs(debit) > 0) amountEur = -Math.abs(debit);
      else if (credit !== null && Math.abs(credit) > 0)
        amountEur = Math.abs(credit);
    } else if (mapping.amountCol !== null) {
      amountEur = parseAmountCell(row[mapping.amountCol] ?? null);
    }

    if (!labelStr && amountEur === null) return;
    if (!labelStr || amountEur === null) {
      errors.push(
        `Ligne ${mapping.headerRowIndex + index + 2} ignorée : libellé ou montant manquant.`,
      );
      return;
    }

    const isoDate = parseDateCell(dateRaw, mapping.dateFormat);
    if (!isoDate) {
      errors.push(
        `Ligne ${mapping.headerRowIndex + index + 2} ignorée : date invalide "${String(dateRaw ?? "")}".`,
      );
      return;
    }

    const normalized = normalizeLabel(labelStr);
    const amountCents = Math.round(amountEur * 100);
    const fp = fingerprint(isoDate, amountCents, normalized);
    const isDuplicate = seenFingerprints.has(fp);

    let category: ExpenseCategory = "other";
    let confidence = 0.3;
    for (const rule of learnedRules ?? []) {
      if (normalized.includes(rule.labelPattern)) {
        category = rule.category;
        confidence = rule.confidence;
        break;
      }
    }
    if (confidence < 1.0) {
      const auto = categorizeLabel(labelStr);
      category = auto.category;
      confidence = auto.confidence;
    }

    transactions.push({
      id: `${sessionId}_${index}`,
      date: isoDate,
      labelRaw: labelStr,
      labelNormalized: normalized,
      amountCents,
      amountEur,
      category,
      categoryConfidence: confidence,
      isDebit: amountEur < 0,
      source: analysis.sourceKey,
      status: isDuplicate ? "possible_duplicate" : "unmatched",
      matchedExpenseId: null,
      importedAt,
      month: isoDate.slice(0, 7),
    });

    if (!isDuplicate) seenFingerprints.add(fp);
  });

  const debits = transactions.filter((t) => t.isDebit);
  const credits = transactions.filter((t) => !t.isDebit);
  const months = [...new Set(transactions.map((t) => t.month))].sort();
  const session: ImportSession = {
    id: sessionId,
    importedAt,
    detectedBank: analysis.detectedBank,
    totalDebits: debits.reduce((s, t) => s + Math.abs(t.amountEur), 0),
    totalCredits: credits.reduce((s, t) => s + t.amountEur, 0),
    transactionCount: transactions.length,
    months,
    errors,
    status: "pending_validation",
  };

  return { transactions, session, errors, detectedBank: analysis.detectedBank };
}

export function getPreviewRows(
  analysis: ImportTableAnalysis,
  mapping: ImportColumnMapping,
  limit = 6,
): RawImportRow[] {
  return analysis.rows.slice(
    mapping.headerRowIndex + 1,
    mapping.headerRowIndex + 1 + limit,
  );
}

export function cellToDisplay(cell: RawImportCell): string {
  if (cell === null || cell === undefined) return "";
  if (cell instanceof Date) return cell.toLocaleDateString("fr-FR");
  return String(cell)
    .replace(/[\n\r\t]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function analyzeRows(
  rows: RawImportRow[],
  fileName: string,
  defaultSource: string,
): ImportTableAnalysis {
  const warnings: string[] = [];
  const bank = detectBank(rows, fileName, defaultSource);
  const candidate = findBestMapping(rows);
  if (!candidate) {
    warnings.push(
      "Colonnes non détectées automatiquement. Choisissez les colonnes Date, Libellé et Montant dans l'étape suivante.",
    );
  } else if (candidate.score < 0.72) {
    warnings.push(
      "Détection automatique incertaine. Vérifiez le mapping des colonnes avant validation.",
    );
  }

  return {
    rows,
    detectedBank: bank.name,
    sourceKey: bank.source,
    suggestedMapping: candidate?.mapping ?? null,
    confidence: candidate?.score ?? 0,
    warnings,
  };
}

function emptyAnalysis(
  fileName: string,
  warnings: string[],
): ImportTableAnalysis {
  const bank = detectBank([], fileName, "csv_generique");
  return {
    rows: [],
    detectedBank: bank.name,
    sourceKey: bank.source,
    suggestedMapping: null,
    confidence: 0,
    warnings,
  };
}

function findBestMapping(rows: RawImportRow[]): CandidateScore | null {
  const candidates: CandidateScore[] = [];
  const maxScan = Math.min(rows.length, 50);

  for (let rowIndex = 0; rowIndex < maxScan; rowIndex++) {
    const row = rows[rowIndex] ?? [];
    if (row.length < 2) continue;

    const normalized = row.map((cell) => normalizeHeader(String(cell ?? "")));
    const dateCol = findHeaderColumn(normalized, DATE_HEADERS);
    const labelCol = findHeaderColumn(normalized, LABEL_HEADERS);
    const amountCol = findHeaderColumn(normalized, AMOUNT_HEADERS);
    const debitCol = findHeaderColumn(normalized, DEBIT_HEADERS);
    const creditCol = findHeaderColumn(normalized, CREDIT_HEADERS);

    const hasAmount = amountCol !== -1 || (debitCol !== -1 && creditCol !== -1);
    if (dateCol === -1 || labelCol === -1 || !hasAmount) continue;

    const mapping: ImportColumnMapping = {
      headerRowIndex: rowIndex,
      dateCol,
      labelCol,
      amountCol: amountCol === -1 ? null : amountCol,
      debitCol: debitCol === -1 ? null : debitCol,
      creditCol: creditCol === -1 ? null : creditCol,
      dateFormat: "auto",
    };
    const sampleHits = countValidSamples(rows, mapping);
    const headerScore = 0.55 + (amountCol !== -1 ? 0.15 : 0.25);
    const rowScore = Math.min(0.25, sampleHits * 0.05);
    candidates.push({
      mapping,
      score: Math.min(0.99, headerScore + rowScore),
      rowScore,
      sampleHits,
    });
  }

  if (candidates.length > 0) {
    return candidates.sort((a, b) => b.score - a.score)[0] ?? null;
  }

  return inferMappingWithoutHeaders(rows);
}

function inferMappingWithoutHeaders(
  rows: RawImportRow[],
): CandidateScore | null {
  const sampleRows = rows.slice(0, Math.min(rows.length, 80));
  const maxCols = Math.max(0, ...sampleRows.map((r) => r.length));
  let best: CandidateScore | null = null;

  for (let dateCol = 0; dateCol < maxCols; dateCol++) {
    for (let labelCol = 0; labelCol < maxCols; labelCol++) {
      if (labelCol === dateCol) continue;
      for (let amountCol = 0; amountCol < maxCols; amountCol++) {
        if (amountCol === dateCol || amountCol === labelCol) continue;
        const mapping: ImportColumnMapping = {
          headerRowIndex: -1,
          dateCol,
          labelCol,
          amountCol,
          debitCol: null,
          creditCol: null,
          dateFormat: "auto",
        };
        const sampleHits = countValidSamples(rows, mapping, 25);
        if (sampleHits < 3) continue;
        const score = Math.min(0.68, sampleHits * 0.06);
        if (!best || score > best.score)
          best = { mapping, score, rowScore: score, sampleHits };
      }
    }
  }
  return best;
}

function countValidSamples(
  rows: RawImportRow[],
  mapping: ImportColumnMapping,
  limit = 12,
): number {
  const start = Math.max(0, mapping.headerRowIndex + 1);
  let hits = 0;
  for (const row of rows.slice(start, start + limit)) {
    const dateOk =
      parseDateCell(row[mapping.dateCol] ?? null, mapping.dateFormat) !== null;
    const labelOk = cleanLabel(String(row[mapping.labelCol] ?? "")).length >= 2;
    let amountOk = false;
    if (mapping.amountCol !== null)
      amountOk = parseAmountCell(row[mapping.amountCol] ?? null) !== null;
    else if (mapping.debitCol !== null && mapping.creditCol !== null) {
      amountOk =
        parseAmountCell(row[mapping.debitCol] ?? null) !== null ||
        parseAmountCell(row[mapping.creditCol] ?? null) !== null;
    }
    if (dateOk && labelOk && amountOk) hits++;
  }
  return hits;
}

function findHeaderColumn(headers: string[], keywords: string[]): number {
  let bestIndex = -1;
  let bestScore = 0;
  headers.forEach((header, index) => {
    const score = scoreHeader(header, keywords);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestScore >= 0.75 ? bestIndex : -1;
}

function scoreHeader(header: string, keywords: string[]): number {
  if (!header) return 0;
  let best = 0;
  for (const kw of keywords.map(normalizeHeader)) {
    if (header === kw) best = Math.max(best, 1);
    else if (header.includes(kw)) best = Math.max(best, 0.86);
    else if (kw.includes(header) && header.length >= 4)
      best = Math.max(best, 0.78);
  }
  return best;
}

function detectBank(
  rows: RawImportRow[],
  fileName: string,
  fallbackSource: string,
): { name: string; source: string } {
  const content = `${fileName} ${rows
    .slice(0, 12)
    .flat()
    .map((c) => String(c ?? ""))
    .join(" ")}`;
  const normalized = normalizeHeader(content);
  for (const bank of BANK_PATTERNS) {
    if (bank.keys.some((key) => normalized.includes(normalizeHeader(key)))) {
      return { name: bank.name, source: bank.source };
    }
  }
  return { name: "Format bancaire générique", source: fallbackSource };
}

function detectBestSeparator(content: string): string {
  const separators = [";", ",", "\t", "|"];
  const sample = content.slice(0, 6000);
  let best = ";";
  let bestScore = -1;
  for (const sep of separators) {
    const rows = parseDelimitedRows(sample, sep).slice(0, 20);
    const counts = rows.map((r) => r.length).filter((n) => n > 1);
    if (counts.length === 0) continue;
    const avg = counts.reduce((s, n) => s + n, 0) / counts.length;
    const stable =
      counts.filter((n) => Math.abs(n - avg) <= 2).length / counts.length;
    const score = avg * stable;
    if (score > bestScore) {
      best = sep;
      bestScore = score;
    }
  }
  return best;
}

function parseDelimitedRows(content: string, sep: string): RawImportRow[] {
  const rows: string[][] = [];
  const cells: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;
  const normalizedContent = content.replace(/^\uFEFF/, "");

  while (i < normalizedContent.length) {
    const ch = normalizedContent[i] ?? "";
    if (ch === '"') {
      if (inQuotes && normalizedContent[i + 1] === '"') {
        cell += '"';
        i += 2;
      } else {
        inQuotes = !inQuotes;
        i++;
      }
    } else if (ch === sep && !inQuotes) {
      cells.push(cell);
      cell = "";
      i++;
    } else if (
      ((ch === "\r" && normalizedContent[i + 1] === "\n") || ch === "\n") &&
      !inQuotes
    ) {
      cells.push(cell);
      rows.push([...cells]);
      cells.length = 0;
      cell = "";
      i += ch === "\r" ? 2 : 1;
    } else {
      cell += ch;
      i++;
    }
  }

  if (cell.length > 0 || cells.length > 0) {
    cells.push(cell);
    rows.push([...cells]);
  }
  return rows.filter((row) =>
    row.some((cellValue) => cleanLabel(cellValue).length > 0),
  );
}

function parseDateCell(
  value: RawImportCell,
  format: ImportDateFormat,
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date)
    return isNaN(value.getTime()) ? null : toIsoDate(value);
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed)
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    return null;
  }
  if (typeof value === "boolean") return null;

  const raw = String(value).trim().replace(/"/g, "");
  const candidates: Exclude<ImportDateFormat, "auto">[] =
    format === "auto"
      ? ["dd/mm/yyyy", "yyyy-mm-dd", "dd-mm-yyyy", "mm/dd/yyyy"]
      : [format];

  for (const fmt of candidates) {
    const iso = parseDateString(raw, fmt);
    if (iso) return iso;
  }

  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : toIsoDate(d);
}

function parseDateString(
  raw: string,
  format: Exclude<ImportDateFormat, "auto">,
): string | null {
  if (format === "yyyy-mm-dd") {
    const m = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    return m
      ? `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}`
      : null;
  }
  if (format === "dd/mm/yyyy" || format === "dd-mm-yyyy") {
    const m = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
    if (!m) return null;
    const year = m[3]!.length === 2 ? `20${m[3]}` : m[3]!;
    return `${year}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  }
  const m = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
  if (!m) return null;
  const year = m[3]!.length === 2 ? `20${m[3]}` : m[3]!;
  return `${year}-${m[1]!.padStart(2, "0")}-${m[2]!.padStart(2, "0")}`;
}

function parseAmountCell(value: RawImportCell): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  if (typeof value === "boolean" || value instanceof Date) return null;

  let s = String(value)
    .trim()
    .replace(/[€$£]/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/CR$/i, "")
    .trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  }
  if (s.endsWith("-")) {
    negative = true;
    s = s.slice(0, -1);
  }
  s = s.trim();

  if (/^\d{1,3}(,\d{3})+\.\d+$/.test(s)) s = s.replace(/,/g, "");
  else if (/^\d{1,3}(\.\d{3})+,\d+$/.test(s))
    s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",") && !s.includes("."))
    s = s.replace(/\s/g, "").replace(",", ".");
  else s = s.replace(/\s/g, "");

  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return negative ? -Math.abs(n) : n;
}

function cleanLabel(raw: string): string {
  return raw
    .replace(/\\n/g, " ")
    .replace(/[\n\r\t]/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^"|"$/g, "")
    .trim();
}

function normalizeHeader(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function fingerprint(
  dateStr: string,
  amountCents: number,
  normalized: string,
): string {
  return `${dateStr}|${amountCents}|${normalized.slice(0, 30)}`;
}
