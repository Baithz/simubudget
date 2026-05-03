// =============================================================================
// Fichier  : src/types/scenarios.ts
// Auteur   : KREMER Regis
// Desc.    : Types pour les scenarios de vie, stress tests et projections.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation du fichier
//   2026-05-03 | KREMER Régis | Phase 18 — scénarios complexes et stress tests
// =============================================================================

export type ScenarioType =
  | "baby"
  | "job_loss"
  | "separation"
  | "move"
  | "job_change"
  | "purchase"
  | "loan_renegotiation"
  | "part_time"
  | "retirement"
  | "inflation"
  | "energy_shock"
  | "salary_raise"
  | "childcare_start"
  | "vehicle_purchase";

export type ProjectionHorizon = 6 | 12 | 24;

export type ScenarioSeverity = "opportunity" | "neutral" | "watch" | "danger";

export interface ScenarioEvent {
  id:          string;
  type:        ScenarioType;
  label:       string;
  monthOffset: number;

  /** Variation de revenus mensuels. Positive = hausse, négative = baisse. */
  salaryDelta?: number;

  /** Variation de charges fixes mensuelles. Positive = charge en plus, négative = économie. */
  fixedCostsDelta?: number;

  /** Coût ponctuel appliqué uniquement le mois de l'événement. */
  oneTimeCost?: number;

  /** Nouveau loyer charges comprises si déménagement. */
  newRent?: number;

  /** Durée d'application en mois. Absent = permanent à partir du moisOffset. */
  durationMonths?: number;

  /** Inflation mensuelle appliquée aux charges variables à partir du moisOffset. Ex : 0.01 = +1%/mois. */
  monthlyInflationRate?: number;

  /** Variation mensuelle alimentation. */
  foodDelta?: number;

  /** Variation mensuelle transport. */
  transportDelta?: number;

  /** Message métier affiché dans l'interface. */
  explanation?: string;

  /** Niveau indicatif pour trier et présenter les scénarios. */
  severity?: ScenarioSeverity;
}

export interface ProjectionPoint {
  month:              number;
  label:              string;
  disposableIncome:   number;
  healthScore:        number;
  cumulativeSavings:  number;
  hasEvent:           boolean;
  eventLabel?:        string;
  activeEventLabels?: string[];
}

export interface ScenarioResult {
  id:           string;
  name:         string;
  events:       ScenarioEvent[];
  projections:  ProjectionPoint[];
  breakpointMonth?: number;
  isStressTest: boolean;
  lowestDisposableIncome?: number;
  finalDisposableIncome?: number;
  finalHealthScore?: number;
}

export interface ScenarioPreset {
  label:       string;
  icon:        string;
  description: string;
  severity:    ScenarioSeverity;
  defaults:    Partial<ScenarioEvent>;
}

