// =============================================================================
// Fichier  : src/services/csvImport.ts
// Auteur   : KREMER Regis
// Desc.    : Parser CSV bancaire - detection automatique du format + categorisation
//            Formats supportes : Boursorama, BNP, Credit Agricole, LCL,
//            Societe Generale, Caisse d'Epargne, La Banque Postale, generique
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation du fichier Phase 4
// =============================================================================

import type { ExpenseCategory } from "@/types/accounting";

// ── Types ────────────────────────────────────────────────────────────────────

export interface BankTransaction {
  date:     Date;
  label:    string;
  amount:   number;       // Negatif = debit, Positif = credit
  category: ExpenseCategory;
  isDebit:  boolean;
  rawLine:  string;
}

export interface ImportResult {
  transactions:    BankTransaction[];
  totalDebit:      number;
  totalCredit:     number;
  detectedBank:    string;
  monthsDetected:  string[];
  errors:          string[];
  byCategory:      Record<ExpenseCategory, number>;
}

// ── Formats bancaires ─────────────────────────────────────────────────────────

interface BankFormat {
  name:       string;
  separator:  string;
  dateCol:    number;
  labelCol:   number;
  amountCol:  number;
  debitCol?:  number;    // Certaines banques separent debit/credit
  creditCol?: number;
  skipRows:   number;    // Lignes d'en-tete a ignorer
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
    name: "Credit Agricole", separator: ";", dateCol: 0, labelCol: 2,
    amountCol: 3, skipRows: 1, dateFormat: "dd/mm/yyyy",
  },
  lcl: {
    name: "LCL", separator: ";", dateCol: 0, labelCol: 1,
    amountCol: 2, skipRows: 1, dateFormat: "dd/mm/yyyy",
  },
  societe_generale: {
    name: "Societe Generale", separator: ";", dateCol: 0, labelCol: 2,
    debitCol: 3, creditCol: 4, amountCol: 3, skipRows: 1, dateFormat: "dd/mm/yyyy",
  },
  caisse_epargne: {
    name: "Caisse d'Epargne", separator: ";", dateCol: 0, labelCol: 1,
    amountCol: 3, skipRows: 1, dateFormat: "dd/mm/yyyy",
  },
  la_banque_postale: {
    name: "La Banque Postale", separator: ";", dateCol: 0, labelCol: 2,
    amountCol: 4, skipRows: 2, dateFormat: "dd/mm/yyyy",
  },
  generic: {
    name: "Format generique", separator: ",", dateCol: 0, labelCol: 1,
    amountCol: 2, skipRows: 1, dateFormat: "dd/mm/yyyy",
  },
};

// ── Categorisation automatique ────────────────────────────────────────────────

