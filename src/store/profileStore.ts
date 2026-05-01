// =============================================================================
// Fichier  : src/store/profileStore.ts
// Auteur   : KREMER Regis
// Desc.    : Store Zustand pour le profil utilisateur (persiste en localStorage)
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation du fichier
//   2026-04-27 | KREMER Regis | Phase 6 - savingsGoals CRUD, migration partnerSalaryNet
//   2026-04-28 | KREMER Regis | Correction TS strict - clearPartner sans undefined explicite
//   2026-04-29 | KREMER Regis | Phase 9.2 - migration identites personne A/B
//   2026-05-01 | KREMER Régis | Phase 12B — scope multi-profils du profil actif
// =============================================================================

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { UserProfile, SavingsGoal, PartnerProfile } from "@/types/profile";
import { DEFAULT_PROFILE } from "@/types/profile";
import { getActiveProfileId, profileScopedStorage } from "@/store/profileListStore";

function generateId(): string {
  return `profile_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

interface ProfileStore {
  profile:               UserProfile;
  hasCompletedOnboarding: boolean;

  // ── Profil global
  setProfile:         (p: UserProfile) => void;
  updateField:        <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => void;
  completeOnboarding: () => void;
  reset:              () => void;

  // ── Conjoint
  setPartner:   (p: PartnerProfile) => void;
  clearPartner: () => void;

  // ── Objectifs d'épargne
  addGoal:    (goal: Omit<SavingsGoal, "id">) => void;
  updateGoal: (id: string, patch: Partial<Omit<SavingsGoal, "id">>) => void;
  removeGoal: (id: string) => void;
}

const newProfile = (): UserProfile => ({
  ...DEFAULT_PROFILE,
  id:        generateId(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

/** Migration : si un profil ancien a partnerSalaryNet mais pas partner, on convertit */
function displayName(firstName: string, lastName: string, fallback: string): string {
  const full = `${firstName} ${lastName}`.trim();
  return full.length > 0 ? full : fallback;
}

function migrateProfile(profile: UserProfile): UserProfile {
  const holder = profile.holder ?? { firstName: "", lastName: "" };
  const base: UserProfile = { ...profile, holder, savingsGoals: profile.savingsGoals ?? [] };

  if (base.partnerSalaryNet && !base.partner) {
    return {
      ...base,
      partner: {
        name:           "Conjoint",
        firstName:      "",
        lastName:       "",
        salaryNet:      base.partnerSalaryNet,
        bonusAnnual:    0,
        employmentType: "cdi",
        otherIncome:    0,
      },
    };
  }

  if (base.partner) {
    const firstName = base.partner.firstName ?? "";
    const lastName = base.partner.lastName ?? "";
    const name = displayName(firstName, lastName, base.partner.name || "Conjoint");
    return {
      ...base,
      partner: {
        ...base.partner,
        firstName,
        lastName,
        name,
      },
      partnerSalaryNet: base.partner.salaryNet,
    };
  }

  return base;
}

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set, get) => ({
      profile:                { ...newProfile(), id: getActiveProfileId() },
      hasCompletedOnboarding: false,

      setProfile: (profile) => set({ profile: migrateProfile(profile) }),

      updateField: (key, value) =>
        set((s) => ({
          profile: { ...s.profile, [key]: value, updatedAt: new Date().toISOString() },
        })),

      completeOnboarding: () => set({ hasCompletedOnboarding: true }),

      reset: () => set({ profile: newProfile(), hasCompletedOnboarding: false }),

      // ── Conjoint
      setPartner: (partner) =>
        set((s) => ({
          profile: {
            ...s.profile,
            partner,
            // Maintenir compatibilité
            partnerSalaryNet: partner.salaryNet,
            updatedAt: new Date().toISOString(),
          },
        })),

      clearPartner: () =>
        set((s) => {
          const { partner: _p, partnerSalaryNet: _ps, ...rest } = s.profile;
          return {
            profile: { ...rest, updatedAt: new Date().toISOString() },
          };
        }),

      // ── Objectifs d'épargne
      addGoal: (goal) =>
        set((s) => ({
          profile: {
            ...s.profile,
            savingsGoals: [
              ...(s.profile.savingsGoals ?? []),
              { ...goal, id: crypto.randomUUID() },
            ],
            updatedAt: new Date().toISOString(),
          },
        })),

      updateGoal: (id, patch) =>
        set((s) => ({
          profile: {
            ...s.profile,
            savingsGoals: (s.profile.savingsGoals ?? []).map((g) =>
              g.id === id ? { ...g, ...patch } : g
            ),
            updatedAt: new Date().toISOString(),
          },
        })),

      removeGoal: (id) =>
        set((s) => ({
          profile: {
            ...s.profile,
            savingsGoals: (s.profile.savingsGoals ?? []).filter((g) => g.id !== id),
            updatedAt: new Date().toISOString(),
          },
        })),
    }),
    {
      name: "simubudget-profile",
      storage: createJSONStorage(() => profileScopedStorage()),
      // Migration au chargement
      onRehydrateStorage: () => (state) => {
        if (state?.profile) {
          state.profile = migrateProfile(state.profile);
        }
      },
    }
  )
);
