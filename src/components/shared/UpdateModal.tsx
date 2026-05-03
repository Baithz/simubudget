// =============================================================================
// Fichier  : src/components/shared/UpdateModal.tsx
// Auteur   : KREMER Régis
// Desc.    : Modale de notification et d'installation des mises à jour SimuBudget.
//            Design premium cohérent avec le design system Bloomberg×Linear.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-05-01 | KREMER Régis | Création — mise à jour automatique GitHub Releases
//   2026-05-03 | KREMER Régis | Affichage patchnote utilisateur + version installée dynamique
// =============================================================================

import { motion, AnimatePresence } from "framer-motion";
import type { UpdateInfo, UpdateStatus } from "@/hooks/useUpdater";

interface UpdateModalProps {
  status:     UpdateStatus;
  updateInfo: UpdateInfo | null;
  error:      string | null;
  progress:   number;
  onInstall:  () => void;
  onDismiss:  () => void;
}

export function UpdateModal({ status, updateInfo, error, progress, onInstall, onDismiss }: UpdateModalProps) {
  const visible = status === "available" || status === "downloading" || status === "installing" || status === "error";

  return (
    <AnimatePresence>
      {visible && (
        // Backdrop
        <motion.div
          key="update-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
          style={{ background: "rgba(0,0,0,0.52)", backdropFilter: "blur(6px)" }}
          onClick={(e) => { if (e.target === e.currentTarget && status !== "downloading" && status !== "installing") onDismiss(); }}
        >
          {/* Carte modale */}
          <motion.div
            key="update-modal"
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{ duration: 0.22, ease: [0.34, 1.1, 0.64, 1] }}
            className="relative w-full max-w-md overflow-hidden rounded-3xl"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            {/* Orbe décoratif */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-48 opacity-70"
              style={{
                background: "radial-gradient(ellipse 110% 80% at 50% 0%, rgba(6,214,160,.14), transparent 70%)",
              }}
            />

            <div className="relative z-10 p-6">

              {/* ── Mise à jour disponible ────────────────────────────────── */}
              {(status === "available" || status === "downloading" || status === "installing") && updateInfo && (
                <>
                  {/* Icône */}
                  <div className="mb-4 flex justify-center">
                    <div
                      className="flex h-14 w-14 items-center justify-center rounded-2xl"
                      style={{ background: "rgba(6,214,160,.12)", border: "1px solid rgba(6,214,160,.25)" }}
                    >
                      {status === "downloading" ? (
                        <DownloadSpinner />
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" style={{ color: "var(--brand-1)" }}>
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm-1 14v-4H7l5-7v4h4l-5 7Z" fill="currentColor" />
                        </svg>
                      )}
                    </div>
                  </div>

                  {/* Titre */}
                  <h2
                    className="mb-1 text-center font-display text-xl font-extrabold tracking-tight"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {status === "downloading" || status === "installing" ? "Installation en cours…" : "Mise à jour disponible"}
                  </h2>

                  {/* Versions */}
                  <div className="mt-3 flex items-center justify-center gap-3">
                    <VersionBadge label={`v${updateInfo.currentVersion}`} muted />
                    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5" style={{ color: "var(--text-muted)" }}>
                      <path d="M3.5 8h9M9 4.5 12.5 8 9 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    </svg>
                    <VersionBadge label={`v${updateInfo.version}`} accent />
                  </div>

                  {/* Notes utilisateur */}
                  {updateInfo.body && status !== "downloading" && status !== "installing" && (
                    <div
                      className="mt-4 rounded-2xl p-4 text-sm"
                      style={{
                        background: "var(--bg-surface-2)",
                        border: "1px solid var(--border)",
                        color: "var(--text-secondary)",
                        maxHeight: 260,
                        overflowY: "auto",
                        lineHeight: 1.65,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      <div className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
                        Ce qui change pour vous
                      </div>
                      {updateInfo.body}
                    </div>
                  )}

                  {/* Barre de progression pendant téléchargement */}
                  {(status === "downloading" || status === "installing") && (
                    <div
                      className="mt-5 h-1.5 w-full overflow-hidden rounded-full"
                      style={{ background: "var(--bg-surface-2)" }}
                    >
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: "linear-gradient(90deg, var(--brand-1), var(--brand-2))" }}
                        initial={{ width: "0%" }}
                        animate={{ width: status === "installing" ? "100%" : `${progress}%` }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                      />
                    </div>
                  )}

                  {/* Boutons */}
                  {status !== "downloading" && status !== "installing" && (
                    <div className="mt-5 flex gap-3">
                      <button
                        type="button"
                        onClick={onDismiss}
                        className="flex-1 rounded-2xl px-4 py-3 text-sm font-bold transition"
                        style={{
                          background: "var(--bg-surface-2)",
                          color: "var(--text-secondary)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        Plus tard
                      </button>
                      <button
                        type="button"
                        onClick={onInstall}
                        className="flex-[2] rounded-2xl px-4 py-3 text-sm font-extrabold text-white transition hover:opacity-90 active:scale-[.98]"
                        style={{ background: "linear-gradient(135deg, var(--brand-1), var(--brand-2))" }}
                      >
                        Installer la mise à jour
                      </button>
                    </div>
                  )}

                  {(status === "downloading" || status === "installing") && (
                    <p className="mt-3 text-center text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                      L'application va redémarrer automatiquement…
                    </p>
                  )}
                </>
              )}

              {/* ── Erreur ────────────────────────────────────────────────── */}
              {status === "error" && (
                <div className="flex flex-col items-center gap-4 py-4 text-center">
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-2xl"
                    style={{ background: "var(--fin-red-bg)", border: "1px solid var(--fin-red-border)" }}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7" style={{ color: "var(--fin-red)" }}>
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm1 15h-2v-2h2v2Zm0-4h-2V7h2v6Z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="font-display text-xl font-extrabold" style={{ color: "var(--text-primary)" }}>
                      Impossible de mettre à jour
                    </h2>
                    <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                      {error ?? "Une erreur inattendue s'est produite."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onDismiss}
                    className="rounded-2xl px-6 py-3 text-sm font-bold transition"
                    style={{ background: "var(--bg-surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                  >
                    Fermer
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Sous-composants ────────────────────────────────────────────────────────

function VersionBadge({ label, muted, accent }: { label: string; muted?: boolean; accent?: boolean }) {
  return (
    <span
      className="rounded-xl px-3 py-1 font-mono text-sm font-extrabold"
      style={{
        background: accent ? "rgba(6,214,160,.12)" : "var(--bg-surface-2)",
        color: accent ? "var(--brand-1)" : "var(--text-muted)",
        border: `1px solid ${accent ? "rgba(6,214,160,.25)" : "var(--border)"}`,
        opacity: muted ? 0.75 : 1,
      }}
    >
      {label}
    </span>
  );
}

function DownloadSpinner() {
  return (
    <motion.svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-7 w-7"
      style={{ color: "var(--brand-1)" }}
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeDasharray="42 14" strokeLinecap="round" />
    </motion.svg>
  );
}

export default UpdateModal;
