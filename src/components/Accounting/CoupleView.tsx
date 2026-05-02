// =============================================================================
// Fichier  : src/components/Accounting/CoupleView.tsx
// Auteur   : KREMER Regis
// Desc.    : Vue couple - comparaison revenus/depenses/epargne par personne
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-27 | KREMER Regis | Creation Phase 6
//   2026-04-28 | KREMER Regis | Correction TS strict - whoSavesMore comparaison
//   2026-04-29 | KREMER Regis | Phase 9.2 - affichage nominatif personne A/B
//   2026-05-02 | KREMER Régis | Correction lint ESLint 9 — variables inutilisées et règles React adaptées
// =============================================================================

import { clsx } from "clsx";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useAccountingStore } from "@/store/accountingStore";
import { useProfileStore }    from "@/store/profileStore";
import { formatEur } from "@/utils/formatCurrency";

function personName(profile: ReturnType<typeof useProfileStore.getState>["profile"]): string {
  const full = `${profile.holder?.firstName ?? ""} ${profile.holder?.lastName ?? ""}`.trim();
  return full.length > 0 ? full : "Personne A";
}

function partnerName(profile: ReturnType<typeof useProfileStore.getState>["profile"]): string {
  if (!profile.partner) return "Personne B";
  const full = `${profile.partner.firstName ?? ""} ${profile.partner.lastName ?? ""}`.trim();
  return full.length > 0 ? full : profile.partner.name || "Personne B";
}

