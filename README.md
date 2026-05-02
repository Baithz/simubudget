# SimuBudget

> **Copilote financier personnel — Simulateur budget France**  
> Application desktop Windows · Tauri 2 · React 18 · TypeScript · Rust

---

## Pourquoi SimuBudget existe

Dans la vraie vie :

- on connaît son salaire
- on paie ses charges
- et le reste… on improvise

Résultat : fin de mois tendue, dépenses mal réparties, aucune visibilité réelle.

SimuBudget sert à corriger ça. Pas en affichant des graphiques de plus. En répondant à la vraie question :

> _"Est-ce que je peux vraiment me permettre ça ?"_

---

## Ce que fait concrètement le logiciel

SimuBudget ne suit pas les dépenses passées. Il permet d'**agir en amont** :

- répartir son budget intelligemment avant de dépenser
- voir ce qu'il reste en temps réel dans chaque catégorie
- comprendre où part l'argent
- ajuster avant que ça devienne un problème
- simuler un loyer, un crédit, un achat immobilier — avant de signer

---

## Le principe central : les enveloppes

Au lieu d'un budget global flou, SimuBudget découpe le reste à vivre en **enveloppes** par catégorie.

```
Revenus
  − Charges fixes (loyer, crédits, abonnements...)
  = Reste à vivre
        → Alimentation : 400 €
        → Transport    : 150 €
        → Loisirs      : 150 €
        → Épargne      : 200 €
        → Divers       : ...
```

Chaque dépense diminue l'enveloppe correspondante. À tout moment, on sait exactement ce qu'il reste — sans calculer, sans réfléchir.

**Exemple concret :**

| Action            | Montant | Restant Alimentation |
| ----------------- | ------- | -------------------- |
| Budget alloué     | —       | 400 €                |
| Courses Lidl      | −80 €   | 320 €                |
| Courses Carrefour | −60 €   | 260 €                |
| État              |         | 🟢 260 € disponibles |

---

## Ce que ça change vraiment

**Sans SimuBudget :** tu dépenses → tu constates après.

**Avec SimuBudget :** tu vois avant → tu ajustes → tu décides.

---

## Fonctionnalités principales

- Gestion du budget par enveloppes de catégories
- Suivi des dépenses en temps réel
- Distinction entre **prévu** (simulation) et **réel** (dépense effective)
- Simulation logement — location : APL estimée, taux d'effort, loyer optimal
- Simulation achat immobilier — crédit, PTZ, frais de notaire, taux d'endettement HCSF, achat vs location sur 20 ans
- Score de Santé Financière (SSF / 100) — indicateur synthétique de la situation
- Système d'alertes et de recommandations personnalisées
- Projections sur 6, 12, 24 mois avec scénarios de vie
- Gestion multi-profils (solo, couple)
- Import de relevés bancaires CSV
- Application **100 % locale** — aucun compte, aucun serveur, aucune connexion bancaire obligatoire
- Mise à jour automatique via GitHub Releases

---

## Prérequis

| Outil                               | Lien                                                           | Notes                                     |
| ----------------------------------- | -------------------------------------------------------------- | ----------------------------------------- |
| **Rust** (stable)                   | https://rustup.rs                                              | Compilateur backend                       |
| **Node.js 20+**                     | https://nodejs.org                                             | Runtime frontend                          |
| **WebView2**                        | https://developer.microsoft.com/en-us/microsoft-edge/webview2/ | Souvent déjà installé sur Windows 11      |
| **Visual Studio Build Tools** (C++) | https://visualstudio.microsoft.com/visual-cpp-build-tools/     | Nécessaire pour compiler Rust sur Windows |

---

## Installation

```powershell
# Cloner le dépôt
git clone https://github.com/kremer-regis/simubudget.git
cd simubudget

# Installer les dépendances Node
npm install

# Vérifier que Rust compile (optionnel)
cd src-tauri && cargo check && cd ..
```

---

## Développement

```powershell
npm run dev           # Lance Tauri en mode développement (hot reload frontend + Rust)
npm run test          # Tests React (Vitest)
npm run test:rust     # Tests Rust (cargo test)
npm run test:all      # Tous les tests (React + Rust)
npm run type-check    # Vérification TypeScript (strict)
npm run lint          # ESLint — zéro warning toléré
npm run format        # Prettier
npm run build         # Build production (.msi + .nsis)
npm run update-data   # Mise à jour des données de référence (APL, PTZ, taux...)
```

> **Note :** La première compilation Rust (`npm run dev`) prend 2 à 3 minutes. Les suivantes sont incrémentales.

---

## Structure du projet

