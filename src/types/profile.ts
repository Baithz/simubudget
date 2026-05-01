// =============================================================================
// Fichier  : src/types/profile.ts
// Auteur   : KREMER Regis
// Desc.    : Types TypeScript pour le profil utilisateur SimuBudget
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation du fichier
//   2026-04-27 | KREMER Regis | Phase 6 - PartnerProfile, SavingsGoal, MonthlySnapshot
//   2026-04-28 | KREMER Regis | Correction TS strict - DEFAULT_PROFILE sans champs optionnels vides
//   2026-04-29 | KREMER Regis | Phase 9.2 - identites personne A/B pour le suivi couple
//   2026-05-01 | KREMER Régis | Phase 12A — CreditItem enrichi (capitalRemaining, startDate, interestRate, lender)
//   2026-05-01 | KREMER Régis | Phase 12B — Ajout ProfileEntry pour multi-profils + PIN
// =============================================================================

export type Situation      = "single" | "couple" | "separated" | "cohabiting";
export type EmploymentType = "cdi" | "cdd" | "freelance" | "unemployed" | "retired" | "other";
export type AplZone        = 1 | 2 | 3;
export type CustodyType    = "full" | "alternate" | "none";
export type ChildcareType  = "creche" | "assistante_maternelle" | "school" | "none";
export type HeatingType    = "collective" | "individual_gas" | "individual_electric";
export type HousingType    = "tenant" | "owner" | "colocation" | "hosted";
export type CreditType     = "immo" | "auto" | "conso" | "revolving";

export interface ProfileEntry {
  id:             string;
  displayName:    string;
  avatarColor:    string;
  avatarInitials: string;
  pinHash:        string | null;
  lastUsed:       string;
  createdAt:      string;
  profileKind?:   Situation;
}

export interface ChildProfile {
  age:           number;
  custodyType:   CustodyType;
  childcareType: ChildcareType;
  childcareCost: number;
}

export interface CreditItem {
  name:             string;
  monthlyPayment:   number;
  remainingMonths:  number;   // Mois restants — décrémenté à chaque clôture mensuelle
  type:             CreditType;
  // Champs optionnels Phase 12 — enrichissement
  capitalRemaining?: number;  // Capital restant dû (informatif)
  startDate?:        string;  // YYYY-MM — date de début pour calcul date fin
  interestRate?:     number;  // Taux annuel % (pour simulation libération)
  lender?:           string;  // Établissement prêteur (ex : "Crédit Agricole")
}

export interface HousingProfile {
  type:                  HousingType;
  rent?:                 number;
  charges?:              number;
  purchaseLoanMonthly?:  number;
  condoFees?:            number;
  propertyTax?:          number;
  maintenanceProvision?: number;
  surface:               number;
  heatingType:           HeatingType;
}

// ── Profil du conjoint enrichi ────────────────────────────────────────────────
export interface PersonIdentity {
  firstName: string;
  lastName:  string;
}

export interface PartnerProfile {
  name:           string;           // Nom complet affiche dans Mes Comptes
  firstName:      string;
  lastName:       string;
  salaryNet:      number;           // Salaire net mensuel
  bonusAnnual:    number;           // Primes annuelles
  employmentType: EmploymentType;
  otherIncome:    number;           // Autres revenus mensuels
}

// ── Objectif d'épargne ────────────────────────────────────────────────────────
export interface SavingsGoal {
  id:          string;
  label:       string;              // "Apport immobilier", "Vacances 2027"...
  targetAmount: number;             // Montant cible en EUR
  currentAmount: number;           // Épargne déjà constituée
  monthlyContribution: number;     // Montant mensuel dédié à cet objectif
  targetDate?: string;             // ISO date cible (optionnel)
  color:       string;             // Couleur d'affichage (#hex)
}

// ── Snapshot mensuel (historique) ─────────────────────────────────────────────
export interface MonthlySnapshot {
  month:                string;    // "2026-04"
  healthScore:          number;    // SSF 0-100
  realDisposableIncome: number;    // Reste à vivre réel
  totalIncomeMonthly:   number;
  totalExpensesMonthly: number;
  balanceMonthly:       number;
  savingsRate:          number;
}

export interface UserProfile {
  id:        string;
  createdAt: string;
  updatedAt: string;

  // Identité financière
  holder:            PersonIdentity;
  situation:         Situation;
  employmentType:    EmploymentType;

  // Revenus (en euros nets mensuels)
  salaryNet:         number;
  bonusAnnual:       number;
  variableIncomeMin: number;
  variableIncomeMax: number;
  variableEnabled:   boolean;
  allocationsTotal:  number;
  pensionReceived:   number;
  rentalIncome:      number;
  otherIncome:       number;

  // Famille
  children: ChildProfile[];

  // Conjoint — profil enrichi (remplace partnerSalaryNet simple)
  partner?: PartnerProfile;
  /** @deprecated Utiliser partner.salaryNet — conservé pour compatibilité */
  partnerSalaryNet?: number;

  // Logement actuel
  currentHousing: HousingProfile;

  // Charges fixes
  credits:        CreditItem[];
  phoneInternet:  number;
  insuranceTotal: number;
  pensionPaid:    number;
  otherFixed:     number;

  // Épargne
  savingsMonths: number;           // Nb mois de charges en épargne de précaution
  savingsGoals:  SavingsGoal[];    // Objectifs d'épargne nommés

  // Géographie
  department: string;
  city:       string;
  aplZone:    AplZone;
}

export const DEFAULT_PROFILE: Omit<UserProfile, "id" | "createdAt" | "updatedAt"> = {
  holder:             { firstName: "", lastName: "" },
  situation:          "single",
  employmentType:     "cdi",
  salaryNet:          1800,
  bonusAnnual:        0,
  variableIncomeMin:  0,
  variableIncomeMax:  0,
  variableEnabled:    false,
  allocationsTotal:   0,
  pensionReceived:    0,
  rentalIncome:       0,
  otherIncome:        0,
  children:           [],
  currentHousing: {
    type:        "tenant",
    rent:        650,
    charges:     50,
    surface:     30,
    heatingType: "collective",
  },
  credits:        [],
  phoneInternet:  30,
  insuranceTotal: 50,
  pensionPaid:    0,
  otherFixed:     0,
  savingsMonths:  0,
  savingsGoals:   [],
  department:     "69",
  city:           "Lyon",
  aplZone:        2,
};
