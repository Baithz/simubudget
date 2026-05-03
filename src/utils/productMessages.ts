// =============================================================================
// Fichier  : src/utils/productMessages.ts
// Auteur   : KREMER Régis
// Desc.    : Messages courts et cohérents pour les états produit SimuBudget.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-05-03 | KREMER Régis | Création — référentiel de messages finition produit
// =============================================================================

export const PRODUCT_MESSAGES = {
  noImport: {
    title: "Aucun relevé importé",
    description:
      "Importez un relevé bancaire pour comparer vos prévisions avec vos dépenses réelles.",
  },
  noTransactions: {
    title: "Aucune dépense sur ce mois",
    description:
      "Ajoutez une dépense ou importez un relevé pour obtenir une lecture plus fiable du mois.",
  },
  noHistory: {
    title: "Historique insuffisant",
    description:
      "Les tendances apparaîtront après plusieurs mois de suivi.",
  },
  emptyProfile: {
    title: "Profil à compléter",
    description:
      "Complétez vos revenus et charges principales pour obtenir un diagnostic fiable.",
  },
} as const;
