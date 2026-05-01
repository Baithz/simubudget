// =============================================================================
// Fichier  : src/components/Assistant/AdvisorPanel.tsx
// Auteur   : KREMER Régis
// Desc.    : Conseiller Expert — recommandations personnalisées agrégées.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Régis | Création du fichier Phase 4
//   2026-04-27 | KREMER Régis | Correction types ExactOptionalPropertyTypes
//   2026-04-29 | KREMER Régis | Refonte Phase 8 — wrapper premium fluide
//   2026-04-30 | KREMER Régis | Phase 10 — tokens CSS, accents, icônes SVG,
//                               zéro classe Tailwind de couleur hardcodée
//   2026-05-01 | KREMER Régis | ZIP 5 — priorité recommandations comptables enrichies
//   2026-05-01 | KREMER Régis | ZIP 7 — actions externes ouvrant le navigateur système
// =============================================================================

import { useEffect, useState } from "react";
import { useNavigate }        from "react-router-dom";
import { motion }             from "framer-motion";
import { clsx }               from "clsx";
import { useProfileStore }    from "@/store/profileStore";
import { useSimulationStore } from "@/store/simulationStore";
import { usePurchaseStore }   from "@/store/purchaseStore";
import { useAccountingStore } from "@/store/accountingStore";
import { useCalculator }      from "@/hooks/useCalculator";
import { formatEur }          from "@/utils/formatCurrency";
import { openExternal }       from "@/utils/openExternal";
import type { Alert, Recommendation } from "@/types/simulation";
import type { AccountingRecommendation } from "@/types/accounting";

// ─── Types ──────────────────────────────────────────────────────────────────

interface AllRec {
  id:       string;
  priority: number;
  title:    string;
  detail:   string;
  saving?:  number;
  action?:  string;
  impactLabel?: string;
  source:   "budget" | "accounting" | "purchase";
  level:    "critical" | "danger" | "vigilance" | "info" | "conseil";
}

// ─── Config niveaux — 100 % tokens CSS ───────────────────────────────────────

interface LevelCfg {
  bgVar:     string;
  borderVar: string;
  colorVar:  string;
  label:     string;
  icon:      React.ReactElement;
}

function mkSvg(path: string): React.ReactElement {
  return (
    <svg viewBox="0 0 14 14" fill="currentColor" className="h-3.5 w-3.5">
      <path fillRule="evenodd" d={path} clipRule="evenodd" />
    </svg>
  );
}

const WARN = "M6.148 1.584a1 1 0 0 1 1.704 0l5.5 9A1 1 0 0 1 12.5 12H1.5a1 1 0 0 1-.852-1.416l5.5-9ZM7 5.25a.75.75 0 0 0-1.5 0v2.5a.75.75 0 0 0 1.5 0v-2.5ZM7 9.75a.875.875 0 1 0 0 1.75.875.875 0 0 0 0-1.75Z";
const INFO = "M7 1a6 6 0 1 0 0 12A6 6 0 0 0 7 1ZM6.25 5.5a.75.75 0 0 1 1.5 0v4a.75.75 0 0 1-1.5 0v-4ZM7 3a.875.875 0 1 1 0 1.75A.875.875 0 0 1 7 3Z";
const OK   = "M7 1a6 6 0 1 0 0 12A6 6 0 0 0 7 1Zm2.78 4.72a.75.75 0 0 0-1.06-1.06L5.97 7.41l-.69-.69a.75.75 0 0 0-1.06 1.06l1.22 1.22a.75.75 0 0 0 1.06 0l3.28-3.28Z";
const CIRC = "M7 1a6 6 0 1 0 0 12A6 6 0 0 0 7 1ZM6.25 4.25a.75.75 0 0 1 1.5 0v3.5a.75.75 0 0 1-1.5 0v-3.5ZM7 9.5a.875.875 0 1 1 0 1.75.875.875 0 0 1 0-1.75Z";

const LEVEL_CFG: Record<AllRec["level"], LevelCfg> = {
  critical:  { bgVar: "--fin-red-bg",    borderVar: "--fin-red-border",    colorVar: "--fin-red",    label: "CRITIQUE",  icon: mkSvg(WARN) },
  danger:    { bgVar: "--fin-red-bg",    borderVar: "--fin-red-border",    colorVar: "--fin-red",    label: "DANGER",    icon: mkSvg(WARN) },
  vigilance: { bgVar: "--fin-amber-bg",  borderVar: "--fin-amber-border",  colorVar: "--fin-amber",  label: "VIGILANCE", icon: mkSvg(CIRC) },
  info:      { bgVar: "--fin-blue-bg",   borderVar: "--fin-blue-border",   colorVar: "--fin-blue",   label: "INFO",      icon: mkSvg(INFO) },
  conseil:   { bgVar: "--fin-green-bg",  borderVar: "--fin-green-border",  colorVar: "--fin-green",  label: "CONSEIL",   icon: mkSvg(OK)   },
};

