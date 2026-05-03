// =============================================================================
// Fichier  : src/services/ofxImport.ts
// Auteur   : KREMER Régis
// Desc.    : Parser OFX/QIF pour import bancaire — Phase 15.3.
//            OFX (Open Financial Exchange) : format SGML/XML utilisé par BNP,
//            Crédit Agricole, LCL, CIC, Fortuneo, Hello Bank.
//            QIF (Quicken Interchange Format) : format texte hérité, moins courant.
//            Parser maison sans dépendance externe — OFX et QIF sont simples.
//            Produit le même EnrichedImportResult que csvImport.ts.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-05-03 | KREMER Régis | Création Phase 15.3 — import OFX/QIF bancaire
// =============================================================================

import type { EnrichedImportResult } from "@/services/csvImport";
import type { ImportedTransaction, ImportSession } from "@/types/reconciliation";
import type { CategoryRule } from "@/types/reconciliation";
import { normalizeLabel } from "@/store/reconciliationStore";
import { categorizeLabel } from "@/services/csvImport";

// ─── OFX — Open Financial Exchange ───────────────────────────────────────────
//
// OFX est du SGML (comme HTML mais sans fermeture obligatoire des balises).
// Exemple de transaction OFX :
//
// <STMTTRN>
//   <TRNTYPE>DEBIT
//   <DTPOSTED>20260501120000[+2:CEST]
//   <TRNAMT>-78.50
//   <FITID>20260501001234
//   <NAME>LIDL NANCY
//   <MEMO>PAIEMENT CB
// </STMTTRN>
//
// La stratégie : extraction par regex des blocs <STMTTRN>...</STMTTRN>
// puis extraction des champs individuels par regex — pas de vrai parser SGML.

interface OFXTransaction {
  trnType:   string;   // DEBIT | CREDIT | OTHER
  dtPosted:  string;   // YYYYMMDD...
  amount:    number;   // Négatif = débit
  fitId:     string;   // Identifiant unique banque
  name:      string;   // Libellé court
  memo:      string;   // Libellé long (complémentaire à name)
}

function extractOFXTag(block: string, tag: string): string {
  // Matche <TAG>valeur (avec ou sans </TAG>)
  const re = new RegExp(`<${tag}>([^<\r\n]+)`, "i");
  const m  = block.match(re);
  return m ? m[1]!.trim() : "";
}

function parseOFXDate(raw: string): string | null {
  // Format : YYYYMMDDHHMMSS[+2:CEST] ou YYYYMMDD
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function parseOFXContent(content: string): {
  transactions: OFXTransaction[];
  currency: string;
  bankId: string;
} {
  const transactions: OFXTransaction[] = [];

  // Détecter la devise et la banque
  const currency = extractOFXTag(content, "CURDEF") || "EUR";
  const bankId   = extractOFXTag(content, "BANKID") || extractOFXTag(content, "BROKID") || "";

  // Extraire tous les blocs de transactions
  const blockRe = /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>)|$)/gi;
  let match: RegExpExecArray | null;

  while ((match = blockRe.exec(content)) !== null) {
    const block = match[1]!;
    if (!block.trim()) continue;

    const amountStr = extractOFXTag(block, "TRNAMT");
    const amount    = parseFloat(amountStr.replace(",", "."));
    if (isNaN(amount) || amount === 0) continue;

    const dtPosted  = extractOFXTag(block, "DTPOSTED");
    const name      = extractOFXTag(block, "NAME");
    const memo      = extractOFXTag(block, "MEMO");
    const fitId     = extractOFXTag(block, "FITID");
    const trnType   = extractOFXTag(block, "TRNTYPE") || (amount < 0 ? "DEBIT" : "CREDIT");

    if (!dtPosted) continue;

    transactions.push({ trnType, dtPosted, amount, fitId, name, memo });
  }

  return { transactions, currency, bankId };
}

// ─── QIF — Quicken Interchange Format ────────────────────────────────────────
//
// Format texte structuré. Chaque transaction est un bloc de lignes
// commençant par un code lettre, terminé par ^
//
// D01/05/2026   ← date (D)
// T-78,50       ← montant (T) — virgule décimale possible
// PLIDL NANCY   ← payee/libellé (P)
// M Paiement CB ← memo (M)
// ^             ← fin de transaction

interface QIFTransaction {
  date:   string;   // brut
  amount: number;
  payee:  string;
  memo:   string;
}

