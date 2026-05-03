// =============================================================================
// Fichier  : src/types/reconciliation.ts
// Auteur   : KREMER Régis
// Desc.    : Types pour l'import bancaire et le rapprochement prévu/réel (Phase 15.1)
// -----------------------------------------------------------------------------
// Changelog :
//   2026-05-03 | KREMER Régis | Création Phase 15.1 — import CSV et rapprochement
// =============================================================================

import type { ExpenseCategory } from "./accounting";

// ─── Statuts de rapprochement ────────────────────────────────────────────────

export type ReconciliationStatus =
  | "unmatched"          // Importée, sans dépense manuelle correspondante
  | "reconciled"         // Appairée (auto ou manuelle) avec une dépense manuelle
  | "ignored"            // Volontairement exclue par l'utilisateur
  | "possible_duplicate"; // Même montant + même date ±2j → alerte

// Statut d'une dépense manuelle vis-à-vis du rapprochement
export type ManualExpenseReconciliationStatus =
  | "manual"      // Saisie manuelle, pas encore de réel correspondant
  | "reconciled"  // Appairée avec une transaction importée
  | "unmatched";  // Dépense manuelle sans équivalent réel trouvé

// ─── Transaction importée (après parsing et normalisation) ───────────────────

export interface ImportedTransaction {
  id:                 string;
  date:               string;          // ISO date "YYYY-MM-DD"
  labelRaw:           string;          // Libellé bancaire brut
  labelNormalized:    string;          // Normalisé pour matching (majuscules, sans accents)
  amountCents:        number;          // En centimes — négatif = débit
  amountEur:          number;          // En euros — négatif = débit
  category:           ExpenseCategory;
  categoryConfidence: number;          // 0.0 à 1.0
  isDebit:            boolean;
  source:             string;          // "csv_boursorama", "csv_bnp", "csv_generique"…
  status:             ReconciliationStatus;
  matchedExpenseId:   string | null;   // ID de la dépense manuelle appairée
  reconciliationScore?: number;        // Score calculé (0.0 à 1.0)
  importedAt:         string;          // ISO datetime
  month:              string;          // "YYYY-MM" pour filtrage
  // Phase 15.4 — si intégrée dans Mes Comptes
  integratedMonthlyExpenseId?: string; // ID de ligne MonthlyExpenseLine créée ou mise à jour
  integratedAt?:               string; // ISO datetime de l'intégration
}

// ─── Règle de catégorisation apprise localement ──────────────────────────────

export interface CategoryRule {
  id:           string;
  labelPattern: string;   // Sous-chaîne normalisée à rechercher dans le libellé
  category:     ExpenseCategory;
  confidence:   number;   // 1.0 par défaut pour les règles apprises manuellement
  learnedAt:    string;   // ISO date
  usageCount:   number;
}

// ─── Rapport de rapprochement par enveloppe ──────────────────────────────────

export interface EnvelopeReconciliationReport {
  category:          ExpenseCategory;
  label:             string;
  planned:           number;   // Total des dépenses manuelles (en €)
  real:              number;   // Total des transactions importées débit (en €)
  reconciled:        number;   // Total appairé (en €)
  unplanned:         number;   // Réel sans équivalent manuel (en €)
  unreal:            number;   // Manuel sans équivalent réel (en €)
  delta:             number;   // real - planned (positif = dépassement)
  transactionCount:  number;   // Nombre de transactions importées dans cette catégorie
}

// ─── Résultat d'un import complet ────────────────────────────────────────────

export interface ImportSession {
  id:              string;
  importedAt:      string;       // ISO datetime
  detectedBank:    string;
  totalDebits:     number;       // En €
  totalCredits:    number;       // En €
  transactionCount: number;
  months:          string[];     // Mois couverts "YYYY-MM"
  errors:          string[];
  status:          "pending_validation" | "validated" | "cancelled";
}

// ─── Résumé de rapprochement pour l'UI ───────────────────────────────────────

export interface ReconciliationSummary {
  month:              string;          // "YYYY-MM"
  totalImported:      number;          // Nb transactions importées
  totalReconciled:    number;          // Nb appairées
  totalUnmatched:     number;          // Nb non appairées (côté import)
  totalManualOnly:    number;          // Nb dépenses manuelles sans réel
  totalIgnored:       number;          // Nb ignorées
  possibleDuplicates: number;          // Nb doublons possibles
  envelopes:          EnvelopeReconciliationReport[];
}

// ─── Paire de rapprochement (pour l'affichage côte à côte) ──────────────────

export interface ReconciliationPair {
  manual:   ManualSide | null;
  imported: ImportedSide | null;
  status:   "reconciled" | "manual_only" | "imported_only" | "possible_duplicate";
  delta?:   number;   // imported.amount - manual.amount (si les deux existent)
}

export interface ManualSide {
  expenseId:  string;
  label:      string;
  category:   ExpenseCategory;
  amount:     number;    // En € positif
  date:       string;    // "YYYY-MM-DD"
  reconciliationStatus: ManualExpenseReconciliationStatus;
}

export interface ImportedSide {
  transactionId: string;
  labelRaw:      string;
  category:      ExpenseCategory;
  amount:        number;   // En € positif (abs)
  date:          string;   // "YYYY-MM-DD"
  status:        ReconciliationStatus;
}

// ─── Input brut envoyé à Rust pour normalisation ─────────────────────────────

export interface RawTransactionRow {
  dateStr:   string;
  labelStr:  string;
  amountStr: string;
  source:    string;
}
