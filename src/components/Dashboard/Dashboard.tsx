// =============================================================================
// Fichier  : src/components/Dashboard/Dashboard.tsx
// Auteur   : KREMER Régis
// Desc.    : Tableau de bord principal — SSF, reste à vivre, scores, alertes.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Régis | Création Phase 0
//   2026-04-26 | KREMER Régis | Refonte Phase 1 — calculs réels via Tauri
//   2026-04-29 | KREMER Régis | Refonte Phase 8 — wrapper premium fluide
//   2026-04-30 | KREMER Régis | Phase 10 — design premium++, Bloomberg×Linear
//   2026-05-01 | KREMER Régis | Phase 11 — Fix 3 : lien CAF via openExternal (Tauri)
//   2026-05-01 | KREMER Régis | ZIP 8.3 — Recalcul automatique depuis Mes Comptes
// =============================================================================

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { clsx } from "clsx";
import { useProfileStore } from "@/store/profileStore";
import { useSimulationStore } from "@/store/simulationStore";
import { useAccountingStore } from "@/store/accountingStore";
import { useCalculator } from "@/hooks/useCalculator";
import ScoreGauge from "@/components/shared/ScoreGauge";
import AlertBadge from "@/components/shared/AlertBadge";
import { formatEur } from "@/utils/formatCurrency";
import { openExternal } from "@/utils/openExternal";
import type { HealthLevel } from "@/types/simulation";

// ─── Helpers ────────────────────────────────────────────────────────────────
const HEALTH_META: Record<HealthLevel, { label: string; pill: string }> = {
  critical: { label: "Situation critique",  pill: "red"   },
  fragile:  { label: "Situation fragile",   pill: "amber" },
  stable:   { label: "Situation stable",    pill: "blue"  },
  solid:    { label: "Situation solide",    pill: "green" },
  robust:   { label: "Situation robuste",   pill: "brand" },
};

const SCORE_LINES = [
  { key: "housingEffort",   label: "Effort logement",   weight: "30%" },
  { key: "savings",         label: "Épargne de sécurité", weight: "25%" },
  { key: "debt",            label: "Endettement",       weight: "20%" },
  { key: "incomeStability", label: "Stabilité revenus", weight: "15%" },
  { key: "resilience",      label: "Capacité de rebond", weight: "10%" },
] as const;

const EMPLOYMENT_LABELS: Record<string, string> = {
  cdi:       "CDI",
  cdd:       "CDD",
  freelance: "Indépendant",
  unemployed:"Sans emploi",
  retired:   "Retraité",
  other:     "Autre",
};

const stagger = {
  container: { animate: { transition: { staggerChildren: 0.06 } } },
  item: {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.4,0,0.2,1] } },
  },
};

