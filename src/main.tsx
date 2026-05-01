// =============================================================================
// Fichier  : src/main.tsx
// Auteur   : KREMER Regis
// Desc.    : Point d'entree React de SimuBudget
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation du fichier
// =============================================================================
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("Element #root introuvable dans le DOM");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
