// =============================================================================
// Fichier  : src/components/shared/ScoreGauge.tsx
// Auteur   : KREMER Régis
// Desc.    : Jauge SSF premium — dégradé brand, Geist Mono, niveaux.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Régis | Création du fichier
//   2026-04-28 | KREMER Régis | Phase 7 — UI Premium, dégradé brand
//   2026-04-30 | KREMER Régis | Phase 10 — Geist Mono, tokensCSS, glow animé
// =============================================================================

import { motion } from "framer-motion";
import type { HealthLevel } from "../../types/simulation";

const LEVEL_LABELS: Record<HealthLevel, string> = {
  critical: "Critique",
  fragile:  "Fragile",
  stable:   "Stable",
  solid:    "Solide",
  robust:   "Robuste",
};

interface Props {
  score:  number;
  level?: HealthLevel;
  size?:  number;
}

export default function ScoreGauge({ score, level, size = 160 }: Props) {
  const clamped     = Math.max(0, Math.min(100, score));
  const radius      = size * 0.37;
  const circumference = 2 * Math.PI * radius;
  const offset      = circumference * (1 - clamped / 100);
  const cx          = size / 2;
  const cy          = size / 2;
  const gradId      = `ssf-grad-${size}`;
  const glowId      = `ssf-glow-${size}`;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`Score de Santé Financière : ${score}/100`}
        style={{ overflow: "visible" }}
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#0ea5e9" />
            <stop offset="55%"  stopColor="#06d6a0" />
            <stop offset="100%" stopColor="#84cc16" />
          </linearGradient>
          <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Track fond */}
        <circle
          cx={cx} cy={cy} r={radius}
          fill="none"
          stroke="var(--bg-surface-2)"
          strokeWidth={size * 0.065}
          strokeLinecap="round"
        />

        {/* Arc glow (flou) */}
        {clamped > 0 && (
          <motion.circle
            cx={cx} cy={cy} r={radius}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={size * 0.065 + 4}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            transform={`rotate(-90 ${cx} ${cy})`}
            opacity={0.15}
            filter={`url(#${glowId})`}
          />
        )}

        {/* Arc principal */}
        <motion.circle
          cx={cx} cy={cy} r={radius}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={size * 0.065}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          transform={`rotate(-90 ${cx} ${cy})`}
        />

        {/* Valeur centrale */}
        <text
          x={cx} y={cy - size * 0.04}
          textAnchor="middle"
          fontSize={size * 0.22}
          fontWeight="700"
          fontFamily="'Geist Mono', ui-monospace, monospace"
          fill="var(--text-primary)"
        >
          {clamped}
        </text>
        <text
          x={cx} y={cy + size * 0.12}
          textAnchor="middle"
          fontSize={size * 0.085}
          fontFamily="'Geist', system-ui, sans-serif"
          fill="var(--text-muted)"
        >
          / 100
        </text>
      </svg>

      {level && (
        <span
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: "var(--text-muted)", letterSpacing: ".1em" }}
        >
          {LEVEL_LABELS[level]}
        </span>
      )}
    </div>
  );
}