function parseQIFDate(raw: string): string | null {
  // DD/MM/YYYY ou DD-MM-YYYY ou MM/DD/YYYY — on suppose DD/MM/YYYY (France)
  const s1 = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (s1) {
    const d    = s1[1]!.padStart(2, "0");
    const m    = s1[2]!.padStart(2, "0");
    const year = s1[3]!.length === 2 ? `20${s1[3]}` : s1[3]!;
    return `${year}-${m}-${d}`;
  }
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return null;
}

function parseQIFContent(content: string): QIFTransaction[] {
  const transactions: QIFTransaction[] = [];
  const blocks = content.split("^");

  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let date   = "";
    let amount = NaN;
    let payee  = "";
    let memo   = "";

    for (const line of lines) {
      const code  = line[0] ?? "";
      const value = line.slice(1).trim();
      switch (code.toUpperCase()) {
        case "D": date   = value; break;
        case "T": amount = parseFloat(value.replace(/\s/g, "").replace(",", ".")); break;
        case "P": payee  = value; break;
        case "M": memo   = value; break;
      }
    }

    if (!date || isNaN(amount) || amount === 0) continue;
    transactions.push({ date, amount, payee, memo });
  }

  return transactions;
}

// ─── Helpers communs ──────────────────────────────────────────────────────────

function toIsoMonth(isoDate: string): string {
  return isoDate.slice(0, 7);
}

function fingerprint(dateStr: string, amountCents: number, normalizedLabel: string): string {
  return `${dateStr}|${amountCents}|${normalizedLabel.slice(0, 30)}`;
}

function generateId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function buildTransaction(
  idx:          number,
  sessionId:    string,
  importedAt:   string,
  isoDate:      string,
  amountVal:    number,
  labelStr:     string,
  source:       string,
  learnedRules: CategoryRule[] | undefined,
  seenFp:       Set<string>,
): ImportedTransaction | null {
  if (!isoDate || !labelStr) return null;

  const isoMonth    = toIsoMonth(isoDate);
  const amountCents = Math.round(amountVal * 100);
  const normalized  = normalizeLabel(labelStr);
  const fp          = fingerprint(isoDate, amountCents, normalized);
  const isDuplicate = seenFp.has(fp);

  let category    = "other" as ReturnType<typeof categorizeLabel>["category"];
  let confidence  = 0.3;

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

  if (!isDuplicate) seenFp.add(fp);

  return {
    id:                 `${sessionId}_${idx}`,
    date:               isoDate,
    labelRaw:           labelStr,
    labelNormalized:    normalized,
    amountCents,
    amountEur:          amountVal,
    category,
    categoryConfidence: confidence,
    isDebit:            amountVal < 0,
    source,
    status:             isDuplicate ? "possible_duplicate" : "unmatched",
    matchedExpenseId:   null,
    importedAt,
    month:              isoMonth,
  };
}

function buildSession(
  sessionId:    string,
  importedAt:   string,
  detectedBank: string,
  transactions: ImportedTransaction[],
  errors:       string[],
): ImportSession {
  const debits  = transactions.filter((t) => t.isDebit);
  const credits = transactions.filter((t) => !t.isDebit);
  const months  = [...new Set(transactions.map((t) => t.month))].sort();

  return {
    id:              sessionId,
    importedAt,
    detectedBank,
    totalDebits:      debits.reduce((s, t) => s + Math.abs(t.amountEur), 0),
    totalCredits:     credits.reduce((s, t) => s + t.amountEur, 0),
    transactionCount: transactions.length,
    months,
    errors,
    status: "pending_validation",
  };
}

// ─── Point d'entrée OFX ──────────────────────────────────────────────────────

/**
 * Parse un fichier OFX/QFX bancaire.
 * Lire avec FileReader.readAsText(file, "UTF-8") ou "windows-1252".
 */
