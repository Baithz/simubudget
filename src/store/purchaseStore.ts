// =============================================================================
// Fichier  : src/store/purchaseStore.ts
// Auteur   : KREMER Regis
// Desc.    : Store Zustand pour la simulation achat immobilier
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation du fichier
//   2026-05-01 | KREMER Régis | Phase 12B — persist multi-profils de la simulation achat
//   2026-05-01 | KREMER Régis | ZIP 8 — clearResult + fin correcte du loading achat
// =============================================================================
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { PurchaseInput, PurchaseResult } from "../types/purchase";
import { DEFAULT_PURCHASE_INPUT } from "../types/purchase";
import { profileScopedStorage } from "@/store/profileListStore";

interface PurchaseStore {
  input:       PurchaseInput;
  result:      PurchaseResult | null;
  loading:     boolean;
  error:       string | null;
  setInput:    (input: PurchaseInput) => void;
  updateInput: <K extends keyof PurchaseInput>(key: K, value: PurchaseInput[K]) => void;
  setResult:   (r: PurchaseResult) => void;
  clearResult: () => void;
  setLoading:  (v: boolean) => void;
  setError:    (e: string | null) => void;
}

export const usePurchaseStore = create<PurchaseStore>()(
  persist(
    (set) => ({
      input:     DEFAULT_PURCHASE_INPUT,
      result:    null,
      loading:   false,
      error:     null,
      setInput:  (input) => set({ input }),
      updateInput: (key, value) =>
        set((s) => ({ input: { ...s.input, [key]: value } })),
      setResult:   (result) => set({ result, error: null, loading: false }),
      clearResult: () => set({ result: null, loading: false }),
      setLoading:  (loading) => set({ loading }),
      setError:    (error) => set({ error, loading: false }),
    }),
    {
      name: "simubudget-purchase",
      storage: createJSONStorage(() => profileScopedStorage()),
    }
  )
);
