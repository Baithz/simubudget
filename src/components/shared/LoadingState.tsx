// =============================================================================
// Fichier  : src/components/shared/LoadingState.tsx
// Auteur   : KREMER Régis
// Desc.    : État de chargement premium réutilisable pour les écrans SimuBudget.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-05-03 | KREMER Régis | Création — composant de chargement finition produit
// =============================================================================

import { clsx } from "clsx";

interface LoadingStateProps {
  title?:       string;
  description?: string;
  compact?:     boolean;
  className?:   string;
}

export function LoadingState({
  title = "Chargement en cours",
  description = "Les données sont en cours de préparation.",
  compact = false,
  className,
}: LoadingStateProps) {
  return (
    <section
      className={clsx(
        "sb-loading-state",
        compact && "sb-loading-state--compact",
        className,
      )}
      aria-busy="true"
      aria-live="polite"
    >
      <div className="sb-loading-state__spinner" aria-hidden="true" />
      <div>
        <h2 className="sb-loading-state__title">{title}</h2>
        <p className="sb-loading-state__description">{description}</p>
      </div>
    </section>
  );
}
