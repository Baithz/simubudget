// =============================================================================
// Fichier  : src/components/Assistant/AssistantFloatingPanel.tsx
// Auteur   : KREMER Régis
// Desc.    : Panneau assistant flottant premium, confortable et non intrusif.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-05-03 | KREMER Régis | Création — intégration UI premium de l'assistant
//   2026-05-03 | KREMER Régis | Correction UX — bouton compact latéral et panneau moins large
//   2026-05-03 | KREMER Régis | Correction UX finale — panneau confortable 560px et bouton discret
//   2026-05-03 | KREMER Régis | Correction UX — panneau large 920px sans écrasement
// =============================================================================

import { useEffect } from "react";
import type { ReactElement } from "react";
import { AnimatePresence, motion } from "framer-motion";
import LocalAssistantChat from "@/components/Assistant/LocalAssistantChat";

interface AssistantFloatingPanelProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}

function AssistantSparkIcon({ className = "h-5 w-5" }: { className?: string }): ReactElement {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path d="M10 1.5a.7.7 0 0 1 .66.46l1.55 4.2 4.2 1.55a.7.7 0 0 1 0 1.32l-4.2 1.55-1.55 4.2a.7.7 0 0 1-1.32 0l-1.55-4.2-4.2-1.55a.7.7 0 0 1 0-1.32l4.2-1.55 1.55-4.2A.7.7 0 0 1 10 1.5Zm5.7 10.85a.55.55 0 0 1 .52.37l.44 1.22 1.22.44a.55.55 0 0 1 0 1.04l-1.22.44-.44 1.22a.55.55 0 0 1-1.04 0l-.44-1.22-1.22-.44a.55.55 0 0 1 0-1.04l1.22-.44.44-1.22a.55.55 0 0 1 .52-.37Z" />
    </svg>
  );
}

export function AssistantFloatingPanel({ open, onOpen, onClose }: AssistantFloatingPanelProps): ReactElement {
  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  return (
    <>
      <div className="fixed right-4 top-1/2 z-40 -translate-y-1/2 sm:right-5">
        <button
          type="button"
          onClick={open ? onClose : onOpen}
          className="group relative flex h-14 w-14 items-center justify-center rounded-[22px] border text-sm font-black shadow-xl transition hover:-translate-x-1 focus:outline-none focus:ring-2"
          style={{
            background: "var(--bg-surface)",
            borderColor: open ? "var(--brand-1)" : "var(--border)",
            color: "var(--brand-1)",
            boxShadow: open
              ? "0 18px 45px rgba(6, 214, 160, 0.24)"
              : "0 14px 34px rgba(15, 23, 42, 0.18)",
          }}
          aria-expanded={open}
          aria-controls="simubudget-assistant-panel"
          aria-label={open ? "Fermer l'assistant" : "Ouvrir l'assistant"}
          title={open ? "Fermer l'assistant" : "Assistant financier"}
        >
          <AssistantSparkIcon className="h-6 w-6" />
          <span
            className="pointer-events-none absolute right-[calc(100%+0.75rem)] top-1/2 hidden -translate-y-1/2 whitespace-nowrap rounded-2xl border px-3 py-2 text-xs font-black opacity-0 shadow-lg transition group-hover:opacity-100 sm:block"
            style={{
              background: "var(--bg-surface)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
            }}
          >
            Assistant financier
          </span>
          <span
            className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2"
            style={{ background: "var(--brand-1)", borderColor: "var(--bg-surface)" }}
            aria-hidden="true"
          />
        </button>
      </div>

      <AnimatePresence>
        {open ? (
          <>
            <motion.button
              type="button"
              className="fixed inset-0 z-30 cursor-default border-0 bg-black/20 p-0 backdrop-blur-[1px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              onClick={onClose}
              aria-label="Fermer l'assistant"
            />

            <motion.aside
              id="simubudget-assistant-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Assistant financier SimuBudget"
              className="fixed bottom-4 right-4 top-4 z-40 flex w-[min(920px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[30px] border shadow-2xl sm:right-5"
              style={{
                borderColor: "var(--border)",
                background: "var(--bg-surface)",
                boxShadow: "0 28px 80px rgba(15, 23, 42, 0.26)",
              }}
              initial={{ opacity: 0, x: 24, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <div
                className="flex flex-shrink-0 items-center justify-between gap-4 border-b px-5 py-4"
                style={{ borderColor: "var(--border)", background: "var(--topbar-bg)" }}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl"
                    style={{ background: "var(--brand-soft)", color: "var(--brand-1)" }}
                  >
                    <AssistantSparkIcon />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black" style={{ color: "var(--text-primary)" }}>
                      Assistant financier
                    </p>
                    <p className="truncate text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                      Local, chiffré, sans envoi réseau
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border text-sm font-black transition hover:-translate-y-0.5"
                  style={{ borderColor: "var(--border)", background: "var(--bg-surface-2)", color: "var(--text-secondary)" }}
                  aria-label="Fermer l'assistant"
                >
                  ×
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-auto">
                <LocalAssistantChat />
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
