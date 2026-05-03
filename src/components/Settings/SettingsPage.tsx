// =============================================================================
// Fichier  : src/components/Settings/SettingsPage.tsx
// Auteur   : KREMER Régis
// Desc.    : Page Paramètres premium : apparence, profils, données, mises à jour
//            et actions sensibles sécurisées par confirmation explicite.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-29 | KREMER Régis | Création Phase 8 — paramètres complets et version 1.8
//   2026-05-01 | KREMER Régis | Phase 12B — gestion profils, PIN et nettoyage multi-profils
//   2026-05-01 | KREMER Régis | Correction Phase 12B — déclaration du profil actif dans SettingsPage
//   2026-05-01 | KREMER Régis | Phase 12B.1 — accès sélection et création profil depuis paramètres
//   2026-05-01 | KREMER Régis | Phase 12B.2 — aperçu premium profil actif et initiales propres
//   2026-05-01 | KREMER Régis | ZIP 7.1 — édition PIN avec pavé premium
//   2026-05-01 | KREMER Régis | Phase 13 — section Mises à jour avec check manuel et barre de progression
//   2026-05-03 | KREMER Régis | Refonte UX Paramètres — confirmation destructive et notifications utilisateur
// =============================================================================

import { useEffect, useRef, useState } from "react";
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
const APP_VERSION = "2.5.0";
const PROFILE_SESSION_KEY = "simubudget-profile-session-active";
const RESET_DONE_SESSION_KEY = "simubudget-settings-reset-done";
const RESET_CONFIRM_TEXT = "EFFACER";

interface Option<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

interface SettingsToastState {
  type: "success" | "info" | "danger";
  title: string;
  detail?: string;
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
    <div className="space-y-4">
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

          {status === "available" && (
            <button type="button" className="btn-ghost" onClick={dismiss}>
              Plus tard
            </button>
          )}
        </div>
      </div>

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
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [toast, setToast] = useState<SettingsToastState | null>(null);

  const showToast = (nextToast: SettingsToastState) => setToast(nextToast);

