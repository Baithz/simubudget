// =============================================================================
// Fichier  : src/services/csvImport.ts
// Auteur   : KREMER Régis
// Desc.    : Parser CSV bancaire — détection format, parsing, normalisation,
//            catégorisation, déduplication et construction des ImportedTransaction.
//            Formats : Boursorama, BNP, Crédit Agricole, LCL, Société Générale,
//            Caisse d'Épargne, La Banque Postale, générique.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Régis | Création du fichier Phase 4
//   2026-05-02 | KREMER Régis | Correction lint ESLint 9 — variables inutilisées
//   2026-05-03 | KREMER Régis | Phase 15.1 — pipeline complet ImportedTransaction,
//                               normalisation, empreinte, détection doublons
//   2026-05-03 | KREMER Régis | Fix — vrai parser CSV conscient des multilignes,
//                               scan des headers sur 25 lignes (CA, BNP, SG ont
//                               des métadonnées avant les vrais en-têtes)
// =============================================================================

import type { ExpenseCategory } from "@/types/accounting";
import type { ImportedTransaction, ImportSession } from "@/types/reconciliation";
import { normalizeLabel } from "@/store/reconciliationStore";

// ─── Types legacy (conservés pour rétrocompatibilité CSVImportModal existant) ─

export interface BankTransaction {
  date:     Date;
  label:    string;
  amount:   number;
  category: ExpenseCategory;
  isDebit:  boolean;
  rawLine:  string;
}

export interface ImportResult {
  transactions:   BankTransaction[];
  totalDebit:     number;
  totalCredit:    number;
  detectedBank:   string;
  monthsDetected: string[];
  errors:         string[];
  byCategory:     Record<ExpenseCategory, number>;
}

// ─── Types enrichis Phase 15.1 ────────────────────────────────────────────────

export interface EnrichedImportResult {
  transactions:  ImportedTransaction[];
  session:       ImportSession;
  errors:        string[];
  detectedBank:  string;
}

// ─── Formats bancaires ────────────────────────────────────────────────────────

interface BankFormat {
  name:       string;
  separator:  string;
  dateCol:    number;
  labelCol:   number;
  amountCol:  number;
  debitCol?:  number;
  creditCol?: number;
  skipRows:   number;
  dateFormat: "dd/mm/yyyy" | "yyyy-mm-dd" | "dd-mm-yyyy" | "mm/dd/yyyy";
}

const BANK_FORMATS: Record<string, BankFormat> = {
  boursorama: {
    name: "Boursorama", separator: ";", dateCol: 0, labelCol: 2,
    amountCol: 3, skipRows: 1, dateFormat: "dd/mm/yyyy",
  },
  bnp: {
    name: "BNP Paribas", separator: ";", dateCol: 0, labelCol: 1,
    debitCol: 3, creditCol: 4, amountCol: 3, skipRows: 1, dateFormat: "dd/mm/yyyy",
  },
  credit_agricole: {
    name: "Crédit Agricole", separator: ";", dateCol: 0, labelCol: 2,
    amountCol: 3, skipRows: 1, dateFormat: "dd/mm/yyyy",
  },
  lcl: {
    name: "LCL", separator: ";", dateCol: 0, labelCol: 1,
    amountCol: 2, skipRows: 1, dateFormat: "dd/mm/yyyy",
  },
  societe_generale: {
    name: "Société Générale", separator: ";", dateCol: 0, labelCol: 2,
    debitCol: 3, creditCol: 4, amountCol: 3, skipRows: 1, dateFormat: "dd/mm/yyyy",
  },
  caisse_epargne: {
    name: "Caisse d'Épargne", separator: ";", dateCol: 0, labelCol: 1,
    amountCol: 3, skipRows: 1, dateFormat: "dd/mm/yyyy",
  },
  la_banque_postale: {
    name: "La Banque Postale", separator: ";", dateCol: 0, labelCol: 2,
    amountCol: 4, skipRows: 2, dateFormat: "dd/mm/yyyy",
  },
  generic: {
    name: "Format générique", separator: ",", dateCol: 0, labelCol: 1,
    amountCol: 2, skipRows: 1, dateFormat: "dd/mm/yyyy",
  },
};

