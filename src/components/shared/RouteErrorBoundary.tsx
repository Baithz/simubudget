// =============================================================================
// Fichier  : src/components/shared/RouteErrorBoundary.tsx
// Auteur   : KREMER Régis
// Desc.    : Écran d'erreur applicatif premium — tokens Phase 10.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-29 | KREMER Régis | Création du fichier
//   2026-04-30 | KREMER Régis | Phase 10 — tokens CSS, Geist, design premium
// =============================================================================

import { isRouteErrorResponse, useRouteError } from "react-router-dom";

function getErrorMessage(error: unknown): string {
  if (isRouteErrorResponse(error)) return `${error.status} — ${error.statusText}`;
  if (error instanceof Error) return error.message;
  return "Erreur inconnue";
}

export default function RouteErrorBoundary() {
  const error   = useRouteError();
  const message = getErrorMessage(error);

  return (
    <div
      className="flex min-h-screen items-center justify-center px-6"
      style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      <div className="card max-w-lg w-full p-8 text-center" style={{ boxShadow: "var(--shadow-lg)" }}>
        {/* Icône */}
        <div
          className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: "var(--fin-red-bg)", color: "var(--fin-red)", border: "1px solid var(--fin-red-border)" }}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-7 w-7">
            <path fillRule="evenodd" d="M8.485 2.495a1.75 1.75 0 0 1 3.03 0l6.28 10.875A1.75 1.75 0 0 1 16.28 16H3.72a1.75 1.75 0 0 1-1.515-2.63L8.485 2.495ZM10 6a.75.75 0 0 0-.75.75v3.5a.75.75 0 0 0 1.5 0v-3.5A.75.75 0 0 0 10 6Zm0 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
          </svg>
        </div>

        <h1
          className="font-display text-2xl font-extrabold"
          style={{ letterSpacing: "-0.04em", color: "var(--text-primary)" }}
        >
          Une erreur est survenue
        </h1>
        <p className="mt-2 text-sm font-medium" style={{ color: "var(--text-muted)" }}>
          SimuBudget a intercepté l'erreur pour protéger l'application.
        </p>

        <div
          className="mt-5 rounded-xl px-4 py-3 text-left"
          style={{
            background: "var(--bg-surface-2)",
            border: "1px solid var(--border)",
          }}
        >
          <p className="font-mono text-xs" style={{ color: "var(--text-secondary)" }}>
            {message}
          </p>
        </div>

        <button
          type="button"
          className="btn-brand mt-6 w-full"
          onClick={() => window.location.assign("#/")}
        >
          Retour au tableau de bord
        </button>
      </div>
    </div>
  );
}