const CATEGORY_KEYWORDS: Array<{ keywords: string[]; category: ExpenseCategory }> = [
  // Logement
  { keywords: ["loyer", "bail", "quittance", "charges locatives", "syndic", "copropriete"], category: "housing" },
  // Credits
  { keywords: ["credit", "pret immo", "mensualite", "credit conso", "credit auto", "cetelem", "sofinco", "cofidis"], category: "credit" },
  // Alimentation
  { keywords: ["carrefour", "leclerc", "lidl", "aldi", "intermarche", "casino", "super u", "monoprix", "franprix", "biocoop", "picard", "metro", "courses", "epicerie", "boulanger", "boucherie"], category: "food" },
  // Restaurant / livraison
  { keywords: ["uber eats", "deliveroo", "just eat", "mcdonald", "burger king", "kfc", "subway", "pizza", "sushi", "restaurant", "brasserie", "bistro", "cafe"], category: "food" },
  // Transport
  { keywords: ["sncf", "ratp", "navigo", "ter ", "transdev", "blablacar", "uber", "bolt", "total", "bp ", "esso", "shell", "leclerc carburant", "station", "essence", "gazole", "peage", "autoroute"], category: "transport" },
  // Sante
  { keywords: ["pharmacie", "medecin", "docteur", "hopital", "clinique", "mutuelle", "mgen", "harmonie", "malakoff", "alan sante", "axa sante", "cpam", "secu"], category: "health" },
  // Assurances
  { keywords: ["assurance", "axa", "maif", "macif", "mma", "allianz", "groupama", "matmut", "direct assurance", "covea"], category: "insurance" },
  // Telecom
  { keywords: ["sfr", "orange", "free", "bouygues telecom", "sosh", "red by sfr", "coriolis", "b&you", "prixtel", "spotify", "netflix", "disney", "amazon prime", "canal", "deezer", "youtube premium", "apple", "google play"], category: "telecom" },
  // Garde / Scolarite
  { keywords: ["creche", "halte", "assistante maternelle", "cantine", "ecole", "lycee", "college", "universite", "caf", "paje"], category: "childcare" },
  // Loisirs
  { keywords: ["cinema", "theatre", "concert", "fnac", "sephora", "lacoste", "decathlon", "sport", "fitness", "gym", "yoyo", "basic fit", "voyage", "hotel", "airbnb", "booking", "club med", "vacances"], category: "leisure" },
  // Habillement
  { keywords: ["zara", "h&m", "uniqlo", "primark", "shein", "asos", "vetement", "chaussure", "kiabi", "jules", "celio", "jennyfer"], category: "clothing" },
  // Impots
  { keywords: ["impot", "dgfip", "tresor public", "taxe fonciere", "taxe d'habitation", "cfe", "ursaf", "cotisation"], category: "taxes" },
  // Epargne / Placements
  { keywords: ["livret a", "ldd", "pel", "assurance vie", "pea", "virement epargne", "boursorama invest", "degiro", "trade republic", "bourse direct", "virement externe"], category: "savings" },
  // Abonnements
  { keywords: ["abonnement", "forfait", "mensualite abonnement", "amazon", "microsoft", "adobe", "dropbox"], category: "subscriptions" },
  // Cadeaux / Dons
  { keywords: ["croix rouge", "secours", "don", "cadeau", "amazon marketplace", "etsy", "fnac marketplace"], category: "gifts" },
];

function categorize(label: string): ExpenseCategory {
  const lower = label.toLowerCase();
  for (const { keywords, category } of CATEGORY_KEYWORDS) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return category;
    }
  }
  return "other";
}

// ── Detection du format bancaire ──────────────────────────────────────────────

function detectFormat(csvContent: string): BankFormat {
  const firstLines = csvContent.split("\n").slice(0, 5).join("\n").toLowerCase();

  if (firstLines.includes("boursorama"))      return BANK_FORMATS["boursorama"]!;
  if (firstLines.includes("bnp"))             return BANK_FORMATS["bnp"]!;
  if (firstLines.includes("credit agricole") || firstLines.includes("ca-"))
                                              return BANK_FORMATS["credit_agricole"]!;
  if (firstLines.includes("lcl"))             return BANK_FORMATS["lcl"]!;
  if (firstLines.includes("societe generale") || firstLines.includes("sg "))
                                              return BANK_FORMATS["societe_generale"]!;
  if (firstLines.includes("caisse d'epargne") || firstLines.includes("caisse epargne"))
                                              return BANK_FORMATS["caisse_epargne"]!;
  if (firstLines.includes("banque postale") || firstLines.includes("la poste"))
                                              return BANK_FORMATS["la_banque_postale"]!;

  // Detecter separateur
  const semicolonCount = (csvContent.slice(0, 500).match(/;/g) ?? []).length;
  const commaCount     = (csvContent.slice(0, 500).match(/,/g) ?? []).length;
  if (semicolonCount > commaCount) {
    const generic = { ...BANK_FORMATS["generic"]!, separator: ";" };
    return generic;
  }

  return BANK_FORMATS["generic"]!;
}

