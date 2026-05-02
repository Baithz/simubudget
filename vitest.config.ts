// =============================================================================
// Fichier  : vitest.config.ts
// Auteur   : KREMER Regis
// Desc.    : Configuration Vitest pour les tests React/TypeScript.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation du fichier
//   2026-05-02 | KREMER Regis | Correction — autorise le passage temporaire sans fichiers de test React
// =============================================================================
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@":           resolve(__dirname, "./src"),
      "@components": resolve(__dirname, "./src/components"),
      "@store":      resolve(__dirname, "./src/store"),
      "@hooks":      resolve(__dirname, "./src/hooks"),
      "@services":   resolve(__dirname, "./src/services"),
      "@data":       resolve(__dirname, "./src/data"),
      "@utils":      resolve(__dirname, "./src/utils"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles:  ["./src/test/setup.ts"],
    passWithNoTests: true,
    coverage: {
      reporter:   ["text", "lcov"],
      thresholds: { statements: 80, branches: 75, functions: 80, lines: 80 },
    },
  },
});
