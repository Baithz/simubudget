// =============================================================================
// Fichier  : src/data/aplZones.ts
// Auteur   : KREMER Regis
// Desc.    : Donnees APL - zones et plafonds de loyer 2025
//            Source : Arrete du 27 septembre 2024, JO du 28 septembre 2024
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation du fichier
// =============================================================================
import type { AplZone } from "../types/profile";

/** Plafonds de loyer APL par zone et situation familiale (EUR/mois) */
export const APL_RENT_CEILINGS: Record<AplZone, Record<string, number>> = {
  1: { alone: 322, couple: 387, child1: 466, child2: 510, child3: 554 },
  2: { alone: 262, couple: 315, child1: 378, child2: 415, child3: 452 },
  3: { alone: 236, couple: 285, child1: 344, child2: 378, child3: 412 },
};

/** Participation minimale residuelle (toujours a la charge du locataire) */
export const APL_MINIMUM_PARTICIPATION = 35; // EUR/mois

/** R0 de base par zone (revenu plancher, en EUR/an) - valeurs indicatives 2025 */
export const APL_R0_BASE: Record<AplZone, number> = {
  1: 5200,
  2: 4600,
  3: 4200,
};

/** Villes => zone APL (liste partielle, les principales) */
export const CITY_APL_ZONE: Record<string, AplZone> = {
  "Paris":           1,
  "Boulogne-Billancourt": 1,
  "Neuilly-sur-Seine": 1,
  "Versailles":      2,
  "Lyon":            2,
  "Marseille":       2,
  "Nice":            2,
  "Toulouse":        2,
  "Bordeaux":        2,
  "Nantes":          2,
  "Strasbourg":      2,
  "Montpellier":     2,
  "Lille":           2,
  "Rennes":          2,
  "Grenoble":        2,
  "Tours":           3,
  "Dijon":           3,
  "Clermont-Ferrand": 3,
  "Limoges":         3,
  "Rouen":           3,
  "Reims":           3,
  "Metz":            3,
  "Nancy":           3,
};

export function getAplZone(city: string): AplZone {
  return CITY_APL_ZONE[city] ?? 3;
}