// ─── Dashboard ──────────────────────────────────────────────────────────────
export function Dashboard() {
  const navigate               = useNavigate();
  const profile                = useProfileStore((s) => s.profile);
  const result                 = useSimulationStore((s) => s.result);
  const accountingSignal       = useAccountingStore((s) => `${s.activeMonth}:${s.incomes.length}:${s.expenses.length}:${s.monthlyExpenses.length}:${s.closedMonths.length}`);
  const { calculate, loading } = useCalculator();

  useEffect(() => {
    if (profile) calculate(profile);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, accountingSignal]);

  /* ── État vide ──────────────────────────────────────────────────────────── */
  if (!profile) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 px-8 text-center">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-3xl gradient-brand"
          style={{ boxShadow: "0 16px 40px rgba(6,214,160,.3)" }}
        >
          <svg viewBox="0 0 24 24" fill="white" className="h-10 w-10">
            <path d="M3.5 18.5L9.5 12.5L13.5 16.5L22 6.92L20.59 5.5L13.5 13.5L9.5 9.5L2 17L3.5 18.5Z"/>
          </svg>
        </div>
        <div>
          <h2 className="font-display text-2xl font-extrabold" style={{ color: "var(--text-primary)", letterSpacing: "-0.04em" }}>
            Bienvenue sur SimuBudget
          </h2>
          <p className="mt-2 max-w-sm text-sm font-medium" style={{ color: "var(--text-muted)" }}>
            Configurez votre profil financier pour obtenir votre analyse personnalisée et votre Score de Santé Financière.
          </p>
        </div>
        <button onClick={() => navigate("/onboarding")} className="btn-brand px-6">
          Créer mon profil
        </button>
      </div>
    );
  }

  /* ── Chargement ─────────────────────────────────────────────────────────── */
  if (loading || !result) {
    return (
      <div className="page-shell space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="skeleton h-7 w-40 mb-2" />
            <div className="skeleton h-4 w-24" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[1,2,3].map((i) => <div key={i} className="skeleton h-44 rounded-2xl" />)}
        </div>
        <div className="skeleton h-36 rounded-2xl" />
      </div>
    );
  }

  /* ── Données ────────────────────────────────────────────────────────────── */
  const { realDisposableIncome: rdv, healthScore: ssf, healthLevel, breakdown, aplEstimate, scores, alerts } = result;
  const meta = HEALTH_META[healthLevel];

  const rdvColor = rdv >= 600 ? "var(--fin-green)"
                 : rdv >= 200 ? "var(--fin-amber)"
                 : "var(--fin-red)";

  const holderName = `${profile.holder?.firstName ?? ""} ${profile.holder?.lastName ?? ""}`.trim()
    || profile.city || "Profil";

  /* ── Rendu ──────────────────────────────────────────────────────────────── */
  return (
    <motion.div
      className="page-shell space-y-5"
      variants={stagger.container}
      initial="initial"
      animate="animate"
    >

      {/* ── En-tête ─────────────────────────────────────────────────────── */}
      <motion.div variants={stagger.item} className="flex items-start justify-between">
        <div>
          <h1
            className="font-display text-2xl font-extrabold"
            style={{ letterSpacing: "-0.04em", color: "var(--text-primary)" }}
          >
            {holderName}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
              {profile.city}
            </span>
            <span style={{ color: "var(--border-hover)" }}>·</span>
            <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
              {EMPLOYMENT_LABELS[profile.employmentType] ?? profile.employmentType}
            </span>
            {result.basedOnRealAccounting && (
              <>
                <span style={{ color: "var(--border-hover)" }}>·</span>
                <span className="level-pill brand text-[10px]">Données réelles</span>
              </>
            )}
          </div>
        </div>
        <button
          onClick={() => navigate("/onboarding")}
          className="btn-ghost text-xs"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M11.013 2.513a1.75 1.75 0 0 1 2.475 2.474L6.226 12.25a2.75 2.75 0 0 1-.892.596l-2.047.848a.75.75 0 0 1-.98-.98l.848-2.047a2.75 2.75 0 0 1 .596-.892l7.262-7.262Z"/>
          </svg>
          Modifier
        </button>
      </motion.div>

      {/* ── KPIs principaux ─────────────────────────────────────────────── */}
      <motion.div variants={stagger.item} className="grid grid-cols-1 gap-4 md:grid-cols-3">

        {/* Carte SSF */}
        <div className="premium-card p-6 flex flex-col items-center gap-3 md:col-span-1">
          <div className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Score de Santé Financière
          </div>
          <ScoreGauge score={ssf} level={healthLevel} size={148} />
          <span className={clsx("level-pill", meta.pill)}>{meta.label}</span>
        </div>

        {/* Carte Reste à vivre */}
        <div className="premium-card p-6 flex flex-col justify-between md:col-span-2">
          <div className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Reste à vivre réel
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span
              className="font-mono text-5xl font-extrabold tabular-nums"
              style={{ color: rdvColor, letterSpacing: "-0.03em" }}
            >
              {formatEur(rdv)}
            </span>
            <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
              / mois
            </span>
          </div>
          <p className="mt-1 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
            Toutes charges fixes, alimentation et transport inclus
          </p>

          {/* Décomposition */}
          <div className="mt-5 space-y-0 divide-y" style={{ borderColor: "var(--border)" }}>
            <BudgetRow label="Revenus nets" value={breakdown.totalIncome} sign="neutral" />
            {breakdown.totalAids > 0 && (
              <BudgetRow label="Aides estimées (APL…)" value={breakdown.totalAids} sign="positive" />
            )}
            <BudgetRow label="Logement" value={breakdown.housing} sign="negative" />
            <BudgetRow label="Crédits" value={breakdown.credits} sign="negative" />
            <BudgetRow label="Alimentation" value={breakdown.food} sign="negative" />
            <BudgetRow label="Transport" value={breakdown.transport} sign="negative" />
            <BudgetRow label="Charges fixes" value={breakdown.fixed} sign="negative" />
          </div>
        </div>
      </motion.div>

      {/* ── Sous-scores SSF ──────────────────────────────────────────────── */}
      <motion.div variants={stagger.item}>
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              Détail du score
            </h3>
            <span className="text-xs font-semibold font-mono" style={{ color: "var(--text-muted)" }}>
              SSF {ssf}/100
            </span>
          </div>
          <div className="space-y-3">
            {SCORE_LINES.map(({ key, label, weight }, i) => (
              <ScoreLine
                key={key}
                label={label}
                weight={weight}
                value={scores[key]}
                delay={i * 0.07}
              />
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── APL ──────────────────────────────────────────────────────────── */}
      {aplEstimate.estimated > 0 && (
        <motion.div variants={stagger.item}>
          <div
            className="flex items-start gap-3 rounded-2xl px-4 py-3.5"
            style={{
              background: "var(--fin-blue-bg)",
              border: "1px solid var(--fin-blue-border)",
            }}
          >
            <div
              className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
              style={{ background: "var(--fin-blue-bg)", color: "var(--fin-blue)" }}
            >
              <svg viewBox="0 0 14 14" fill="currentColor" className="h-3.5 w-3.5">
                <path fillRule="evenodd" d="M7 1a6 6 0 1 0 0 12A6 6 0 0 0 7 1Zm-.75 3.5a.75.75 0 0 1 1.5 0v.75a.75.75 0 0 1-1.5 0V4.5ZM7 7.5a.75.75 0 0 0-.75.75v2a.75.75 0 0 0 1.5 0v-2A.75.75 0 0 0 7 7.5Z" clipRule="evenodd"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold" style={{ color: "var(--fin-blue)" }}>
                APL estimée · {formatEur(aplEstimate.estimated)}/mois
              </p>
              <p className="mt-0.5 text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                Zone {aplEstimate.zone} — estimation indicative (±10%).{" "}
                <button
                  type="button"
                  onClick={() => void openExternal("https://www.caf.fr/allocataires/droits-et-prestations/s-informer-sur-les-aides/simulateur-caf")}
                  className="underline underline-offset-2 font-medium cursor-pointer"
                  style={{ color: "var(--fin-blue)", background: "none", border: "none", padding: 0 }}
                >
                  Vérifier sur caf.fr
                </button>
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Alertes ──────────────────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <motion.div variants={stagger.item}>
          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                Alertes
              </h3>
              <span className="badge-soft">{alerts.length}</span>
            </div>
            <div className="space-y-2">
              {alerts.map((alert) => (
                <AlertBadge
                  key={alert.id}
                  level={alert.level}
                  message={alert.message}
                  {...(alert.detail !== undefined ? { detail: alert.detail } : {})}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Actions rapides ───────────────────────────────────────────────── */}
      <motion.div variants={stagger.item} className="grid grid-cols-2 gap-3">
        <QuickAction
          icon={
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-5 w-5">
              <path d="M8.44 2.22a.65.65 0 0 0-.88 0L2.3 7.1A.65.65 0 0 0 2.75 8.2h.75v4.3c0 .55.45 1 1 1h2.5v-3h2v3h2.5c.55 0 1-.45 1-1V8.2h.75a.65.65 0 0 0 .45-1.1L8.44 2.22Z" />
            </svg>
          }
          label="Simuler un logement"
          sub="Location ou achat"
          onClick={() => navigate("/housing/location")}
        />
        <QuickAction
          icon={
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-5 w-5">
              <path d="M3.5 3h9A1.5 1.5 0 0 1 14 4.5v5.5A1.5 1.5 0 0 1 12.5 11.5H9.2l-2.7 2.1a.55.55 0 0 1-.9-.44V11.5H3.5A1.5 1.5 0 0 1 2 10V4.5A1.5 1.5 0 0 1 3.5 3Z" />
            </svg>
          }
          label="Scénarios de vie"
          sub="Projections 24 mois"
          onClick={() => navigate("/scenarios")}
        />
      </motion.div>
    </motion.div>
  );
}

// ─── Sous-composants ────────────────────────────────────────────────────────

function BudgetRow({
  label, value, sign,
}: {
  label: string;
  value: number;
  sign: "positive" | "negative" | "neutral";
}) {
  if (value === 0 && sign !== "neutral") return null;
  const color = sign === "positive" ? "var(--fin-green)"
              : sign === "negative" ? "var(--fin-red)"
              : "var(--text-primary)";
  const prefix = sign === "positive" ? "+ " : sign === "negative" ? "− " : "";
  return (
    <div className="stat-row">
      <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="font-mono text-xs font-bold tabular-nums" style={{ color }}>
        {prefix}{formatEur(Math.abs(value))}
      </span>
    </div>
  );
}

function ScoreLine({
  label, weight, value, delay,
}: {
  label: string;
  weight: string;
  value: number;
  delay: number;
}) {
  const pct = Math.round(value * 100);
  const barColor = pct >= 70 ? "var(--fin-green)"
                 : pct >= 40 ? "var(--fin-amber)"
                 : "var(--fin-red)";

  return (
    <div className="flex items-center gap-3">
      <div className="w-40 flex-shrink-0">
        <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
          {label}
        </span>
        <span className="ml-1 text-[10px] font-semibold" style={{ color: "var(--text-placeholder)" }}>
          {weight}
        </span>
      </div>
      <div
        className="flex-1 h-1.5 overflow-hidden"
        style={{ background: "var(--bg-surface-2)", borderRadius: 999 }}
      >
        <motion.div
          style={{ height: "100%", borderRadius: 999, background: barColor }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, delay, ease: "easeOut" }}
        />
      </div>
      <span
        className="w-8 text-right font-mono text-xs font-bold tabular-nums"
        style={{ color: barColor }}
      >
        {pct}
      </span>
    </div>
  );
}

function QuickAction({
  icon, label, sub, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="kpi-card text-left flex items-center gap-3 transition-all group"
    >
      <div
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl gradient-brand"
        style={{
          color: "white",
          boxShadow: "0 6px 16px rgba(6,214,160,.2)",
          transition: "box-shadow .2s ease",
        }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
          {label}
        </div>
        <div className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          {sub}
        </div>
      </div>
    </button>
  );
}