// ─── Catégorisation automatique ───────────────────────────────────────────────

const CATEGORY_KEYWORDS: Array<{ keywords: string[]; category: ExpenseCategory }> = [
  { keywords: ["loyer", "bail", "quittance", "charges locatives", "syndic", "copropriete"], category: "housing" },
  { keywords: ["credit", "pret immo", "mensualite", "credit conso", "credit auto", "cetelem", "sofinco", "cofidis"], category: "credit" },
  { keywords: ["carrefour", "leclerc", "lidl", "aldi", "intermarche", "casino", "super u", "monoprix", "franprix", "biocoop", "picard", "metro", "courses", "epicerie", "boulanger", "boucherie"], category: "food" },
  { keywords: ["uber eats", "deliveroo", "just eat", "mcdonald", "burger king", "kfc", "subway", "pizza", "sushi", "restaurant", "brasserie", "bistro", "cafe"], category: "food" },
  { keywords: ["sncf", "ratp", "navigo", "ter ", "transdev", "blablacar", "uber", "bolt", "total", "bp ", "esso", "shell", "leclerc carburant", "station", "essence", "gazole", "peage", "autoroute"], category: "transport" },
  { keywords: ["pharmacie", "medecin", "docteur", "hopital", "clinique", "mutuelle", "mgen", "harmonie", "malakoff", "alan sante", "axa sante", "cpam", "secu"], category: "health" },
  { keywords: ["assurance", "axa", "maif", "macif", "mma", "allianz", "groupama", "matmut", "direct assurance", "covea"], category: "insurance" },
  { keywords: ["sfr", "orange", "free", "bouygues telecom", "sosh", "red by sfr", "coriolis", "b&you", "prixtel", "spotify", "netflix", "disney", "amazon prime", "canal", "deezer", "youtube premium", "apple", "google play"], category: "telecom" },
  { keywords: ["creche", "halte", "assistante maternelle", "cantine", "ecole", "lycee", "college", "universite", "caf", "paje"], category: "childcare" },
  { keywords: ["cinema", "theatre", "concert", "fnac", "sephora", "lacoste", "decathlon", "sport", "fitness", "gym", "basic fit", "voyage", "hotel", "airbnb", "booking", "club med", "vacances"], category: "leisure" },
  { keywords: ["zara", "h&m", "uniqlo", "primark", "shein", "asos", "vetement", "chaussure", "kiabi", "jules", "celio", "jennyfer"], category: "clothing" },
  { keywords: ["impot", "dgfip", "tresor public", "taxe fonciere", "taxe d'habitation", "cfe", "ursaf", "cotisation"], category: "taxes" },
  { keywords: ["livret a", "ldd", "pel", "assurance vie", "pea", "virement epargne", "boursorama invest", "degiro", "trade republic", "bourse direct", "virement externe"], category: "savings" },
  { keywords: ["abonnement", "forfait", "mensualite abonnement", "amazon", "microsoft", "adobe", "dropbox"], category: "subscriptions" },
  { keywords: ["croix rouge", "secours", "don", "cadeau", "etsy", "fnac marketplace"], category: "gifts" },
];

export function categorizeLabel(label: string): { category: ExpenseCategory; confidence: number } {
  const lower = label.toLowerCase();
  for (const { keywords, category } of CATEGORY_KEYWORDS) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return { category, confidence: 0.85 };
    }
  }
  return { category: "other", confidence: 0.3 };
}

// ─── Détection du format bancaire ────────────────────────────────────────────

