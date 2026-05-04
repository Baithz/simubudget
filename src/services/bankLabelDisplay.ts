// =============================================================================
// Fichier  : src/services/bankLabelDisplay.ts
// Auteur   : KREMER Régis
// Desc.    : Nettoyage des libellés bancaires bruts en libellés humains lisibles,
//            tout en conservant le libellé original pour audit et rapprochement.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-05-04 | KREMER Régis | Phase 3 — création du service de libellés bancaires humains
// =============================================================================

import type { ExpenseCategory } from "@/types/accounting";

export interface BankLabelDisplayResult {
  displayLabel: string;
  merchantLabel: string;
  categoryHint?: ExpenseCategory;
  matchedRule?: string;
}

function normalizeBankLabel(label: string): string {
  return label
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface BankLabelRule {
  pattern: string;
  displayLabel: string;
  merchantLabel: string;
  categoryHint?: ExpenseCategory;
}

const BANK_LABEL_RULES: BankLabelRule[] = [
  { pattern: "MATMUT", displayLabel: "Matmut — Assurance", merchantLabel: "Matmut", categoryHint: "insurance" },
  { pattern: "MACIF", displayLabel: "Macif — Assurance", merchantLabel: "Macif", categoryHint: "insurance" },
  { pattern: "MAIF", displayLabel: "MAIF — Assurance", merchantLabel: "MAIF", categoryHint: "insurance" },
  { pattern: "AXA", displayLabel: "AXA — Assurance", merchantLabel: "AXA", categoryHint: "insurance" },
  { pattern: "COFIDIS", displayLabel: "Cofidis — Crédit", merchantLabel: "Cofidis", categoryHint: "credit" },
  { pattern: "CETELEM", displayLabel: "Cetelem — Crédit", merchantLabel: "Cetelem", categoryHint: "credit" },
  { pattern: "SOFINCO", displayLabel: "Sofinco — Crédit", merchantLabel: "Sofinco", categoryHint: "credit" },
  { pattern: "ORANGE", displayLabel: "Orange — Internet / Mobile", merchantLabel: "Orange", categoryHint: "telecom" },
  { pattern: "BOUYGUES TELECOM", displayLabel: "Bouygues Telecom", merchantLabel: "Bouygues Telecom", categoryHint: "telecom" },
  { pattern: "SFR", displayLabel: "SFR — Internet / Mobile", merchantLabel: "SFR", categoryHint: "telecom" },
  { pattern: "FREE MOBILE", displayLabel: "Free Mobile", merchantLabel: "Free Mobile", categoryHint: "telecom" },
  { pattern: "FREE TELECOM", displayLabel: "Free — Internet", merchantLabel: "Free", categoryHint: "telecom" },
  { pattern: "NETFLIX", displayLabel: "Netflix", merchantLabel: "Netflix", categoryHint: "subscriptions" },
  { pattern: "SPOTIFY", displayLabel: "Spotify", merchantLabel: "Spotify", categoryHint: "subscriptions" },
  { pattern: "GOOGLE ONE", displayLabel: "Google One", merchantLabel: "Google One", categoryHint: "subscriptions" },
  { pattern: "CLAUDE AI", displayLabel: "Claude AI", merchantLabel: "Claude AI", categoryHint: "subscriptions" },
  { pattern: "ANTHROPIC", displayLabel: "Claude AI", merchantLabel: "Claude AI", categoryHint: "subscriptions" },
  { pattern: "AMAZON", displayLabel: "Amazon", merchantLabel: "Amazon", categoryHint: "other" },
  { pattern: "LECLERC", displayLabel: "Leclerc — Courses", merchantLabel: "Leclerc", categoryHint: "food" },
  { pattern: "LIDL", displayLabel: "Lidl — Courses", merchantLabel: "Lidl", categoryHint: "food" },
  { pattern: "AUCHAN", displayLabel: "Auchan — Courses", merchantLabel: "Auchan", categoryHint: "food" },
  { pattern: "CARREFOUR", displayLabel: "Carrefour — Courses", merchantLabel: "Carrefour", categoryHint: "food" },
  { pattern: "INTERMARCHE", displayLabel: "Intermarché — Courses", merchantLabel: "Intermarché", categoryHint: "food" },
  { pattern: "SUPER U", displayLabel: "Super U — Courses", merchantLabel: "Super U", categoryHint: "food" },
  { pattern: "COLLEGE", displayLabel: "Collège — Scolarité", merchantLabel: "Collège", categoryHint: "childcare" },
  { pattern: "CANTINE", displayLabel: "Cantine scolaire", merchantLabel: "Cantine", categoryHint: "childcare" },
  { pattern: "PHARMACIE", displayLabel: "Pharmacie", merchantLabel: "Pharmacie", categoryHint: "health" },
  { pattern: "SNCF", displayLabel: "SNCF", merchantLabel: "SNCF", categoryHint: "transport" },
  { pattern: "TOTAL", displayLabel: "TotalEnergies — Carburant", merchantLabel: "TotalEnergies", categoryHint: "transport" },
  { pattern: "ESSO", displayLabel: "Esso — Carburant", merchantLabel: "Esso", categoryHint: "transport" },
  { pattern: "IMPOTS", displayLabel: "Impôts", merchantLabel: "Impôts", categoryHint: "taxes" },
  { pattern: "DGFIP", displayLabel: "Impôts", merchantLabel: "Impôts", categoryHint: "taxes" },
  { pattern: "EDF", displayLabel: "EDF — Énergie", merchantLabel: "EDF", categoryHint: "housing" },
  { pattern: "ENGIE", displayLabel: "Engie — Énergie", merchantLabel: "Engie", categoryHint: "housing" },
];

const TECHNICAL_TOKENS = new Set([
  "PRELEVEMENT", "PRLV", "SEPA", "VIREMENT", "VIR", "CARTE", "CB", "PAIEMENT",
  "FACTURE", "ACHAT", "RETRAIT", "SOC", "AMDT", "FR", "C", "REF", "MANDAT",
]);

function titleCaseWord(word: string): string {
  if (word.length <= 2) return word.toUpperCase();
  return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
}

function fallbackMerchantLabel(normalizedLabel: string): string {
  const tokens = normalizedLabel
    .split(" ")
    .filter((token) => token.length >= 3)
    .filter((token) => !TECHNICAL_TOKENS.has(token))
    .filter((token) => !/^\d+$/.test(token))
    .filter((token) => !/^FR\d+/i.test(token))
    .slice(0, 3);

  if (tokens.length === 0) return "Transaction bancaire";
  return tokens.map(titleCaseWord).join(" ");
}

export function getHumanBankLabel(rawLabel: string, category?: ExpenseCategory): BankLabelDisplayResult {
  const normalized = normalizeBankLabel(rawLabel);
  const rule = BANK_LABEL_RULES.find((item) => normalized.includes(item.pattern));

  if (rule !== undefined) {
    return {
      displayLabel: rule.displayLabel,
      merchantLabel: rule.merchantLabel,
      ...(rule.categoryHint !== undefined ? { categoryHint: rule.categoryHint } : {}),
      matchedRule: rule.pattern,
    };
  }

  const merchantLabel = fallbackMerchantLabel(normalized);
  const suffixByCategory: Partial<Record<ExpenseCategory, string>> = {
    insurance: "Assurance",
    telecom: "Internet / Mobile",
    credit: "Crédit",
    food: "Courses",
    transport: "Transport",
    health: "Santé",
    childcare: "Scolarité",
    subscriptions: "Abonnement",
    taxes: "Impôts / Taxes",
  };
  const suffix = category !== undefined ? suffixByCategory[category] : undefined;

  return {
    displayLabel: suffix !== undefined && merchantLabel !== "Transaction bancaire"
      ? `${merchantLabel} — ${suffix}`
      : merchantLabel,
    merchantLabel,
  };
}

export function shouldReplaceCategoryFromBankLabel(current: ExpenseCategory, suggested: ExpenseCategory | undefined): boolean {
  if (suggested === undefined) return false;
  if (current === suggested) return false;
  return current === "other" || current === "professional";
}