// ── Parsers de date ───────────────────────────────────────────────────────────

function parseDate(str: string, format: BankFormat["dateFormat"]): Date | null {
  const clean = str.trim().replace(/"/g, "");
  try {
    if (format === "dd/mm/yyyy") {
      const [d, m, y] = clean.split("/");
      return new Date(parseInt(y!), parseInt(m!) - 1, parseInt(d!));
    }
    if (format === "yyyy-mm-dd") {
      return new Date(clean);
    }
    if (format === "dd-mm-yyyy") {
      const [d, m, y] = clean.split("-");
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

// ── Parser principal ──────────────────────────────────────────────────────────

export function parseCSV(csvContent: string): ImportResult {
  const format = detectFormat(csvContent);
  const errors: string[] = [];
  const transactions: BankTransaction[] = [];

  const lines = csvContent
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const dataLines = lines.slice(format.skipRows);

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i]!;
    // Gestion des guillemets dans le CSV
    const cols = splitCSVLine(line, format.separator);

    if (cols.length < 3) continue;

    const dateStr   = cols[format.dateCol]?.trim().replace(/"/g, "") ?? "";
    const labelStr  = cols[format.labelCol]?.trim().replace(/"/g, "") ?? "";
    let   amountVal: number | null = null;

    // Gestion debit/credit separes
    if (format.debitCol !== undefined && format.creditCol !== undefined) {
      const debit  = parseAmount(cols[format.debitCol] ?? "");
      const credit = parseAmount(cols[format.creditCol] ?? "");
      if (debit !== null && debit !== 0)  amountVal = -Math.abs(debit);
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

    const category = categorize(labelStr);
    transactions.push({
      date,
      label:    labelStr,
      amount:   amountVal,
      category,
      isDebit:  amountVal < 0,
      rawLine:  line,
    });
  }

  // Calculs aggreges
  const totalDebit  = transactions.filter((t) => t.isDebit).reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalCredit = transactions.filter((t) => !t.isDebit).reduce((s, t) => s + t.amount, 0);

  const byCategory = {} as Record<ExpenseCategory, number>;
  for (const t of transactions.filter((t) => t.isDebit)) {
    byCategory[t.category] = (byCategory[t.category] ?? 0) + Math.abs(t.amount);
  }

  // Mois detectes
  const months = [...new Set(
    transactions.map((t) => `${t.date.toLocaleString("fr-FR", { month: "long" })} ${t.date.getFullYear()}`)
  )];

  return {
    transactions,
    totalDebit,
    totalCredit,
    detectedBank:   format.name,
    monthsDetected: months,
    errors,
    byCategory,
  };
}

/** Split CSV en gerant les guillemets */
function splitCSVLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === sep && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

/** Convertit les transactions importees en lignes de depenses pour le store */
export function transactionsToExpenses(
  transactions: BankTransaction[],
  monthFilter?: string,
): Array<{
  label:       string;
  category:    ExpenseCategory;
  amount:      number;
  frequency:   "monthly";
  isFixed:     boolean;
  isMandatory: boolean;
}> {
  // Grouper les debits par categorie et calculer la moyenne mensuelle
  const debits = transactions.filter((t) => t.isDebit);

  // Detecter les charges recurrentes (apparaissent chaque mois avec le meme montant ~)
  const grouped: Record<string, BankTransaction[]> = {};
  for (const t of debits) {
    const key = t.label.substring(0, 20).toLowerCase().trim();
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  }

  return Object.entries(grouped).map(([, txs]) => {
    const avgAmount = txs.reduce((s, t) => s + Math.abs(t.amount), 0) / txs.length;
    const isFixed   = txs.length > 1 && Math.max(...txs.map((t) => Math.abs(t.amount))) - Math.min(...txs.map((t) => Math.abs(t.amount))) < 5;
    const cat       = txs[0]!.category;

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
