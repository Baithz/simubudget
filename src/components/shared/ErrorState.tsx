// =============================================================================
// Fichier  : src/components/shared/ErrorState.tsx
// Auteur   : KREMER Régis
// Desc.    : État d'erreur utilisateur réutilisable avec action de reprise.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-05-03 | KREMER Régis | Création — composant d'erreur finition produit
// =============================================================================

import { clsx } from "clsx";

interface ErrorStateProps {
  title?:       string;
  description: string;
  actionLabel?: string;
  onAction?:    () => void;
  className?:   string;
}

export function ErrorState({
  title = "Une action n'a pas abouti",
  description,
  actionLabel,
  onAction,
  className,
}: ErrorStateProps) {
  return (
    <section className={clsx("sb-error-state", className)} role="alert">
      <div className="sb-error-state__icon" aria-hidden="true">!</div>
      <div className="sb-error-state__content">
        <h2 className="sb-error-state__title">{title}</h2>
        <p className="sb-error-state__description">{description}</p>
        {actionLabel !== undefined && onAction !== undefined && (
          <button type="button" className="sb-action-button sb-action-button--secondary" onClick={onAction}>
            {actionLabel}
          </button>
        )}
      </div>
    </section>
  );
}
