// =============================================================================
// Fichier  : src/store/simulationStore.ts
// Auteur   : KREMER Regis
// Desc.    : Store Zustand pour le resultat de simulation courant
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation Phase 0
//   2026-04-26 | KREMER Regis | Ajout loading expose Phase 1
//   2026-04-27 | KREMER Regis | Phase 6 - basedOnRealAccounting flag
// =============================================================================

import { create } from "zustand";
import type { BudgetResult } from "@/types/simulation";

// BudgetResult étendu avec le flag comptabilité réelle
export interface EnrichedBudgetResult extends BudgetResult {
  basedOnRealAccounting?: boolean;
}

interface SimulationStore {
  result:    EnrichedBudgetResult | null;
  loading:   boolean;
  error:     string | null;
  setResult: (r: EnrichedBudgetResult) => void;
  setLoading:(v: boolean) => void;
  setError:  (e: string | null) => void;
  reset:     () => void;
}

export const useSimulationStore = create<SimulationStore>()((set) => ({
  result:    null,
  loading:   false,
  error:     null,
  setResult: (result)  => set({ result, loading: false, error: null }),
  setLoading:(loading) => set({ loading }),
  setError:  (error)   => set({ error, loading: false }),
  reset:     ()        => set({ result: null, loading: false, error: null }),
}));
