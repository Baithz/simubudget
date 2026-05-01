// =============================================================================
// Fichier  : src/types/purchase.ts
// Auteur   : KREMER Regis
// Desc.    : Types TypeScript pour le module simulation achat immobilier
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation du fichier
// =============================================================================
import type { Alert, Recommendation } from "./simulation";

export type PropertyType  = "apartment" | "house" | "land_build" | "vefa";
export type PropertyUsage = "primary" | "secondary" | "rental_investment";
export type PropertyCondition = "good" | "to_renovate" | "energy_sieve";
export type PtzZone       = "A_BIS" | "A" | "B1" | "B2" | "C";

export interface PurchaseInput {
  // Bien
  propertyPrice:     number;
  propertyType:      PropertyType;
  surface:           number;
  city:              string;
  department:        string;
  condition:         PropertyCondition;
  usage:             PropertyUsage;
  renovationBudget:  number;
  isNew:             boolean;

  // Financement
  downPayment:       number;
  loanDurationYears: number;
  interestRate?:     number;
  insuranceRate?:    number;
  otherLoansMonthly: number;

  // Profil emprunteur
  monthlyIncome:     number;
  age:               number;
  isSmoker:          boolean;
  householdSize:     number;

  // Aides
  isFirstTimeBuyer:        boolean;
  fiscalReferenceIncome?:  number;
  employerOver10:          boolean;
}

export interface PtzResult {
  eligible:      boolean;
  zone?:         PtzZone;
  amount?:       number;
  deferralYears?: number;
}

export interface PurchaseResult {
  // Frais
  notaryFees:           number;
  guaranteeFees:        number;
  totalOperationCost:   number;
  loanAmount:           number;

  // Credit
  monthlyPaymentNoInsurance: number;
  monthlyPaymentWithInsurance: number;
  totalInterestPaid:    number;
  totalInsurancePaid:   number;

  // PTZ
  ptz: PtzResult;
  monthlyPhase1?:       number;
  monthlyPhase2?:       number;

  // Ratios
  debtRatioPostPurchase:         number;   // 0-1
  disposableIncomePostPurchase:  number;
  downPaymentRatio:              number;   // 0-1
  residualSavings:               number;

  // Achat vs Location
  breakEvenYears:    number;
  wealthAt5Years:    number;
  wealthAt10Years:   number;
  rentEquivalent:    number;

  // SSF impact
  ssfBefore:  number;
  ssfAfter:   number;

  // Alertes
  alerts:          Alert[];
  recommendations: Recommendation[];
}

export const DEFAULT_PURCHASE_INPUT: PurchaseInput = {
  propertyPrice:     200000,
  propertyType:      "apartment",
  surface:           50,
  city:              "Lyon",
  department:        "69",
  condition:         "good",
  usage:             "primary",
  renovationBudget:  0,
  isNew:             false,
  downPayment:       20000,
  loanDurationYears: 20,
  otherLoansMonthly: 0,
  monthlyIncome:     2400,
  age:               30,
  isSmoker:          false,
  householdSize:     1,
  isFirstTimeBuyer:  true,
  employerOver10:    false,
};
