// =============================================================================
// Fichier  : src/components/Housing/PurchaseModule/BuyVsRentChart.tsx
// Auteur   : KREMER Régis
// Desc.    : Graphe comparatif achat vs location sur 20 ans (Recharts).
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Régis | Création du fichier Phase 2
//   2026-04-30 | KREMER Régis | Phase 10 — tokens CSS, zéro couleur hardcodée, accents
//   2026-05-01 | KREMER Régis | Phase 11 — Fix 6 : formatYears pluriel conditionnel
//   2026-05-02 | KREMER Régis | Correction lint ESLint 9 — variables inutilisées et règles React adaptées
// =============================================================================

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Legend,
} from "recharts";
import { formatEur } from "@/utils/formatCurrency";
import type { PurchaseResult } from "@/types/purchase";

interface DataPoint {
  year:               number;
  label:              string;
  rentalCumulative:   number;
  purchaseCumulative: number;
  wealthBuilt:        number;
}

function buildChartData(result: PurchaseResult, years = 20): DataPoint[] {
  const RENT_INCREASE  = 0.018;
  const PRICE_INCREASE = 0.015;

  const monthlyPayment   = result.monthlyPaymentWithInsurance;
  const rentEquivalent   = result.rentEquivalent;
  const annualCapitalRep = result.loanAmount / 20;

  let rentalCumul  = 0;
  let purchaseCumul = result.notaryFees + result.guaranteeFees;
  let rentAnnual   = rentEquivalent * 12;
  let wealth       = result.residualSavings;

  const data: DataPoint[] = [];
  for (let y = 0; y <= years; y++) {
    data.push({
      year: y,
      label:              `An ${y}`,
      rentalCumulative:   Math.round(rentalCumul + rentAnnual * y),
      purchaseCumulative: Math.round(purchaseCumul + monthlyPayment * 12 * y),
      wealthBuilt:        Math.round(wealth + annualCapitalRep * y + result.loanAmount * PRICE_INCREASE * y),
    });
    rentAnnual *= (1 + RENT_INCREASE);
  }
  return data;
}

interface Props {
  result:        PurchaseResult;
  breakEvenYear: number;
}

export function BuyVsRentChart({ result, breakEvenYear }: Props) {
  const data = buildChartData(result);

  // Couleurs via tokens CSS — lues au runtime pour suivre le thème
  const colBlue   = "var(--brand-2)";   // #0ea5e9
  const colGreen  = "var(--fin-green)";
  const colAmber  = "var(--fin-amber)";
  const colMuted  = "var(--text-muted)";

  const tooltipStyle = {
    background:   "var(--bg-surface)",
    border:       "1px solid var(--border)",
    borderRadius: 12,
    fontSize:     12,
    color:        "var(--text-primary)",
  };

  return (
    <div className="space-y-5">
      {/* Graphe coûts cumulatifs */}
      <div>
        <p
          className="text-xs font-bold uppercase tracking-widest mb-3"
          style={{ color: "var(--text-muted)" }}
        >
          Coût cumulatif total sur 20 ans
        </p>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data} margin={{ top: 5, right: 16, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: colMuted }}
              tickLine={false}
              interval={4}
            />
            <YAxis
              tick={{ fontSize: 10, fill: colMuted }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${(v / 1000).toFixed(0)} k`}
            />
            <Tooltip
              formatter={(v: number, name: string) => [
                formatEur(v),
                name === "rentalCumulative"    ? "Coût location"
                : name === "purchaseCumulative" ? "Coût achat"
                : "Patrimoine constitué",
              ]}
              contentStyle={tooltipStyle}
            />
            <Legend
              iconType="line"
              wrapperStyle={{ fontSize: 11, color: "var(--text-secondary)" }}
              formatter={(value) =>
                value === "rentalCumulative"    ? "Location (loyers cumulatifs)"
                : value === "purchaseCumulative" ? "Achat (mensualités + frais)"
                : "Patrimoine constitué"
              }
            />
            {breakEvenYear > 0 && breakEvenYear <= 20 && (
              <ReferenceLine
                x={`An ${breakEvenYear}`}
                stroke={colGreen}
                strokeDasharray="5 3"
                strokeWidth={1.5}
                label={{
                  value:    `Bascule an ${breakEvenYear}`,
                  fontSize: 10,
                  fill:     colGreen,
                  position: "top",
                }}
              />
            )}
            <Line
              type="monotone"
              dataKey="rentalCumulative"
              stroke={colAmber}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: colAmber }}
            />
            <Line
              type="monotone"
              dataKey="purchaseCumulative"
              stroke={colBlue}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: colBlue }}
            />
            <Line
              type="monotone"
              dataKey="wealthBuilt"
              stroke={colGreen}
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
              activeDot={{ r: 4, fill: colGreen }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Hypothèses */}
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium"
        style={{ color: "var(--text-muted)" }}
      >
        <span className="font-bold">Hypothèses :</span>
        <span>Revalorisation loyers +1,8 %/an</span>
        <span>·</span>
        <span>Plus-value bien +1,5 %/an</span>
        <span>·</span>
        <span>Loyer équivalent {formatEur(result.rentEquivalent)}/mois</span>
      </div>
    </div>
  );
}
