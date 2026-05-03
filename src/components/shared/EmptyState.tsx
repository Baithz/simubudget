// =============================================================================
// Fichier  : src/components/shared/EmptyState.tsx
// Auteur   : KREMER Régis
// Desc.    : État vide premium réutilisable pour les modules SimuBudget.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-05-03 | KREMER Régis | Création — composant d'état vide finition produit
// =============================================================================

import { clsx } from "clsx";

interface EmptyStateAction {
  label:    string;
  onClick:  () => void;
  variant?: "primary" | "secondary";
}

interface EmptyStateProps {
  title:       string;
  description: string;
  eyebrow?:    string;
  icon?:       React.ReactNode;
  actions?:    EmptyStateAction[];
  compact?:    boolean;
  className?:  string;
}

export function EmptyState({
  title,
  description,
  eyebrow,
  icon,
  actions = [],
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <section
      className={clsx(
        "sb-empty-state",
        compact && "sb-empty-state--compact",
        className,
      )}
      aria-live="polite"
    >
      {icon !== undefined && <div className="sb-empty-state__icon">{icon}</div>}
      {eyebrow !== undefined && eyebrow.trim() !== "" && (
        <p className="sb-empty-state__eyebrow">{eyebrow}</p>
      )}
      <h2 className="sb-empty-state__title">{title}</h2>
      <p className="sb-empty-state__description">{description}</p>

      {actions.length > 0 && (
        <div className="sb-empty-state__actions">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={clsx(
                "sb-action-button",
                action.variant === "secondary"
                  ? "sb-action-button--secondary"
                  : "sb-action-button--primary",
              )}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
