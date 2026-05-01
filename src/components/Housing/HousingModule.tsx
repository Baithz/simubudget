// =============================================================================
// Fichier  : src/components/Housing/HousingModule.tsx
// Auteur   : KREMER Régis
// Desc.    : Sélecteur du module logement — Location ou Achat immobilier.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Régis | Création du fichier
//   2026-04-29 | KREMER Régis | Refonte Phase 8 — wrapper fluide responsive
//   2026-04-30 | KREMER Régis | Phase 10 — icônes SVG, tokens CSS, accents
// =============================================================================

import { NavLink } from "react-router-dom";
import { clsx }    from "clsx";

interface Card {
  to:    string;
  label: string;
  desc:  string;
  icon:  React.ReactElement;
  kpis:  string[];
}

const CARDS: Card[] = [
  {
    to:    "/housing/location",
    label: "Location",
    desc:  "Loyer viable ? APL ? Reste à vivre réel ?",
    kpis:  ["Taux d'effort", "APL estimée", "Loyer recommandé"],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
        <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5Z" />
        <path d="M9 21V12h6v9" />
      </svg>
    ),
  },
  {
    to:    "/housing/purchase",
    label: "Achat immobilier",
    desc:  "Crédit faisable ? PTZ ? Taux d'endettement HCSF ?",
    kpis:  ["Mensualité", "PTZ automatique", "Achat vs Location"],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
        <path d="M12 2 2 7l10 5 10-5-10-5Z" />
        <path d="m2 17 10 5 10-5" />
        <path d="m2 12 10 5 10-5" />
      </svg>
    ),
  },
];

export default function HousingModule() {
  return (
    <div className="page-shell">
      {/* En-tête */}
      <div className="mb-8">
        <h1
          className="font-display text-2xl font-extrabold"
          style={{ letterSpacing: "-0.04em", color: "var(--text-primary)" }}
        >
          Simulation Logement
        </h1>
        <p className="mt-1.5 text-sm font-medium" style={{ color: "var(--text-muted)" }}>
          Choisissez votre mode de simulation pour analyser votre projet.
        </p>
      </div>

      {/* Cartes de sélection */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {CARDS.map(({ to, label, desc, icon, kpis }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                "group flex flex-col gap-5 rounded-2xl p-7 transition-all duration-200",
                "border-2",
                isActive
                  ? "border-[var(--border-brand)] [background:var(--bg-surface)]"
                    + " shadow-[0_0_0_3px_var(--brand-glow)]"
                  : "border-[var(--border)] [background:var(--bg-surface)]"
                    + " hover:border-[var(--border-brand)] hover:shadow-[0_8px_32px_var(--brand-glow)]"
                    + " hover:-translate-y-0.5"
              )
            }
          >
            {/* Icône */}
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl gradient-brand"
              style={{
                color: "white",
                boxShadow: "0 8px 20px rgba(6,214,160,.22)",
              }}
            >
              {icon}
            </div>

            {/* Titre + description */}
            <div>
              <p
                className="font-display text-lg font-extrabold"
                style={{ letterSpacing: "-0.03em", color: "var(--text-primary)" }}
              >
                {label}
              </p>
              <p className="mt-1 text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                {desc}
              </p>
            </div>

            {/* KPIs */}
            <div className="flex flex-wrap gap-2 mt-auto">
              {kpis.map((kpi) => (
                <span key={kpi} className="badge-soft">{kpi}</span>
              ))}
            </div>

            {/* Flèche */}
            <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: "var(--brand-1)" }}>
              <span>Accéder</span>
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5">
                <path fillRule="evenodd" d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd"/>
              </svg>
            </div>
          </NavLink>
        ))}
      </div>
    </div>
  );
}
