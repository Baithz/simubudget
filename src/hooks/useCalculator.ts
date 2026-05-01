// =============================================================================
// Fichier  : src/hooks/useCalculator.ts
// Auteur   : KREMER Regis
// Desc.    : Hook React - bridge Tauri invoke pour les calculs budget.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation du fichier Phase 0
//   2026-04-26 | KREMER Regis | Ajout loading + parametre profile optionnel Phase 1
//   2026-04-27 | KREMER Regis | Phase 6 - enrichissement profil depuis accountingStore
//                               + auto-snapshot mensuel apres calcul
//   2026-05-01 | KREMER Régis | ZIP 8.3 — Source de vérité financière : Dashboard basé sur Mes Comptes si disponible
// =============================================================================

import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useProfileStore } from "@/store/profileStore";
import { useSimulationStore } from "@/store/simulationStore";
import { useAccountingStore } from "@/store/accountingStore";
import type { MonthlyBudget, AccountingRecommendation } from "@/types/accounting";
import type { Alert, AlertLevel, BudgetResult, HealthLevel, Recommendation, SubScores } from "@/types/simulation";
import type { UserProfile } from "@/types/profile";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function healthLevelFromScore(score: number): HealthLevel {
  if (score < 35) return "critical";
  if (score < 50) return "fragile";
  if (score < 70) return "stable";
  if (score < 85) return "solid";
  return "robust";
}

function incomeStabilityScore(profile: UserProfile): number {
  if (profile.employmentType === "cdi" || profile.employmentType === "retired") return 1;
  if (profile.employmentType === "cdd") return 0.65;
  if (profile.employmentType === "freelance") return profile.variableEnabled ? 0.45 : 0.6;
  if (profile.employmentType === "unemployed") return 0.2;
  return 0.55;
}

function buildAccountingScores(profile: UserProfile, budget: MonthlyBudget): SubScores {
  const housingExpense = budget.expenseByCategory.housing ?? 0;
  const savingsExpense = budget.expenseByCategory.savings ?? 0;
  const income = budget.totalIncomeMonthly;
  const housingRatio = income > 0 ? housingExpense / income : 1;
  const effectiveSavings = Math.max(0, budget.balanceMonthly) + savingsExpense;
  const savingsRatio = income > 0 ? effectiveSavings / income : 0;

  return {
    housingEffort: clamp01(1 - Math.max(0, housingRatio - 0.25) / 0.25),
    savings: clamp01((profile.savingsMonths / 3) * 0.55 + (savingsRatio / 0.20) * 0.45),
    debt: clamp01(1 - Math.max(0, budget.debtRatio - 0.20) / 0.25),
    incomeStability: incomeStabilityScore(profile),
    resilience: clamp01(profile.savingsMonths / 6),
  };
}

function scoreFromSubScores(scores: SubScores): number {
  const value = (
    scores.housingEffort * 0.30 +
    scores.savings * 0.25 +
    scores.debt * 0.20 +
    scores.incomeStability * 0.15 +
    scores.resilience * 0.10
  ) * 100;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function recommendationToAlert(rec: AccountingRecommendation): Alert {
  const level: AlertLevel = rec.level;
  const alert: Alert = {
    id: rec.id,
    level,
    message: rec.title,
  };
  if (rec.detail.length > 0) alert.detail = rec.detail;
  if (rec.action !== undefined && rec.action.length > 0) alert.action = rec.action;
  return alert;
}

function recommendationToBudgetRecommendation(rec: AccountingRecommendation): Recommendation {
  const recommendation: Recommendation = {
    id: rec.id,
    priority: rec.priority ?? 99,
    label: rec.title,
    impact: rec.detail,
  };
  if (rec.saving !== undefined) recommendation.saving = rec.saving;
  if (rec.action !== undefined && rec.action.length > 0) recommendation.action = rec.action;
  return recommendation;
}

function buildAccountingResult(profile: UserProfile, budget: MonthlyBudget, recommendations: AccountingRecommendation[]): BudgetResult & { basedOnRealAccounting: true } {
  const scores = buildAccountingScores(profile, budget);
  const healthScore = scoreFromSubScores(scores);
  const alerts = recommendations
    .filter((rec) => rec.level === "critical" || rec.level === "danger" || rec.level === "vigilance")
    .slice(0, 5)
    .map(recommendationToAlert);

  return {
    basedOnRealAccounting: true,
    realDisposableIncome: budget.balanceMonthly,
    healthScore,
    healthLevel: healthLevelFromScore(healthScore),
    breakdown: {
      totalIncome: budget.totalIncomeMonthly,
      totalAids: budget.incomeByType.allowance ?? 0,
      housing: budget.expenseByCategory.housing ?? 0,
      credits: budget.expenseByCategory.credit ?? 0,
      food: budget.expenseByCategory.food ?? 0,
      transport: budget.expenseByCategory.transport ?? 0,
      fixed: Math.max(0, budget.fixedExpensesMonthly - (budget.expenseByCategory.housing ?? 0) - (budget.expenseByCategory.credit ?? 0)),
      savingsCapacity: budget.balanceMonthly,
    },
    aplEstimate: {
      estimated: budget.incomeByType.allowance ?? 0,
      confidence: "medium",
      zone: profile.aplZone,
    },
    scores,
    alerts,
    recommendations: recommendations.slice(0, 6).map(recommendationToBudgetRecommendation),
  };
}

export function useCalculator() {
  const storeProfile = useProfileStore((s) => s.profile);
  const { setResult, setLoading, setError, loading } = useSimulationStore();

  const calculate = useCallback(async (profileOverride?: UserProfile) => {
    const profile = profileOverride ?? storeProfile;
    if (!profile) return;

    setLoading(true);
    try {
      const accountingStore = useAccountingStore.getState();
      const hasAccountingData = accountingStore.incomes.length > 0 || accountingStore.expenses.length > 0;

      if (hasAccountingData) {
        const budget = accountingStore.getBudget();
        const recommendations = accountingStore.getRecommendations();
        const result = buildAccountingResult(profile, budget, recommendations);
        setResult(result);

        const currentMonth = new Date().toISOString().slice(0, 7);
        accountingStore.saveSnapshot({
          month: currentMonth,
          healthScore: result.healthScore,
          realDisposableIncome: result.realDisposableIncome,
          totalIncomeMonthly: budget.totalIncomeMonthly,
          totalExpensesMonthly: budget.totalExpensesMonthly,
          balanceMonthly: budget.balanceMonthly,
          savingsRate: budget.savingsRate,
        });
        return;
      }

      const result = await invoke<BudgetResult>("calculate_budget", { profile });
      setResult({ ...result, basedOnRealAccounting: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  }, [storeProfile, setResult, setLoading, setError]);

  return { calculate, loading };
}