const SITUATION_CFG = {
  critical:  { label: "Critique",                     colorVar: "--fin-red"   },
  danger:    { label: "Attention requise",             colorVar: "--fin-red"   },
  vigilance: { label: "Quelques points à surveiller", colorVar: "--fin-amber" },
  ok:        { label: "Situation saine",               colorVar: "--fin-green" },
};

// ─── Helper makeRec ──────────────────────────────────────────────────────────

function makeRec(p: Omit<AllRec, "saving" | "action" | "impactLabel"> & { saving?: number; action?: string; impactLabel?: string }): AllRec {
  const r: AllRec = { id: p.id, priority: p.priority, title: p.title, detail: p.detail, source: p.source, level: p.level };
  if (p.saving !== undefined) r.saving = p.saving;
  if (p.action !== undefined) r.action = p.action;
  if (p.impactLabel !== undefined) r.impactLabel = p.impactLabel;
  return r;
}

// ─── Composant principal ─────────────────────────────────────────────────────

export default function AdvisorPanel() {
  const navigate        = useNavigate();
  const profile         = useProfileStore((s) => s.profile);
  const result          = useSimulationStore((s) => s.result);
  const purchaseResult  = usePurchaseStore((s) => s.result);
  const { calculate }   = useCalculator();
  const accountingRecs  = useAccountingStore((s) => s.getRecommendations());

  const [filter,   setFilter]   = useState<"all" | AllRec["level"]>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (profile && !result) calculate(profile);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  if (!profile) {
    return (
      <div className="p-8 text-center" style={{ color: "var(--text-muted)" }}>
        <p className="text-lg mb-2 font-semibold" style={{ color: "var(--text-secondary)" }}>
          Aucun profil configuré.
        </p>
        <a href="#/onboarding" className="text-sm font-bold underline" style={{ color: "var(--brand-1)" }}>
          Créer mon profil
        </a>
      </div>
    );
  }

  // ─── Agrégation des recommandations ─────────────────────────────────────

  const allRecs: AllRec[] = [];

  if (result?.recommendations) {
    result.recommendations.forEach((rec: Recommendation) => {
      const r: Parameters<typeof makeRec>[0] = {
        id: rec.id, priority: rec.priority, title: rec.label, detail: rec.impact,
        source: "budget",
        level:  rec.priority <= 2 ? "critical" : rec.priority <= 3 ? "danger" : rec.priority <= 4 ? "vigilance" : "conseil",
      };
      if (rec.action !== undefined) r.action = rec.action;
      allRecs.push(makeRec(r));
    });
  }

  accountingRecs.forEach((rec: AccountingRecommendation) => {
    const r: Parameters<typeof makeRec>[0] = {
      id: rec.id + "_acc",
      priority: rec.priority ?? (rec.level === "critical" ? 1 : rec.level === "danger" ? 2 : rec.level === "vigilance" ? 3 : 5),
      title: rec.title, detail: rec.detail, source: "accounting", level: rec.level,
    };
    if (rec.saving !== undefined) r.saving = rec.saving;
    if (rec.action !== undefined) r.action = rec.action;
    if (rec.impactLabel !== undefined) r.impactLabel = rec.impactLabel;
    allRecs.push(makeRec(r));
  });

  if (result?.alerts) {
    result.alerts
      .filter((a: Alert) => a.level === "critical" || a.level === "danger")
      .forEach((a: Alert) => {
        if (!allRecs.find((r) => r.id === a.id)) {
          const r: Parameters<typeof makeRec>[0] = {
            id: a.id + "_alert", priority: a.level === "critical" ? 0 : 1,
            title: a.message, detail: a.detail ?? "", source: "budget", level: a.level as AllRec["level"],
          };
          if (a.action !== undefined) r.action = a.action;
          allRecs.push(makeRec(r));
        }
      });
  }

  if (purchaseResult) {
    if (purchaseResult.debtRatioPostPurchase > 0.35) {
      allRecs.push(makeRec({
        id: "PA001", priority: 2, source: "purchase", level: "danger",
        title:  "Taux d'endettement achat dépasse le plafond HCSF",
        detail: `Votre taux d'endettement post-achat serait de ${(purchaseResult.debtRatioPostPurchase * 100).toFixed(1)} %.`,
        action: "Augmentez l'apport de 10 000 € ou allongez la durée de 5 ans.",
      }));
    }
    if (purchaseResult.ptz.eligible && purchaseResult.ptz.amount) {
      allRecs.push(makeRec({
        id: "PA002", priority: 4, source: "purchase", level: "info",
        title:  `PTZ éligible — ${formatEur(purchaseResult.ptz.amount)} sans intérêts`,
        detail: "Vous êtes éligible au Prêt à Taux Zéro. Cela réduit votre mensualité pendant le différé.",
        action: "Simulez avec PTZ dans le module Achat pour voir l'impact complet.",
      }));
    }
  }

  // Dédoublonner + trier
  const seen   = new Set<string>();
  const unique = allRecs
    .filter((r) => { if (seen.has(r.id)) return false; seen.add(r.id); return true; })
    .sort((a, b) => a.priority - b.priority);

  const filtered = filter === "all" ? unique : unique.filter((r) => r.level === filter);

  const counts = {
    all:       unique.length,
    critical:  unique.filter((r) => r.level === "critical").length,
    danger:    unique.filter((r) => r.level === "danger").length,
    vigilance: unique.filter((r) => r.level === "vigilance").length,
    info:      unique.filter((r) => r.level === "info").length,
    conseil:   unique.filter((r) => r.level === "conseil").length,
  };
  const criticalCount = counts.critical + counts.danger;

  const sitKey: keyof typeof SITUATION_CFG =
    counts.critical > 0  ? "critical"
    : counts.danger > 0  ? "danger"
    : counts.vigilance > 0 ? "vigilance"
    : "ok";
  const sit = SITUATION_CFG[sitKey];

  // ─── Rendu ──────────────────────────────────────────────────────────────

  return (
    <div className="page-shell space-y-5">
      {/* En-tête */}
      <div>
        <h1
          className="font-display text-2xl font-extrabold"
          style={{ letterSpacing: "-0.04em", color: "var(--text-primary)" }}
        >
          Conseiller Expert
        </h1>
        <p className="mt-1 text-sm font-medium" style={{ color: "var(--text-muted)" }}>
          Analyse personnalisée — {unique.length} recommandations générées.
        </p>
      </div>

      {/* Situation globale */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              Situation globale
            </p>
            <p className="text-xl font-bold mt-1" style={{ color: `var(${sit.colorVar})` }}>
              {sit.label}
            </p>
          </div>
          {result && (
            <div className="text-right">
              <p className="text-3xl font-bold font-mono tabular-nums" style={{ color: "var(--text-primary)" }}>
                {result.healthScore}
                <span className="text-lg font-normal" style={{ color: "var(--text-muted)" }}>/100</span>
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Score SSF</p>
            </div>
          )}
        </div>
        {result && (
          <div className="grid grid-cols-3 gap-3">
            <MiniStat
              label="Reste à vivre"
              value={formatEur(result.realDisposableIncome)}
              colorVar={result.realDisposableIncome > 400 ? "--fin-green" : "--fin-red"}
            />
            <MiniStat
              label="Alertes actives"
              value={String(criticalCount)}
              colorVar={criticalCount > 0 ? "--fin-red" : "--fin-green"}
            />
            <MiniStat
              label="Actions possibles"
              value={String(unique.length)}
              colorVar="--brand-1"
            />
          </div>
        )}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2">
        {(["all", "critical", "danger", "vigilance", "info", "conseil"] as const).map((f) => {
          const active = filter === f;
          const cfg    = f !== "all" ? LEVEL_CFG[f] : null;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all border"
              style={
                active
                  ? { background: cfg ? `var(${cfg.bgVar})` : "var(--brand-glow)",
                      color:      cfg ? `var(${cfg.colorVar})` : "var(--brand-1)",
                      borderColor:cfg ? `var(${cfg.borderVar})` : "var(--border-brand)" }
                  : { background: "var(--bg-surface)", color: "var(--text-muted)",
                      borderColor: "var(--border)" }
              }
            >
              {f === "all"
                ? `Tout (${counts.all})`
                : `${LEVEL_CFG[f].label} · ${counts[f]}`}
            </button>
          );
        })}
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="card p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          Aucune recommandation dans cette catégorie.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((rec, i) => {
            const cfg    = LEVEL_CFG[rec.level];
            const isOpen = expanded === rec.id;
            return (
              <motion.div
                key={rec.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-2xl border overflow-hidden"
                style={{
                  background:  `var(${cfg.bgVar})`,
                  borderColor: `var(${cfg.borderVar})`,
                }}
              >
                <button
                  onClick={() => setExpanded(isOpen ? null : rec.id)}
                  className="w-full flex items-start gap-3 p-4 text-left"
                >
                  <span className="flex-shrink-0 mt-0.5" style={{ color: `var(${cfg.colorVar})` }}>
                    {cfg.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className="text-[10px] font-extrabold uppercase tracking-wider"
                        style={{ color: `var(${cfg.colorVar})`, opacity: 0.85 }}
                      >
                        {cfg.label}
                      </span>
                      <span className="text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>
                        · {rec.source === "budget" ? "Budget" : rec.source === "accounting" ? "Comptes" : "Achat"}
                      </span>
                    </div>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {rec.title}
                    </p>
                    {rec.saving !== undefined && rec.saving > 0 && (
                      <p className="text-xs font-bold mt-1" style={{ color: "var(--fin-green)" }}>
                        Potentiel : +{formatEur(rec.saving)}/mois
                      </p>
                    )}
                    {rec.source === "accounting" && rec.impactLabel && (
                      <p className="text-xs font-bold mt-1" style={{ color: "var(--fin-blue)" }}>
                        {rec.impactLabel}
                      </p>
                    )}
                  </div>
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className={clsx("w-4 h-4 flex-shrink-0 mt-0.5 transition-transform", isOpen && "rotate-180")}
                    style={{ color: "var(--text-muted)" }}
                  >
                    <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd"/>
                  </svg>
                </button>

                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    className="px-4 pb-4 pt-3 space-y-2 border-t"
                    style={{ borderColor: "var(--border)" }}
                  >
                    {rec.detail && (
                      <p className="text-xs font-medium leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                        {rec.detail}
                      </p>
                    )}
                    {rec.action && (
                      <div
                        className="rounded-xl p-3"
                        style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border)" }}
                      >
                        <p className="text-xs font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
                          Action concrète :
                        </p>
                        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                          {rec.action}
                        </p>
                        <div className="mt-2">
                          <ActionButton action={rec.action} navigate={navigate} />
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
        Ces recommandations sont générées automatiquement. Elles ne constituent pas un conseil financier réglementé.
      </p>
    </div>
  );
}

// ─── Sous-composants ─────────────────────────────────────────────────────────

function MiniStat({ label, value, colorVar }: { label: string; value: string; colorVar: string }) {
  return (
    <div className="text-center">
      <p className="text-xl font-bold font-mono tabular-nums" style={{ color: `var(${colorVar})` }}>
        {value}
      </p>
      <p className="text-xs mt-0.5 font-medium" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
    </div>
  );
}

function externalUrlFromAction(action: string): string | null {
  const normalized = action.toLowerCase();
  if (normalized.includes("impots.gouv.fr")) return "https://www.impots.gouv.fr";
  if (normalized.includes("caf.fr")) return "https://www.caf.fr";
  if (normalized.includes("service-public.fr")) return "https://www.service-public.fr";
  if (normalized.includes("anil.org")) return "https://www.anil.org";
  if (normalized.includes("economie.gouv.fr")) return "https://www.economie.gouv.fr";

  const match = action.match(/https?:\/\/[^\s)]+/i);
  return match?.[0] ?? null;
}

function ActionButton({ action, navigate }: { action: string; navigate: (p: string) => void }) {
  const t = action.toLowerCase();
  const externalUrl = externalUrlFromAction(action);
  const target =
    t.includes("achat") || t.includes("immobilier") || t.includes("ptz") ? "/housing/purchase"
    : t.includes("location") || t.includes("loyer") ? "/housing/location"
    : t.includes("épargne") || t.includes("compte") || t.includes("dépens") ? "/accounting"
    : t.includes("scénario") || t.includes("projection") ? "/scenarios"
    : t.includes("profil") || t.includes("situation") ? "/onboarding"
    : null;


  if (externalUrl !== null) {
    return (
      <button
        type="button"
        onClick={() => void openExternal(externalUrl)}
        className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
        style={{ background: "var(--fin-blue-bg)", color: "var(--fin-blue)", border: "1px solid var(--fin-blue-border)" }}
      >
        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3">
          <path d="M4.5 2H2.8A1.3 1.3 0 0 0 1.5 3.3v5.9a1.3 1.3 0 0 0 1.3 1.3h5.9A1.3 1.3 0 0 0 10 9.2V7.5" strokeLinecap="round" />
          <path d="M7 1.5h3.5V5M5.5 6.5l4.7-4.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Ouvrir la source officielle
      </button>
    );
  }

  if (target) {
    return (
      <button
        onClick={() => navigate(target)}
        className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
        style={{ background: "var(--fin-green-bg)", color: "var(--fin-green)", border: "1px solid var(--fin-green-border)" }}
      >
        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3">
          <path d="M1 6h9M6 2l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {action}
      </button>
    );
  }
  return (
    <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
      {action}
    </span>
  );
}
