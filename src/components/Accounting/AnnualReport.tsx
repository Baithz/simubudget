// =============================================================================
// Fichier  : src/components/Accounting/AnnualReport.tsx
// Auteur   : KREMER Regis
// Desc.    : Rapport annuel complet - bilan, fiscalite, optimisation
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation du fichier Phase 4
//   2026-04-29 | KREMER Régis | Refonte Phase 8 - wrapper premium fluide
// =============================================================================

import { useMemo } from "react";
import { motion } from "framer-motion";
import { clsx } from "clsx";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell,
} from "recharts";
import { useAccountingStore } from "@/store/accountingStore";
import { useProfileStore }    from "@/store/profileStore";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/types/accounting";
import type { ExpenseCategory } from "@/types/accounting";
import { formatEur }           from "@/utils/formatCurrency";

// ── Estimation IR simplifie (barème 2025) ────────────────────────────────────

function estimateIncomeTax(annualNet: number, situation: string, nbChildren: number): number {
  if (annualNet <= 0) return 0;

  // Abattement 10% frais professionnels (plafonné)
  const abattement = Math.min(annualNet * 0.10, 14_171);
  const revenuImposable = annualNet - abattement;

  // Parts fiscales
  let parts = situation === "couple" ? 2.0 : 1.0;
  parts += Math.min(nbChildren, 2) * 0.5 + Math.max(0, nbChildren - 2) * 1.0;

  const quotient = revenuImposable / parts;

  // Barème 2025 (tranches)
  let impot = 0;
  if (quotient > 177_106) impot += (quotient - 177_106) * 0.45;
  if (quotient > 84_529)  impot += (Math.min(quotient, 177_106) - 84_529) * 0.41;
  if (quotient > 28_797)  impot += (Math.min(quotient, 84_529)  - 28_797) * 0.30;
  if (quotient > 11_520)  impot += (Math.min(quotient, 28_797)  - 11_520) * 0.11;

  impot *= parts;

  // Decote (si impôt brut < seuil)
  if (situation === "couple") {
    if (impot < 3_402) impot = Math.max(0, impot - (3_402 - impot) * 0.4525);
  } else {
    if (impot < 1_929) impot = Math.max(0, impot - (1_929 - impot) * 0.4525);
  }

  return Math.round(Math.max(0, impot));
}

// ── Niches fiscales potentielles ──────────────────────────────────────────────

interface TaxOptimization {
  label:      string;
  potential:  number;    // Reduction IR potentielle
  condition:  string;
  action:     string;
}

function computeTaxOptimizations(annualNet: number, situation: string): TaxOptimization[] {
  const opts: TaxOptimization[] = [];

  // PER (Epargne retraite)
  const perLimit = Math.min(annualNet * 0.10, 37_094);
  if (annualNet > 20_000) {
    const saving = estimateIncomeTax(annualNet, situation, 0) -
                   estimateIncomeTax(annualNet - Math.min(perLimit, 4_000), situation, 0);
    opts.push({
      label:     "PER Individuel (Epargne retraite)",
      potential: saving,
      condition: `Versez jusqu'a ${formatEur(perLimit)} sur un PER pour deduire de vos revenus imposables.`,
      action:    "Ouvrez un PER chez Linxea, Boursorama ou Suravenir. Versez avant le 31 decembre.",
    });
  }

  // Dons associations
  if (annualNet > 15_000) {
    opts.push({
      label:     "Dons associations (66% reduction)",
      potential: 200,
      condition: "Un don de 300 EUR a une association reconnue vous reduit l'IR de 198 EUR.",
      action:    "Conservez le recu fiscal. Deduisez dans votre declaration de revenus (case 7UF).",
    });
  }

  // Emploi domicile
  opts.push({
    label:     "Emploi a domicile (50% credit IR)",
    potential: 1_500,
    condition: "Garde d'enfants, menage, jardinage — 50% des depenses en credit d'impot (max 12 000 EUR).",
    action:    "Declarez via CESU ou PAJEMPLOI. Montant crediteur sur votre IR.",
  });

  // Travaux economie energie
  opts.push({
    label:     "MaPrimeRenov' + CEE",
    potential: 2_000,
    condition: "Si vous etes proprietaire, les travaux d'isolation ou de chauffage sont subventionnes.",
    action:    "Simulez sur maprimerenov.gouv.fr avant tout chantier.",
  });

  return opts.sort((a, b) => b.potential - a.potential);
}

