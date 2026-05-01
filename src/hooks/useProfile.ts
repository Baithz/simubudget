// =============================================================================
// Fichier  : src/hooks/useProfile.ts
// Auteur   : KREMER Regis
// Desc.    : Hook React - bridge Tauri pour la persistance des profils SQLite
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation du fichier Phase 1
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useProfileStore } from "@/store/profileStore";
import type { UserProfile } from "@/types/profile";

interface UseProfileReturn {
  loading: boolean;
  error: string | null;
  saveProfile: (profile: UserProfile) => Promise<void>;
  loadProfile: () => Promise<void>;
  clearError: () => void;
}

export function useProfile(): UseProfileReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const { setProfile }        = useProfileStore();

  const saveProfile = useCallback(async (profile: UserProfile) => {
    setLoading(true);
    setError(null);
    try {
      await invoke("save_profile", { profile });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const profile = await invoke<UserProfile | null>("load_profile");
      if (profile) {
        setProfile(profile);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [setProfile]);

  const clearError = useCallback(() => setError(null), []);

  return { loading, error, saveProfile, loadProfile, clearError };
}

/// Charge le profil au demarrage de l'app (utilise dans App.tsx)
export function useProfileInit() {
  const { loadProfile } = useProfile();
  const profile = useProfileStore((s) => s.profile);

  useEffect(() => {
    if (!profile) {
      loadProfile();
    }
  }, []);
}
