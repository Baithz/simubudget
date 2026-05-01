// =============================================================================
// Fichier  : src/components/Housing/PurchaseModule/DebtGauge.tsx
// Auteur   : KREMER Régis
// Desc.    : Jauge taux d'endettement avec seuil HCSF 35% mis en évidence.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Régis | Création du fichier
//   2026-04-30 | KREMER Régis | Phase 10 — tokens CSS, zéro couleur hardcodée
// =============================================================================

import { motion } from "framer-motion";
import { formatPctFromHundred } from "../../../utils/formatCurrency";

interface Props {
  ratio: number; // 0 à 1
}

export default function DebtGauge({ ratio }: Props) {
  const pct = Math.min(ratio * 100, 100);

  const colorVar =
    pct <= 33 ? "var(--fin-green)"
    : pct <= 35 ? "var(--fin-amber)"
    : pct <= 40 ? "var(--fin-amber)"
    : "var(--fin-red)";

  const label =
    pct <= 33  ? "Sûr"
    : pct <= 35 ? "Limite HCSF"
    : pct <= 40 ? "Dépassé"
    : "Refus probable";

  return (
    <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <p
        className="text-2xl font-mono font-bold tabular-nums"
        style={{ color: colorVar }}
      >
        {formatPctFromHundred(pct)}
      </p>
      <p className="text-xs font-semibold mt-0.5" style={{ color: colorVar }}>
        {label}
      </p>

      {/* Barre */}
      <div
        className="mt-3 relative h-2 rounded-full overflow-hidden"
        style={{ background: "var(--bg-surface-2)" }}
      >
        {/* Marqueur HCSF 35% */}
        <div
          className="absolute top-0 bottom-0 w-0.5 z-10"
          style={{ left: "35%", background: "var(--fin-amber)", opacity: 0.8 }}
        />
        <motion.div
          className="h-full rounded-full"
          style={{ background: colorVar }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
      </div>

      <div
        className="mt-1.5 flex justify-between text-[10px] font-semibold"
        style={{ color: "var(--text-muted)" }}
      >
        <span>0 %</span>
        <span style={{ color: "var(--fin-amber)" }}>35 % HCSF</span>
        <span>50 %+</span>
      </div>
    </div>
  );
}
