// =============================================================================
// Fichier  : src/store/profileListStore.ts
// Auteur   : KREMER Régis
// Desc.    : Store Zustand des profils SimuBudget, sélection active et verrouillage PIN.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-05-01 | KREMER Régis | Création Phase 12B — multi-profils + PIN + migration localStorage
//   2026-05-01 | KREMER Régis | Phase 12B.2 — helpers UX profils, initiales et dernier usage
//   2026-05-01 | KREMER Régis | ZIP 7.1 — verrouillage PIN session et type de foyer
//   2026-05-01 | KREMER Régis | ZIP 7.2 — libellés couple et initiales foyer
//   2026-05-01 | KREMER Régis | ZIP 7.3 — libellés complets titulaire + partenaire
//   2026-05-02 | KREMER Régis | Correction Phase 14.1 — suppression profils et arrêt du profil exemple automatique
// =============================================================================

import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import type { ProfileEntry, UserProfile } from "@/types/profile";

export const DEFAULT_PROFILE_ID = "default";
const PROFILE_LIST_KEY = "simubudget-profile-list";
const LEGACY_KEYS = [
  "simubudget-profile",
  "simubudget-accounting",
  "simubudget-scenarios",
  "simubudget-purchase",
] as const;

const AVATAR_COLORS = [
  "#06d6a0",
  "#118ab2",
  "#ffd166",
  "#ef476f",
  "#8b5cf6",
  "#f97316",
] as const;

interface ProfileListPersistedState {
  profiles?: ProfileEntry[];
  activeProfileId?: string | null;
}

interface ProfileListPersistedWrapper {
  state?: ProfileListPersistedState;
}

interface RuntimeSecurityState {
  unlockedIds: string[];
  failedAttempts: Record<string, number>;
  lockedUntil: Record<string, number>;
}

interface AddProfileInput {
  displayName: string;
  avatarColor?: string;
  avatarInitials?: string;
  pinHash?: string | null;
  id?: string;
  profileKind?: ProfileEntry["profileKind"];
}

interface ProfileListStore extends RuntimeSecurityState {
  profiles: ProfileEntry[];
  activeProfileId: string | null;

  addProfile:    (entry: AddProfileInput) => string;
  removeProfile: (id: string) => void;
  updateEntry:   (id: string, patch: Partial<ProfileEntry>) => void;
  setActive:     (id: string) => void;
  clearActive:   () => void;
  isUnlocked:    (id: string) => boolean;
  unlock:        (id: string, pin: string) => Promise<boolean>;
  lock:          (id: string) => void;
  getLockSeconds:(id: string) => number;
  ensureProfileEntry: (profile: UserProfile) => string;
}

export function getActiveProfileId(): string {
  const raw = localStorage.getItem(PROFILE_LIST_KEY);
  if (!raw) return DEFAULT_PROFILE_ID;
  try {
    const parsed = JSON.parse(raw) as ProfileListPersistedWrapper;
    return parsed.state?.activeProfileId ?? DEFAULT_PROFILE_ID;
  } catch {
    return DEFAULT_PROFILE_ID;
  }
}

export function profileScopedKey(baseKey: string, profileId = getActiveProfileId()): string {
  return `${baseKey}-${profileId}`;
}

export function profileScopedStorage(): StateStorage {
  return {
    getItem: (name) => localStorage.getItem(profileScopedKey(name)),
    setItem: (name, value) => localStorage.setItem(profileScopedKey(name), value),
    removeItem: (name) => localStorage.removeItem(profileScopedKey(name)),
  };
}

export function migrateLegacyScopedKeys(profileId = DEFAULT_PROFILE_ID): void {
  for (const key of LEGACY_KEYS) {
    const legacyValue = localStorage.getItem(key);
    const scopedKey = `${key}-${profileId}`;
    if (legacyValue !== null && localStorage.getItem(scopedKey) === null) {
      localStorage.setItem(scopedKey, legacyValue);
    }
  }
}

function fullNameOf(firstName: string | undefined, lastName: string | undefined): string {
  const first = (firstName ?? "").trim();
  const last = (lastName ?? "").trim();
  return `${first} ${last}`.trim() || first || last || "";
}

