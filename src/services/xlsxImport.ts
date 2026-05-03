// =============================================================================
// Fichier  : src/services/xlsxImport.ts
// Auteur   : KREMER Régis
// Desc.    : Parser Excel (.xlsx / .xls) pour import bancaire — Phase 15.2.
//            Utilise SheetJS (xlsx) pour lire les deux formats.
//            Produit le même EnrichedImportResult que csvImport.ts.
//            Prérequis : npm install xlsx
// -----------------------------------------------------------------------------
// Changelog :
//   2026-05-03 | KREMER Régis | Création Phase 15.2 — import Excel bancaire
//   2026-05-03 | KREMER Régis | Fix — scan des headers sur les 25 premières lignes
//                               (CA, BNP, SG ont des lignes de metadata avant
//                               les vrais en-têtes), nettoyage libellés multilignes,
//                               montants avec virgule milliers ("1,980.71")
// =============================================================================

import * as XLSX from "xlsx";
import type { EnrichedImportResult } from "@/services/csvImport";
import type { ImportedTransaction, ImportSession } from "@/types/reconciliation";
import type { CategoryRule } from "@/types/reconciliation";
import { normalizeLabel } from "@/store/reconciliationStore";
import { categorizeLabel } from "@/services/csvImport";

// ─── Types internes ───────────────────────────────────────────────────────────

type RawCell = string | number | boolean | Date | null;
type RawRow  = RawCell[];

interface ColMap {
  headerRowIndex: number; // Ligne contenant les en-têtes dans rawRows
  date:    number;        // Index de colonne date
  label:   number;        // Index de colonne libellé
  amount:  number;        // Index colonne montant unique (-1 si débit/crédit séparés)
  debit:   number;        // Index colonne débit (-1 si montant unique)
  credit:  number;        // Index colonne crédit (-1 si montant unique)
}

// ─── Mots-clés de détection des colonnes ─────────────────────────────────────

const DATE_KW   = ["date", "jour", "day", "valeur"];
const LABEL_KW  = ["libelle", "label", "description", "intitule", "reference",
                   "detail", "motif", "intitulé", "libellé", "opérations"];
