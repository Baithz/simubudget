// =============================================================================
// Fichier  : src/components/ProfileSelector/PinSetupModal.tsx
// Auteur   : KREMER Régis
// Desc.    : Modale premium de définition ou modification d'un PIN profil.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-05-01 | KREMER Régis | Création ZIP 7.1 — PIN homogène création et paramètres
//   2026-05-01 | KREMER Régis | ZIP 7.2 — PIN 4 à 6 chiffres sans bascule automatique à 4
// =============================================================================

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface PinSetupModalProps {
  title: string;
  description: string;
  confirmLabel?: string;
  allowSkip?: boolean;
  skipLabel?: string;
  onConfirm: (pin: string) => Promise<void> | void;
  onSkip: () => void;
  onCancel: () => void;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"] as const;

export function PinSetupModal({
  title,
  description,
  confirmLabel = "Valider le PIN",
  allowSkip = true,
  skipLabel = "Continuer sans PIN",
  onConfirm,
  onSkip,
  onCancel,
}: PinSetupModalProps) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [editingConfirm, setEditingConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const dots = useMemo(() => Array.from({ length: 6 }), []);
  const activeValue = editingConfirm ? confirmPin : pin;
  const canSubmit = pin.length >= 4 && confirmPin.length >= 4 && pin === confirmPin && !loading;

  function addDigit(digit: string): void {
    setError(null);
    if (editingConfirm) {
      setConfirmPin((value) => `${value}${digit}`.slice(0, 6));
      return;
    }
    const next = `${pin}${digit}`.slice(0, 6);
    setPin(next);
    if (next.length === 6 && confirmPin.length === 0) {
      window.setTimeout(() => setEditingConfirm(true), 80);
    }
  }

  function removeDigit(): void {
    setError(null);
    if (editingConfirm) {
      if (confirmPin.length > 0) {
        setConfirmPin((value) => value.slice(0, -1));
        return;
      }
      setEditingConfirm(false);
      return;
    }
    setPin((value) => value.slice(0, -1));
  }

  async function submit(): Promise<void> {
    if (loading) return;
    if (pin.length < 4) {
      setError("Le PIN doit contenir au moins 4 chiffres.");
      return;
    }
    if (pin !== confirmPin) {
      setError("Les deux PIN ne correspondent pas.");
      setConfirmPin("");
      setEditingConfirm(true);
      return;
    }
    setLoading(true);
    await onConfirm(pin);
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center px-4 py-8" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Fermer la définition du PIN"
        className="absolute inset-0 cursor-default"
        style={{ background: "rgba(15, 23, 42, .38)", backdropFilter: "blur(10px)" }}
        onClick={onCancel}
      />
      <motion.div
        initial={{ opacity: 0, scale: .97, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: .97, y: 14 }}
        transition={{ duration: .2, ease: "easeOut" }}
        className="relative w-full max-w-sm rounded-[32px] p-6"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)" }}
      >
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-[22px] text-xl font-extrabold text-white gradient-brand shadow-lg">
            🔒
          </div>
          <h2 className="font-display text-xl font-extrabold text-ink-primary">{title}</h2>
          <p className="mt-1 text-sm font-semibold text-ink-muted">{description}</p>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            className="rounded-2xl px-3 py-2 text-xs font-extrabold uppercase tracking-[0.12em] transition"
            style={{
              color: !editingConfirm ? "var(--brand-1)" : "var(--text-muted)",
              background: !editingConfirm ? "var(--brand-soft)" : "var(--bg-surface-2)",
              border: !editingConfirm ? "1px solid var(--border-brand)" : "1px solid var(--border)",
            }}
            onClick={() => setEditingConfirm(false)}
          >
            PIN
          </button>
          <button
            type="button"
            className="rounded-2xl px-3 py-2 text-xs font-extrabold uppercase tracking-[0.12em] transition"
            style={{
              color: editingConfirm ? "var(--brand-1)" : "var(--text-muted)",
              background: editingConfirm ? "var(--brand-soft)" : "var(--bg-surface-2)",
              border: editingConfirm ? "1px solid var(--border-brand)" : "1px solid var(--border)",
            }}
            onClick={() => setEditingConfirm(true)}
          >
            Confirmation
          </button>
        </div>

        <motion.div
          key={`${editingConfirm ? "confirm" : "pin"}-${error ?? "ok"}`}
          animate={error ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 }}
          transition={{ duration: .28 }}
          className="mb-3 flex justify-center gap-2"
        >
          {dots.map((_, index) => (
            <span
              key={`setup-pin-dot-${index}`}
              className="h-3 w-3 rounded-full transition"
              style={{
                background: index < activeValue.length
                  ? error ? "var(--fin-red)" : "var(--brand-1)"
                  : "var(--bg-surface-3)",
              }}
            />
          ))}
        </motion.div>

        <p className="mb-4 text-center text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">
          {editingConfirm ? "Ressaisissez le PIN" : "Saisissez 4 à 6 chiffres, puis confirmez"}
        </p>

        {!editingConfirm && pin.length >= 4 && (
          <button
            type="button"
            className="btn-secondary mb-4 w-full"
            onClick={() => setEditingConfirm(true)}
            disabled={loading}
          >
            Confirmer ce PIN
          </button>
        )}

        <AnimatePresence mode="wait">
          {error && (
            <motion.p
              key="pin-setup-error"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mb-4 rounded-xl px-3 py-2 text-center text-sm font-bold"
              style={{ color: "var(--fin-red)", background: "var(--fin-red-bg)", border: "1px solid var(--fin-red-border)" }}
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-3 gap-3">
          {KEYS.slice(0, 9).map((digit) => (
            <PinSetupButton key={digit} label={digit} onClick={() => addDigit(digit)} disabled={loading} />
          ))}
          <button type="button" className="btn-ghost" onClick={removeDigit} disabled={loading || activeValue.length === 0}>
            ⌫
          </button>
          <PinSetupButton label="0" onClick={() => addDigit("0")} disabled={loading} />
          <button type="button" className="btn-brand" onClick={() => void submit()} disabled={!canSubmit}>
            {loading ? "…" : "OK"}
          </button>
        </div>

        <div className="mt-5 grid gap-2">
          {allowSkip && (
            <button type="button" className="btn-ghost" onClick={onSkip} disabled={loading}>
              {skipLabel}
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={loading}>
            Annuler
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function PinSetupButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  const animationProps = disabled ? {} : { whileHover: { scale: 1.025 }, whileTap: { scale: .96 } };
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

export default PinSetupModal;