```
simubudget/
├── src/                          # Frontend React + TypeScript
│   ├── components/               # Composants UI
│   │   ├── Dashboard/            # Vue principale, jauge SSF, reste à vivre
│   │   ├── Housing/              # Modules Location et Achat immobilier
│   │   ├── Scenarios/            # Projections et scénarios de vie
│   │   ├── Assistant/            # Assistant IA conversationnel
│   │   └── shared/               # Composants réutilisables
│   ├── hooks/                    # Hooks React (bridge Tauri invoke)
│   ├── store/                    # Stores Zustand (profile, simulation, purchase...)
│   ├── types/                    # Types TypeScript stricts
│   ├── services/                 # Claude API, CSV parser, PDF export
│   └── data/                     # Données de référence (APL, PTZ, loyers...)
│
└── src-tauri/src/
    ├── calculator/               # Moteur de calcul Rust — logique métier pure
    │   ├── budget.rs             # Reste à vivre réel
    │   ├── housing.rs            # APL, taux d'effort
    │   ├── purchase.rs           # Crédit, PTZ, frais de notaire
    │   ├── aids.rs               # Prime d'activité, allocations
    │   ├── scoring.rs            # Score de Santé Financière (SSF/100)
    │   ├── projection.rs         # Projections temporelles
    │   └── rules.rs              # Moteur d'alertes
    ├── commands/                 # Commandes Tauri (bridge JS ↔ Rust)
    ├── models/                   # Structs Rust sérialisables
    ├── data/                     # Données embarquées (APL, PTZ, notaire...)
    └── db/                       # SQLite — persistance locale
```

---

## Architecture en un coup d'œil

```
Frontend React ──invoke()──► Backend Rust
  Zustand stores              calculator/
  TailwindCSS                 SQLite (rusqlite)
  Recharts / Framer Motion    Serde JSON
        │                         │
        └──── 100 % local ────────┘
                    │
          api.anthropic.com  (assistant IA — optionnel)
```

**Règles non négociables :**

- Tout calcul financier = **Rust uniquement** (zéro calcul financier en TypeScript)
- TypeScript `strict: true` — zéro `any`
- Rust — zéro `unsafe`, toutes erreurs via `Result<T, SimuError>`
- Montants stockés en **centimes** (`i64`) en SQLite, `f64` pour les calculs
- Arrondir uniquement à l'affichage, jamais dans les calculs intermédiaires

---

## Tests

```powershell
# Tests Rust — couverture cible > 90 % sur calculator/
npm run test:rust

# Tests React — couverture cible > 70 % sur components/
npm run test
```

Profils de test de référence :

| Profil           | Paramètres                             | Résultats attendus                    |
| ---------------- | -------------------------------------- | ------------------------------------- |
| Lucas (location) | 1 800 €/mois, loyer 650 €, Lyon zone 2 | APL ~140 €, taux effort ~36 %         |
| Lucas (achat)    | 160k€, apport 15k€, 20 ans, Lyon B1    | Taux ~38 %, PTZ éligible, alerte HCSF |
| Famille Nantes   | 280k€, apport 50k€, 20 ans, couple     | Taux ~34.8 %, stable                  |
| Non finançable   | 250k€, apport 5k€                      | CRITIQUE — refus bancaire certain     |

---

## Mise à jour automatique

L'application se met à jour automatiquement via GitHub Releases :

1. Une nouvelle version est publiée et signée cryptographiquement
2. Au prochain lancement, l'application détecte la mise à jour
3. Elle est téléchargée, vérifiée (signature ed25519) et installée

Aucune intervention manuelle requise. La vérification de signature garantit qu'aucune mise à jour falsifiée ne peut être installée.

---

## Données de référence intégrées

Les données françaises sont embarquées dans le binaire et mises à jour annuellement :

- Barèmes et zones **APL** (source : legifrance.gouv.fr)
- Zones et plafonds **PTZ** 2025 (zones A bis / A / B1 / B2 / C)
- **Frais de notaire** par département (droits de mutation)
- **Loyers médians** par ville (source : ANIL)
- **Prix m²** médians par ville (source : DVF)
- **Taux crédit** de référence par durée
- Barèmes **Prime d'activité** et allocations familiales CAF

```powershell
# Mettre à jour les données (script Python)
npm run update-data
```

---

## Documentation

Le wiki complet est disponible dans l'onglet **Wiki** du dépôt :

| Page                                                          | Contenu                                           |
| ------------------------------------------------------------- | ------------------------------------------------- |
| [Vision et objectifs](wiki/01_Vision_et_objectifs)            | Pourquoi SimuBudget, personas, principes          |
| [Logique métier](wiki/02_Logique_metier_budget)               | Structure du budget, calculs, reste à vivre réel  |
| [Système des enveloppes](wiki/03_Systeme_enveloppes_detaille) | Enveloppes, états, exemples pas à pas             |
| [Architecture frontend](wiki/07_Architecture_frontend)        | React, Zustand, TailwindCSS, structure dossiers   |
| [Architecture backend](wiki/08_Architecture_backend_tauri)    | Rust, Tauri, SQLite, commandes disponibles        |
| [Stores Zustand](wiki/15_Stores_zustand_detail)               | Détail complet des stores et de la logique métier |
| [Système d'alertes](wiki/10_Systeme_recommandations)          | Alertes, recommandations, règles métier           |
| [Installation et dev](wiki/12_Installation_et_developpement)  | Environnement, conventions, scripts               |

---

## Philosophie

SimuBudget n'est pas là pour impressionner. Il est là pour être utile.

Pas de connexion bancaire obligatoire. Pas de tracking. Pas de complexité inutile.  
Juste un outil pour mieux gérer son argent — et décider en connaissance de cause.

---

## Auteur

**KREMER Régis** — SimuBudget v2.0.1

---

_Les estimations produites par SimuBudget sont indicatives et ne remplacent pas une simulation officielle CAF ou un conseil d'un professionnel agréé._
