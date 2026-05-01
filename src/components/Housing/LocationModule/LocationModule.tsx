// =============================================================================
// Fichier  : src/components/Housing/LocationModule/LocationModule.tsx
// Auteur   : KREMER Régis
// Desc.    : Module simulation location — loyer viable, APL, reste à vivre.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Régis | Création Phase 0
//   2026-04-26 | KREMER Régis | Refonte complète Phase 1 — debounce + alertes
//   2026-04-29 | KREMER Régis | Refonte Phase 8 — wrapper premium fluide
//   2026-04-30 | KREMER Régis | Phase 10 — tokens CSS, accents, zéro couleur hardcodée
//   2026-05-01 | KREMER Régis | Phase 11 — Fix 3 : lien CAF via openExternal (Tauri)
// =============================================================================

import { useState, useEffect } from "react";
import { invoke }         from "@tauri-apps/api/core";
import { motion }         from "framer-motion";
import SliderInput        from "../../shared/SliderInput";
import AlertBadge         from "../../shared/AlertBadge";
import { formatEur, formatPct } from "../../../utils/formatCurrency";
import { openExternal } from "../../../utils/openExternal";
import { useProfileStore }       from "../../../store/profileStore";
import { useDebounce }           from "../../../hooks/useDebounce";
import type { BudgetResult }     from "../../../types/simulation";

// Seuils taux d'effort — via tokens CSS uniquement
function effortColor(r: number): string {
  return r <= 0.25 ? "var(--fin-green)"
       : r <= 0.33 ? "var(--fin-green)"
       : r <= 0.40 ? "var(--fin-amber)"
       : "var(--fin-red)";
}
function effortLabel(r: number): string {
  return r <= 0.25 ? "Excellent"
       : r <= 0.33 ? "Acceptable"
       : r <= 0.40 ? "Élevé — attention"
       : "Trop élevé — risque";
}

