// =============================================================================
// Fichier  : src/store/uiStore.ts
// Auteur   : KREMER Régis
// Desc.    : Store Zustand pour l'état UI, le thème, les réglages et onglets.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Régis | Création du fichier
//   2026-04-29 | KREMER Régis | Refonte Phase 8 — thème système, taille texte, démarrage, version 1.8
//   2026-05-03 | KREMER Régis | Phase 16 — anti-spam des alertes proactives
// =============================================================================
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";
export type FontSizeMode = "sm" | "md" | "lg";
export type StartPageMode = "/" | "last";

interface UIStore {
  darkMode: boolean;
  themeMode: ThemeMode;
  fontSize: FontSizeMode;
  startPage: StartPageMode;
  notifications: boolean;
  purchaseActiveTab: number;
  alertSnooze: Record<string, string>;
  toggleDark: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  setFontSize: (size: FontSizeMode) => void;
  setStartPage: (page: StartPageMode) => void;
  setNotifications: (enabled: boolean) => void;
  setPurchaseTab: (tab: number) => void;
  snoozeAlert: (id: string) => void;
  clearAlertSnooze: (id: string) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      darkMode: false,
      themeMode: "light",
      fontSize: "md",
      startPage: "/",
      notifications: true,
      purchaseActiveTab: 0,
      alertSnooze: {},
      toggleDark: () => set((state) => {
        const nextDark = !state.darkMode;
        return { darkMode: nextDark, themeMode: nextDark ? "dark" : "light" };
      }),
      setThemeMode: (themeMode) => set({ themeMode, darkMode: themeMode === "dark" }),
      setFontSize: (fontSize) => set({ fontSize }),
      setStartPage: (startPage) => set({ startPage }),
      setNotifications: (notifications) => set({ notifications }),
      setPurchaseTab: (purchaseActiveTab) => set({ purchaseActiveTab }),
      snoozeAlert: (id) =>
        set((state) => ({
          alertSnooze: { ...state.alertSnooze, [id]: new Date().toISOString() },
        })),
      clearAlertSnooze: (id) =>
        set((state) => {
          const next = { ...state.alertSnooze };
          delete next[id];
          return { alertSnooze: next };
        }),
    }),
    { name: "simubudget-ui" }
  )
);
