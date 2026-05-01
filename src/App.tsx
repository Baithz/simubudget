// =============================================================================
// Fichier  : src/App.tsx
// Auteur   : KREMER Régis
// Desc.    : Layout principal premium SimuBudget — sidebar, topbar, thème.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Régis | Création Phase 0
//   2026-04-27 | KREMER Régis | Redesign Phase 5 - sidebar Notion/Linear
//   2026-04-28 | KREMER Régis | Phase 7 - UI Premium dark finance
//   2026-04-29 | KREMER Régis | Refonte Phase 8 - sidebar cohérente, version 1.8
//   2026-04-29 | KREMER Régis | Phase 9.1 - carte profil et cohérence navigation
//   2026-04-30 | KREMER Régis | Phase 10 - design premium++, Geist, Bloomberg×Linear
//   2026-05-01 | KREMER Régis | Phase 12B - guard profil actif et accès sélection profils
//   2026-05-01 | KREMER Régis | Phase 12B.1 - afficher le sélecteur profils à chaque démarrage
//   2026-05-01 | KREMER Régis | Phase 12B.3 - tooltips premium sidebar collapsed
//   2026-05-01 | KREMER Régis | ZIP 7 - navigation, aide utilisateur et actions profil
//   2026-05-01 | KREMER Régis | ZIP 7.2 — affichage sidebar adapté aux profils couple
//   2026-05-01 | KREMER Régis | Phase 13 — vérification MAJ automatique au démarrage (3s delay)
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";
import { Outlet, NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { clsx } from "clsx";
import { useUIStore } from "@/store/uiStore";
import { useProfileStore } from "@/store/profileStore";
import { useProfileListStore } from "@/store/profileListStore";
import { useSimulationStore } from "@/store/simulationStore";
import { useProfile } from "@/hooks/useProfile";
import { useUpdater } from "@/hooks/useUpdater";
import { UpdateModal } from "@/components/shared/UpdateModal";
import { formatEur } from "@/utils/formatCurrency";
import logoIcon from "@/assets/logo-icon.png";

type IconName =
  | "dashboard" | "accounts" | "report" | "home"
  | "purchase" | "scenario" | "assistant" | "help" | "settings";

interface NavItem    { to: string; end?: boolean; label: string; icon: IconName; }
interface NavSection { label?: string; items: NavItem[]; }

const PROFILE_SESSION_KEY = "simubudget-profile-session-active";

const NAV: NavSection[] = [
  { items: [{ to: "/", end: true, label: "Vue d'ensemble", icon: "dashboard" }] },
  { label: "Comptabilité", items: [
    { to: "/accounting", label: "Mes Comptes",    icon: "accounts" },
    { to: "/report",     label: "Rapport annuel", icon: "report"   },
  ]},
  { label: "Logement", items: [
    { to: "/housing/location", label: "Location",         icon: "home"     },
    { to: "/housing/purchase", label: "Achat immobilier", icon: "purchase" },
  ]},
  { label: "Projections", items: [
    { to: "/scenarios", label: "Scénarios de vie", icon: "scenario" },
  ]},
  { label: "Analyse", items: [
    { to: "/assistant", label: "Conseiller expert", icon: "assistant" },
  ]},
  { label: "Aide", items: [
    { to: "/help", label: "Guide utilisateur", icon: "help" },
  ]},
];

function Icon({ name, className = "w-4 h-4" }: { name: IconName; className?: string }): ReactElement {
  const p = { viewBox: "0 0 16 16", fill: "currentColor", className };
  switch (name) {
    case "dashboard": return (
      <svg {...p}>
        <rect x="2" y="2" width="5.5" height="5.5" rx="1.5" opacity=".7" />
        <rect x="8.5" y="2" width="5.5" height="5.5" rx="1.5" />
        <rect x="2" y="8.5" width="5.5" height="5.5" rx="1.5" />
        <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1.5" opacity=".7" />
      </svg>
    );
    case "accounts": return (
      <svg {...p}>
        <path d="M2.5 4a1 1 0 0 1 1-1h9a1 1 0 0 1 0 2h-9a1 1 0 0 1-1-1Zm0 4a1 1 0 0 1 1-1h9a1 1 0 0 1 0 2h-9a1 1 0 0 1-1-1Zm1 3a1 1 0 1 0 0 2h9a1 1 0 1 0 0-2h-9Z" />
      </svg>
    );
    case "report": return (
      <svg {...p}>
        <path d="M4.5 1.5A2 2 0 0 0 2.5 3.5v9a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2V6L9.5 1.5h-5ZM9 2.75 12.25 6H10a1 1 0 0 1-1-1V2.75ZM5.5 8h5v1.5h-5V8Zm0 3h5v1.5h-5V11Z" />
      </svg>
    );
    case "home": return (
      <svg {...p}>
        <path d="M8.44 2.22a.65.65 0 0 0-.88 0L2.3 7.1A.65.65 0 0 0 2.75 8.2h.75v4.3c0 .55.45 1 1 1h2.5v-3h2v3h2.5c.55 0 1-.45 1-1V8.2h.75a.65.65 0 0 0 .45-1.1L8.44 2.22Z" />
      </svg>
    );
    case "purchase": return (
      <svg {...p}>
        <path d="M8 1.5 1.5 4.6v1.5L8 9.2l6.5-3.1V4.6L8 1.5ZM3.25 7.7v3.5L8 13.8l4.75-2.6V7.7L8 10.4 3.25 7.7Z" />
      </svg>
    );
    case "scenario": return (
      <svg {...p}>
        <path d="M3.5 3h9A1.5 1.5 0 0 1 14 4.5v5.5A1.5 1.5 0 0 1 12.5 11.5H9.2l-2.7 2.1a.55.55 0 0 1-.9-.44V11.5H3.5A1.5 1.5 0 0 1 2 10V4.5A1.5 1.5 0 0 1 3.5 3Zm2 3v1.2h5V6h-5Zm0 2.4v1.2h3.2V8.4H5.5Z" />
      </svg>
    );
    case "assistant": return (
      <svg {...p}>
        <path d="M8 1.5a6.5 6.5 0 0 0-5.38 10.15l-.77 2.31a.55.55 0 0 0 .7.7l2.31-.77A6.5 6.5 0 1 0 8 1.5Zm-2.5 5.5h5v1.3h-5V7Zm0 2.4h3.2v1.3H5.5V9.4Z" />
      </svg>
    );
    case "help": return (
      <svg {...p}>
        <path d="M8 1.5a6.5 6.5 0 1 0 0 13A6.5 6.5 0 0 0 8 1.5Zm0 10.1a.85.85 0 1 1 0 1.7.85.85 0 0 1 0-1.7Zm-.05-8.2c1.72 0 3.05.96 3.05 2.55 0 1.16-.6 1.82-1.43 2.38-.62.42-.86.67-.86 1.33v.35H7.18v-.43c0-1.12.52-1.63 1.26-2.12.65-.43.98-.75.98-1.42 0-.74-.58-1.22-1.5-1.22-.8 0-1.37.36-1.78 1.03L4.82 5.1c.62-1.03 1.7-1.7 3.13-1.7Z" />
      </svg>
    );
    case "settings": return (
      <svg {...p}>
        <path d="M7.1 1.4h1.8l.2 1.4c.34.1.65.24.94.42l1.14-.87 1.28 1.28-.87 1.14c.18.3.32.6.42.94l1.4.2v1.8l-1.4.2c-.1.34-.24.65-.42.94l.87 1.14-1.28 1.28-1.14-.87c-.3.18-.6.32-.94.42l-.2 1.4H7.1l-.2-1.4c-.34-.1-.65-.24-.94-.42l-1.14.87-1.28-1.28.87-1.14a4.4 4.4 0 0 1-.42-.94l-1.4-.2V7.1l1.4-.2c.1-.34.24-.65.42-.94l-.87-1.14 1.28-1.28 1.14.87c.3-.18.6-.32.94-.42l.2-1.4ZM8 9.8a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6Z" />
      </svg>
    );
  }
}

function healthColor(score: number): string {
  if (score >= 75) return "var(--fin-green)";
  if (score >= 50) return "var(--fin-amber)";
  return "var(--fin-red)";
}

function profileDisplayName(profile: NonNullable<ReturnType<typeof useProfileStore.getState>["profile"]>): string {
  const holderFirst  = (profile.holder?.firstName  ?? "").trim();
  const holderLast   = (profile.holder?.lastName   ?? "").trim();
  const partnerFirst = (profile.partner?.firstName ?? "").trim();
  const partnerLast  = (profile.partner?.lastName  ?? "").trim();

  if (profile.situation === "couple" && (holderFirst || holderLast) && (partnerFirst || partnerLast)) {
    return `${holderFirst || holderLast} & ${partnerFirst || partnerLast}`;
  }
  return `${holderFirst} ${holderLast}`.trim() || profile.city || "Mon profil";
}

function profileMonthlyIncome(profile: NonNullable<ReturnType<typeof useProfileStore.getState>["profile"]>): number {
  return profile.salaryNet
    + (profile.partner?.salaryNet ?? profile.partnerSalaryNet ?? 0)
    + (profile.bonusAnnual / 12)
    + ((profile.partner?.bonusAnnual ?? 0) / 12)
    + profile.allocationsTotal
    + profile.pensionReceived
    + profile.rentalIncome
    + profile.otherIncome
    + (profile.partner?.otherIncome ?? 0);
}

// ─── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const { themeMode, fontSize } = useUIStore();
  const profile      = useProfileStore((s) => s.profile);
  const hasCompleted = useProfileStore((s) => s.hasCompletedOnboarding);
  const result       = useSimulationStore((s) => s.result);
  const { loadProfile } = useProfile();
  const location  = useLocation();
  const navigate  = useNavigate();
  const profiles        = useProfileListStore((state) => state.profiles);
  const activeProfileId = useProfileListStore((state) => state.activeProfileId);
  const lockProfile     = useProfileListStore((state) => state.lock);
  const [collapsed, setCollapsed] = useState(false);

  // ── Mise à jour automatique au démarrage (checkOnMount = true) ────────────
  const { status: updateStatus, updateInfo, progress: updateProgress, error: updateError, installUpdate, dismiss } = useUpdater(true);

  /* Thème */
  useEffect(() => {
    const apply = () => {
      const dark = themeMode === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
        : themeMode === "dark";
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    };
    apply();
    if (themeMode !== "system") return undefined;
    const m = window.matchMedia("(prefers-color-scheme: dark)");
    m.addEventListener("change", apply);
    return () => m.removeEventListener("change", apply);
  }, [themeMode]);

  useEffect(() => {
    document.documentElement.dataset.fontSize = fontSize;
  }, [fontSize]);

  useEffect(() => {
    if (location.pathname === "/profiles") return;
    if (location.pathname === "/onboarding" && !activeProfileId) return;
    if (profiles.length === 0) return;

    const sessionProfileId = sessionStorage.getItem(PROFILE_SESSION_KEY);
    const hasSelectedProfileThisSession = activeProfileId !== null && sessionProfileId === activeProfileId;

    if (!hasSelectedProfileThisSession) {
      navigate("/profiles", { replace: true });
    }
  }, [activeProfileId, location.pathname, navigate, profiles.length]);

  useEffect(() => {
    if (!profile) void loadProfile();
  }, [loadProfile, profile]);

  const currentPage = useMemo(() =>
    NAV.flatMap((s) => s.items).find((item) =>
      item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
    ),
  [location.pathname]);

  const ssf = result?.healthScore ?? 0;
  const rdv = result?.realDisposableIncome ?? 0;
  const rdvColor = rdv >= 600 ? "var(--fin-green)" : rdv >= 200 ? "var(--fin-amber)" : "var(--fin-red)";

  function changeAccount(): void {
    sessionStorage.removeItem(PROFILE_SESSION_KEY);
    if (activeProfileId) lockProfile(activeProfileId);
    navigate("/profiles");
  }

  const holderName    = profile ? profileDisplayName(profile) : null;
  const profileIncome = profile ? profileMonthlyIncome(profile) : 0;

  return (
    <div
      className="flex h-screen overflow-hidden font-sans"
      style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      {/* ── Modale mise à jour (check automatique au démarrage) ─────────── */}
      <UpdateModal
        status={updateStatus}
        updateInfo={updateInfo}
        error={updateError}
        progress={updateProgress}
        onInstall={() => void installUpdate()}
        onDismiss={dismiss}
      />

      {/* ── SIDEBAR ──────────────────────────────────────────────────────── */}
      <motion.aside
        animate={{ width: collapsed ? 62 : 240 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        className="relative z-20 flex h-screen flex-shrink-0 flex-col overflow-visible"
        style={{
          background: "var(--sidebar-bg)",
          borderRight: "1px solid var(--border)",
          boxShadow: "var(--shadow-soft)",
        }}
      >
        {/* Orbe décoratif */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-36 opacity-60"
          style={{
            background: "radial-gradient(ellipse 120% 80% at 40% 0%, rgba(6,214,160,.12), transparent 70%)",
          }}
        />

        {/* Logo + toggle */}
        <div
          className="relative z-10 flex h-[60px] flex-shrink-0 items-center px-3"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="flex w-full items-center gap-2.5 text-left rounded-xl px-1.5 py-1 transition-colors hover:bg-[var(--sidebar-soft)]"
          >
            <img src={logoIcon} alt="SimuBudget" className="h-8 w-8 flex-shrink-0 object-contain" />
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div
                  className="font-display text-[15px] font-extrabold gradient-brand-full-text"
                  style={{ letterSpacing: "-0.04em" }}
                >
                  SimuBudget
                </div>
                <div className="text-[10px] font-semibold" style={{ color: "var(--text-placeholder)" }}>
                  by Baithz
                </div>
              </div>
            )}
            {!collapsed && (
              <svg
                viewBox="0 0 16 16" fill="currentColor"
                className="h-3.5 w-3.5 flex-shrink-0"
                style={{ color: "var(--text-placeholder)" }}
              >
                <path d="M5.72 3.22a.75.75 0 0 1 1.06 1.06L4.56 6.5h6.69a.75.75 0 0 1 0 1.5H4.56l2.22 2.22a.75.75 0 1 1-1.06 1.06l-3.5-3.5a.75.75 0 0 1 0-1.06l3.5-3.5Z" />
              </svg>
            )}
          </button>
        </div>

        {/* Profil card */}
        {!collapsed && profile && holderName && (
          <div className="mx-3 mt-3 space-y-1.5">
            <Link to={hasCompleted ? "/" : "/onboarding"} className="profile-card-link" title="Accéder au tableau de bord">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-sm font-extrabold text-white gradient-brand">
                {holderName.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold" style={{ color: "var(--text-primary)" }}>{holderName}</div>
                <div className="truncate text-xs font-medium" style={{ color: "var(--text-muted)" }}>{formatEur(profileIncome)} /mois</div>
              </div>
              {result && (
                <div className="font-mono text-sm font-extrabold flex-shrink-0" style={{ color: healthColor(ssf) }}>
                  {ssf}
                </div>
              )}
            </Link>
            <div className="grid grid-cols-2 gap-1.5">
              <Link to="/onboarding" className="profile-action-link" title="Modifier le profil">
                <svg viewBox="0 0 12 12" fill="currentColor" className="h-3 w-3">
                  <path d="M8.5 1.5a1.5 1.5 0 0 1 2.12 2.12L3.9 10.33a2 2 0 0 1-.65.43l-1.5.62a.5.5 0 0 1-.66-.66l.62-1.5c.1-.24.25-.46.43-.65L8.5 1.5Z"/>
                </svg>
                Modifier
              </Link>
              <button type="button" onClick={changeAccount} className="profile-action-link profile-action-link-brand" title="Changer de compte">
                <svg viewBox="0 0 12 12" fill="currentColor" className="h-3 w-3">
                  <path d="M6 1.25a2.35 2.35 0 1 0 0 4.7 2.35 2.35 0 0 0 0-4.7ZM2.2 10.1c.43-1.9 1.93-3.05 3.8-3.05s3.37 1.15 3.8 3.05c.1.43-.23.85-.68.85H2.88a.7.7 0 0 1-.68-.85Z"/>
                </svg>
                Changer
              </button>
            </div>
          </div>
        )}

        {/* Icône profil collapsed */}
        {collapsed && profile && holderName && (
          <div className="px-2 mt-3">
            <Link
              to={hasCompleted ? "/" : "/onboarding"}
              data-tooltip={holderName}
              className="app-tooltip flex h-9 w-9 items-center justify-center rounded-xl text-sm font-extrabold text-white gradient-brand mx-auto"
            >
              {holderName.slice(0, 1).toUpperCase()}
            </Link>
          </div>
        )}

        {/* Navigation */}
        <nav className={clsx("relative z-10 flex-1 space-y-0.5 px-2.5 py-3", collapsed ? "overflow-visible" : "overflow-y-auto")}>
          {NAV.map((section, idx) => (
            <div key={section.label ?? `sec-${idx}`} className={idx > 0 ? "mt-4" : ""}>
              {section.label && !collapsed && (
                <p className="section-label mb-1.5 px-2">{section.label}</p>
              )}
              {section.label && collapsed && (
                <div className="mx-2 my-2.5 h-px" style={{ background: "var(--border)" }} />
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end ?? false}
                    data-tooltip={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      clsx("nav-item", collapsed && "app-tooltip justify-center px-0", isActive && "active")
                    }
                  >
                    <Icon name={item.icon} className="h-4 w-4 flex-shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer sidebar */}
        <div
          className="relative z-10 px-2.5 py-3 space-y-0.5"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <NavLink
            to="/settings"
            data-tooltip={collapsed ? "Paramètres" : undefined}
            className={({ isActive }) =>
              clsx("nav-item", collapsed && "app-tooltip justify-center px-0", isActive && "active")
            }
          >
            <Icon name="settings" className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span>Paramètres</span>}
          </NavLink>
          {!collapsed && (
            <p className="px-2 pt-1 text-[10px] font-semibold" style={{ color: "var(--text-placeholder)" }}>
              v1.9.0
            </p>
          )}
        </div>
      </motion.aside>

      {/* ── CONTENU PRINCIPAL ──────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

        {/* Topbar */}
        <header
          className="relative z-10 flex h-[52px] flex-shrink-0 items-center gap-3 px-5"
          style={{
            background: "var(--topbar-bg)",
            backdropFilter: "blur(20px) saturate(1.6)",
            WebkitBackdropFilter: "blur(20px) saturate(1.6)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div className="flex min-w-0 items-center gap-2">
            {currentPage && (
              <span style={{ color: "var(--text-muted)" }}>
                <Icon name={currentPage.icon} className="h-3.5 w-3.5" />
              </span>
            )}
            <span className="truncate text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
              {currentPage?.label ?? "Paramètres"}
            </span>
          </div>

          {result && (
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="ml-auto flex items-center gap-3"
            >
              <div className="hidden items-center gap-2 sm:flex">
                <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>SSF</span>
                <div
                  className="relative h-1.5 w-24 overflow-hidden"
                  style={{ background: "var(--bg-surface-2)", borderRadius: 999 }}
                >
                  <motion.div
                    className="absolute left-0 top-0 h-full"
                    style={{ background: "linear-gradient(90deg, var(--brand-2), var(--brand-1))", borderRadius: 999 }}
                    initial={{ width: 0 }}
                    animate={{ width: `${ssf}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </div>
                <span className="font-mono text-xs font-bold w-6" style={{ color: healthColor(ssf) }}>{ssf}</span>
              </div>

              <div className="h-4 w-px" style={{ background: "var(--border)" }} />

              <div className="flex items-baseline gap-1">
                <span className="font-mono text-sm font-extrabold tabular-nums" style={{ color: rdvColor }}>
                  {formatEur(rdv)}
                </span>
                <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>/mois</span>
              </div>
            </motion.div>
          )}
        </header>

        {/* Zone de contenu */}
        <main className="min-h-0 flex-1 overflow-auto" style={{ background: "var(--bg-base)" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="min-h-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