export default function LocationModule() {
  const profile = useProfileStore((s) => s.profile);

  const [rent,    setRent]    = useState(profile?.currentHousing.rent    ?? 650);
  const [charges, setCharges] = useState(profile?.currentHousing.charges ?? 50);
  const [result,  setResult]  = useState<BudgetResult | null>(null);
  const [loading, setLoading] = useState(false);

  const debouncedRent    = useDebounce(rent,    300);
  const debouncedCharges = useDebounce(charges, 300);

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    const p = {
      ...profile,
      currentHousing: {
        ...profile.currentHousing,
        rent:    debouncedRent,
        charges: debouncedCharges,
        type:    "tenant" as const,
      },
    };
    invoke<BudgetResult>("calculate_budget", { profile: p })
      .then(setResult)
      .catch(() => { /* Tauri non disponible en dev */ })
      .finally(() => setLoading(false));
  }, [debouncedRent, debouncedCharges, profile]);

  if (!profile) {
    return (
      <div className="p-8 text-center" style={{ color: "var(--text-muted)" }}>
        Aucun profil.{" "}
        <a href="#/onboarding" className="font-semibold underline" style={{ color: "var(--brand-1)" }}>
          Créez votre profil
        </a>
      </div>
    );
  }

  const rentCC      = rent + charges;
  const totalIncome = result
    ? (result.breakdown.totalIncome + result.breakdown.totalAids)
    : profile.salaryNet;
  const effortRatio = totalIncome > 0 ? rentCC / totalIncome : 0;
  const maxRent     = totalIncome * 0.33;

  const rdvColor = result
    ? (result.realDisposableIncome < 0    ? "var(--fin-red)"
     : result.realDisposableIncome < 300  ? "var(--fin-amber)"
     : "var(--fin-green)")
    : "var(--text-muted)";

  return (
    <div className="page-shell space-y-5">

      {/* En-tête */}
      <div>
        <h1
          className="font-display text-2xl font-extrabold"
          style={{ letterSpacing: "-0.04em", color: "var(--text-primary)" }}
        >
          Simulation Location
        </h1>
        <p className="mt-1 text-sm font-medium" style={{ color: "var(--text-muted)" }}>
          Ajustez le loyer — les résultats se mettent à jour en temps réel.
        </p>
      </div>

      {/* Sliders */}
      <div className="card p-6 space-y-5">
        <SliderInput
          label="Loyer hors charges"
          value={rent}
          min={200} max={3000} step={10}
          onChange={setRent}
        />
        <SliderInput
          label="Charges estimées"
          value={charges}
          min={0} max={500} step={5}
          onChange={setCharges}
        />
        <div
          className="flex items-center justify-between pt-3 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
            Loyer charges comprises
          </span>
          <span className="font-mono text-lg font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
            {formatEur(rentCC)}
            <span className="text-sm font-normal" style={{ color: "var(--text-muted)" }}>/mois</span>
          </span>
        </div>
      </div>

      {/* KPIs principaux */}
      <div className="grid grid-cols-2 gap-4">

        {/* Taux d'effort */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-5"
        >
          <p
            className="text-xs font-bold uppercase tracking-widest mb-3"
            style={{ color: "var(--text-muted)" }}
          >
            Taux d'effort
          </p>
          <p
            className="text-4xl font-mono font-bold tabular-nums"
            style={{ color: effortColor(effortRatio) }}
          >
            {formatPct(effortRatio)}
          </p>
          <p className="text-xs mt-1 font-medium" style={{ color: effortColor(effortRatio) }}>
            {effortLabel(effortRatio)}
          </p>

          {/* Barre */}
          <div
            className="mt-3 h-1.5 rounded-full overflow-hidden"
            style={{ background: "var(--bg-surface-2)" }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ background: effortColor(effortRatio) }}
              animate={{ width: `${Math.min((effortRatio / 0.5) * 100, 100)}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>

          <div
            className="mt-1.5 flex justify-between text-[10px] font-semibold"
            style={{ color: "var(--text-muted)" }}
          >
            <span>0 %</span>
            <span style={{ color: "var(--fin-green)" }}>33 %</span>
            <span style={{ color: "var(--fin-red)" }}>50 %</span>
          </div>
        </motion.div>

        {/* Reste à vivre */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="card p-5"
        >
          <p
            className="text-xs font-bold uppercase tracking-widest mb-3"
            style={{ color: "var(--text-muted)" }}
          >
            Reste à vivre
          </p>
          {result ? (
            <>
              <p
                className="text-4xl font-mono font-bold tabular-nums"
                style={{ color: rdvColor }}
              >
                {formatEur(result.realDisposableIncome)}
              </p>
              <p className="text-xs mt-1 font-medium" style={{ color: "var(--text-muted)" }}>
                par mois, charges incluses
              </p>
            </>
          ) : (
            <p className="animate-pulse text-sm" style={{ color: "var(--text-muted)" }}>
              {loading ? "Calcul…" : "—"}
            </p>
          )}
        </motion.div>
      </div>

      {/* Loyer recommandé */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card p-5"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
              Loyer maximum recommandé
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              33 % de vos revenus nets — seuil bancaire standard
            </p>
          </div>
          <p className="text-xl font-mono font-bold tabular-nums" style={{ color: "var(--brand-1)" }}>
            {formatEur(maxRent)}
          </p>
        </div>

        {rentCC > maxRent && (
          <div
            className="mt-3 pt-3 border-t"
            style={{ borderColor: "var(--border)" }}
          >
            <p className="text-xs font-semibold" style={{ color: "var(--fin-amber)" }}>
              Ce loyer dépasse de {formatEur(rentCC - maxRent)} le seuil recommandé.
            </p>
          </div>
        )}
      </motion.div>

      {/* APL estimée */}
      {result?.aplEstimate && result.aplEstimate.estimated > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
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
                APL estimée · {formatEur(result.aplEstimate.estimated)}/mois
              </p>
              <p className="mt-0.5 text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                Zone {result.aplEstimate.zone} — estimation indicative (±10 %).{" "}
                <button
                  type="button"
                  onClick={() => void openExternal("https://www.caf.fr")}
                  className="underline underline-offset-2 font-medium cursor-pointer"
                  style={{ color: "var(--fin-blue)", background: "none", border: "none", padding: 0 }}
                >
                  Vérifiez sur caf.fr
                </button>
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Alertes */}
      {result && result.alerts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-2"
        >
          {result.alerts.map((a) => (
            <AlertBadge key={a.id} {...a} />
          ))}
        </motion.div>
      )}

      {/* Indicateur chargement */}
      {loading && (
        <p className="text-center text-xs animate-pulse" style={{ color: "var(--text-muted)" }}>
          Recalcul en cours…
        </p>
      )}
    </div>
  );
}