// ── Composant principal ───────────────────────────────────────────────────────

export function AnnualReport() {
  const profile = useProfileStore((s) => s.profile);
  const store   = useAccountingStore();
  const budget  = store.getBudget();

  const year = new Date().getFullYear();

  // Revenus annuels imposables
  const taxableAnnual = store.incomes
    .filter((l) => l.isTaxable)
    .reduce((s, l) => s + l.annualAmount, 0);

  const totalAnnualIncome = budget.totalIncomeAnnual;
  const totalAnnualExpenses = budget.totalExpensesAnnual;
  const annualBalance = budget.balanceAnnual;

  const estimatedTax = useMemo(() => {
    if (!profile) return 0;
    return estimateIncomeTax(
      taxableAnnual || (profile.salaryNet * 12 + profile.bonusAnnual),
      profile.situation,
      profile.children.length,
    );
  }, [taxableAnnual, profile]);

  const netAfterTax = totalAnnualIncome - estimatedTax;

  const taxOpts = useMemo(() =>
    computeTaxOptimizations(taxableAnnual || (profile?.salaryNet ?? 0) * 12, profile?.situation ?? "single"),
    [taxableAnnual, profile]
  );

  const totalTaxSaving = taxOpts.reduce((s, o) => s + o.potential, 0);

  // Donnees graphe dépenses par catégorie
  const chartData = (Object.entries(budget.expenseByCategory) as [ExpenseCategory, number][])
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([cat, monthly]) => ({
      name:    CATEGORY_LABELS[cat].substring(0, 12),
      monthly: Math.round(monthly),
      annual:  Math.round(monthly * 12),
      color:   CATEGORY_COLORS[cat],
    }));

  if (!profile) {
    return (
      <div className="p-8 text-center text-ink-muted">
        Configurez votre profil pour voir le rapport annuel.
      </div>
    );
  }

  return (
    <div className="page-shell space-y-6">

      <div>
        <h1 className="text-2xl font-bold text-ink-primary">
          Rapport Annuel {year}
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          Bilan complet, estimation fiscale et optimisations.
        </p>
      </div>

      {/* Bilan global */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Revenus nets annuels" value={formatEur(totalAnnualIncome)} color="text-green-600 dark:text-green-400" />
        <StatCard label="Depenses annuelles" value={formatEur(totalAnnualExpenses)} color="text-red-500 dark:text-red-400" />
        <StatCard
          label="Solde annuel"
          value={`${annualBalance >= 0 ? "+" : ""}${formatEur(annualBalance)}`}
          color={annualBalance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}
        />
      </div>

      {/* Indicateurs cles */}
      <div className="card rounded-2xl p-5 shadow-card">
        <p className="text-sm font-semibold text-ink-secondary mb-4">Indicateurs cles</p>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
          <KpiLine label="Taux d'epargne"          value={`${(budget.savingsRate * 100).toFixed(1)}%`} target="Objectif : 10-15%" ok={budget.savingsRate >= 0.10} />
          <KpiLine label="Taux charges fixes"       value={`${(budget.fixedChargesRatio * 100).toFixed(1)}%`} target="Seuil : < 60%" ok={budget.fixedChargesRatio < 0.60} />
          <KpiLine label="Taux endettement"         value={`${(budget.debtRatio * 100).toFixed(1)}%`} target="Plafond : 33%" ok={budget.debtRatio <= 0.33} />
          <KpiLine label="Charges optimisables/mois" value={formatEur(budget.optimizableAmount)} target="Depenses non obligatoires" ok />
          <KpiLine label="Impot estime"             value={formatEur(estimatedTax)} target={`${((estimatedTax / Math.max(totalAnnualIncome, 1)) * 100).toFixed(1)}% des revenus`} ok={estimatedTax < totalAnnualIncome * 0.15} />
          <KpiLine label="Reste apres IR"           value={formatEur(netAfterTax)} target="Revenu disponible reel" ok={netAfterTax > 0} />
        </div>
      </div>

      {/* Graphe depenses */}
      {chartData.length > 0 && (
        <div className="card rounded-2xl p-5 shadow-card">
          <p className="text-sm font-semibold text-ink-secondary mb-4">
            Dépenses par catégorie — comparaison mensuel / annuel
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ left: 10, right: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text-muted)" }} angle={-20} textAnchor="end" />
              <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false}
                tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v: number, name: string) => [formatEur(v), name === "monthly" ? "Mensuel" : "Annuel"]}
                contentStyle={{ borderRadius: 12, fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => v === "monthly" ? "Mensuel" : "Annuel"} />
              <Bar dataKey="monthly" name="monthly" radius={[4, 4, 0, 0]}>
                {chartData.map((d, i) => <Cell key={i} fill={d.color} opacity={0.7} />)}
              </Bar>
              <Bar dataKey="annual" name="annual" radius={[4, 4, 0, 0]}>
                {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Estimation fiscale */}
      <div className="card rounded-2xl p-5 shadow-card space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-ink-secondary">
              Estimation Impot sur le Revenu {year}
            </p>
            <p className="text-xs text-ink-muted mt-0.5">
              Bareme {year}, {profile.situation === "couple" ? "declaration commune" : "declaration individuelle"},
              {profile.children.length} enfant{profile.children.length > 1 ? "s" : ""}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold font-mono text-ink-primary">{formatEur(estimatedTax)}</p>
            <p className="text-xs text-ink-muted">estimation indicative</p>
          </div>
        </div>

        <div className="border-t [border-color:var(--border)] pt-3 space-y-2">
          <TaxLine label="Revenus imposables"      value={formatEur(taxableAnnual || (profile.salaryNet * 12 + profile.bonusAnnual))} />
          <TaxLine label="Abattement frais pro (10%)" value={`- ${formatEur(Math.min((taxableAnnual || profile.salaryNet * 12) * 0.10, 14_171))}`} />
          <TaxLine label="IR brut estime"          value={formatEur(estimatedTax)} bold />
          <TaxLine label="Revenu mensuel apres IR" value={formatEur(netAfterTax / 12)} bold />
        </div>

        <p className="text-xs text-ink-muted italic">
          Estimation basee sur le bareme {year}. Ne tient pas compte de toutes les deductions possibles.
          Vérifiez sur impots.gouv.fr.
        </p>
      </div>

      {/* Optimisations fiscales */}
      <div className="card rounded-2xl p-5 shadow-card space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink-secondary">
            Optimisations fiscales potentielles
          </p>
          <span className="text-sm font-bold text-green-600 dark:text-green-400">
            Jusqu'a {formatEur(totalTaxSaving)} d'economie
          </span>
        </div>

        <div className="space-y-3">
          {taxOpts.map((opt, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-green-50 dark:bg-green-950/50 border border-green-100 dark:border-green-900 rounded-xl p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-ink-primary">{opt.label}</p>
                  <p className="text-xs text-ink-muted mt-1">{opt.condition}</p>
                  <p className="text-xs text-ink-muted mt-1 italic">Action : {opt.action}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-green-700 dark:text-green-400">
                    -{formatEur(opt.potential)}/an
                  </p>
                  <p className="text-xs text-ink-muted">d'IR</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-ink-muted text-center">
        Estimation non contractuelle. Consultez un expert-comptable ou le service des impots pour votre situation exacte.
      </p>
    </div>
  );
}

// ── Composants internes ────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="card rounded-2xl p-5 shadow-card text-center">
      <p className="text-xs text-ink-muted mb-2">{label}</p>
      <p className={clsx("text-2xl font-bold font-mono", color)}>{value}</p>
    </div>
  );
}

function KpiLine({ label, value, target, ok }: { label: string; value: string; target: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs font-medium text-ink-secondary">{label}</p>
        <p className="text-xs text-ink-muted">{target}</p>
      </div>
      <div className="text-right">
        <p className={clsx("text-sm font-mono font-bold", ok ? "text-green-600 dark:text-green-400" : "text-orange-500")}>{value}</p>
        <span className={clsx("text-xs", ok ? "text-green-500" : "text-orange-400")}>{ok ? "OK" : "A optimiser"}</span>
      </div>
    </div>
  );
}

function TaxLine({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-ink-muted">{label}</span>
      <span className={clsx("text-xs font-mono", bold ? "font-bold text-ink-primary" : "text-ink-secondary")}>{value}</span>
    </div>
  );
}