export function parseOFX(
  content:       string,
  fileName:      string,
  learnedRules?: CategoryRule[],
  existingFp?:   Set<string>,
): EnrichedImportResult {
  const sessionId  = generateId();
  const importedAt = new Date().toISOString();
  const errors: string[] = [];
  const transactions: ImportedTransaction[] = [];
  const seenFp = new Set<string>(existingFp);

  const { transactions: ofxTxs, bankId } = parseOFXContent(content);
  const detectedBank = detectBankFromOFX(bankId, fileName);

  ofxTxs.forEach((tx, i) => {
    const isoDate  = parseOFXDate(tx.dtPosted);
    if (!isoDate) {
      errors.push(`Transaction ${i + 1} : date invalide "${tx.dtPosted}"`);
      return;
    }

    // Libellé : préférer NAME, compléter avec MEMO si distinct
    const labelParts = [tx.name, tx.memo]
      .map((s) => s.trim())
      .filter(Boolean);
    const dedupedParts = labelParts.filter((s, i) =>
      i === 0 || !labelParts[0]!.toLowerCase().includes(s.toLowerCase())
    );
    const labelStr = dedupedParts.join(" — ").slice(0, 80) || `Transaction ${i + 1}`;

    const built = buildTransaction(
      i, sessionId, importedAt, isoDate, tx.amount,
      labelStr, `ofx_${detectedBank.toLowerCase().replace(/\s/g, "_")}`,
      learnedRules, seenFp,
    );
    if (built) transactions.push(built);
  });

  if (ofxTxs.length === 0) {
    errors.push("Aucune transaction trouvée dans ce fichier OFX. Vérifiez qu'il s'agit d'un export de relevé bancaire.");
  }

  return {
    transactions,
    session: buildSession(sessionId, importedAt, detectedBank, transactions, errors),
    errors,
    detectedBank,
  };
}

// ─── Point d'entrée QIF ──────────────────────────────────────────────────────

/**
 * Parse un fichier QIF bancaire.
 * Lire avec FileReader.readAsText(file, "UTF-8") ou "windows-1252".
 */
export function parseQIF(
  content:       string,
  fileName:      string,
  learnedRules?: CategoryRule[],
  existingFp?:   Set<string>,
): EnrichedImportResult {
  const sessionId  = generateId();
  const importedAt = new Date().toISOString();
  const errors: string[] = [];
  const transactions: ImportedTransaction[] = [];
  const seenFp = new Set<string>(existingFp);
  const detectedBank = detectBankFromFileName(fileName);

  const qifTxs = parseQIFContent(content);

  qifTxs.forEach((tx, i) => {
    const isoDate = parseQIFDate(tx.date);
    if (!isoDate) {
      errors.push(`Transaction ${i + 1} : date invalide "${tx.date}"`);
      return;
    }

    const labelStr = [tx.payee, tx.memo]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(" — ")
      .slice(0, 80) || `Transaction ${i + 1}`;

    const built = buildTransaction(
      i, sessionId, importedAt, isoDate, tx.amount,
      labelStr, "qif_generic",
      learnedRules, seenFp,
    );
    if (built) transactions.push(built);
  });

  if (qifTxs.length === 0) {
    errors.push("Aucune transaction trouvée dans ce fichier QIF.");
  }

  return {
    transactions,
    session: buildSession(sessionId, importedAt, detectedBank, transactions, errors),
    errors,
    detectedBank,
  };
}

// ─── Détection banque ─────────────────────────────────────────────────────────

function detectBankFromOFX(bankId: string, fileName: string): string {
  const id = bankId.toLowerCase();
  if (id.includes("30006") || id.includes("30004")) return "Crédit Agricole";
  if (id.includes("30004")) return "BNP Paribas";
  if (id.includes("30002")) return "Crédit Lyonnais (LCL)";
  if (id.includes("30076") || id.includes("societe")) return "Société Générale";
  if (id.includes("10278") || id.includes("caisse")) return "Caisse d'Épargne";
  if (id.includes("20041") || id.includes("postale")) return "La Banque Postale";
  if (id.includes("30027") || id.includes("cic"))  return "CIC";
  if (id.includes("fortuneo")) return "Fortuneo";
  if (id.includes("hello"))    return "Hello Bank";
  return detectBankFromFileName(fileName);
}

function detectBankFromFileName(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.includes("bnp"))              return "BNP Paribas";
  if (lower.includes("creditagricole") || lower.includes("ca_"))  return "Crédit Agricole";
  if (lower.includes("lcl"))              return "LCL";
  if (lower.includes("socgen"))           return "Société Générale";
  if (lower.includes("caisse"))           return "Caisse d'Épargne";
  if (lower.includes("postale"))          return "La Banque Postale";
  if (lower.includes("cic"))              return "CIC";
  if (lower.includes("fortuneo"))         return "Fortuneo";
  if (lower.includes("hello"))            return "Hello Bank";
  if (lower.includes("revolut"))          return "Revolut";
  if (lower.includes("n26"))              return "N26";
  return "Format OFX/QIF";
}