export const SCENARIO_PRESETS: Record<ScenarioType, ScenarioPreset> = {
  baby: {
    label: "Naissance d'un enfant",
    icon: "famille",
    description: "Congé parental éventuel, garde, alimentation et charges supplémentaires.",
    severity: "watch",
    defaults: {
      salaryDelta: -500,
      fixedCostsDelta: 180,
      foodDelta: 120,
      durationMonths: 12,
      explanation: "Teste l'arrivée d'un enfant avec une baisse temporaire de revenus et des charges nouvelles.",
    },
  },
  job_loss: {
    label: "Perte d'emploi",
    icon: "alerte",
    description: "Baisse de revenus pendant une période donnée, avec indemnisation estimée.",
    severity: "danger",
    defaults: {
      salaryDelta: -900,
      durationMonths: 6,
      explanation: "Mesure la durée soutenable si les revenus baissent fortement pendant plusieurs mois.",
    },
  },
  separation: {
    label: "Séparation",
    icon: "foyer",
    description: "Nouvelles charges de logement, pension ou réorganisation du foyer.",
    severity: "danger",
    defaults: {
      fixedCostsDelta: 450,
      oneTimeCost: 1200,
      explanation: "Simule une réorganisation du foyer avec des coûts fixes plus élevés.",
    },
  },
  move: {
    label: "Déménagement",
    icon: "maison",
    description: "Nouveau loyer, frais de déménagement et impact transport.",
    severity: "neutral",
    defaults: {
      oneTimeCost: 1800,
      newRent: 850,
      transportDelta: 60,
      explanation: "Compare l'impact d'un nouveau logement avec frais ponctuels.",
    },
  },
  job_change: {
    label: "Changement de poste",
    icon: "travail",
    description: "Nouveau salaire et coût de transport ajusté.",
    severity: "opportunity",
    defaults: {
      salaryDelta: 300,
      transportDelta: 40,
      explanation: "Mesure le gain réel d'un nouveau poste après charges de transport.",
    },
  },
  purchase: {
    label: "Achat immobilier",
    icon: "achat",
    description: "Passage loyer vers mensualité propriétaire avec charges annexes.",
    severity: "watch",
    defaults: {
      fixedCostsDelta: 220,
      newRent: 950,
      oneTimeCost: 3500,
      explanation: "Approxime le passage à propriétaire : mensualité, charges et frais initiaux.",
    },
  },
  loan_renegotiation: {
    label: "Renégociation crédit",
    icon: "credit",
    description: "Baisse de mensualité ou rachat de crédit.",
    severity: "opportunity",
    defaults: {
      fixedCostsDelta: -150,
      oneTimeCost: 500,
      explanation: "Teste une baisse de mensualité après frais de dossier.",
    },
  },
  part_time: {
    label: "Passage à temps partiel",
    icon: "temps",
    description: "Réduction temporaire ou durable de revenus.",
    severity: "watch",
    defaults: {
      salaryDelta: -700,
      durationMonths: 12,
      explanation: "Vérifie si un temps partiel reste soutenable dans la durée.",
    },
  },
  retirement: {
    label: "Départ en retraite",
    icon: "retraite",
    description: "Baisse durable des revenus et charges souvent plus stables.",
    severity: "watch",
    defaults: {
      salaryDelta: -650,
      transportDelta: -80,
      explanation: "Simule un revenu de retraite inférieur avec moins de frais de transport.",
    },
  },
  inflation: {
    label: "Inflation forte",
    icon: "inflation",
    description: "Hausse progressive des charges variables et fixes.",
    severity: "watch",
    defaults: {
      monthlyInflationRate: 0.01,
      durationMonths: 12,
      explanation: "Applique une hausse progressive des charges pour tester la résistance du budget.",
    },
  },
  energy_shock: {
    label: "Hausse énergie",
    icon: "energie",
    description: "Augmentation immédiate des charges fixes.",
    severity: "watch",
    defaults: {
      fixedCostsDelta: 120,
      durationMonths: 6,
      explanation: "Teste une hausse temporaire d'énergie ou de chauffage.",
    },
  },
  salary_raise: {
    label: "Augmentation salaire",
    icon: "hausse",
    description: "Gain mensuel durable, impact reste à vivre et score.",
    severity: "opportunity",
    defaults: {
      salaryDelta: 250,
      explanation: "Mesure l'effet réel d'une hausse de revenus.",
    },
  },
  childcare_start: {
    label: "Début garde enfant",
    icon: "garde",
    description: "Nouvelle charge de garde mensuelle.",
    severity: "watch",
    defaults: {
      fixedCostsDelta: 350,
      durationMonths: 18,
      explanation: "Anticipe les frais de garde avant qu'ils pèsent sur le budget.",
    },
  },
  vehicle_purchase: {
    label: "Achat véhicule",
    icon: "vehicule",
    description: "Mensualité auto, assurance, entretien et frais initiaux.",
    severity: "watch",
    defaults: {
      fixedCostsDelta: 260,
      transportDelta: 70,
      oneTimeCost: 1500,
      explanation: "Simule l'impact global d'un véhicule financé à crédit.",
    },
  },
};

export const STRESS_TEST_PRESETS: Array<{
  id: string;
  label: string;
  description: string;
  events: Array<Pick<ScenarioEvent, "type" | "monthOffset"> & Partial<ScenarioEvent>>;
}> = [
  {
    id: "job_loss_inflation",
    label: "Perte d'emploi + inflation",
    description: "Test sévère : revenus en baisse et charges qui montent progressivement.",
    events: [
      { type: "job_loss", monthOffset: 1, salaryDelta: -900, durationMonths: 6 },
      { type: "inflation", monthOffset: 0, monthlyInflationRate: 0.01, durationMonths: 12 },
    ],
  },
  {
    id: "baby_part_time",
    label: "Naissance + temps partiel",
    description: "Arrivée d'un enfant avec baisse temporaire de revenus.",
    events: [
      { type: "baby", monthOffset: 4, fixedCostsDelta: 250, foodDelta: 120, durationMonths: 18 },
      { type: "part_time", monthOffset: 4, salaryDelta: -700, durationMonths: 12 },
    ],
  },
  {
    id: "move_vehicle",
    label: "Déménagement + véhicule",
    description: "Frais ponctuels importants et charges mensuelles plus hautes.",
    events: [
      { type: "move", monthOffset: 2, oneTimeCost: 1800, newRent: 850, transportDelta: 50 },
      { type: "vehicle_purchase", monthOffset: 3, fixedCostsDelta: 260, transportDelta: 70, oneTimeCost: 1500 },
    ],
  },
];
