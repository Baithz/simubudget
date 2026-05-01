// =============================================================================
// Fichier  : src/components/shared/PageLayout.tsx
// Auteur   : KREMER Régis
// Desc.    : Wrapper page fluide responsive — Phase 10, tokens CSS.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-28 | KREMER Régis | Création Phase 7 — layout fluide
//   2026-04-30 | KREMER Régis | Phase 10 — tokens CSS, Geist
// =============================================================================

import { clsx } from "clsx";

interface PageLayoutProps {
  children:   React.ReactNode;
  className?: string;
  centered?:  boolean;
  padding?:   "sm" | "md" | "lg";
}

export function PageLayout({
  children,
  className,
  centered = false,
  padding = "md",
}: PageLayoutProps) {
  if (centered) {
    return (
      <div
        className={clsx(
          "w-full h-full flex flex-col items-center justify-center",
          padding === "sm" && "p-4",
          padding === "md" && "p-6 sm:p-8",
          padding === "lg" && "p-8 sm:p-12",
          className,
        )}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={clsx("w-full h-full overflow-auto", className)}
      style={{ background: "var(--bg-base)" }}
    >
      <div
        className="mx-auto w-full"
        style={{
          padding:
            padding === "sm" ? "14px 18px" :
            padding === "lg" ? "28px 36px" :
            "20px 26px",
          maxWidth: "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Grille KPI responsive */
export function KpiGrid({
  children,
  cols = "auto",
  className,
}: {
  children:   React.ReactNode;
  cols?:      "2" | "3" | "4" | "auto";
  className?: string;
}) {
  const gridCols = {
    "2":    "grid-cols-2",
    "3":    "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    "4":    "grid-cols-2 lg:grid-cols-4",
    "auto": "grid-cols-2 xl:grid-cols-4",
  }[cols];

  return (
    <div className={clsx("grid gap-4", gridCols, className)}>
      {children}
    </div>
  );
}

/** Layout deux colonnes */
export function TwoColLayout({
  left,
  right,
  leftWidth  = "2fr",
  rightWidth = "1fr",
}: {
  left:        React.ReactNode;
  right:       React.ReactNode;
  leftWidth?:  string;
  rightWidth?: string;
}) {
  return (
    <div
      className="grid gap-4 w-full"
      style={{ gridTemplateColumns: `${leftWidth} ${rightWidth}` }}
    >
      <div>{left}</div>
      <div>{right}</div>
    </div>
  );
}
