// =============================================================================
// Fichier  : src/hooks/useAppVersion.ts
// Auteur   : KREMER Régis
// Desc.    : Hook de lecture de la version réelle de l’application via Tauri.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-05-04 | KREMER Régis | Création — affichage version installée dans menu et paramètres
// =============================================================================

import { useEffect, useState } from "react";

const FALLBACK_APP_VERSION = "2.5.1";

export function useAppVersion(): string {
  const [version, setVersion] = useState(FALLBACK_APP_VERSION);

  useEffect(() => {
    let mounted = true;

    void import("@tauri-apps/api/app")
      .then(({ getVersion }) => getVersion())
      .then((nextVersion) => {
        if (mounted && nextVersion.trim().length > 0) {
          setVersion(nextVersion);
        }
      })
      .catch(() => {
        if (mounted) setVersion(FALLBACK_APP_VERSION);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return version;
}
