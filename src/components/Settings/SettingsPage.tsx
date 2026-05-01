// =============================================================================
// Fichier  : src/components/Settings/SettingsPage.tsx
// Auteur   : KREMER Régis
// Desc.    : Page Paramètres premium : apparence, application, données et à propos.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-29 | KREMER Régis | Création Phase 8 — paramètres complets et version 1.8
//   2026-05-01 | KREMER Régis | Phase 12B — gestion profils, PIN et nettoyage multi-profils
//   2026-05-01 | KREMER Régis | Correction Phase 12B — déclaration du profil actif dans SettingsPage
//   2026-05-01 | KREMER Régis | Phase 12B.1 — accès sélection et création profil depuis paramètres
//   2026-05-01 | KREMER Régis | Phase 12B.2 — aperçu premium profil actif et initiales propres
//   2026-05-01 | KREMER Régis | ZIP 7.1 — édition PIN avec pavé premium
//   2026-05-01 | KREMER Régis | Phase 13 — section Mises à jour avec check manuel et barre de progression
// =============================================================================

import { useRef, useState } from "react";
import { clsx } from "clsx";
import { motion, AnimatePresence } from "framer-motion";
import { useUIStore, type FontSizeMode, type StartPageMode, type ThemeMode } from "@/store/uiStore";
import { useProfileStore } from "@/store/profileStore";
import {
  formatProfileLastUsed,
  hashProfilePin,
  profileInitialsFromName,
  useProfileListStore,
} from "@/store/profileListStore";
import { useUpdater } from "@/hooks/useUpdater";
import logoFull from "@/assets/logo-full.png";
import PinSetupModal from "@/components/ProfileSelector/PinSetupModal";

// ─── Constantes ───────────────────────────────────────────────────────────────
const APP_VERSION = "2.0.1";

interface Option<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

const THEME_OPTIONS: Option<ThemeMode>[] = [
  { value: "light",  label: "Clair",   hint: "Interface lumineuse" },
  { value: "dark",   label: "Sombre",  hint: "Confort visuel" },
  { value: "system", label: "Système", hint: "Suit Windows" },
];

const FONT_OPTIONS: Option<FontSizeMode>[] = [
  { value: "sm", label: "Petite" },
  { value: "md", label: "Normale" },
  { value: "lg", label: "Grande" },
];

const START_OPTIONS: Option<StartPageMode>[] = [
  { value: "/",    label: "Accueil" },
  { value: "last", label: "Dernière page" },
];

const PROFILE_SESSION_KEY = "simubudget-profile-session-active";

