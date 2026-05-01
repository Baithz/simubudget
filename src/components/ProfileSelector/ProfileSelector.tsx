// =============================================================================
// Fichier  : src/components/ProfileSelector/ProfileSelector.tsx
// Auteur   : KREMER Régis
// Desc.    : Écran de sélection des profils SimuBudget avec création et PIN.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-05-01 | KREMER Régis | Création Phase 12B — sélection profils style cartes
//   2026-05-01 | KREMER Régis | Phase 12B.1 — sélection explicite même avec un seul profil
//   2026-05-01 | KREMER Régis | Phase 12B.2 — UX premium profils, animation et dernier usage
//   2026-05-01 | KREMER Régis | Phase 12B.3 — logo, baseline et animation ouverture non chevauchante
//   2026-05-01 | KREMER Régis | ZIP 7 — simplification hero sans répétition baseline
//   2026-05-01 | KREMER Régis | ZIP 7.1 — PIN requis à chaque sélection et badge foyer
//   2026-05-01 | KREMER Régis | ZIP 7.3 — affichage complet des profils couple
// =============================================================================

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import type { ProfileEntry, UserProfile } from "@/types/profile";
import {
  formatProfileLastUsed,
  useProfileListStore,
} from "@/store/profileListStore";
import { useProfileStore } from "@/store/profileStore";
import { useAccountingStore } from "@/store/accountingStore";
import { useScenarioStore } from "@/store/scenarioStore";
import { usePurchaseStore } from "@/store/purchaseStore";
import PinPad from "./PinPad";
import logoFull from "@/assets/logo-full.png";

const PROFILE_SESSION_KEY = "simubudget-profile-session-active";

interface PersistedProfileState {
  profile?: UserProfile | null;
}

interface PersistedProfileWrapper {
  state?: PersistedProfileState;
}

function fullNameOf(firstName: string | undefined, lastName: string | undefined): string {
  const first = (firstName ?? "").trim();
  const last = (lastName ?? "").trim();
  return `${first} ${last}`.trim() || first || last || "";
}

