// =============================================================================
// Fichier  : src/data/ptzData.ts
// Auteur   : KREMER Regis
// Desc.    : Donnees PTZ 2025 - zones, plafonds revenus, quotites, plafonds prix
//            Source : Decret ndeg 2023-1297 du 28 decembre 2023
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation du fichier
// =============================================================================
import type { PtzZone } from "../types/purchase";

/** Plafonds de ressources PTZ par zone et taille du foyer (revenus fiscaux N-2, EUR/an) */
export const PTZ_INCOME_CEILINGS: Record<PtzZone, number[]> = {
  // Index 0 = 1 personne, index 1 = 2 personnes, ... index 4+ = 5 personnes+
  A_BIS: [37000, 51800, 62900, 74000, 85100, 96200, 107300, 118400],
  A:     [37000, 51800, 62900, 74000, 85100, 96200, 107300, 118400],
  B1:    [30000, 42000, 51000, 60000, 69000, 78000, 87000, 96000],
  B2:    [27000, 37800, 45900, 54000, 62100, 70200, 78300, 86400],
  C:     [24000, 33600, 40800, 48000, 55200, 62400, 69600, 76800],
};

/** Quotites PTZ (fraction du prix eligible financee) */
export const PTZ_QUOTITY: Record<PtzZone, { nouveau: number; ancien: number }> = {
  A_BIS: { nouveau: 0.40, ancien: 0.40 },
  A:     { nouveau: 0.40, ancien: 0.40 },
  B1:    { nouveau: 0.40, ancien: 0.40 },
  B2:    { nouveau: 0.20, ancien: 0.40 },  // Ancien avec travaux >= 25%
  C:     { nouveau: 0.20, ancien: 0.40 },
};

/** Plafonds du prix de l'operation pris en compte pour le PTZ */
export const PTZ_PRICE_CEILINGS: Record<PtzZone, number[]> = {
  // Index 0 = 1 personne, index 4+ = 5 personnes+
  A_BIS: [150000, 210000, 255000, 300000, 345000],
  A:     [150000, 210000, 255000, 300000, 345000],
  B1:    [135000, 189000, 230000, 270000, 310000],
  B2:    [110000, 154000, 187000, 220000, 253000],
  C:     [100000, 140000, 170000, 200000, 230000],
};

/** Duree du differe selon niveau de revenus (part du plafond) */
export function getPtzDeferral(incomeRatio: number): number {
  if (incomeRatio <= 0.5) return 15;
  if (incomeRatio <= 0.75) return 10;
  return 5;
}

/** Mapping ville -> zone PTZ (liste partielle) */
export const CITY_PTZ_ZONE: Record<string, PtzZone> = {
  "Paris":           "A_BIS",
  "Boulogne-Billancourt": "A_BIS",
  "Lyon":            "A",
  "Marseille":       "A",
  "Nice":            "A",
  "Toulouse":        "B1",
  "Bordeaux":        "B1",
  "Nantes":          "B1",
  "Strasbourg":      "B1",
  "Montpellier":     "B1",
  "Lille":           "B1",
  "Rennes":          "B1",
  "Grenoble":        "B1",
  "Tours":           "B2",
  "Dijon":           "B2",
  "Clermont-Ferrand": "B2",
  "Limoges":         "C",
  "Rouen":           "B2",
  "Reims":           "B2",
  "Metz":            "B2",
  "Nancy":           "B2",
};

export function getPtzZone(city: string): PtzZone {
  return CITY_PTZ_ZONE[city] ?? "C";
}

export function getPtzIncomeCeiling(zone: PtzZone, householdSize: number): number {
  const ceilings = PTZ_INCOME_CEILINGS[zone];
  const idx = Math.min(householdSize - 1, ceilings.length - 1);
  return ceilings[idx] ?? ceilings[ceilings.length - 1] ?? 0;
}

export function getPtzPriceCeiling(zone: PtzZone, householdSize: number): number {
  const ceilings = PTZ_PRICE_CEILINGS[zone];
  const idx = Math.min(householdSize - 1, ceilings.length - 1);
  return ceilings[idx] ?? ceilings[ceilings.length - 1] ?? 0;
}
