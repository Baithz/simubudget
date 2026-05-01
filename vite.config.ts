// =============================================================================
// Fichier  : vite.config.ts
// Auteur   : KREMER Regis
// Desc.    : Configuration Vite pour SimuBudget (Tauri + React + TypeScript)
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation du fichier
// =============================================================================
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig(async () => ({
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
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