function parseProfileName(profile: UserProfile | null): string {
  if (!profile) return "Profil principal";
  const holderName = fullNameOf(profile.holder?.firstName, profile.holder?.lastName);
  const partnerName = profile.partner ? fullNameOf(profile.partner.firstName, profile.partner.lastName) : "";
  if (profile.situation === "couple" && holderName && partnerName) {
    return `${holderName} & ${partnerName}`;
  }
  return holderName || profile.city || "Profil principal";
}

export function profileInitialsFromName(name: string): string {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .trim();
  const parts = cleaned.split(/[\s-]+/).filter(Boolean);
  if (parts.length === 0) return "P";
  const first = parts[0]?.slice(0, 1) ?? "P";
  const second = parts.length > 1 ? parts[1]?.slice(0, 1) ?? "" : "";
  return `${first}${second}`.toUpperCase();
}

export function formatProfileLastUsed(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Dernière utilisation inconnue";

  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60_000);
  const diffHours = Math.round(diffMs / 3_600_000);
  const diffDays = Math.round(diffMs / 86_400_000);
  const formatter = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });

  if (Math.abs(diffMinutes) < 60) return formatter.format(diffMinutes, "minute");
  if (Math.abs(diffHours) < 24) return formatter.format(diffHours, "hour");
  if (Math.abs(diffDays) < 31) return formatter.format(diffDays, "day");

  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function randomColor(seed: string): string {
  const total = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return AVATAR_COLORS[total % AVATAR_COLORS.length] ?? AVATAR_COLORS[0];
}


function isTemplateProfile(profile: UserProfile | null): boolean {
  if (!profile) return false;
  const hasName = Boolean(`${profile.holder?.firstName ?? ""}${profile.holder?.lastName ?? ""}`.trim());
  return !hasName
    && profile.city === "Lyon"
    && profile.department === "69"
    && profile.salaryNet === 1800
    && profile.currentHousing.rent === 650;
}

function readLegacyProfile(): UserProfile | null {
  const raw = localStorage.getItem("simubudget-profile");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { state?: { profile?: UserProfile } };
    return parsed.state?.profile ?? null;
  } catch {
    return null;
  }
}

function buildDefaultEntry(): ProfileEntry | null {
  const legacyProfile = readLegacyProfile();
  if (!legacyProfile || isTemplateProfile(legacyProfile)) return null;
  const displayName = parseProfileName(legacyProfile);
  return {
    id: DEFAULT_PROFILE_ID,
    displayName,
    avatarColor: randomColor(displayName),
    avatarInitials: profileInitialsFromName(displayName),
    pinHash: null,
    profileKind: legacyProfile.situation,
    lastUsed: new Date().toISOString(),
    createdAt: legacyProfile.createdAt || new Date().toISOString(),
  };
}

