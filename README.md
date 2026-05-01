# SimuBudget - Phase 0

> Copilote financier personnel - Simulateur budget France

## Prerequis

- **Rust** : https://rustup.rs
- **Node.js 20+** : https://nodejs.org
- **WebView2** (Windows, souvent deja installe) : https://developer.microsoft.com/en-us/microsoft-edge/webview2/
- **Visual Studio Build Tools** avec C++ : https://visualstudio.microsoft.com/visual-cpp-build-tools/

## Installation

```powershell
# Dans le dossier simubudget/
npm install
```

## Developpement

```powershell
npm run dev          # Lance Tauri en mode developpement (frontend + backend)
npm run test         # Tests React (Vitest)
npm run test:rust    # Tests Rust (cargo test)
npm run test:all     # Tous les tests
npm run type-check   # Verification TypeScript
npm run lint         # ESLint
```

## Structure

```
simubudget/
_-- src/                    # Frontend React + TypeScript
|   _-- components/         # Composants UI
|   _-- hooks/              # Hooks React (bridge Tauri)
|   _-- store/              # Stores Zustand
|   _-- types/              # Types TypeScript
|   _-- data/               # Donnees de reference (APL, PTZ...)
_-- src-tauri/src/
    _-- calculator/         # Moteur de calcul Rust (logique metier pure)
    _-- commands/           # Commandes Tauri (bridge)
    _-- models/             # Structs Rust
    _-- data/               # Donnees embarquees
```

## Auteur

KREMER Regis - SimuBudget v0.1.0