  useEffect(() => {
    if (sessionStorage.getItem(RESET_DONE_SESSION_KEY) === "1") {
      sessionStorage.removeItem(RESET_DONE_SESSION_KEY);
      showToast({
        type:  "success",
        title: "Données réinitialisées",
        detail: "L'espace local SimuBudget a été remis à zéro.",
      });
    }
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const exportProfile = () => {
    const payload = JSON.stringify(
      { version: APP_VERSION, exportedAt: new Date().toISOString(), profile },
      null,
      2
    );
    const blob = new Blob([payload], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `simubudget-profil-v${APP_VERSION}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast({ type: "success", title: "Export lancé", detail: "Le profil JSON a été généré." });
  };

  const importProfile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as { profile?: unknown };
        if (parsed.profile && typeof parsed.profile === "object") {
          setProfile(parsed.profile as Parameters<typeof setProfile>[0]);
          showToast({ type: "success", title: "Profil importé", detail: "Les données du profil ont été restaurées." });
        } else {
          showToast({ type: "danger", title: "Import impossible", detail: "Le fichier ne contient pas de profil SimuBudget valide." });
        }
      } catch {
        showToast({ type: "danger", title: "Import impossible", detail: "Le fichier JSON sélectionné n'est pas lisible." });
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
    showToast({ type: "success", title: "Profil renommé", detail: `Nouveau nom : ${next}.` });
  };

  const definePin = async (pin: string) => {
    if (!activeEntry) return;
    updateProfileEntry(activeEntry.id, { pinHash: await hashProfilePin(pin) });
    setPinModalOpen(false);
    showToast({ type: "success", title: "PIN enregistré", detail: "Le profil est maintenant protégé." });
  };

  const removePin = () => {
    if (!activeEntry || !window.confirm("Supprimer le PIN de ce profil ?")) return;
    updateProfileEntry(activeEntry.id, { pinHash: null });
    showToast({ type: "success", title: "PIN retiré", detail: "Le profil n'est plus protégé par un code." });
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
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("simubudget-")) localStorage.removeItem(key);
    }
    sessionStorage.setItem(RESET_DONE_SESSION_KEY, "1");
    window.location.reload();
  };

  return (
    <div className="page-shell">
      <AnimatePresence>
        {toast && <SettingsToast toast={toast} onClose={() => setToast(null)} />}
      </AnimatePresence>

      <AnimatePresence>
        {resetModalOpen && (
          <ResetDataModal
            onCancel={() => setResetModalOpen(false)}
            onConfirm={() => {
              setResetModalOpen(false);
              clearData();
            }}
          />
        )}
      </AnimatePresence>

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

      <div className="mx-auto w-full max-w-[1320px] space-y-7">
        <SettingsHero
          activeName={activeEntry?.displayName ?? "Aucun profil actif"}
          hasPin={Boolean(activeEntry?.pinHash)}
          notifications={notifications}
          version={APP_VERSION}
        />

        <div className="grid gap-6 xl:grid-cols-[1fr_0.92fr]">
          <div className="space-y-6">
            <SettingsCard title="Apparence" icon="🎨" subtitle="Lisibilité, thème et confort visuel.">
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

            <SettingsCard title="Application" icon="⚙️" subtitle="Comportement général et version installée.">
              <SettingRow title="Page de démarrage" description="Quelle page afficher à l'ouverture de l'app.">
                <Segmented value={startPage} options={START_OPTIONS} onChange={setStartPage} />
              </SettingRow>
              <SettingRow title="Notifications" description="Alertes budgétaires et rappels Windows.">
                <button
                  type="button"
                  onClick={() => {
                    setNotifications(!notifications);
                    showToast({
                      type:  "info",
                      title: !notifications ? "Notifications activées" : "Notifications désactivées",
                    });
                  }}
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

            <SettingsCard title="Mises à jour" icon="🔄" subtitle="Contrôle manuel et auto-update Tauri.">
              <div className="px-5 py-4">
                <UpdatePanel />
              </div>
            </SettingsCard>
          </div>

          <div className="space-y-6">
            <SettingsCard title="Profils" icon="👤" subtitle="Espaces indépendants et protection locale.">
              <SettingRow title="Profil actif" description="Profil actuellement chargé dans SimuBudget.">
                <div className="flex flex-wrap items-center justify-end gap-3">
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

            <SettingsCard title="Données" icon="💾" subtitle="Sauvegarde, restauration et zone sensible.">
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
              <div className="px-5 py-4">
                <DangerZone onClearData={() => setResetModalOpen(true)} />
              </div>
            </SettingsCard>

            <SettingsCard title="À propos" icon="ℹ️" subtitle="Version, identité et confidentialité locale.">
              <div className="flex flex-col items-center gap-4 py-6 text-center">
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

// ─── Composants UX Paramètres ────────────────────────────────────────────────
function SettingsHero({
  activeName,
  hasPin,
  notifications,
  version,
}: {
  activeName: string;
  hasPin: boolean;
  notifications: boolean;
  version: string;
}) {
  return (
    <section
      className="relative overflow-hidden rounded-[32px] p-6 shadow-card lg:p-7"
      style={{
        background: "linear-gradient(135deg, color-mix(in srgb, var(--brand-1) 12%, var(--bg-surface)), var(--bg-surface))",
        border: "1px solid var(--border-brand)",
      }}
    >
      <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-30 blur-3xl gradient-brand" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="section-label">Préférences</p>
          <h1 className="page-title mt-2 text-4xl">Paramètres</h1>
          <p className="page-subtitle mt-2 max-w-xl">
            Personnalisez SimuBudget, gérez vos profils et sécurisez vos données locales sans perturber vos simulations.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[520px]">
          <MiniStatusCard label="Profil" value={activeName} tone="brand" />
          <MiniStatusCard label="Protection" value={hasPin ? "PIN actif" : "Sans PIN"} tone={hasPin ? "success" : "muted"} />
          <MiniStatusCard label="Version" value={`v${version}`} tone={notifications ? "brand" : "muted"} />
        </div>
      </div>
    </section>
  );
}

function MiniStatusCard({ label, value, tone }: { label: string; value: string; tone: "brand" | "success" | "muted" }) {
  const color = tone === "success" ? "var(--fin-green)" : tone === "brand" ? "var(--brand-2)" : "var(--text-muted)";
  return (
    <div
      className="min-w-0 rounded-2xl px-4 py-3"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
    >
      <p className="text-[10px] font-extrabold uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-extrabold" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function DangerZone({ onClearData }: { onClearData: () => void }) {
  return (
    <div
      className="rounded-3xl p-4"
      style={{
        background: "linear-gradient(135deg, color-mix(in srgb, var(--fin-red) 8%, var(--bg-surface)), var(--bg-surface))",
        border: "1px solid var(--fin-red-border)",
      }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-extrabold" style={{ color: "var(--fin-red)" }}>
            Zone sensible
          </p>
          <p className="mt-1 text-sm font-medium leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Réinitialise les données locales SimuBudget. Une confirmation explicite sera demandée avant exécution.
          </p>
        </div>
        <button
          type="button"
          className="rounded-2xl px-4 py-3 text-sm font-extrabold transition hover:scale-[1.01] active:scale-[0.99]"
          style={{
            color: "white",
            background: "var(--fin-red)",
            boxShadow: "0 18px 40px color-mix(in srgb, var(--fin-red) 24%, transparent)",
          }}
          onClick={onClearData}
        >
          Réinitialiser les données
        </button>
      </div>
    </div>
  );
}

function ResetDataModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const [confirmText, setConfirmText] = useState("");
  const canConfirm = confirmText.trim().toUpperCase() === RESET_CONFIRM_TEXT;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <motion.div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ background: "rgba(15, 23, 42, 0.42)", backdropFilter: "blur(10px)" }}
      onMouseDown={onCancel}
    >
      <motion.div
        className="w-full max-w-[560px] overflow-hidden rounded-[28px] shadow-2xl"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
        style={{ background: "var(--bg-surface)", border: "1px solid var(--fin-red-border)" }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="p-6 sm:p-7">
          <div className="flex items-start gap-4">
            <span
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-xl"
              style={{ background: "var(--fin-red-bg)", color: "var(--fin-red)" }}
            >
              ⚠️
            </span>
            <div className="min-w-0">
              <p className="section-label" style={{ color: "var(--fin-red)" }}>
                Action irréversible
              </p>
              <h2 className="mt-1 font-display text-2xl font-extrabold tracking-[-0.04em]" style={{ color: "var(--text-primary)" }}>
                Réinitialiser les données SimuBudget ?
              </h2>
              <p className="mt-3 text-sm font-medium leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                Cette action efface les profils, simulations, comptes, imports bancaires, rapprochements et préférences stockés localement.
              </p>
            </div>
          </div>

          <div
            className="mt-5 rounded-2xl p-4 text-sm font-medium"
            style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          >
            Pour confirmer, tapez <span className="font-mono font-extrabold" style={{ color: "var(--fin-red)" }}>{RESET_CONFIRM_TEXT}</span> ci-dessous.
          </div>

          <input
            autoFocus
            value={confirmText}
            onChange={(event) => setConfirmText(event.currentTarget.value)}
            placeholder={RESET_CONFIRM_TEXT}
            className="mt-4 w-full rounded-2xl px-4 py-3 font-mono text-sm font-extrabold outline-none"
            style={{
              background: "var(--bg-surface-2)",
              border: `1px solid ${canConfirm ? "var(--fin-red-border)" : "var(--border)"}`,
              color: "var(--text-primary)",
            }}
          />

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" className="btn-secondary" onClick={onCancel}>
              Annuler
            </button>
            <button
              type="button"
              disabled={!canConfirm}
              className="rounded-xl px-5 py-2.5 text-sm font-extrabold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: "var(--fin-red)" }}
              onClick={onConfirm}
            >
              Effacer définitivement
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function SettingsToast({ toast, onClose }: { toast: SettingsToastState; onClose: () => void }) {
  const color = toast.type === "danger" ? "var(--fin-red)" : toast.type === "success" ? "var(--fin-green)" : "var(--brand-2)";
  const bg = toast.type === "danger" ? "var(--fin-red-bg)" : "var(--bg-surface)";

  return (
    <motion.div
      className="fixed right-6 top-6 z-[90] w-[min(420px,calc(100vw-3rem))] rounded-3xl p-4 shadow-2xl"
      initial={{ opacity: 0, x: 28, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 28, scale: 0.98 }}
      style={{ background: bg, border: `1px solid ${color}` }}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold" style={{ color: "var(--text-primary)" }}>
            {toast.title}
          </p>
          {toast.detail && (
            <p className="mt-1 text-sm font-medium leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {toast.detail}
            </p>
          )}
        </div>
        <button type="button" className="btn-ghost px-2 py-1" onClick={onClose} aria-label="Fermer la notification">
          ×
        </button>
      </div>
    </motion.div>
  );
}

// ─── Composants utilitaires ───────────────────────────────────────────────────
function SettingsCard({ title, icon, subtitle, children }: { title: string; icon: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="card overflow-hidden">
      <header className="flex items-center gap-3 px-5 py-4"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-surface-2)" }}>
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl"
          style={{ background: "rgba(6,214,160,.12)" }}>{icon}</span>
        <span className="min-w-0">
          <h2 className="font-display text-lg font-extrabold tracking-[-0.03em]"
            style={{ color: "var(--text-primary)" }}>{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs font-bold" style={{ color: "var(--text-muted)" }}>{subtitle}</p>}
        </span>
      </header>
      <div className="divide-y" style={{ borderColor: "var(--border)" }}>{children}</div>
    </section>
  );
}

function SettingRow({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 pr-2">
        <p className="font-extrabold" style={{ color: "var(--text-primary)" }}>{title}</p>
        <p className="mt-1 text-sm font-medium leading-relaxed" style={{ color: "var(--text-muted)" }}>{description}</p>
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
