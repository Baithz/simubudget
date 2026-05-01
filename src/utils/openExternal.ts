// =============================================================================
// Fichier  : src/utils/openExternal.ts
// Auteur   : KREMER Régis
// Desc.    : Ouverture de liens externes dans Tauri 2 ou navigateur web.
//            Utilise l'API shell globale Tauri 2 si disponible,
//            sinon fallback window.open (dev navigateur).
// -----------------------------------------------------------------------------
// Changelog :
//   2026-05-01 | KREMER Régis | Création Phase 11 — Fix 3 liens Tauri
//   2026-05-01 | KREMER Régis | Fix TS2307 : suppression import plugin-shell non déclaré
//   2026-05-01 | KREMER Régis | ZIP 7 — ouverture robuste navigateur système
//   2026-05-01 | KREMER Régis | ZIP 7.1 — priorité plugin-shell officiel Tauri
// =============================================================================

// Tauri 2 expose __TAURI_INTERNALS__ en global quand l'app tourne dans le WebView.
// On l'utilise directement pour éviter toute dépendance de type manquante.
declare global {
  interface Window {
    __TAURI_INTERNALS__?: {
      invoke?: (cmd: string, args?: unknown) => Promise<unknown>;
    };
  }
}

/**
 * Ouvre une URL dans le navigateur système par défaut.
 * - Dans Tauri 2 : via la commande shell "open_url" (plugin tauri-plugin-shell)
 * - En dev navigateur : via window.open
 */
export async function openExternal(url: string): Promise<void> {
  try {
    const { open } = await import("@tauri-apps/plugin-shell");
    await open(url);
    return;
  } catch {
    // Plugin shell absent ou non autorisé : essais directs via invoke.
  }

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("plugin:shell|open", { path: url });
    return;
  } catch {
    // Commande shell indisponible.
  }

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("plugin:opener|open_url", { url });
    return;
  } catch {
    // Commande opener indisponible.
  }

  if (window.__TAURI_INTERNALS__?.invoke) {
    try {
      await window.__TAURI_INTERNALS__.invoke("plugin:shell|open", { path: url });
      return;
    } catch {
      // Dernier fallback navigateur.
    }
  }

  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    window.location.href = url;
  }
}
