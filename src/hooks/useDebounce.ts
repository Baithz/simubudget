// =============================================================================
// Fichier  : src/hooks/useDebounce.ts
// Auteur   : KREMER Regis
// Desc.    : Hook de debounce pour les sliders temps reel
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation du fichier
// =============================================================================
import { useState, useEffect } from "react";

export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