const AMOUNT_KW = ["montant", "amount", "somme"];
const DEBIT_KW  = ["debit", "sortie", "retrait", "depense"];
const CREDIT_KW = ["credit", "entree", "recette", "versement"];

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeHeader(h: string): string {
  return stripAccents(h.toLowerCase())
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesKw(header: string, keywords: string[]): boolean {
  const h = normalizeHeader(header);
  return keywords.some((kw) => h === kw || h.startsWith(kw + " ") || h.includes(" " + kw));
}

/**
 * Scanne les N premières lignes brutes pour trouver la ligne d'en-têtes.
 *
 * Les banques françaises insèrent des métadonnées avant les vrais en-têtes :
 *   Crédit Agricole : 9 lignes (titre, compte, solde, période...)
 *   BNP Paribas     : 7-10 lignes
 *   Société Générale: 5-8 lignes
 *   Boursorama      : 0 (en-têtes dès la ligne 1)
 *
 * Condition : la ligne doit contenir "date" ET "libellé" ET
 * ("montant" OU ("débit" ET "crédit")).
 */
function findHeaderRow(rawRows: RawRow[], maxScan = 25): ColMap | null {
  for (let rowIdx = 0; rowIdx < Math.min(rawRows.length, maxScan); rowIdx++) {
    const row = rawRows[rowIdx]!;
    let date   = -1;
    let label  = -1;
    let amount = -1;
    let debit  = -1;
    let credit = -1;

    row.forEach((cell, colIdx) => {
      if (cell === null || cell === undefined) return;
      const h = String(cell);
      if (typeof cell === "number" || cell instanceof Date) return; // pas un header
      if (date   === -1 && matchesKw(h, DATE_KW))   date   = colIdx;
      if (label  === -1 && matchesKw(h, LABEL_KW))  label  = colIdx;
      if (amount === -1 && matchesKw(h, AMOUNT_KW)) amount = colIdx;
      if (debit  === -1 && matchesKw(h, DEBIT_KW))  debit  = colIdx;
      if (credit === -1 && matchesKw(h, CREDIT_KW)) credit = colIdx;
    });

    if (date === -1 || label === -1) continue;
    if (amount === -1 && (debit === -1 || credit === -1)) continue;

    return { headerRowIndex: rowIdx, date, label, amount, debit, credit };
  }
  return null;
}

// ─── Conversion montant ───────────────────────────────────────────────────────

/**
 * Convertit une cellule en nombre, en gérant tous les formats français et anglais :
 *   145.0     → 145.0   (SheetJS number natif — le cas le plus courant)
 *   "145,00"  → 145.0   (virgule décimale FR)
 *   "1 980,71"→ 1980.71 (espace milliers + virgule décimale FR)
 *   "1,980.71"→ 1980.71 (virgule milliers EN + point décimal)
 *   "145.00"  → 145.0   (point décimal standard)
 */
function cellToAmount(val: RawCell): number | null {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number") return val;
  if (typeof val === "boolean" || val instanceof Date) return null;

  let s = String(val).trim().replace(/[€$£]/g, "").trim();
  if (!s) return null;

  // "1,980.71" — virgule = milliers, point = décimal
  if (/^\d{1,3}(,\d{3})+\.\d+$/.test(s)) {
    s = s.replace(/,/g, "");
  }
  // "1 980,71" ou "145,00" — virgule = décimal FR (ou "145,0")
  else if (s.includes(",") && !s.includes(".")) {
    s = s.replace(/\s/g, "").replace(",", ".");
  }
  // Supprimer les espaces milliers restants
  s = s.replace(/\s/g, "");

  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// ─── Conversion date ──────────────────────────────────────────────────────────

function cellToIsoDate(val: RawCell): string | null {
  if (val === null || val === undefined || val === "") return null;

  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return toIsoDate(val);
  }

  if (typeof val === "number") {
    const d = XLSX.SSF.parse_date_code(val);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }

  if (typeof val === "string") {
    const s = val.trim();
    const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m1) return `${m1[3]}-${m1[2]!.padStart(2,"0")}-${m1[1]!.padStart(2,"0")}`;
    const m2 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (m2) return `${m2[3]}-${m2[2]!.padStart(2,"0")}-${m2[1]!.padStart(2,"0")}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    if (!isNaN(d.getTime())) return toIsoDate(d);
  }

  return null;
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function toIsoMonth(iso: string): string { return iso.slice(0, 7); }

/** Nettoie un libellé bancaire : retire les sauts de ligne, espaces multiples */
function cleanLabel(raw: string): string {
  return raw
    .replace(/\\n/g, " ")  // \n littéral (certains exports CSV->XLSX)
    .replace(/[\n\r\t]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function fingerprint(dateStr: string, amountCents: number, norm: string): string {
  return `${dateStr}|${amountCents}|${norm.slice(0, 30)}`;
}

// ─── Parser principal ─────────────────────────────────────────────────────────

export function parseXLSX(
  buffer: ArrayBuffer,
  fileName: string,
  learnedRules?: CategoryRule[],
  existingFingerprints?: Set<string>,
): EnrichedImportResult {
  const errors: string[] = [];
  const transactions: ImportedTransaction[] = [];
  const sessionId  = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const importedAt = new Date().toISOString();
  const isXls      = fileName.toLowerCase().endsWith(".xls");
  const sourceKey  = isXls ? "xls_generic" : "xlsx_generic";

  // ── Lecture workbook ──────────────────────────────────────────────────────
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, {
      type:      "array",
      cellDates: true,  // Convertit les serial-dates en objets Date JS
      raw:       true,  // Valeurs numériques natives (pas de formatage string)
    });
  } catch (_err) {
    return makeEmptyResult(sessionId, importedAt,
      ["Impossible de lire ce fichier Excel. Vérifiez qu'il n'est pas corrompu ou protégé par mot de passe."]);
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return makeEmptyResult(sessionId, importedAt, ["Fichier sans feuille de données."]);
  const sheet = workbook.Sheets[sheetName];
  if (!sheet)     return makeEmptyResult(sessionId, importedAt, ["Feuille introuvable."]);

  // ── Extraction brute (tableau de tableaux) pour scan des headers ──────────
  // header:1 → tableaux au lieu d'objets, nécessaire pour scanner toutes les lignes
  const rawRows = XLSX.utils.sheet_to_json<RawRow>(sheet, {
    header: 1,
    defval: null,
    raw:    true,
  });

  if (rawRows.length === 0) return makeEmptyResult(sessionId, importedAt, ["La feuille est vide."]);

  // ── Trouver la ligne d'en-têtes réels ─────────────────────────────────────
  const colMap = findHeaderRow(rawRows);
  if (!colMap) {
    return makeEmptyResult(sessionId, importedAt, [
      "Colonnes non détectées automatiquement. " +
      "Vérifiez que votre fichier contient des en-têtes Date, Libellé et Montant (ou Débit / Crédit).",
    ]);
  }

  const detectedBank     = detectBankFromContent(rawRows, fileName);
  const seenFingerprints = new Set<string>(existingFingerprints);
  const dataRows         = rawRows.slice(colMap.headerRowIndex + 1);

  // ── Parcours des lignes de données ────────────────────────────────────────
  dataRows.forEach((row, i) => {
    const dateRaw  = row[colMap.date]  ?? null;
    const labelRaw = row[colMap.label] ?? null;

    let amountVal: number | null = null;
    if (colMap.debit !== -1 && colMap.credit !== -1) {
      const d = cellToAmount(row[colMap.debit]  ?? null);
      const c = cellToAmount(row[colMap.credit] ?? null);
      if (d !== null && Math.abs(d) > 0)  amountVal = -Math.abs(d);
      else if (c !== null && c > 0)       amountVal = c;
    } else if (colMap.amount !== -1) {
      amountVal = cellToAmount(row[colMap.amount] ?? null);
    }

    if (dateRaw === null || amountVal === null) return;

    const labelStr = cleanLabel(String(labelRaw ?? ""));
    if (!labelStr) return;

    const isoDate = cellToIsoDate(dateRaw);
    if (!isoDate) {
      errors.push(`Ligne ${colMap.headerRowIndex + i + 2} : date invalide "${String(dateRaw)}"`);
      return;
    }

    const isoMonth    = toIsoMonth(isoDate);
    const amountCents = Math.round(amountVal * 100);
    const normalized  = normalizeLabel(labelStr);
    const fp          = fingerprint(isoDate, amountCents, normalized);
    const isDuplicate = seenFingerprints.has(fp);

    let category   = "other" as ReturnType<typeof categorizeLabel>["category"];
    let confidence = 0.3;

    if (learnedRules) {
      for (const rule of learnedRules) {
        if (normalized.includes(rule.labelPattern)) {
          category   = rule.category;
          confidence = 1.0;
          break;
        }
      }
    }
    if (confidence < 1.0) {
      const auto = categorizeLabel(labelStr);
      category   = auto.category;
      confidence = auto.confidence;
    }

    transactions.push({
      id:                 `${sessionId}_${i}`,
      date:               isoDate,
      labelRaw:           labelStr,
      labelNormalized:    normalized,
      amountCents,
      amountEur:          amountVal,
      category,
      categoryConfidence: confidence,
      isDebit:            amountVal < 0,
      source:             sourceKey,
      status:             isDuplicate ? "possible_duplicate" : "unmatched",
      matchedExpenseId:   null,
      importedAt,
      month:              isoMonth,
    });

    if (!isDuplicate) seenFingerprints.add(fp);
  });

  const debits  = transactions.filter((t) => t.isDebit);
  const credits = transactions.filter((t) => !t.isDebit);
  const months  = [...new Set(transactions.map((t) => t.month))].sort();

  const session: ImportSession = {
    id: sessionId, importedAt, detectedBank,
    totalDebits:      debits.reduce((s, t) => s + Math.abs(t.amountEur), 0),
    totalCredits:     credits.reduce((s, t) => s + t.amountEur, 0),
    transactionCount: transactions.length,
    months, errors,
    status: "pending_validation",
  };

  return { transactions, session, errors, detectedBank };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Détecte la banque depuis le contenu des métadonnées en haut du fichier */
function detectBankFromContent(rawRows: RawRow[], fileName: string): string {
  const headerContent = rawRows
    .slice(0, 10)
    .flatMap((r) => r.map((c) => stripAccents(String(c ?? "").toLowerCase())))
    .join(" ");

  if (headerContent.includes("credit agricole") || headerContent.includes("ca ")) return "Crédit Agricole";
  if (headerContent.includes("boursorama"))    return "Boursorama";
  if (headerContent.includes("bnp"))           return "BNP Paribas";
  if (headerContent.includes("societe generale")) return "Société Générale";
  if (headerContent.includes("caisse d epargne") || headerContent.includes("cepargne")) return "Caisse d'Épargne";
  if (headerContent.includes("banque postale") || headerContent.includes("la poste")) return "La Banque Postale";
  if (headerContent.includes("lcl"))           return "LCL";
  if (headerContent.includes("cic"))           return "CIC";
  if (headerContent.includes("fortuneo"))      return "Fortuneo";
  if (headerContent.includes("hello bank"))    return "Hello Bank";
  if (headerContent.includes("revolut"))       return "Revolut";
  if (headerContent.includes("n26"))           return "N26";

  return detectBankFromFileName(fileName);
}

function detectBankFromFileName(fileName: string): string {
  const lower = fileName.toLowerCase();
  // CA20260503_... → Crédit Agricole (pattern typique)
  if (/^ca\d{8}/.test(lower) || lower.includes("creditagricole")) return "Crédit Agricole";
  if (lower.includes("boursorama"))    return "Boursorama";
  if (lower.includes("bnp"))           return "BNP Paribas";
  if (lower.includes("lcl"))           return "LCL";
  if (lower.includes("socgen") || lower.includes("sg_")) return "Société Générale";
  if (lower.includes("caisse") || lower.includes("cepargne")) return "Caisse d'Épargne";
  if (lower.includes("postale") || lower.includes("laposte")) return "La Banque Postale";
  if (lower.includes("revolut"))       return "Revolut";
  if (lower.includes("n26"))           return "N26";
  if (lower.includes("fortuneo"))      return "Fortuneo";
  if (lower.includes("hello"))         return "Hello Bank";
  if (lower.includes("cic"))           return "CIC";
  return "Excel";
}

function makeEmptyResult(sessionId: string, importedAt: string, errors: string[]): EnrichedImportResult {
  return {
    transactions: [],
    session: {
      id: sessionId, importedAt, detectedBank: "Inconnu",
      totalDebits: 0, totalCredits: 0, transactionCount: 0,
      months: [], errors, status: "pending_validation",
    },
    errors,
    detectedBank: "Inconnu",
  };
}
