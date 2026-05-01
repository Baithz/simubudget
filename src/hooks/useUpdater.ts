// =============================================================================
// Fichier  : src/hooks/useUpdater.ts
// Auteur   : KREMER Régis
// Desc.    : Hook React — détection et installation des mises à jour via Tauri Updater.
//            Check au démarrage (App.tsx) + vérification manuelle (Settings).
// -----------------------------------------------------------------------------
// Changelog :
//   2026-05-01 | KREMER Régis | Création — plugin tauri-plugin-updater v2
//   2026-05-01 | KREMER Régis | Phase 13C — diagnostic fiable erreurs updater
// =============================================================================

import { useState, useCallback, useEffect, useRef } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "installing"
  | "up-to-date"
  | "error";

export interface UpdateInfo {
  version:     string;
  date?:       string;
  body?:       string;     // Notes de version (markdown)
}

export interface UseUpdaterReturn {
  status:       UpdateStatus;
  updateInfo:   UpdateInfo | null;
  progress:     number;         // 0-100 pendant le téléchargement
  error:        string | null;
  checkUpdate:  () => Promise<void>;
  installUpdate: () => Promise<void>;
  dismiss:      () => void;
}

export function useUpdater(checkOnMount = false): UseUpdaterReturn {
  const [status,     setStatus]     = useState<UpdateStatus>("idle");
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [progress,   setProgress]   = useState(0);
  const [error,      setError]      = useState<string | null>(null);
  const updateRef = useRef<Update | null>(null);

  const checkUpdate = useCallback(async () => {
    setStatus("checking");
    setError(null);
    setUpdateInfo(null);
    setProgress(0);

    try {
      const update = await check();

      if (!update) {
        setStatus("up-to-date");
        return;
      }

      updateRef.current = update;

      const info: UpdateInfo = { version: update.version };
      if (update.date) info.date = update.date;
      if (update.body) info.body = update.body;
      setUpdateInfo(info);
      setStatus("available");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const lower = message.toLowerCase();

      // Ne jamais masquer les erreurs de permission / signature / réseau :
      // ce sont précisément les causes qui empêchent l'auto-update en production.
      if (lower.includes("no updates available")) {
        setStatus("up-to-date");
        return;
      }

      setError(message);
      setStatus("error");
    }
  }, []);

  const installUpdate = useCallback(async () => {
    const update = updateRef.current;
    if (!update) return;

    setStatus("downloading");
    setProgress(0);

    try {
      let downloaded  = 0;
      let total       = 0;

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            total = event.data.contentLength ?? 0;
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            setProgress(total > 0 ? Math.round((downloaded / total) * 100) : 0);
            break;
          case "Finished":
            setProgress(100);
            setStatus("installing");
            break;
        }
      });

      // Relance l'application après installation
      await relaunch();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setStatus("error");
    }
  }, []);

  const dismiss = useCallback(() => {
    setStatus("idle");
    setUpdateInfo(null);
    setError(null);
    setProgress(0);
  }, []);

  useEffect(() => {
    if (!checkOnMount) return;
    void checkUpdate();
  }, [checkOnMount, checkUpdate]);

  return { status, updateInfo, progress, error, checkUpdate, installUpdate, dismiss };
}
