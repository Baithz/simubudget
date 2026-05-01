// =============================================================================
// Fichier  : src/test/setup.ts
// Auteur   : KREMER Regis
// Desc.    : Configuration du setup de tests React (Vitest + Testing Library)
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation du fichier
// =============================================================================
import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock Tauri invoke pour les tests (pas d'environnement Tauri dans les tests unitaires)
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue({
    realDisposableIncome: 800,
    healthScore:          65,
    healthLevel:          "stable",
    breakdown: {
      totalIncome:     1800,
      totalAids:       150,
      housing:         700,
      credits:         0,
      food:            250,
      transport:       100,
      fixed:           100,
      savingsCapacity: 600,
    },
    aplEstimate:  { estimated: 150, confidence: "medium", zone: 2 },
    scores: {
      housingEffort:   0.6,
      savings:         0.4,
      debt:            0.9,
      incomeStability: 1.0,
      resilience:      0.5,
    },
    alerts:          [],
    recommendations: [],
  }),
}));
