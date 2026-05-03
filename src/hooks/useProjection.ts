// =============================================================================
// Fichier  : src/hooks/useProjection.ts
// Auteur   : KREMER Regis
// Desc.    : Hook de calcul des projections temporelles et scénarios complexes.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation Phase 2
//   2026-05-03 | KREMER Régis | Phase 18 — prise en charge scénarios complexes et stress tests
// =============================================================================

import { useCallback } from "react";
import { useProfileStore }  from "@/store/profileStore";
import { useScenarioStore } from "@/store/scenarioStore";
import { useSimulationStore } from "@/store/simulationStore";
import type { ProjectionPoint, ScenarioEvent, ScenarioResult } from "@/types/scenarios";

const MONTHS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

interface ProjectionBase {
  income: number;
  fixedCosts: number;
  rent: number;
  food: number;
  transport: number;
}

function monthLabel(offsetFromNow: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offsetFromNow);
  return `${MONTHS_FR[d.getMonth()] ?? "Mois"} ${d.getFullYear()}`;
}

function isEventActive(event: ScenarioEvent, month: number): boolean {
  if (month < event.monthOffset) return false;
  if (event.durationMonths === undefined) return true;
  return month < event.monthOffset + event.durationMonths;
}

function inflationFactor(events: ScenarioEvent[], month: number): number {
  return events.reduce((factor, event) => {
    if (event.monthlyInflationRate === undefined || month < event.monthOffset) return factor;
    const cappedDuration = event.durationMonths ?? month;
    const elapsed = Math.min(month - event.monthOffset + 1, cappedDuration);
    if (elapsed <= 0) return factor;
    return factor * Math.pow(1 + event.monthlyInflationRate, elapsed);
  }, 1);
}

function buildMonthlyState(base: ProjectionBase, events: ScenarioEvent[], month: number): ProjectionBase {
  const activeEvents = events.filter((event) => isEventActive(event, month));
  const state = activeEvents.reduce<ProjectionBase>((acc, event) => {
    const next: ProjectionBase = {
      income: acc.income + (event.salaryDelta ?? 0),
      fixedCosts: acc.fixedCosts + (event.fixedCostsDelta ?? 0),
      rent: event.newRent ?? acc.rent,
      food: acc.food + (event.foodDelta ?? 0),
      transport: acc.transport + (event.transportDelta ?? 0),
    };
    return next;
  }, { ...base });

  const factor = inflationFactor(events, month);
  return {
    ...state,
    fixedCosts: Math.round(state.fixedCosts * factor),
    food: Math.round(state.food * factor),
    transport: Math.round(state.transport * factor),
  };
}

function oneTimeCostsForMonth(events: ScenarioEvent[], month: number): number {
  return events
    .filter((event) => event.monthOffset === month)
    .reduce((sum, event) => sum + (event.oneTimeCost ?? 0), 0);
}

function activeEventLabels(events: ScenarioEvent[], month: number): string[] {
  return events
    .filter((event) => event.monthOffset === month || isEventActive(event, month))
    .map((event) => event.label);
}

function estimateSSF(income: number, rent: number, fixedCosts: number, food: number, transport: number): number {
  if (income <= 0) return 0;
  const totalEssential = rent + fixedCosts + food + transport;
  const effortRatio = totalEssential / income;
  const disposable = income - totalEssential;
  const effortScore = Math.max(0, Math.min(1, 1 - (effortRatio - 0.45) / 0.35));
  const disposableScore = Math.max(0, Math.min(1, disposable / Math.max(1, income * 0.25)));
  return Math.round(Math.min(100, (effortScore * 0.65 + disposableScore * 0.35) * 100));
}

export function useProjection() {
  const profile = useProfileStore((s) => s.profile);
  const baseResult = useSimulationStore((s) => s.result);
  const { events, horizon, setResult, setLoading, setError } = useScenarioStore();

  const compute = useCallback(() => {
    if (!profile || !baseResult) return;
    setLoading(true);

    try {
      const baseIncome =
        profile.salaryNet +
        (profile.partnerSalaryNet ?? 0) +
        profile.allocationsTotal +
        profile.pensionReceived +
        profile.rentalIncome +
        profile.otherIncome +
        (profile.bonusAnnual / 12);

      const baseRent = (profile.currentHousing.rent ?? 0) + (profile.currentHousing.charges ?? 0);
      const baseFixedCosts = profile.phoneInternet + profile.insuranceTotal + profile.pensionPaid + profile.otherFixed;
      const baseFood = 250 + (profile.children.length * 150);
      const baseTransport = 100;

      const base: ProjectionBase = {
        income: baseIncome,
        fixedCosts: baseFixedCosts,
        rent: baseRent,
        food: baseFood,
        transport: baseTransport,
      };

      const sortedEvents = [...events].sort((a, b) => a.monthOffset - b.monthOffset);
      const points: ProjectionPoint[] = [];
      let cumulativeSavings = profile.savingsMonths * Math.max(1, baseRent + baseFixedCosts + baseFood + baseTransport);

      for (let month = 0; month <= horizon; month += 1) {
        const state = buildMonthlyState(base, sortedEvents, month);
        const oneTimeCosts = oneTimeCostsForMonth(sortedEvents, month);
        const disposableIncome = state.income - state.rent - state.fixedCosts - state.food - state.transport - oneTimeCosts;
        const healthScore = estimateSSF(state.income, state.rent, state.fixedCosts, state.food, state.transport);

        if (disposableIncome > 0) {
          cumulativeSavings += disposableIncome * 0.3;
        } else {
          cumulativeSavings += disposableIncome;
        }

        const labels = activeEventLabels(sortedEvents, month);
        const point: ProjectionPoint = {
          month,
          label: monthLabel(month),
          disposableIncome: Math.round(disposableIncome),
          healthScore,
          cumulativeSavings: Math.round(cumulativeSavings),
          hasEvent: labels.length > 0,
        };
        if (labels[0] !== undefined) point.eventLabel = labels[0];
        if (labels.length > 0) point.activeEventLabels = labels;
        points.push(point);
      }

      const breakpointMonth = points.find((point) => point.disposableIncome < 0)?.month;
      const lowestDisposableIncome = points.reduce((min, point) => Math.min(min, point.disposableIncome), Number.POSITIVE_INFINITY);
      const lastPoint = points[points.length - 1];

      const scenarioResult: ScenarioResult = {
        id: crypto.randomUUID(),
        name: events.length >= 2 ? "Stress test" : "Projection courante",
        events: sortedEvents,
        projections: points,
        isStressTest: events.length >= 2,
      };
      if (breakpointMonth !== undefined) scenarioResult.breakpointMonth = breakpointMonth;
      if (Number.isFinite(lowestDisposableIncome)) scenarioResult.lowestDisposableIncome = lowestDisposableIncome;
      if (lastPoint !== undefined) {
        scenarioResult.finalDisposableIncome = lastPoint.disposableIncome;
        scenarioResult.finalHealthScore = lastPoint.healthScore;
      }

      setResult(scenarioResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [profile, baseResult, events, horizon, setResult, setLoading, setError]);

  return { compute };
}