export function CoupleView() {
  const profile      = useProfileStore((s) => s.profile);
  const accounting   = useAccountingStore();
  const personALabel = personName(profile);
  const partnerLabel = partnerName(profile);
  const coupleBudget = accounting.getCoupleBudget(personALabel, partnerLabel);

  const hasPartnerData =
    accounting.incomes.some((l) => l.owner === "partner") ||
    accounting.expenses.some((l) => l.owner === "partner");

  if (!hasPartnerData) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
        <div className="w-12 h-12 rounded-2xl [background:var(--bg-surface-2)]  flex items-center justify-center">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6 text-ink-muted">
            <path d="M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM14.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.615 16.428a1.224 1.224 0 0 1-.569-1.175 6.002 6.002 0 0 1 11.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 0 1 7 17a9.953 9.953 0 0 1-5.385-1.572ZM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 0 0-1.588-3.755 4.502 4.502 0 0 1 5.874 2.636.818.818 0 0 1-.36.98A7.465 7.465 0 0 1 14.5 16Z"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-ink-secondary dark:text-ink-muted">Aucune donnee conjoint</p>
          <p className="text-xs text-ink-muted dark:text-ink-muted mt-1 max-w-xs">
            Ajoutez des revenus ou dépenses attribués à la personne B dans les onglets Revenus et Depenses
            en utilisant le champ "Propriétaire".
          </p>
        </div>
      </div>
    );
  }

  if (!coupleBudget) return null;

  const { me, partner, combined, whoSavesMore, whoSpendMore, rebalanceSuggestion } = coupleBudget;

  // Données pour le graphe comparatif
  const chartData = [
    {
      name: "Revenus",
      [me.label]:      Math.round(me.totalIncomeMonthly),
      [partner.label]: Math.round(partner.totalIncomeMonthly),
    },
    {
      name: "Dépenses",
      [me.label]:      Math.round(me.totalExpensesMonthly),
      [partner.label]: Math.round(partner.totalExpensesMonthly),
    },
    {
      name: "Solde",
      [me.label]:      Math.max(0, Math.round(me.balanceMonthly)),
      [partner.label]: Math.max(0, Math.round(partner.balanceMonthly)),
    },
  ];

  return (
    <div className="space-y-5">

      {/* ── Cartes résumé par personne ── */}
      <div className="grid grid-cols-2 gap-4">
        {[me, partner].map((p, idx) => {
          const isWinner = (whoSavesMore === "me" && idx === 0) || (whoSavesMore === "partner" && idx === 1);
          return (
            <div
              key={p.label}
              className={clsx(
                "rounded-2xl p-5 border transition-all",
                isWinner
                  ? "border-emerald-300 dark:border-[var(--fin-green-border)] [background:var(--fin-green-bg)] dark:bg-[var(--fin-green-bg)]/20"
                  : "border-[var(--border)] dark:border-[var(--border)] [background:var(--bg-surface)] dark:bg-[var(--bg-surface)]"
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-ink-primary dark:text-[#e8e8e6]">{p.label}</span>
                {isWinner && (whoSavesMore === "me" || whoSavesMore === "partner") && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full
                                   bg-emerald-100 dark:bg-[var(--fin-green-bg)] text-[var(--fin-green)] dark:text-[var(--fin-green)]">
                    Epargne +
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <StatRow label="Revenus" value={formatEur(p.totalIncomeMonthly)} />
                <StatRow label="Dépenses" value={formatEur(p.totalExpensesMonthly)} negative />
                <div className="border-t border-slate-100 dark:border-[var(--border)] pt-2">
                  <StatRow
                    label="Solde"
                    value={formatEur(p.balanceMonthly)}
                    highlight
                    positive={p.balanceMonthly >= 0}
                    negative={p.balanceMonthly < 0}
                  />
                  <StatRow
                    label="Taux d'epargne"
                    value={`${(p.savingsRate * 100).toFixed(1)}%`}
                    positive={p.savingsRate >= 0.1}
                  />
                  <StatRow
                    label="Contribution charges communes"
                    value={`${(p.shareOfCommonExpenses * 100).toFixed(0)}%`}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Graphe comparatif ── */}
      <div className="[background:var(--bg-surface)] dark:bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] dark:border-[var(--border)] p-5">
        <p className="text-sm font-semibold text-ink-secondary dark:text-[#c8c8c5] mb-4">
          Comparaison revenus / depenses / solde
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} barGap={4} barCategoryGap="30%">
            <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v: number) => formatEur(v)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey={me.label}      fill="var(--brand-2)" radius={[4, 4, 0, 0]} />
            <Bar dataKey={partner.label} fill="#8b5cf6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Charges communes ── */}
      <div className="[background:var(--bg-surface)] dark:bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] dark:border-[var(--border)] p-5">
        <p className="text-sm font-semibold text-ink-secondary dark:text-[#c8c8c5] mb-3">
          Charges communes
        </p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-mono font-bold text-ink-primary dark:text-[#e8e8e6]">
              {formatEur(coupleBudget.sharedExpenses)}
            </p>
            <p className="text-xs text-ink-muted dark:text-[#4b4b48] mt-0.5">par mois au total</p>
          </div>
          <div className="text-right text-xs text-ink-muted dark:text-[#6b6b67] space-y-1">
            <div>{me.label} : {formatEur(coupleBudget.sharedExpenses * me.shareOfCommonExpenses)}</div>
            <div>{partner.label} : {formatEur(coupleBudget.sharedExpenses * partner.shareOfCommonExpenses)}</div>
            <div className="text-[10px] text-ink-muted">Repartition proportionnelle aux revenus</div>
          </div>
        </div>

        {/* Barre de répartition */}
        <div className="mt-3 h-3 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-sky-400 transition-all duration-700"
            style={{ width: `${me.shareOfCommonExpenses * 100}%` }}
          />
          <div className="h-full bg-violet-400 flex-1" />
        </div>
        <div className="flex justify-between text-[10px] text-ink-muted mt-1">
          <span>{me.label} ({(me.shareOfCommonExpenses * 100).toFixed(0)}%)</span>
          <span>{partner.label} ({(partner.shareOfCommonExpenses * 100).toFixed(0)}%)</span>
        </div>
      </div>

      {/* ── Indicateurs qui épargne/dépense plus ── */}
      <div className="grid grid-cols-2 gap-3">
        <InsightCard
          label="Epargne le plus"
          value={whoSavesMore === "equal" ? "Equilibre" : whoSavesMore === "me" ? me.label : partner.label}
          icon="savings"
          positive
        />
        <InsightCard
          label="Depense le plus"
          value={whoSpendMore === "equal" ? "Equilibre" : whoSpendMore === "me" ? me.label : partner.label}
          icon="spend"
        />
      </div>

      {/* ── Suggestion de rééquilibrage ── */}
      {rebalanceSuggestion && (
        <div className="[background:var(--fin-amber-bg)] dark:bg-[var(--fin-amber-bg)]/20 border border-[var(--fin-amber-border)] dark:border-[var(--fin-amber-border)]
                        rounded-2xl p-4">
          <p className="text-xs font-semibold text-[var(--fin-amber)] dark:text-[var(--fin-amber)] mb-1">
            Suggestion d'optimisation couple
          </p>
          <p className="text-sm text-amber-800 dark:text-[var(--fin-amber)]">{rebalanceSuggestion}</p>
        </div>
      )}

      {/* ── Bilan combiné ── */}
      <div className="[background:var(--bg-surface)] dark:bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] dark:border-[var(--border)] p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted dark:text-[#4b4b48] mb-3">
          Bilan couple consolide
        </p>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xl font-mono font-bold text-ink-primary dark:text-[#e8e8e6]">
              {formatEur(combined.totalIncomeMonthly)}
            </p>
            <p className="text-xs text-ink-muted mt-0.5">Revenus totaux</p>
          </div>
          <div>
            <p className="text-xl font-mono font-bold text-ink-primary dark:text-[#e8e8e6]">
              {formatEur(combined.totalExpensesMonthly)}
            </p>
            <p className="text-xs text-ink-muted mt-0.5">Depenses totales</p>
          </div>
          <div>
            <p className={clsx(
              "text-xl font-mono font-bold",
              combined.balanceMonthly >= 0 ? "text-[var(--fin-green)] dark:text-[var(--fin-green)]" : "text-[var(--fin-red)] dark:text-[var(--fin-red)]"
            )}>
              {formatEur(combined.balanceMonthly)}
            </p>
            <p className="text-xs text-ink-muted mt-0.5">Solde commun</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sous-composants ────────────────────────────────────────────────────────────

function StatRow({
  label, value, highlight = false, positive = false, negative = false,
}: {
  label: string; value: string; highlight?: boolean; positive?: boolean; negative?: boolean;
}) {
  const valueColor = positive ? "var(--fin-green)"
    : negative  ? "var(--fin-red)"
    : highlight ? "var(--text-primary)"
    : "var(--text-secondary)";

  return (
    <div className="flex justify-between items-center py-0.5">
      <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span
        className="text-xs font-mono font-medium tabular-nums"
        style={{ color: valueColor }}
      >
        {value}
      </span>
    </div>
  );
}

function InsightCard({
  label, value, icon: _icon, positive = false,
}: {
  label: string; value: string; icon: string; positive?: boolean;
}) {
  return (
    <div className="[background:var(--bg-surface)] dark:bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] dark:border-[var(--border)] p-4">
      <p className="text-xs text-ink-muted dark:text-[#4b4b48]">{label}</p>
      <p className={clsx(
        "text-sm font-semibold mt-1",
        positive ? "text-[var(--fin-green)] dark:text-[var(--fin-green)]" : "text-ink-secondary dark:text-[#c8c8c5]"
      )}>
        {value}
      </p>
    </div>
  );
}
