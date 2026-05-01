// =============================================================================
// Fichier  : src/hooks/useProjection.ts
// Auteur   : KREMER Regis
// Desc.    : Hook de calcul des projections temporelles (logique client)
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation du fichier Phase 2
// =============================================================================

import { useCallback } from "react";
import { useProfileStore }  from "@/store/profileStore";
import { useScenarioStore } from "@/store/scenarioStore";
import { useSimulationStore } from "@/store/simulationStore";
import type { ProjectionPoint, ScenarioEvent, ScenarioResult } from "@/types/scenarios";

const MONTHS_FR = ["Jan","Fev","Mar","Avr","Mai","Jun","Jul","Aou","Sep","Oct","Nov","Dec"];

function monthLabel(offsetFromNow: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offsetFromNow);
  return `${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

/** Applique les modificateurs d'un evenement a un profil simplifie */
function applyEvent(
  base: { income: number; fixedCosts: number; rent: number },
  event: ScenarioEvent,
): typeof base {
  return {
    income:     base.income     + (event.salaryDelta     ?? 0),
    fixedCosts: base.fixedCosts + (event.fixedCostsDelta ?? 0),
    rent:       event.newRent   ?? base.rent,
  };
}

/** Estime un score SSF simplifie (0-100) a partir du taux d'effort */
function estimateSSF(income: number, rent: number, fixedCosts: number): number {
  if (income <= 0) return 0;
  const effortRatio = (rent + fixedCosts) / income;
  const rdv         = income - rent - fixedCosts - (income * 0.25); // 25% alim+transport
  if (rdv < 0) return Math.max(0, 20 - Math.abs(rdv) / 100);
  const effortScore = Math.max(0, 1 - (effortRatio - 0.25) / 0.25);
  return Math.round(Math.min(100, effortScore * 80 + (rdv / income) * 20));
}

export function useProjection() {
  const profile   = useProfileStore((s) => s.profile);
  const baseResult = useSimulationStore((s) => s.result);
  const { events, horizon, setResult, setLoading, setError } = useScenarioStore();

  const compute = useCallback(() => {
    if (!profile || !baseResult) return;
    setLoading(true);

    try {
      const baseIncome     = profile.salaryNet + (profile.partnerSalaryNet ?? 0) + profile.allocationsTotal;
      const baseRent       = (profile.currentHousing.rent ?? 0) + (profile.currentHousing.charges ?? 0);
      const baseFixedCosts = profile.phoneInternet + profile.insuranceTotal + profile.pensionPaid + profile.otherFixed;

      const points: ProjectionPoint[] = [];
      let current = { income: baseIncome, fixedCosts: baseFixedCosts, rent: baseRent };
      let cumSavings = profile.savingsMonths * (baseRent + baseFixedCosts);

      // Trier les evenements par mois
      const sortedEvents = [...events].sort((a, b) => a.monthOffset - b.monthOffset);

      for (let m = 0; m <= horizon; m++) {
        // Appliquer les evenements de ce mois
        const monthEvents = sortedEvents.filter((e) => e.monthOffset === m);
        let hasEvent = false;
        let eventLabel: string | undefined;

        for (const evt of monthEvents) {
          current  = applyEvent(current, evt);
          hasEvent = true;
          eventLabel = evt.label;
          // Cout ponctuel
          if (evt.oneTimeCost) cumSavings -= evt.oneTimeCost;
        }

        // Calcul reste a vivre simplifie
        const food      = 250 + (profile.children.length * 150);
        const transport = 100;
        const rdv       = current.income - current.rent - current.fixedCosts - food - transport;
        const ssf       = estimateSSF(current.income, current.rent, current.fixedCosts + food + transport);

        // Epargne cumulee (si rdv > 0, on suppose 30% part en epargne)
        if (rdv > 0) cumSavings += rdv * 0.30;
        else         cumSavings += rdv; // Desepargne

        const point: ProjectionPoint = {
          month:            m,
          label:            monthLabel(m),
          disposableIncome: Math.round(rdv),
          healthScore:      ssf,
          cumulativeSavings:Math.round(cumSavings),
          hasEvent,
        };
        if (eventLabel !== undefined) point.eventLabel = eventLabel;
        points.push(point);
      }

      // Trouver le point de rupture (premier mois < 0)
      const breakpointMonth = points.find((p) => p.disposableIncome < 0)?.month;

      const scenarioResult: ScenarioResult = {
        id:           crypto.randomUUID(),
        name:         "Projection courante",
        events,
        projections:  points,
        isStressTest: events.length >= 2,
      };
      if (breakpointMonth !== undefined) scenarioResult.breakpointMonth = breakpointMonth;
      setResult(scenarioResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [profile, baseResult, events, horizon, setResult, setLoading, setError]);

  return { compute };
}
