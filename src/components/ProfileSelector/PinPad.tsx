// =============================================================================
// Fichier  : src/components/ProfileSelector/PinPad.tsx
// Auteur   : KREMER Régis
// Desc.    : Pavé numérique PIN pour déverrouiller un profil SimuBudget.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-05-01 | KREMER Régis | Création Phase 12B — saisie PIN 4 à 6 chiffres
//   2026-05-01 | KREMER Régis | Phase 12B.2 — feedback premium erreur, verrouillage et animation
// =============================================================================

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ProfileEntry } from "@/types/profile";

interface PinPadProps {
  profile: ProfileEntry;
  lockSeconds: number;
  onSubmit: (pin: string) => Promise<boolean>;
  onCancel: () => void;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"] as const;

export function PinPad({ profile, lockSeconds, onSubmit, onCancel }: PinPadProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failedCount, setFailedCount] = useState(0);

  const dots = useMemo(() => Array.from({ length: 6 }), []);
  const isLocked = lockSeconds > 0;
  const helperText = isLocked
    ? `Profil verrouillé encore ${lockSeconds} seconde${lockSeconds > 1 ? "s" : ""}.`
    : "PIN de 4 à 6 chiffres.";

  async function submit(nextPin = pin) {
    if (nextPin.length < 4 || loading || isLocked) return;
    setLoading(true);
    setError(null);
    const ok = await onSubmit(nextPin);
    setLoading(false);
    if (!ok) {
      const nextFailedCount = Math.min(3, failedCount + 1);
      setFailedCount(nextFailedCount);
      setPin("");
      setError(nextFailedCount >= 3
        ? "Trop d'essais. Le profil est temporairement verrouillé."
        : `PIN incorrect. Essai ${nextFailedCount}/3.`);
    }
  }

  function addDigit(digit: string) {
    if (isLocked || loading) return;
    setError(null);
    const next = `${pin}${digit}`.slice(0, 6);
    setPin(next);
    if (next.length === 6) void submit(next);
  }

  function removeDigit() {
    if (loading || isLocked) return;
    setError(null);
    setPin((value) => value.slice(0, -1));
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="mx-auto w-full max-w-sm rounded-[32px] p-6"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)" }}
    >
      <div className="mb-5 text-center">
        <div
          className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-[24px] text-xl font-extrabold text-white shadow-lg"
          style={{ background: profile.avatarColor }}
        >
          {profile.avatarInitials}
        </div>
        <h2 className="font-display text-xl font-extrabold text-ink-primary">{profile.displayName}</h2>
        <p className="mt-1 text-sm font-semibold text-ink-muted">Saisissez le code PIN du profil</p>
      </div>

      <motion.div
        key={error ?? "pin-ok"}
        animate={error ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 }}
        transition={{ duration: 0.28 }}
        className="mb-3 flex justify-center gap-2"
      >
        {dots.map((_, index) => (
          <span
            key={`pin-dot-${index}`}
            className="h-3 w-3 rounded-full transition"
            style={{
              background: index < pin.length
                ? error ? "var(--fin-red)" : "var(--brand-1)"
                : "var(--bg-surface-3)",
            }}
          />
        ))}
      </motion.div>

      <p className="mb-4 text-center text-xs font-bold uppercase tracking-[0.16em]" style={{ color: isLocked ? "var(--fin-red)" : "var(--text-muted)" }}>
        {helperText}
      </p>

      <AnimatePresence mode="wait">
        {isLocked && (
          <Feedback key="locked" level="danger" message="Sécurité active : patientez avant un nouvel essai." />
        )}
        {!isLocked && error && (
          <Feedback key="error" level="danger" message={error} />
        )}
        {!isLocked && !error && failedCount > 0 && (
          <Feedback key="warning" level="warning" message={`${3 - failedCount} tentative${3 - failedCount > 1 ? "s" : ""} restante${3 - failedCount > 1 ? "s" : ""}.`} />
        )}
      </AnimatePresence>

      <div className="grid grid-cols-3 gap-3">
        {KEYS.slice(0, 9).map((digit) => (
          <PinButton key={digit} label={digit} onClick={() => addDigit(digit)} disabled={loading || isLocked} />
        ))}
        <button type="button" className="btn-ghost" onClick={removeDigit} disabled={loading || pin.length === 0 || isLocked}>
          ⌫
        </button>
        <PinButton label="0" onClick={() => addDigit("0")} disabled={loading || isLocked} />
        <button type="button" className="btn-brand" onClick={() => void submit()} disabled={loading || pin.length < 4 || isLocked}>
          {loading ? "…" : "OK"}
        </button>
      </div>

      <button type="button" className="mt-5 w-full btn-ghost" onClick={onCancel}>
        Annuler
      </button>
    </motion.div>
  );
}

function Feedback({ level, message }: { level: "danger" | "warning"; message: string }) {
  const danger = level === "danger";
  return (
    <motion.p
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="mb-4 rounded-xl px-3 py-2 text-center text-sm font-bold"
      style={{
        color: danger ? "var(--fin-red)" : "var(--fin-amber)",
        background: danger ? "var(--fin-red-bg)" : "var(--fin-amber-bg)",
        border: danger ? "1px solid var(--fin-red-border)" : "1px solid var(--fin-amber-border)",
      }}
    >
      {message}
    </motion.p>
  );
}

function PinButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  const animationProps = disabled
    ? {}
    : {
        whileHover: { scale: 1.025 },
        whileTap: { scale: 0.96 },
      };

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      {...animationProps}
      className="rounded-2xl px-4 py-4 font-mono text-xl font-extrabold transition disabled:cursor-not-allowed disabled:opacity-50"
      style={{ background: "var(--bg-surface-2)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
    >
      {label}
    </motion.button>
  );
}

export default PinPad;
