// =============================================================================
// Fichier  : src/components/shared/AlertBadge.tsx
// Auteur   : KREMER Régis
// Desc.    : Badge d'alerte premium — tokens CSS, parfait light/dark.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Régis | Création du fichier
//   2026-04-28 | KREMER Régis | Phase 7 — UI premium dark
//   2026-04-29 | KREMER Régis | Correction contraste clair/sombre
//   2026-04-30 | KREMER Régis | Phase 10 — tokens CSS complets, typography Geist
// =============================================================================

import { clsx } from "clsx";
import type { AlertLevel } from "../../types/simulation";

interface Cfg {
  bgVar:     string;
  borderVar: string;
  colorVar:  string;
  label:     string;
  icon: React.ReactElement;
}

function mkIcon(path: string): React.ReactElement {
  return (
    <svg viewBox="0 0 14 14" fill="currentColor" className="h-3.5 w-3.5">
      <path fillRule="evenodd" d={path} clipRule="evenodd" />
    </svg>
  );
}

const WARNING_PATH =
  "M6.148 1.584a1 1 0 0 1 1.704 0l5.5 9A1 1 0 0 1 12.5 12H1.5a1 1 0 0 1-.852-1.416l5.5-9ZM7 5.25a.75.75 0 0 0-1.5 0v2.5a.75.75 0 0 0 1.5 0v-2.5ZM7 9.75a.875.875 0 1 0 0 1.75.875.875 0 0 0 0-1.75Z";
const CIRCLE_PATH =
  "M7 1a6 6 0 1 0 0 12A6 6 0 0 0 7 1ZM6.25 4.25a.75.75 0 0 1 1.5 0v3.5a.75.75 0 0 1-1.5 0v-3.5ZM7 9.5a.875.875 0 1 1 0 1.75.875.875 0 0 1 0-1.75Z";
const CHECK_PATH =
  "M7 1a6 6 0 1 0 0 12A6 6 0 0 0 7 1Zm2.78 4.72a.75.75 0 0 0-1.06-1.06L5.97 7.41l-.69-.69a.75.75 0 0 0-1.06 1.06l1.22 1.22a.75.75 0 0 0 1.06 0l3.28-3.28Z";
const INFO_PATH =
  "M7 1a6 6 0 1 0 0 12A6 6 0 0 0 7 1ZM6.25 5.5a.75.75 0 0 1 1.5 0v4a.75.75 0 0 1-1.5 0v-4ZM7 3a.875.875 0 1 1 0 1.75A.875.875 0 0 1 7 3Z";

const CONFIGS: Record<AlertLevel, Cfg> = {
  critical: {
    bgVar:     "--fin-red-bg",
    borderVar: "--fin-red-border",
    colorVar:  "--fin-red",
    label:     "Critique",
    icon: mkIcon(WARNING_PATH),
  },
  danger: {
    bgVar:     "--fin-red-bg",
    borderVar: "--fin-red-border",
    colorVar:  "--fin-red",
    label:     "Danger",
    icon: mkIcon(WARNING_PATH),
  },
  vigilance: {
    bgVar:     "--fin-amber-bg",
    borderVar: "--fin-amber-border",
    colorVar:  "--fin-amber",
    label:     "Vigilance",
    icon: mkIcon(CIRCLE_PATH),
  },
  info: {
    bgVar:     "--fin-blue-bg",
    borderVar: "--fin-blue-border",
    colorVar:  "--fin-blue",
    label:     "Info",
    icon: mkIcon(INFO_PATH),
  },
  conseil: {
    bgVar:     "--fin-green-bg",
    borderVar: "--fin-green-border",
    colorVar:  "--fin-green",
    label:     "Conseil",
    icon: mkIcon(CHECK_PATH),
  },
};

interface Props {
  level:     AlertLevel;
  message:   string;
  detail?:   string;
  action?:   string;
  onAction?: () => void;
}

export default function AlertBadge({ level, message, detail, action, onAction }: Props) {
  const cfg = CONFIGS[level];

  return (
    <div
      className="flex gap-3 rounded-xl px-3.5 py-3"
      style={{
        background: `var(${cfg.bgVar})`,
        border:     `1px solid var(${cfg.borderVar})`,
      }}
    >
      {/* Icône */}
      <span
        className="mt-0.5 flex-shrink-0"
        style={{ color: `var(${cfg.colorVar})` }}
      >
        {cfg.icon}
      </span>

      {/* Contenu */}
      <div className="flex-1 min-w-0">
        <div className="mb-0.5 flex items-center gap-2">
          <span
            className="text-[10px] font-extrabold uppercase tracking-wider"
            style={{ color: `var(${cfg.colorVar})`, opacity: 0.8 }}
          >
            {cfg.label}
          </span>
        </div>
        <p
          className="text-xs font-semibold leading-snug"
          style={{ color: "var(--text-primary)" }}
        >
          {message}
        </p>
        {detail && (
          <p
            className="mt-1 text-xs font-medium leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            {detail}
          </p>
        )}
        {action && onAction && (
          <button
            onClick={onAction}
            className="mt-1.5 text-xs font-bold underline underline-offset-2 transition-opacity hover:opacity-70"
            style={{ color: `var(${cfg.colorVar})` }}
          >
            {action}
          </button>
        )}
      </div>
    </div>
  );
}
