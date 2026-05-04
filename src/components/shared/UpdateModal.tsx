// =============================================================================
// Fichier  : src/components/shared/UpdateModal.tsx
// Auteur   : KREMER Régis
// Desc.    : Modale de notification et d'installation des mises à jour SimuBudget.
//            Design premium cohérent avec le design system Bloomberg×Linear.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-05-01 | KREMER Régis | Création — mise à jour automatique GitHub Releases
//   2026-05-03 | KREMER Régis | Affichage patchnote utilisateur + version installée dynamique
//   2026-05-04 | KREMER Régis | Agrandissement modale + présentation structurée v2.5.1
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
        <motion.div
          key="update-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center px-6 py-6"
          style={{ background: "rgba(15,23,42,0.58)", backdropFilter: "blur(8px)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget && status !== "downloading" && status !== "installing") onDismiss();
          }}
        >
          <motion.div
            key="update-modal"
            initial={{ opacity: 0, scale: 0.94, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{ duration: 0.22, ease: [0.34, 1.1, 0.64, 1] }}
            className="relative w-full max-w-4xl overflow-hidden rounded-[32px]"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-72 opacity-80"
              style={{
                background: "radial-gradient(ellipse 100% 80% at 50% 0%, rgba(6,214,160,.18), transparent 72%)",
              }}
            />
            <div
              className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-40 blur-3xl"
              style={{ background: "var(--brand-2)" }}
            />

            <div className="relative z-10 max-h-[88vh] overflow-y-auto p-7 sm:p-8">
              {(status === "available" || status === "downloading" || status === "installing") && updateInfo && (
                <>
                  <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
                    <aside
                      className="rounded-[28px] p-5"
                      style={{
                        background: "linear-gradient(180deg, rgba(6,214,160,.12), rgba(0,180,216,.08))",
                        border: "1px solid rgba(6,214,160,.24)",
                      }}
                    >
                      <div
                        className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl"
                        style={{ background: "rgba(255,255,255,.72)", border: "1px solid rgba(6,214,160,.25)" }}
                      >
                        {status === "downloading" ? (
                          <DownloadSpinner />
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8" style={{ color: "var(--brand-1)" }}>
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm-1 14v-4H7l5-7v4h4l-5 7Z" fill="currentColor" />
                          </svg>
                        )}
                      </div>

                      <p className="text-xs font-extrabold uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
                        Mise à jour SimuBudget
                      </p>
                      <h2 className="mt-2 font-display text-2xl font-extrabold leading-tight tracking-tight" style={{ color: "var(--text-primary)" }}>
                        {status === "downloading" || status === "installing" ? "Installation en cours…" : "Nouvelle version disponible"}
                      </h2>
                      <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                        Découvrez les nouveautés avant installation. Vos données locales sont conservées.
                      </p>

                      <div className="mt-5 flex flex-wrap items-center gap-2">
                        <VersionBadge label={`v${updateInfo.currentVersion}`} muted />
                        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5" style={{ color: "var(--text-muted)" }}>
                          <path d="M3.5 8h9M9 4.5 12.5 8 9 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                        </svg>
                        <VersionBadge label={`v${updateInfo.version}`} accent />
                      </div>
                    </aside>

                    <section className="space-y-4">
                      {updateInfo.body && status !== "downloading" && status !== "installing" && (
                        <ReleasePresentation body={updateInfo.body} />
                      )}

                      {(status === "downloading" || status === "installing") && (
                        <div className="rounded-[28px] p-6" style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
                          <p className="text-sm font-bold" style={{ color: "var(--text-secondary)" }}>
                            {status === "installing" ? "Installation de la mise à jour…" : "Téléchargement de la mise à jour…"}
                          </p>
                          <div className="mt-4 h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--bg-surface-3)" }}>
                            <motion.div
                              className="h-full rounded-full"
                              style={{ background: "linear-gradient(90deg, var(--brand-1), var(--brand-2))" }}
                              initial={{ width: "0%" }}
                              animate={{ width: status === "installing" ? "100%" : `${progress}%` }}
                              transition={{ duration: 0.3, ease: "easeOut" }}
                            />
                          </div>
                          <p className="mt-3 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                            L'application va redémarrer automatiquement.
                          </p>
                        </div>
                      )}
                    </section>
                  </div>

                  {status !== "downloading" && status !== "installing" && (
                    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={onDismiss}
                        className="rounded-2xl px-5 py-3 text-sm font-bold transition"
                        style={{ background: "var(--bg-surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                      >
                        Plus tard
                      </button>
                      <button
                        type="button"
                        onClick={onInstall}
                        className="rounded-2xl px-6 py-3 text-sm font-extrabold text-white transition hover:opacity-90 active:scale-[.98]"
                        style={{ background: "linear-gradient(135deg, var(--brand-1), var(--brand-2))" }}
                      >
                        Installer la mise à jour
                      </button>
                    </div>
                  )}
                </>
              )}

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

function ReleasePresentation({ body }: { body: string }) {
  const sections = splitReleaseSections(body);

  if (sections.length === 0) {
    return (
      <div className="rounded-[28px] p-5 text-sm" style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border)", color: "var(--text-secondary)", whiteSpace: "pre-wrap", lineHeight: 1.65 }}>
        {body}
      </div>
    );
  }

  const intro = body.split("\n").find((line) => line.trim().startsWith("🚀"));
  const objective = body.split("\n").find((line) => line.trim().startsWith("👉"));

  return (
    <div className="space-y-4">
      <div className="rounded-[28px] p-5" style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
        <p className="text-xs font-extrabold uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
          Ce qui change pour vous
        </p>
        <h3 className="mt-2 font-display text-2xl font-extrabold leading-tight" style={{ color: "var(--text-primary)" }}>
          {intro?.replace(/^🚀\s*/, "") ?? "Présentation de la mise à jour"}
        </h3>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {sections.map((section) => (
          <ReleaseSectionCard key={section.title} title={section.title} items={section.items} />
        ))}
      </div>

      {objective && (
        <div
          className="rounded-[24px] p-4 text-sm font-bold leading-relaxed"
          style={{ background: "rgba(6,214,160,.10)", border: "1px solid rgba(6,214,160,.24)", color: "var(--text-primary)" }}
        >
          {objective}
        </div>
      )}
    </div>
  );
}

function ReleaseSectionCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-[24px] p-4" style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
      <h4 className="font-display text-base font-extrabold" style={{ color: "var(--text-primary)" }}>
        {title}
      </h4>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm leading-snug" style={{ color: "var(--text-secondary)" }}>
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--brand-1)" }} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function splitReleaseSections(body: string): Array<{ title: string; items: string[] }> {
  const sections: Array<{ title: string; items: string[] }> = [];
  let current: { title: string; items: string[] } | null = null;

  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("🚀") || line.startsWith("👉")) continue;

    if (line.startsWith("✨") || line.startsWith("📊") || line.startsWith("🛡️")) {
      current = { title: line, items: [] };
      sections.push(current);
      continue;
    }

    if (line.startsWith("•") && current !== null) {
      current.items.push(line.replace(/^•\s*/, ""));
    }
  }

  return sections.filter((section) => section.items.length > 0);
}

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