// ─── UpdatePanel ──────────────────────────────────────────────────────────────
function UpdatePanel() {
  const { status, updateInfo, progress, error, checkUpdate, installUpdate, dismiss } = useUpdater();

  const statusLabel: Record<typeof status, string> = {
    idle:          "Non vérifié",
    checking:      "Vérification en cours…",
    available:     `Version ${updateInfo?.version ?? "?"} disponible`,
    downloading:   `Téléchargement… ${progress}%`,
    installing:    "Installation en cours…",
    "up-to-date":  "À jour",
    error:         "Erreur de mise à jour",
  };

  const statusColor: Record<typeof status, string> = {
    idle:          "var(--text-muted)",
    checking:      "var(--text-muted)",
    available:     "var(--fin-amber)",
    downloading:   "var(--brand-2)",
    installing:    "var(--brand-1)",
    "up-to-date":  "var(--fin-green)",
    error:         "var(--fin-red)",
  };

  const isWorking = status === "checking" || status === "downloading" || status === "installing";

  return (
    <div className="space-y-3">
      {/* Ligne statut + boutons */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-extrabold" style={{ color: "var(--text-primary)" }}>
            Mises à jour automatiques
          </p>
          <p className="mt-0.5 text-sm font-medium" style={{ color: "var(--text-muted)" }}>
            Version installée :{" "}
            <span className="font-mono font-bold" style={{ color: "var(--text-secondary)" }}>
              v{APP_VERSION}
            </span>
          </p>
        </div>

        <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
          {/* Badge statut */}
          <span
            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold"
            style={{
              color: statusColor[status],
              background: "var(--bg-surface-2)",
              border: "1px solid var(--border)",
            }}
          >
            {isWorking && (
              <span
                className="inline-block h-2 w-2 rounded-full animate-pulse"
                style={{ background: statusColor[status] }}
              />
            )}
            {status === "up-to-date" && (
              <svg viewBox="0 0 12 12" fill="currentColor" className="h-3 w-3">
                <path d="M10.07 3.07 4.75 8.4 2.43 6.08a.75.75 0 0 0-1.06 1.06l2.85 2.86a.75.75 0 0 0 1.06 0l5.85-5.86a.75.75 0 0 0-1.06-1.06Z" />
              </svg>
            )}
            {statusLabel[status]}
          </span>

          {/* Bouton principal */}
          {status === "available" ? (
            <button
              type="button"
              className="rounded-xl px-4 py-2 text-sm font-extrabold text-white transition hover:opacity-90 gradient-brand"
              onClick={() => void installUpdate()}
            >
              Mettre à jour
            </button>
          ) : (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => void checkUpdate()}
              disabled={isWorking}
            >
              {status === "checking" ? "Vérification…" : "Vérifier maintenant"}
            </button>
          )}

          {/* Ignorer */}
          {status === "available" && (
            <button type="button" className="btn-ghost" onClick={dismiss}>
              Plus tard
            </button>
          )}
        </div>
      </div>

      {/* Barre de progression */}
      <AnimatePresence>
        {(status === "downloading" || status === "installing") && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div
              className="h-2 w-full overflow-hidden rounded-full"
              style={{ background: "var(--bg-surface-3)" }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg, var(--brand-1), var(--brand-2))" }}
                initial={{ width: "0%" }}
                animate={{ width: status === "installing" ? "100%" : `${progress}%` }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              />
            </div>
            <p className="mt-1.5 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              {status === "installing"
                ? "Installation… L'application va redémarrer automatiquement."
                : `Téléchargement de la mise à jour — ${progress}%`}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notes de version */}
      <AnimatePresence>
        {status === "available" && updateInfo?.body && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="rounded-2xl p-4 text-sm"
            style={{
              background: "var(--bg-surface-2)",
              border: "1px solid var(--border-brand)",
            }}
          >
            <p
              className="mb-2 text-xs font-bold uppercase tracking-wide"
              style={{ color: "var(--text-muted)" }}
            >
              Nouveautés v{updateInfo.version}
            </p>
            <p
              className="whitespace-pre-wrap font-medium leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              {updateInfo.body}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Erreur */}
      <AnimatePresence>
        {status === "error" && error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="rounded-2xl p-3 text-sm font-medium"
            style={{
              background: "var(--fin-red-bg)",
              border: "1px solid var(--fin-red-border)",
              color: "var(--fin-red)",
            }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── SettingsPage ─────────────────────────────────────────────────────────────
export function SettingsPage() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const profile  = useProfileStore((state) => state.profile);
  const setProfile = useProfileStore((state) => state.setProfile);
  const {
    themeMode, fontSize, startPage, notifications,
    setThemeMode, setFontSize, setStartPage, setNotifications,
  } = useUIStore();

  const profiles           = useProfileListStore((state) => state.profiles);
  const activeProfileId    = useProfileListStore((state) => state.activeProfileId);
  const updateProfileEntry = useProfileListStore((state) => state.updateEntry);
  const removeProfileEntry = useProfileListStore((state) => state.removeProfile);
  const clearActiveProfile = useProfileListStore((state) => state.clearActive);
  const activeEntry = profiles.find((e) => e.id === activeProfileId) ?? null;
  const [pinModalOpen, setPinModalOpen] = useState(false);

  const exportProfile = () => {
    const payload = JSON.stringify(
      { version: APP_VERSION, exportedAt: new Date().toISOString(), profile },
      null, 2
    );
    const blob = new Blob([payload], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `simubudget-profil-v${APP_VERSION}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importProfile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as { profile?: unknown };
        if (parsed.profile && typeof parsed.profile === "object") {
          setProfile(parsed.profile as Parameters<typeof setProfile>[0]);
        }
      } catch {
        window.alert("Le fichier JSON sélectionné n'est pas lisible.");
      }
    };
    reader.readAsText(file);
  };

  const renameActiveProfile = () => {
    if (!activeEntry) return;
    const next = window.prompt("Nom du profil", activeEntry.displayName)?.trim();
    if (!next) return;
    updateProfileEntry(activeEntry.id, {
      displayName:    next,
      avatarInitials: profileInitialsFromName(next),
    });
  };

  const definePin = async (pin: string) => {
    if (!activeEntry) return;
    updateProfileEntry(activeEntry.id, { pinHash: await hashProfilePin(pin) });
    setPinModalOpen(false);
  };

  const removePin = () => {
    if (!activeEntry || !window.confirm("Supprimer le PIN de ce profil ?")) return;
    updateProfileEntry(activeEntry.id, { pinHash: null });
  };

  const openProfileSelector = () => {
    sessionStorage.removeItem(PROFILE_SESSION_KEY);
    if (activeProfileId) useProfileListStore.getState().lock(activeProfileId);
    window.location.hash = "#/profiles";
  };

  const createNewProfile = () => {
    sessionStorage.removeItem(PROFILE_SESSION_KEY);
    clearActiveProfile();
    window.location.hash = "#/onboarding";
  };

  const deleteActiveProfile = () => {
    if (!activeEntry) return;
    if (!window.confirm(`Supprimer le profil "${activeEntry.displayName}" et ses données locales ?`)) return;
    removeProfileEntry(activeEntry.id);
    window.location.hash = "#/profiles";
  };

  const clearData = () => {
    if (!window.confirm("Effacer toutes les données locales SimuBudget ? Cette action est irréversible.")) return;
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("simubudget-")) localStorage.removeItem(key);
    }
    window.location.reload();
  };

  return (
    <div className="page-shell">
      {pinModalOpen && (
        <PinSetupModal
          title="Définir un code PIN"
          description="Utilisez le même pavé que lors du choix de profil. Le PIN est demandé à chaque changement de compte."
          confirmLabel="Enregistrer le PIN"
          allowSkip={false}
          onConfirm={(pin) => void definePin(pin)}
          onSkip={() => setPinModalOpen(false)}
          onCancel={() => setPinModalOpen(false)}
        />
      )}

      <div className="mx-auto w-full max-w-[1180px] space-y-7">
        <header className="flex flex-col gap-2">
          <p className="section-label">Préférences</p>
          <h1 className="page-title text-3xl">Paramètres</h1>
          <p className="page-subtitle">
            Personnalisez SimuBudget sans casser votre espace de simulation.
          </p>
        </header>

        <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
          {/* ── Colonne gauche ─────────────────────────────────────── */}
          <div className="space-y-6">
            <SettingsCard title="Apparence" icon="🎨">
              <SettingRow title="Thème" description="Choisissez le rendu clair, sombre, ou celui de Windows.">
                <Segmented value={themeMode} options={THEME_OPTIONS} onChange={setThemeMode} />
              </SettingRow>
              <SettingRow title="Taille du texte" description="Adaptez la lisibilité à votre écran.">
                <Segmented value={fontSize} options={FONT_OPTIONS} onChange={setFontSize} />
              </SettingRow>
              <SettingRow title="Langue" description="Langue de l'application en V1.">
                <span className="rounded-xl border px-4 py-2 text-sm font-bold"
                  style={{ borderColor: "var(--border)", background: "var(--bg-surface-2)", color: "var(--text-secondary)" }}>
                  Français
                </span>
              </SettingRow>
            </SettingsCard>

            <SettingsCard title="Application" icon="⚙️">
              <SettingRow title="Page de démarrage" description="Quelle page afficher à l'ouverture de l'app.">
                <Segmented value={startPage} options={START_OPTIONS} onChange={setStartPage} />
              </SettingRow>
              <SettingRow title="Notifications" description="Alertes budgétaires et rappels Windows.">
                <button
                  type="button"
                  onClick={() => setNotifications(!notifications)}
                  className={clsx("relative h-8 w-14 rounded-full transition", notifications ? "gradient-brand" : "")}
                  style={{ background: notifications ? undefined : "var(--bg-surface-2)" }}
                  aria-pressed={notifications}
                >
                  <span className={clsx("absolute top-1 h-6 w-6 rounded-full bg-white shadow transition",
                    notifications ? "left-7" : "left-1")} />
                </button>
              </SettingRow>
              <SettingRow title="Version" description="Build desktop Windows actuel.">
                <span className="font-mono text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                  SimuBudget v{APP_VERSION}
                </span>
              </SettingRow>
            </SettingsCard>

            {/* ── Mises à jour ───────────────────────────────────────── */}
            <SettingsCard title="Mises à jour" icon="🔄">
              <div className="px-5 py-4">
                <UpdatePanel />
              </div>
            </SettingsCard>
          </div>

          {/* ── Colonne droite ─────────────────────────────────────── */}
          <div className="space-y-6">
            <SettingsCard title="Profils" icon="👤">
              <SettingRow title="Profil actif" description="Profil actuellement chargé dans SimuBudget.">
                <div className="flex flex-wrap items-center gap-3">
                  {activeEntry ? (
                    <div className="flex min-w-[240px] items-center gap-3 rounded-2xl px-3 py-2"
                      style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-extrabold text-white"
                        style={{ background: activeEntry.avatarColor }}>
                        {activeEntry.avatarInitials}
                      </span>
                      <span className="min-w-0 text-left">
                        <span className="block truncate text-sm font-extrabold" style={{ color: "var(--text-primary)" }}>
                          {activeEntry.displayName}
                        </span>
                        <span className="block truncate text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                          Dernier usage : {formatProfileLastUsed(activeEntry.lastUsed)}
                        </span>
                      </span>
                    </div>
                  ) : (
                    <span className="rounded-xl px-3 py-2 text-sm font-extrabold"
                      style={{ color: "var(--text-primary)", background: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
                      Aucun profil actif
                    </span>
                  )}
                  <button type="button" className="btn-secondary" onClick={openProfileSelector}>Changer</button>
                </div>
              </SettingRow>
              <SettingRow title="Nouveau profil" description="Créez un espace indépendant pour une autre personne ou un autre foyer.">
                <button type="button" className="btn-secondary" onClick={createNewProfile}>Créer</button>
              </SettingRow>
              <SettingRow title="Renommer ce profil" description="Modifiez le nom affiché sur l'écran de sélection.">
                <button type="button" className="btn-secondary" onClick={renameActiveProfile} disabled={!activeEntry}>Renommer</button>
              </SettingRow>
              <SettingRow title="Code PIN" description="Protégez ce profil partagé par un PIN de 4 à 6 chiffres.">
                <div className="flex gap-2">
                  <button type="button" className="btn-secondary" onClick={() => setPinModalOpen(true)} disabled={!activeEntry}>
                    Définir / changer
                  </button>
                  {activeEntry?.pinHash !== null && activeEntry !== null && (
                    <button type="button" className="btn-ghost" onClick={removePin}>Retirer</button>
                  )}
                </div>
              </SettingRow>
              <SettingRow title="Supprimer ce profil" description="Efface uniquement le profil actif et ses données liées.">
                <button type="button"
                  className="rounded-xl px-4 py-2 text-sm font-extrabold transition hover:bg-red-50 dark:hover:bg-red-950/30"
                  style={{ color: "var(--fin-red)" }}
                  onClick={deleteActiveProfile} disabled={!activeEntry}>
                  Supprimer
                </button>
              </SettingRow>
            </SettingsCard>

            <SettingsCard title="Données" icon="💾">
              <SettingRow title="Exporter mon profil" description="Sauvegardez votre profil en JSON.">
                <button type="button" className="btn-secondary" onClick={exportProfile}>Exporter JSON</button>
              </SettingRow>
              <SettingRow title="Importer un profil" description="Restaurez un profil depuis un fichier JSON.">
                <input ref={inputRef} type="file" accept="application/json,.json" className="hidden"
                  onChange={(e) => { const f = e.currentTarget.files?.[0]; if (f) importProfile(f); e.currentTarget.value = ""; }} />
                <button type="button" className="btn-secondary" onClick={() => inputRef.current?.click()}>Importer JSON</button>
              </SettingRow>
              <SettingRow title="Emplacement SQLite" description="Base de données locale.">
                <span className="rounded-xl px-3 py-2 font-mono text-xs"
                  style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                  %APPDATA%\simubudget\data.db
                </span>
              </SettingRow>
              <button type="button"
                className="rounded-xl px-4 py-3 text-left text-sm font-extrabold transition hover:bg-red-50 dark:hover:bg-red-950/30"
                style={{ color: "var(--fin-red)" }} onClick={clearData}>
                Effacer toutes les données…
              </button>
            </SettingsCard>

            <SettingsCard title="À propos" icon="ℹ️">
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <img src={logoFull} alt="SimuBudget" className="h-24 w-auto object-contain" />
                <div>
                  <p className="font-display text-xl font-extrabold gradient-brand-text">
                    Vois ta vie financière avant de la vivre.
                  </p>
                  <p className="mt-2 text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
                    SimuBudget v{APP_VERSION} · by Baithz
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                    Application locale Windows — données stockées sur votre machine.
                  </p>
                </div>
              </div>
            </SettingsCard>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Composants utilitaires ───────────────────────────────────────────────────
function SettingsCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <section className="card overflow-hidden">
      <header className="flex items-center gap-3 px-5 py-4"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-surface-2)" }}>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ background: "rgba(6,214,160,.12)" }}>{icon}</span>
        <h2 className="font-display text-lg font-extrabold tracking-[-0.03em]"
          style={{ color: "var(--text-primary)" }}>{title}</h2>
      </header>
      <div className="divide-y" style={{ borderColor: "var(--border)" }}>{children}</div>
    </section>
  );
}

function SettingRow({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-extrabold" style={{ color: "var(--text-primary)" }}>{title}</p>
        <p className="mt-1 text-sm font-medium" style={{ color: "var(--text-muted)" }}>{description}</p>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: Option<T>[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-2xl p-1"
      style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
      {options.map((o) => (
        <button key={o.value} type="button" title={o.hint} onClick={() => onChange(o.value)}
          className={clsx("rounded-xl px-4 py-2 text-sm font-extrabold transition",
            value === o.value ? "shadow" : "hover:opacity-80")}
          style={{ background: value === o.value ? "var(--bg-surface)" : "transparent",
            color: value === o.value ? "var(--text-primary)" : "var(--text-muted)" }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default SettingsPage;
