// =============================================================================
// Fichier  : src/data/releaseNotes.ts
// Auteur   : KREMER Régis
// Desc.    : Notes de version utilisateur utilisées comme fallback dans la
//            modale de mise à jour automatique SimuBudget.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-05-03 | KREMER Régis | Création — patchnote utilisateur v2.5.0 pour auto-update
// =============================================================================

export const FALLBACK_RELEASE_NOTES_BY_VERSION: Record<string, string> = {
  "2.5.0": `🚀 SimuBudget 2.5.0 — Votre copilote financier

✨ Nouveautés majeures
• Assistant financier intelligent avec réponses chiffrées à partir de vos données.
• Import bancaire multi-formats avec rapprochement prévu / réel.
• Objectifs de vie avec projection réelle.
• Simulations de situations concrètes : perte d'emploi, inflation et imprévus.

📊 Améliorations
• Lecture instantanée de votre situation depuis le tableau de bord.
• Score expliqué avec ce qui s'améliore et ce qui se dégrade.
• Guide utilisateur plus complet et interactif.
• Interface plus fluide, plus cohérente et plus confortable.

🛡️ Correctifs
• Confirmation avant suppression d'un profil.
• Actions sensibles mieux sécurisées.
• Stabilité générale améliorée.

Objectif : vous aider à comprendre votre argent et prendre de meilleures décisions.`,
};

export function getFallbackReleaseNotes(version: string): string | null {
  const normalized = version.trim().replace(/^v/i, "");
  return FALLBACK_RELEASE_NOTES_BY_VERSION[normalized] ?? null;
}