async function hashPin(pin: string): Promise<string> {
  const buffer = new TextEncoder().encode(pin);
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function sanitizePin(pin: string): string {
  return pin.replace(/\D/g, "").slice(0, 6);
}

function makeEntry(input: AddProfileInput): ProfileEntry {
  const now = new Date().toISOString();
  const displayName = input.displayName.trim() || "Nouveau profil";
  const entry: ProfileEntry = {
    id: input.id ?? crypto.randomUUID(),
    displayName,
    avatarColor: input.avatarColor ?? randomColor(displayName),
    avatarInitials: input.avatarInitials ?? profileInitialsFromName(displayName),
    pinHash: input.pinHash ?? null,
    createdAt: now,
    lastUsed: now,
  };
  if (input.profileKind !== undefined) {
    entry.profileKind = input.profileKind;
  }
  return entry;
}

export const useProfileListStore = create<ProfileListStore>()(
  persist(
    (set, get) => ({
      profiles: [],
      activeProfileId: null,
      unlockedIds: [],
      failedAttempts: {},
      lockedUntil: {},

      addProfile: (entry) => {
        const profile = makeEntry(entry);
        set((state) => ({ profiles: [...state.profiles, profile] }));
        return profile.id;
      },

      removeProfile: (id) =>
        set((state) => {
          const profiles = state.profiles.filter((profile) => profile.id !== id);
          const activeProfileId = state.activeProfileId === id ? profiles[0]?.id ?? null : state.activeProfileId;
          localStorage.removeItem(profileScopedKey("simubudget-profile", id));
          localStorage.removeItem(profileScopedKey("simubudget-accounting", id));
          localStorage.removeItem(profileScopedKey("simubudget-scenarios", id));
          localStorage.removeItem(profileScopedKey("simubudget-purchase", id));
          return { profiles, activeProfileId, unlockedIds: state.unlockedIds.filter((item) => item !== id) };
        }),

      updateEntry: (id, patch) =>
        set((state) => ({
          profiles: state.profiles.map((profile) => profile.id === id ? { ...profile, ...patch } : profile),
        })),

      setActive: (id) => {
        const now = new Date().toISOString();
        set((state) => ({
          activeProfileId: id,
          profiles: state.profiles.map((profile) => profile.id === id ? { ...profile, lastUsed: now } : profile),
        }));
      },

      clearActive: () => set({ activeProfileId: null }),

      isUnlocked: (id) => {
        const entry = get().profiles.find((profile) => profile.id === id);
        if (!entry) return false;
        return entry.pinHash === null || get().unlockedIds.includes(id);
      },

      unlock: async (id, pin) => {
        const entry = get().profiles.find((profile) => profile.id === id);
        if (!entry) return false;
        if (entry.pinHash === null) return true;
        const lockSeconds = get().getLockSeconds(id);
        if (lockSeconds > 0) return false;
        const cleanPin = sanitizePin(pin);
        if (cleanPin.length < 4) return false;
        const candidate = await hashPin(cleanPin);
        if (candidate === entry.pinHash) {
          set((state) => ({
            unlockedIds: state.unlockedIds.includes(id) ? state.unlockedIds : [...state.unlockedIds, id],
            failedAttempts: { ...state.failedAttempts, [id]: 0 },
            lockedUntil: { ...state.lockedUntil, [id]: 0 },
          }));
          return true;
        }
        const nextAttempts = (get().failedAttempts[id] ?? 0) + 1;
        const nextLockedUntil = nextAttempts >= 3 ? Date.now() + 30_000 : 0;
        set((state) => ({
          failedAttempts: { ...state.failedAttempts, [id]: nextAttempts >= 3 ? 0 : nextAttempts },
          lockedUntil: { ...state.lockedUntil, [id]: nextLockedUntil },
        }));
        return false;
      },

      lock: (id) => set((state) => ({ unlockedIds: state.unlockedIds.filter((item) => item !== id) })),

      getLockSeconds: (id) => {
        const until = get().lockedUntil[id] ?? 0;
        if (until <= Date.now()) return 0;
        return Math.ceil((until - Date.now()) / 1000);
      },

      ensureProfileEntry: (profile) => {
        const existing = get().profiles.find((entry) => entry.id === profile.id);
        const displayName = parseProfileName(profile);
        if (existing) {
          get().updateEntry(existing.id, {
            displayName,
            avatarInitials: profileInitialsFromName(displayName),
            profileKind: profile.situation,
          });
          return existing.id;
        }
        return get().addProfile({ id: profile.id, displayName, avatarInitials: profileInitialsFromName(displayName), profileKind: profile.situation });
      },
    }),
    {
      name: PROFILE_LIST_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ profiles: state.profiles, activeProfileId: state.activeProfileId }),
      onRehydrateStorage: () => (state) => {
        migrateLegacyScopedKeys(DEFAULT_PROFILE_ID);
        if (state && state.profiles.length === 0) {
          const defaultEntry = buildDefaultEntry();
          if (defaultEntry) {
            state.profiles = [defaultEntry];
            state.activeProfileId = defaultEntry.id;
          }
        }
      },
    }
  )
);

export async function hashProfilePin(pin: string): Promise<string> {
  return hashPin(sanitizePin(pin));
}
