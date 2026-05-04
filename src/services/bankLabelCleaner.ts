// =============================================================================
// Fichier  : src/services/bankLabelCleaner.ts
// Auteur   : KREMER Régis
// Desc.    : Nettoyage des libellés bancaires bruts en libellés lisibles pour
//            l'affichage et l'intégration dans Mes Comptes.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-05-04 | KREMER Régis | Création — libellés bancaires humains Phase 15.5
// =============================================================================

const TECHNICAL_PATTERNS = [
  /\bFR[0-9A-Z]{10,}\b/gi,
  /\bSOC[0-9A-Z]{8,}\b/gi,
  /\bRUM[0-9A-Z-]{8,}\b/gi,
  /\b[0-9A-F]{18,}\b/gi,
  /\b[0-9]{8,}\b/g,
  /\bCARTE\s+X{2,}\d*\b/gi,
  /\bCB\s+X{2,}\d*\b/gi,
  /\bPRLV\b/gi,
  /\bPRELEVEMENT\b/gi,
  /\bPAIEMENT\s+PAR\s+CARTE\b/gi,
  /\bVIREMENT\s+EMIS\b/gi,
  /\bRETRAIT\s+AU\s+DISTRIBUTEUR\b/gi,
  /\bFACT\.?\s*N[°O]?\.?\s*\w+\b/gi,
  /\bLE\s+\d{2}\/\d{2}\b/gi,
  /\b\d{2}\/\d{2}(?:\/\d{2,4})?\b/g,
];

const MERCHANT_RULES: Array<[RegExp, string]> = [
  [/\bMATMUT\b/i, "Matmut"],
  [/\bMACIF\b/i, "Macif"],
  [/\bOUI?CIANE\b|\bOCIANE\b/i, "Ociane"],
  [/\bORANGE\b/i, "Orange"],
  [/\bBOUYGUES\b/i, "Bouygues Telecom"],
  [/\bFREE\b/i, "Free"],
  [/\bSFR\b/i, "SFR"],
  [/\bCOFIDIS\b/i, "Cofidis"],
  [/\bCETELEM\b/i, "Cetelem"],
  [/\bLECLERC\b/i, "E.Leclerc"],
  [/\bLIDL\b/i, "Lidl"],
  [/\bALDI\b/i, "Aldi"],
  [/\bINTERMARCHE\b/i, "Intermarché"],
  [/\bCARREFOUR\b/i, "Carrefour"],
  [/\bAUCHAN\b/i, "Auchan"],
  [/\bBURGER\s*KING\b/i, "Burger King"],
  [/\bMCDONALD/i, "McDonald's"],
  [/\bAMAZON\b/i, "Amazon"],
  [/\bPAYPAL\b/i, "PayPal"],
  [/\bNETFLIX\b/i, "Netflix"],
  [/\bGOOGLE\b/i, "Google"],
  [/\bOCULUS\b/i, "Meta Quest"],
  [/\bCLAUDE\.AI\b|\bANTHROPIC\b/i, "Claude AI"],
  [/\bCOLLEGE\s+GRANDVILLE\b/i, "Collège Grandville"],
  [/\bSGC\s+NANCY\b/i, "SGC Nancy"],
];

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.length <= 2 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function simplifyBankLabel(rawLabel: string): string {
  const raw = rawLabel.trim();
  if (raw.length === 0) return "Transaction bancaire";

  for (const [pattern, label] of MERCHANT_RULES) {
    if (pattern.test(raw)) return label;
  }

  let cleaned = raw;
  for (const pattern of TECHNICAL_PATTERNS) {
    cleaned = cleaned.replace(pattern, " ");
  }

  cleaned = cleaned
    .replace(/[-_*/:;,()[\]{}]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length === 0) return "Transaction bancaire";

  const words = cleaned.split(" ").filter((word) => word.length > 1).slice(0, 5);
  return titleCase(words.join(" "));
}

export function buildImportedDisplayLabel(rawLabel: string, categoryLabel: string): string {
  const merchant = simplifyBankLabel(rawLabel);
  if (merchant === "Transaction bancaire") return `${merchant} — ${categoryLabel}`;
  return merchant;
}
