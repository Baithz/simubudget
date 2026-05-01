// =============================================================================
// Fichier  : src/router.tsx
// Auteur   : KREMER Regis
// Desc.    : Configuration des routes HashRouter
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation Phase 0
//   2026-04-26 | KREMER Regis | Corrections Phase 1
//   2026-04-26 | KREMER Regis | Ajout /scenarios Phase 2
//   2026-04-26 | KREMER Regis | Ajout /accounting Phase 3
//   2026-04-26 | KREMER Regis | Ajout /report Phase 4
//   2026-04-27 | KREMER Regis | Phase 5 - App comme layout parent (Outlet)
//   2026-04-29 | KREMER Régis | Ajout route paramètres Phase 8
//   2026-04-29 | KREMER Regis | Ajout ErrorBoundary applicatif
//   2026-05-01 | KREMER Régis | Phase 12B — route /profiles hors layout applicatif
//   2026-05-01 | KREMER Régis | ZIP 7 — ajout route aide utilisateur
// =============================================================================

import { createHashRouter }  from "react-router-dom";
import App                   from "./App";
import { Dashboard }         from "./components/Dashboard/Dashboard";
import { OnboardingWizard }  from "./components/Onboarding/OnboardingWizard";
import { ScenarioTimeline }  from "./components/Scenarios/ScenarioTimeline";
import { AccountingModule }  from "./components/Accounting/AccountingModule";
import { AnnualReport }      from "./components/Accounting/AnnualReport";
import AssistantChat         from "./components/Assistant/AssistantChat";
import HousingModule         from "./components/Housing/HousingModule";
import LocationModule        from "./components/Housing/LocationModule/LocationModule";
import PurchaseModule        from "./components/Housing/PurchaseModule/PurchaseModule";
import SettingsPage          from "./components/Settings/SettingsPage";
import ProfileSelector       from "./components/ProfileSelector/ProfileSelector";
import HelpPage              from "./components/Help/HelpPage";
import RouteErrorBoundary   from "./components/shared/RouteErrorBoundary";

export const router = createHashRouter([
  { path: "/profiles", element: <ProfileSelector />, errorElement: <RouteErrorBoundary /> },
  {
    path: "/",
    element: <App />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true,                element: <Dashboard /> },
      { path: "onboarding",         element: <OnboardingWizard /> },
      { path: "housing",            element: <HousingModule /> },
      { path: "housing/location",   element: <LocationModule /> },
      { path: "housing/purchase",   element: <PurchaseModule /> },
      { path: "scenarios",          element: <ScenarioTimeline /> },
      { path: "accounting",         element: <AccountingModule /> },
      { path: "report",             element: <AnnualReport /> },
      { path: "assistant",          element: <AssistantChat /> },
      { path: "settings",           element: <SettingsPage /> },
      { path: "help",               element: <HelpPage /> },
    ],
  },
]);
