// =============================================================================
// Fichier  : src/hooks/usePurchase.ts
// Auteur   : KREMER Regis
// Desc.    : Hook React - bridge Tauri invoke pour la simulation achat
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation du fichier
//   2026-05-01 | KREMER Régis | ZIP 8 — sécurisation loading et erreurs simulate_purchase
// =============================================================================
import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { usePurchaseStore } from "../store/purchaseStore";
import type { PurchaseResult } from "../types/purchase";

/**
 * Appelle la commande Rust `simulate_purchase` avec l'input achat courant.
 * Les formules financières restent côté Rust ; ce hook ne fait que piloter l'appel Tauri.
 */
export function usePurchase() {
  const input = usePurchaseStore((s) => s.input);
  const { setResult, setLoading, setError } = usePurchaseStore();

  const simulate = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invoke<PurchaseResult>("simulate_purchase", { input });
      setResult(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  }, [input, setResult, setLoading, setError]);

  return { simulate };
}
