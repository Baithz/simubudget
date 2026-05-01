// =============================================================================
// Fichier  : src/utils/formatCurrency.ts
// Auteur   : KREMER Régis
// Desc.    : Utilitaires de formatage des montants, pourcentages et durées.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Régis | Création du fichier
//   2026-05-01 | KREMER Régis | Phase 11 — Ajout formatYears (pluriel conditionnel)
// =============================================================================

const FR_CURRENCY = new Intl.NumberFormat("fr-FR", {
  style:                 "currency",
  currency:              "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const FR_PERCENT = new Intl.NumberFormat("fr-FR", {
  style:                 "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Formate un montant en euros : 1 234 € */
export function formatEur(amount: number): string {
  return FR_CURRENCY.format(amount);
}

/** Formate un ratio (0–1) en pourcentage : 35,0 % */
export function formatPct(ratio: number): string {
  return FR_PERCENT.format(ratio);
}

/** Formate un pourcentage déjà en base 100 : 35,0 % */
export function formatPctFromHundred(pct: number): string {
  return FR_PERCENT.format(pct / 100);
}

/**
 * Formate une durée en années avec pluriel conditionnel correct.
 * formatYears(1)  → "1 an"
 * formatYears(20) → "20 ans"
 */
export function formatYears(n: number): string {
  return n === 1 ? "1 an" : `${n} ans`;
}

/** Couleur selon zone financière */
export function colorForZone(ratio: number, thresholds: [number, number]): string {
  const [warn, danger] = thresholds;
  if (ratio <= warn)   return "text-zone-green";
  if (ratio <= danger) return "text-zone-orange";
  return "text-zone-red";
}
