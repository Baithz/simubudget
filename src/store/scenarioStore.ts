// =============================================================================
// Fichier  : src/store/scenarioStore.ts
// Auteur   : KREMER Regis
// Desc.    : Store Zustand pour les scenarios de vie et projections
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation du fichier Phase 2
//   2026-05-01 | KREMER Régis | Phase 12B — scope multi-profils des scénarios
// =============================================================================

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ScenarioEvent, ScenarioResult, ProjectionHorizon } from "@/types/scenarios";
import { profileScopedStorage } from "@/store/profileListStore";

interface ScenarioStore {
  // Evenements actifs sur la timeline
  events:    ScenarioEvent[];
  // Horizon de projection choisi
  horizon:   ProjectionHorizon;
  // Resultat de la derniere projection calculee
  result:    ScenarioResult | null;
  loading:   boolean;
  error:     string | null;

  // Actions
  addEvent:    (e: ScenarioEvent) => void;
  removeEvent: (id: string) => void;
  clearEvents: () => void;
  setHorizon:  (h: ProjectionHorizon) => void;
  setResult:   (r: ScenarioResult) => void;
  setLoading:  (v: boolean) => void;
  setError:    (e: string | null) => void;
}

export const useScenarioStore = create<ScenarioStore>()(
  persist(
    (set) => ({
      events:  [],
      horizon: 12,
      result:  null,
      loading: false,
      error:   null,

      addEvent:    (e) => set((s) => ({ events: [...s.events, e] })),
      removeEvent: (id) => set((s) => ({ events: s.events.filter((e) => e.id !== id) })),
      clearEvents: () => set({ events: [] }),
      setHorizon:  (horizon) => set({ horizon }),
      setResult:   (result)  => set({ result, loading: false, error: null }),
      setLoading:  (loading) => set({ loading }),
      setError:    (error)   => set({ error, loading: false }),
    }),
    { name: "simubudget-scenarios", storage: createJSONStorage(() => profileScopedStorage()) }
  )
);