function detectFormat(csvContent: string): { format: BankFormat; bankKey: string } {
  const firstLines = csvContent.split("\n").slice(0, 5).join("\n").toLowerCase();

  if (firstLines.includes("boursorama"))      return { format: BANK_FORMATS["boursorama"]!, bankKey: "csv_boursorama" };
  if (firstLines.includes("bnp"))             return { format: BANK_FORMATS["bnp"]!, bankKey: "csv_bnp" };
  if (firstLines.includes("credit agricole") || firstLines.includes("ca-"))
                                              return { format: BANK_FORMATS["credit_agricole"]!, bankKey: "csv_credit_agricole" };
  if (firstLines.includes("lcl"))             return { format: BANK_FORMATS["lcl"]!, bankKey: "csv_lcl" };
  if (firstLines.includes("societe generale") || firstLines.includes("sg "))
                                              return { format: BANK_FORMATS["societe_generale"]!, bankKey: "csv_societe_generale" };
  if (firstLines.includes("caisse d'epargne") || firstLines.includes("caisse epargne"))
                                              return { format: BANK_FORMATS["caisse_epargne"]!, bankKey: "csv_caisse_epargne" };
  if (firstLines.includes("banque postale") || firstLines.includes("la poste"))
                                              return { format: BANK_FORMATS["la_banque_postale"]!, bankKey: "csv_la_banque_postale" };

  const semicolonCount = (csvContent.slice(0, 500).match(/;/g) ?? []).length;
  const commaCount     = (csvContent.slice(0, 500).match(/,/g) ?? []).length;
  if (semicolonCount > commaCount) {
    return { format: { ...BANK_FORMATS["generic"]!, separator: ";" }, bankKey: "csv_generique" };
  }
  return { format: BANK_FORMATS["generic"]!, bankKey: "csv_generique" };
}

// ─── Parsers internes ─────────────────────────────────────────────────────────