function readScopedUserProfile(profileId: string): UserProfile | null {
  const raw = localStorage.getItem(`simubudget-profile-${profileId}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PersistedProfileWrapper;
    return parsed.state?.profile ?? null;
  } catch {
    return null;
  }
}

function profileCardDisplayName(entry: ProfileEntry): string {
  const profile = readScopedUserProfile(entry.id);
  if (!profile) return entry.displayName;
  const holderName = fullNameOf(profile.holder?.firstName, profile.holder?.lastName);
  const partnerName = profile.partner ? fullNameOf(profile.partner.firstName, profile.partner.lastName) : "";
  if (profile.situation === "couple" && holderName && partnerName) {
    return `${holderName} & ${partnerName}`;
  }
  return holderName || entry.displayName;
}

function refreshScopedStores(): void {
  void useProfileStore.persist.rehydrate();
  void useAccountingStore.persist.rehydrate();
  void useScenarioStore.persist.rehydrate();
  void usePurchaseStore.persist.rehydrate();
}

export function ProfileSelector() {
  const navigate = useNavigate();
  const profiles = useProfileListStore((state) => state.profiles);
  const activeProfileId = useProfileListStore((state) => state.activeProfileId);
  const setActive = useProfileListStore((state) => state.setActive);
  const clearActive = useProfileListStore((state) => state.clearActive);
  const unlock = useProfileListStore((state) => state.unlock);
  const getLockSeconds = useProfileListStore((state) => state.getLockSeconds);
  const [pinProfile, setPinProfile] = useState<ProfileEntry | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (profiles.length === 0) {
      sessionStorage.removeItem(PROFILE_SESSION_KEY);
      clearActive();
      navigate("/onboarding", { replace: true });
    }
  }, [clearActive, navigate, profiles.length]);

  async function selectProfile(profile: ProfileEntry) {
    if (selectedProfileId !== null) return;
    if (profile.pinHash !== null) {
      setPinProfile(profile);
      return;
    }
    setSelectedProfileId(profile.id);
    window.setTimeout(() => {
      setActive(profile.id);
      sessionStorage.setItem(PROFILE_SESSION_KEY, profile.id);
      refreshScopedStores();
      navigate("/", { replace: true });
    }, 180);
  }

  async function submitPin(pin: string): Promise<boolean> {
    if (!pinProfile) return false;
    const ok = await unlock(pinProfile.id, pin);
    if (ok) {
      setSelectedProfileId(pinProfile.id);
      window.setTimeout(() => {
        setActive(pinProfile.id);
        sessionStorage.setItem(PROFILE_SESSION_KEY, pinProfile.id);
        refreshScopedStores();
        navigate("/", { replace: true });
      }, 180);
    }
    return ok;
  }

  function createProfile() {
    sessionStorage.removeItem(PROFILE_SESSION_KEY);
    clearActive();
    refreshScopedStores();
    navigate("/onboarding");
  }

  if (pinProfile) {
    return (
      <div className="min-h-screen px-4 py-10" style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>
        <PinPad
          profile={pinProfile}
          lockSeconds={getLockSeconds(pinProfile.id) + tick * 0}
          onSubmit={submitPin}
          onCancel={() => setPinProfile(null)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-hidden px-4 py-10" style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>
      <div className="pointer-events-none fixed inset-0 opacity-70" aria-hidden="true">
        <div className="absolute left-[12%] top-[8%] h-64 w-64 rounded-full blur-3xl" style={{ background: "var(--brand-soft)" }} />
        <div className="absolute bottom-[8%] right-[10%] h-72 w-72 rounded-full blur-3xl" style={{ background: "var(--fin-green-bg)" }} />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl flex-col justify-center">
        <motion.header
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="mb-9 text-center"
        >
          <div className="mx-auto mb-5 flex w-full max-w-[300px] flex-col items-center">
            <img src={logoFull} alt="SimuBudget" className="h-auto w-[185px] object-contain md:w-[230px]" />
          </div>
          <h1 className="font-display text-4xl font-extrabold tracking-[-0.06em] text-ink-primary md:text-5xl">Choisissez votre profil</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm font-semibold text-ink-muted">
            Chaque espace garde ses comptes, scénarios, simulations et paramètres de pilotage.
          </p>
        </motion.header>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.065 } }, hidden: {} }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {profiles.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              isActive={profile.id === activeProfileId}
              isSelected={profile.id === selectedProfileId}
              disabled={selectedProfileId !== null}
              onClick={() => void selectProfile(profile)}
            />
          ))}
          <motion.button
            type="button"
            variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
            whileHover={{ y: -4, scale: 1.012 }}
            whileTap={{ scale: 0.985 }}
            onClick={createProfile}
            className="group flex min-h-[232px] flex-col items-center justify-center rounded-[32px] p-6 text-center transition focus:outline-none focus:ring-4 focus:ring-[var(--brand-soft)]"
            style={{ background: "var(--bg-surface)", border: "1px dashed var(--border-brand)", boxShadow: "var(--shadow-soft)" }}
          >
            <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-[24px] text-3xl font-extrabold transition group-hover:scale-105" style={{ background: "var(--brand-soft)", color: "var(--brand-1)" }}>+</span>
            <span className="font-display text-lg font-extrabold text-ink-primary">Nouveau profil</span>
            <span className="mt-2 max-w-[220px] text-sm font-semibold text-ink-muted">Créer un espace indépendant pour une autre personne ou un autre foyer.</span>
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}

interface ProfileCardProps {
  profile: ProfileEntry;
  isActive: boolean;
  isSelected: boolean;
  disabled: boolean;
  onClick: () => void;
}

function ProfileCard({ profile, isActive, isSelected, disabled, onClick }: ProfileCardProps) {
  const locked = profile.pinHash !== null;
  const cardDisplayName = profileCardDisplayName(profile);
  const kindLabel = profile.profileKind === "couple" ? "Couple" : profile.profileKind === "cohabiting" ? "Colocation" : profile.profileKind === "separated" ? "Séparé" : "Solo";
  const animationProps = disabled
    ? {}
    : {
        whileHover: { y: -4, scale: 1.012 },
        whileTap: { scale: 0.985 },
      };

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
      {...animationProps}
      className="group relative flex min-h-[232px] flex-col items-center justify-center overflow-hidden rounded-[32px] p-6 text-center transition focus:outline-none focus:ring-4 focus:ring-[var(--brand-soft)] disabled:cursor-wait disabled:opacity-80"
      style={{ background: "var(--bg-surface)", border: isActive ? "1px solid var(--border-brand)" : "1px solid var(--border)", boxShadow: isActive ? "var(--shadow-glow)" : "var(--shadow-soft)" }}
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-1" style={{ background: isActive ? "var(--gradient-brand)" : "transparent" }} />
      <span className="absolute right-4 top-4 rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em]" style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
        {locked ? "PIN" : "Libre"}
      </span>

      <span className="relative mb-4 flex h-20 w-20 items-center justify-center rounded-[30px] text-2xl font-extrabold text-white shadow-lg transition group-hover:scale-105" style={{ background: profile.avatarColor }}>
        {profile.avatarInitials}
        <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full" style={{ background: isActive ? "var(--fin-green)" : "var(--bg-surface-3)", border: "3px solid var(--bg-surface)" }} />
      </span>

      <span className="font-display text-xl font-extrabold text-ink-primary">{cardDisplayName}</span>
      <span className="mt-2 text-sm font-semibold text-ink-muted">Dernier usage : {formatProfileLastUsed(profile.lastUsed)}</span>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {isActive && <Badge label="Actif" tone="brand" />}
        <Badge label={kindLabel} tone="muted" />
        {locked && <Badge label="Protégé" tone="muted" />}
      </div>

      <AnimatePresence>
        {isSelected && (
          <motion.span
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="mt-4 inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-extrabold"
            style={{ background: "var(--brand-soft)", color: "var(--brand-1)", border: "1px solid var(--border-brand)" }}
          >
            <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: "var(--brand-1)" }} />
            Ouverture du profil…
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

function Badge({ label, tone }: { label: string; tone: "brand" | "muted" }) {
  return (
    <span
      className="rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em]"
      style={{
        background: tone === "brand" ? "var(--brand-soft)" : "var(--bg-surface-2)",
        border: tone === "brand" ? "1px solid var(--border-brand)" : "1px solid var(--border)",
        color: tone === "brand" ? "var(--brand-1)" : "var(--text-muted)",
      }}
    >
      {label}
    </span>
  );
}

export default ProfileSelector;