function parseDate(str: string, fmt: BankFormat["dateFormat"]): Date | null {
  const clean = str.trim().replace(/"/g, "");
  try {
    if (fmt === "dd/mm/yyyy") {
      const parts = clean.split("/");
      if (parts.length !== 3) return null;
      const [d, m, y] = parts;
      return new Date(parseInt(y!), parseInt(m!) - 1, parseInt(d!));
    }
    if (fmt === "yyyy-mm-dd") return new Date(clean);
    if (fmt === "dd-mm-yyyy") {
      const parts = clean.split("-");
      if (parts.length !== 3) return null;
      const [d, m, y] = parts;
      return new Date(parseInt(y!), parseInt(m!) - 1, parseInt(d!));
    }
    return new Date(clean);
  } catch {
    return null;
  }
}

function parseAmount(str: string): number | null {
  if (!str) return null;
  const clean = str.trim().replace(/"/g, "").replace(/\s/g, "").replace(",", ".");
  const val = parseFloat(clean);
  return isNaN(val) ? null : val;
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toIsoMonth(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Empreinte de déduplication : date + montant en centimes + libellé normalisé (30 premiers chars) */
function fingerprint(dateStr: string, amountCents: number, normalizedLabel: string): string {
  const labelPart = normalizedLabel.slice(0, 30);
  return `${dateStr}|${amountCents}|${labelPart}`;
}

// ─── Parser CSV conscient des multilignes ─────────────────────────────────────

/**
 * Parse un contenu CSV complet en tableau de lignes logiques.
 * Gère correctement les cellules entre guillemets qui contiennent
 * de vrais retours à la ligne (cas Crédit Agricole, BNP, SG...).
 *
 * Exemple CA : une cellule libellé peut contenir :
 *   "PAIEMENT PAR CARTE\nX5555 AMAZON\n29/04"
 * Un simple split('\n') produit 3 fausses lignes au lieu d'une.
 */
function parseCSVToRows(content: string, sep: string): string[][] {
  const rows: string[][] = [];
  const cells: string[] = [];
  let cell       = "";
  let inQuotes   = false;
  let i          = 0;

  while (i < content.length) {
    const ch = content[i]!;

    if (ch === '"') {
      if (inQuotes && content[i + 1] === '"') {
        // Guillemet doublé → guillemet littéral
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
    } else if ((ch === "\r" && content[i + 1] === "\n" || ch === "\n") && !inQuotes) {
      cells.push(cell);
      cell = "";
      rows.push([...cells]);
      cells.length = 0;
      i += ch === "\r" ? 2 : 1;
    } else {
      cell += ch;
      i++;
    }
  }

  // Dernière cellule / ligne
  if (cell || cells.length > 0) {
    cells.push(cell);
    rows.push([...cells]);
  }

  return rows;
}

/** Normalise un en-tête pour la comparaison : minuscules, sans accents */
function normalizeCSVHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const CSV_DATE_KW   = ["date", "jour", "valeur"];
const CSV_LABEL_KW  = ["libelle", "label", "description", "intitule", "reference", "detail", "motif", "operations"];
const CSV_AMOUNT_KW = ["montant", "amount", "somme"];
const CSV_DEBIT_KW  = ["debit", "sortie", "retrait", "depense"];
const CSV_CREDIT_KW = ["credit", "entree", "recette", "versement"];

function csvMatchesKw(header: string, keywords: string[]): boolean {
  const h = normalizeCSVHeader(header);
  return keywords.some((kw) => h === kw || h.startsWith(kw + " ") || h.includes(" " + kw));
}

interface CSVColMap {
  headerRowIndex: number;
  separator:      string;
  dateFormat:     BankFormat["dateFormat"];
  dateCol:        number;
  labelCol:       number;
  amountCol:      number;   // -1 si débit/crédit séparés
  debitCol:       number;   // -1 si montant unique
  creditCol:      number;   // -1 si montant unique
  bankKey:        string;
  bankName:       string;
}

/**
 * Scanne les premières lignes parsées pour trouver la ligne d'en-têtes réels.
 * Retourne null si introuvable.
 */
function findCSVHeaderRow(rows: string[][], bankKey: string, bankName: string): CSVColMap | null {
  const sep = detectSeparator(rows);

  for (let rowIdx = 0; rowIdx < Math.min(rows.length, 25); rowIdx++) {
    const row = rows[rowIdx]!;
    let date   = -1;
    let label  = -1;
    let amount = -1;
    let debit  = -1;
    let credit = -1;

    row.forEach((cell, colIdx) => {
      const h = cell.trim();
      if (!h) return;
      if (date   === -1 && csvMatchesKw(h, CSV_DATE_KW))   date   = colIdx;
      if (label  === -1 && csvMatchesKw(h, CSV_LABEL_KW))  label  = colIdx;
      if (amount === -1 && csvMatchesKw(h, CSV_AMOUNT_KW)) amount = colIdx;
      if (debit  === -1 && csvMatchesKw(h, CSV_DEBIT_KW))  debit  = colIdx;
      if (credit === -1 && csvMatchesKw(h, CSV_CREDIT_KW)) credit = colIdx;
    });

    if (date === -1 || label === -1) continue;
    if (amount === -1 && (debit === -1 || credit === -1)) continue;

    return {
      headerRowIndex: rowIdx,
      separator: sep,
      dateFormat: "dd/mm/yyyy",
      dateCol:    date,
      labelCol:   label,
      amountCol:  amount,
      debitCol:   debit,
      creditCol:  credit,
      bankKey,
      bankName,
    };
  }
  return null;
}

function detectSeparator(rows: string[][]): string {
  // La ligne avec le plus de colonnes est vraisemblablement la ligne de données
  const maxCols = Math.max(...rows.slice(0, 20).map((r) => r.length));
  return maxCols >= 3 ? ";" : ","; // heuristique simple
}

/** Nettoie un libellé : retire les vrais newlines issus de cellules multilignes */
function cleanCSVLabel(raw: string): string {
  return raw
    .replace(/\\n/g, " ")
    .replace(/[\n\r\t]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ─── Parser principal — Phase 15.1 ───────────────────────────────────────────

/**
 * Parse un fichier CSV bancaire et retourne des ImportedTransaction prêtes
 * à être stockées dans le reconciliationStore.
 *
 * Gère les fichiers avec métadonnées en en-tête (CA, BNP, SG...)
 * et les libellés multilignes entre guillemets.
 */
export function parseCSVEnriched(
  csvContent: string,
  learnedRules?: Array<{ labelPattern: string; category: ExpenseCategory }>,
  existingFingerprints?: Set<string>,
): EnrichedImportResult {
  const { format, bankKey } = detectFormat(csvContent);
  const errors: string[] = [];
  const transactions: ImportedTransaction[] = [];
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const importedAt = new Date().toISOString();

  // ── Parse le CSV en tableau de lignes logiques (gère les multilignes) ────
  const allRows = parseCSVToRows(csvContent, format.separator);

  // ── Scan des headers sur les 25 premières lignes ──────────────────────────
  const colMap = findCSVHeaderRow(allRows, bankKey, format.name);

  if (!colMap) {
    // Fallback : utiliser le format détecté classiquement (skipRows)
    const dataLines = allRows.slice(format.skipRows);
    return parseWithFixedFormat(
      dataLines, format, bankKey, sessionId, importedAt, learnedRules, existingFingerprints,
    );
  }

  const seenFingerprints = new Set<string>(existingFingerprints);
  const dataRows = allRows.slice(colMap.headerRowIndex + 1);

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]!;
    if (row.length < 2) continue;

    const dateStr  = (row[colMap.dateCol]  ?? "").trim().replace(/"/g, "");
    const rawLabel = (row[colMap.labelCol] ?? "").trim().replace(/"/g, "");
    const labelStr = cleanCSVLabel(rawLabel);

    let amountVal: number | null = null;
    if (colMap.debitCol !== -1 && colMap.creditCol !== -1) {
      const debit  = parseAmount(row[colMap.debitCol]  ?? "");
      const credit = parseAmount(row[colMap.creditCol] ?? "");
      if (debit  !== null && debit  !== 0) amountVal = -Math.abs(debit);
      else if (credit !== null && credit !== 0) amountVal = Math.abs(credit);
    } else if (colMap.amountCol !== -1) {
      amountVal = parseAmount(row[colMap.amountCol] ?? "");
    }

    if (!dateStr || !labelStr || amountVal === null) continue;

    const date = parseDate(dateStr, colMap.dateFormat);
    if (!date || isNaN(date.getTime())) {
      errors.push(`Ligne ${colMap.headerRowIndex + i + 2} : date invalide "${dateStr}"`);
      continue;
    }

    const isoDate     = toIsoDate(date);
    const isoMonth    = toIsoMonth(date);
    const amountCents = Math.round(amountVal * 100);
    const normalized  = normalizeLabel(labelStr);
    const fp          = fingerprint(isoDate, amountCents, normalized);
    const isDuplicate = seenFingerprints.has(fp);

    let category: ExpenseCategory = "other";
    let confidence = 0.3;
    if (learnedRules) {
      for (const rule of learnedRules) {
        if (normalized.includes(rule.labelPattern)) { category = rule.category; confidence = 1.0; break; }
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
      source:             colMap.bankKey,
      status:             isDuplicate ? "possible_duplicate" : "unmatched",
      matchedExpenseId:   null,
      importedAt,
      month:              isoMonth,
    });

    if (!isDuplicate) seenFingerprints.add(fp);
  }

  // Agrégats pour la session
  const debits  = transactions.filter((t) => t.isDebit);
  const credits = transactions.filter((t) => !t.isDebit);
  const months  = [...new Set(transactions.map((t) => t.month))].sort();

  const session: ImportSession = {
    id:              sessionId,
    importedAt,
    detectedBank:    colMap.bankName,
    totalDebits:     debits.reduce((s, t) => s + Math.abs(t.amountEur), 0),
    totalCredits:    credits.reduce((s, t) => s + t.amountEur, 0),
    transactionCount: transactions.length,
    months,
    errors,
    status:          "pending_validation",
  };

  return { transactions, session, errors, detectedBank: colMap.bankName };
}

// ─── Fallback format fixe (Boursorama et autres sans metadata) ────────────────

function parseWithFixedFormat(
  dataRows:    string[][],
  format:      BankFormat,
  bankKey:     string,
  sessionId:   string,
  importedAt:  string,
  learnedRules?: Array<{ labelPattern: string; category: ExpenseCategory }>,
  existingFp?: Set<string>,
): EnrichedImportResult {
  const errors: string[] = [];
  const transactions: ImportedTransaction[] = [];
  const seenFp = new Set<string>(existingFp);

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]!;
    if (row.length < 3) continue;

    const dateStr  = (row[format.dateCol]  ?? "").trim().replace(/"/g, "");
    const rawLabel = (row[format.labelCol] ?? "").trim().replace(/"/g, "");
    const labelStr = cleanCSVLabel(rawLabel);
    let amountVal: number | null = null;

    if (format.debitCol !== undefined && format.creditCol !== undefined) {
      const d = parseAmount(row[format.debitCol]  ?? "");
      const c = parseAmount(row[format.creditCol] ?? "");
      if (d !== null && d !== 0) amountVal = -Math.abs(d);
      else if (c !== null && c !== 0) amountVal = Math.abs(c);
    } else {
      amountVal = parseAmount(row[format.amountCol] ?? "");
    }

    if (!dateStr || !labelStr || amountVal === null) continue;

    const date = parseDate(dateStr, format.dateFormat);
    if (!date || isNaN(date.getTime())) {
      errors.push(`Ligne ${i + format.skipRows + 1} : date invalide "${dateStr}"`);
      continue;
    }

    const isoDate     = toIsoDate(date);
    const isoMonth    = toIsoMonth(date);
    const amountCents = Math.round(amountVal * 100);
    const normalized  = normalizeLabel(labelStr);
    const fp          = fingerprint(isoDate, amountCents, normalized);
    const isDuplicate = seenFp.has(fp);

    let category: ExpenseCategory = "other";
    let confidence = 0.3;
    if (learnedRules) {
      for (const rule of learnedRules) {
        if (normalized.includes(rule.labelPattern)) { category = rule.category; confidence = 1.0; break; }
      }
    }
    if (confidence < 1.0) {
      const auto = categorizeLabel(labelStr);
      category   = auto.category;
      confidence = auto.confidence;
    }

    transactions.push({
      id: `${sessionId}_${i}`, date: isoDate, labelRaw: labelStr,
      labelNormalized: normalized, amountCents, amountEur: amountVal,
      category, categoryConfidence: confidence, isDebit: amountVal < 0,
      source: bankKey, status: isDuplicate ? "possible_duplicate" : "unmatched",
      matchedExpenseId: null, importedAt, month: isoMonth,
    });
    if (!isDuplicate) seenFp.add(fp);
  }

  const debits  = transactions.filter((t) => t.isDebit);
  const credits = transactions.filter((t) => !t.isDebit);
  const months  = [...new Set(transactions.map((t) => t.month))].sort();

  return {
    transactions,
    session: {
      id: sessionId, importedAt, detectedBank: format.name,
      totalDebits:  debits.reduce((s, t) => s + Math.abs(t.amountEur), 0),
      totalCredits: credits.reduce((s, t) => s + t.amountEur, 0),
      transactionCount: transactions.length, months, errors,
      status: "pending_validation",
    },
    errors,
    detectedBank: format.name,
  };
}

// ─── splitCSVLine (conservé pour le parser legacy) ────────────────────────────

function splitCSVLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (char === '"') { inQuotes = !inQuotes; }
    else if (char === sep && !inQuotes) { result.push(current); current = ""; }
    else { current += char; }
  }
  result.push(current);
  return result;
}



export function parseCSV(csvContent: string): ImportResult {
  const { format } = detectFormat(csvContent);
  const errors: string[] = [];
  const transactions: BankTransaction[] = [];

  const lines = csvContent
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const dataLines = lines.slice(format.skipRows);

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i]!;
    const cols = splitCSVLine(line, format.separator);
    if (cols.length < 3) continue;

    const dateStr  = cols[format.dateCol]?.trim().replace(/"/g, "") ?? "";
    const labelStr = cols[format.labelCol]?.trim().replace(/"/g, "") ?? "";
    let amountVal: number | null = null;

    if (format.debitCol !== undefined && format.creditCol !== undefined) {
      const debit  = parseAmount(cols[format.debitCol] ?? "");
      const credit = parseAmount(cols[format.creditCol] ?? "");
      if (debit  !== null && debit  !== 0) amountVal = -Math.abs(debit);
      else if (credit !== null && credit !== 0) amountVal = Math.abs(credit);
    } else {
      amountVal = parseAmount(cols[format.amountCol] ?? "");
    }

    if (!dateStr || !labelStr || amountVal === null) continue;

    const date = parseDate(dateStr, format.dateFormat);
    if (!date || isNaN(date.getTime())) {
      errors.push(`Ligne ${i + format.skipRows + 1} : date invalide "${dateStr}"`);
      continue;
    }

    const { category } = categorizeLabel(labelStr);
    transactions.push({ date, label: labelStr, amount: amountVal, category, isDebit: amountVal < 0, rawLine: line });
  }

  const totalDebit  = transactions.filter((t) => t.isDebit).reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalCredit = transactions.filter((t) => !t.isDebit).reduce((s, t) => s + t.amount, 0);

  const byCategory = {} as Record<ExpenseCategory, number>;
  for (const t of transactions.filter((t) => t.isDebit)) {
    byCategory[t.category] = (byCategory[t.category] ?? 0) + Math.abs(t.amount);
  }

  const months = [...new Set(
    transactions.map((t) => `${t.date.toLocaleString("fr-FR", { month: "long" })} ${t.date.getFullYear()}`)
  )];

  return { transactions, totalDebit, totalCredit, detectedBank: format.name, monthsDetected: months, errors, byCategory };
}

/** Convertit les transactions importées en lignes de dépenses pour le store (usage legacy) */
export function transactionsToExpenses(
  transactions: BankTransaction[],
): Array<{
  label:       string;
  category:    ExpenseCategory;
  amount:      number;
  frequency:   "monthly";
  isFixed:     boolean;
  isMandatory: boolean;
}> {
  const debits = transactions.filter((t) => t.isDebit);
  const grouped: Record<string, BankTransaction[]> = {};
  for (const t of debits) {
    const key = t.label.substring(0, 20).toLowerCase().trim();
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  }

  return Object.entries(grouped).map(([, txs]) => {
    const avgAmount = txs.reduce((s, t) => s + Math.abs(t.amount), 0) / txs.length;
    const isFixed   = txs.length > 1 && Math.max(...txs.map((t) => Math.abs(t.amount))) - Math.min(...txs.map((t) => Math.abs(t.amount))) < 5;
    const cat = txs[0]!.category;
    return {
      label:       txs[0]!.label.substring(0, 50),
      category:    cat,
      amount:      Math.round(avgAmount),
      frequency:   "monthly" as const,
      isFixed,
      isMandatory: cat === "housing" || cat === "credit" || cat === "taxes",
    };
  }).filter((e) => e.amount > 0);
}
