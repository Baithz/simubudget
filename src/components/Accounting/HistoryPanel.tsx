// =============================================================================
// Fichier  : src/components/Accounting/HistoryPanel.tsx
// Auteur   : KREMER Regis
// Desc.    : Historique mensuel - tendances SSF, evolution solde, meilleur/pire mois
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-27 | KREMER Regis | Creation Phase 6
//   2026-04-28 | KREMER Regis | Correction TS strict - guards undefined sur snapshots
//   2026-04-29 | KREMER Regis | Correction crash historique sur snapshots invalides
// =============================================================================

import { clsx } from "clsx";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, AreaChart,
} from "recharts";
import { useAccountingStore } from "@/store/accountingStore";
import { formatEur }          from "@/utils/formatCurrency";
import type { MonthlySnapshot } from "@/types/profile";

function isValidSnapshot(snapshot: MonthlySnapshot | null | undefined): snapshot is MonthlySnapshot {
  return Boolean(
    snapshot &&
    typeof snapshot.month === "string" &&
    Number.isFinite(snapshot.healthScore) &&
    Number.isFinite(snapshot.totalIncomeMonthly) &&
    Number.isFinite(snapshot.totalExpensesMonthly) &&
    Number.isFinite(snapshot.balanceMonthly) &&
    Number.isFinite(snapshot.savingsRate)
  );
}

function monthLabel(isoMonth: string): string {
  const parts = isoMonth.split("-");
  const year  = parts[0] ?? "2026";
  const month = parts[1] ?? "01";
  const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
  return d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
}

export function HistoryPanel() {
  const accounting = useAccountingStore();
  const snapshots  = accounting.getSnapshots().filter(isValidSnapshot);

  if (snapshots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
        <div className="w-12 h-12 rounded-2xl [background:var(--bg-surface-2)]  flex items-center justify-center">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6 text-ink-muted">
            <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-ink-secondary dark:text-ink-muted">
            Pas encore d'historique
          </p>
          <p className="text-xs text-ink-muted dark:text-ink-muted mt-1 max-w-xs">
            L'historique se constitué automatiquement chaque fois que vous calculez
            votre budget avec des donnees comptables saisies. Revenez le mois prochain !
          </p>
        </div>
      </div>
    );
  }

  // Statistiques
  const best   = snapshots.reduce((a, b) => b.balanceMonthly > a.balanceMonthly ? b : a, snapshots[0]!);
  const worst  = snapshots.reduce((a, b) => b.balanceMonthly < a.balanceMonthly ? b : a, snapshots[0]!);
  const avgBalance = snapshots.reduce((s, x) => s + x.balanceMonthly, 0) / snapshots.length;
  const avgSsf     = snapshots.reduce((s, x) => s + x.healthScore,    0) / snapshots.length;

  // Trend SSF : comparer dernier mois vs premier mois
  const first   = snapshots[0]!;
  const last    = snapshots[snapshots.length - 1]!;
  const ssfTrend     = last.healthScore    - first.healthScore;
  const balanceTrend = last.balanceMonthly - first.balanceMonthly;

  // Données graphe : format pour recharts
  const chartData = snapshots.map((s) => ({
    month:       monthLabel(s.month),
    solde:       Math.round(s.balanceMonthly),
    ssf:         Math.round(s.healthScore),
    revenus:     Math.round(s.totalIncomeMonthly),
    depenses:    Math.round(s.totalExpensesMonthly),
    epargne:     Math.round(s.savingsRate * 100),
  }));

  // Comparaison si on a >= 2 mois
  const hasComparison = snapshots.length >= 2;
  const prevMonth     = hasComparison ? snapshots[snapshots.length - 2]! : last;
  const currMonth     = last;
  const balanceDiff   = currMonth.balanceMonthly - prevMonth.balanceMonthly;
  const ssfDiff       = currMonth.healthScore - prevMonth.healthScore;

  return (
    <div className="space-y-5">

      {/* ── Résumé rapide ── */}
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard
          label="Meilleur mois"
          value={formatEur(best.balanceMonthly)}
          sub={monthLabel(best.month)}
          positive
        />
        <SummaryCard
          label="Pire mois"
          value={formatEur(worst.balanceMonthly)}
          sub={monthLabel(worst.month)}
          negative={worst.balanceMonthly < 0}
        />
        <SummaryCard
          label="Solde moyen"
          value={formatEur(avgBalance)}
          sub={`sur ${snapshots.length} mois`}
          positive={avgBalance >= 0}
        />
        <SummaryCard
          label="SSF moyen"
          value={`${avgSsf.toFixed(0)}/100`}
          sub={ssfTrend >= 0 ? `+${ssfTrend.toFixed(0)} pts depuis debut` : `${ssfTrend.toFixed(0)} pts depuis debut`}
          positive={ssfTrend >= 0}
          negative={ssfTrend < -5}
        />
      </div>

      {/* ── Comparaison mois courant vs précédent ── */}
      {hasComparison && (
        <div className="[background:var(--bg-surface)] dark:bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] dark:border-[var(--border)] p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted dark:text-[var(--text-muted)] mb-3">
            {monthLabel(currMonth.month)} vs {monthLabel(prevMonth.month)}
          </p>
          <div className="grid grid-cols-2 gap-4">
            <CompareRow
              label="Solde"
              current={formatEur(currMonth.balanceMonthly)}
              diff={balanceDiff}
              diffLabel={`${balanceDiff >= 0 ? "+" : ""}${formatEur(balanceDiff)}`}
            />
            <CompareRow
              label="SSF"
              current={`${currMonth.healthScore}/100`}
              diff={ssfDiff}
              diffLabel={`${ssfDiff >= 0 ? "+" : ""}${ssfDiff.toFixed(0)} pts`}
            />
            <CompareRow
              label="Revenus"
              current={formatEur(currMonth.totalIncomeMonthly)}
              diff={currMonth.totalIncomeMonthly - prevMonth.totalIncomeMonthly}
              diffLabel={`${currMonth.totalIncomeMonthly >= prevMonth.totalIncomeMonthly ? "+" : ""}${formatEur(currMonth.totalIncomeMonthly - prevMonth.totalIncomeMonthly)}`}
            />
            <CompareRow
              label="Dépenses"
              current={formatEur(currMonth.totalExpensesMonthly)}
              diff={prevMonth.totalExpensesMonthly - currMonth.totalExpensesMonthly}
              diffLabel={`${currMonth.totalExpensesMonthly <= prevMonth.totalExpensesMonthly ? "" : "+"}${formatEur(currMonth.totalExpensesMonthly - prevMonth.totalExpensesMonthly)}`}
            />
          </div>
          {/* Message de contexte */}
          <p className={clsx(
            "mt-3 text-xs px-3 py-2 rounded-lg",
            balanceDiff >= 0
              ? "[background:var(--fin-green-bg)] dark:bg-[var(--fin-green-bg)]/20 text-[var(--fin-green)] dark:text-[var(--fin-green)]"
              : "[background:var(--fin-amber-bg)] dark:bg-[var(--fin-amber-bg)]/20 text-[var(--fin-amber)] dark:text-[var(--fin-amber)]"
          )}>
            Ce mois est{" "}
            {Math.abs(balanceDiff) > 0
              ? `${balanceDiff >= 0 ? "meilleur" : "moins bon"} de ${formatEur(Math.abs(balanceDiff))} que le mois precedent.`
              : "identique au mois precedent."
            }
            {avgBalance > 0 && balanceDiff < 0 && currMonth.balanceMonthly > avgBalance * 0.8
              ? " Vous restez au-dessus de votre moyenne."
              : ""
            }
          </p>
        </div>
      )}

      {/* ── Graphe évolution du solde ── */}
      {snapshots.length >= 2 && (
        <div className="[background:var(--bg-surface)] dark:bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] dark:border-[var(--border)] p-5">
          <p className="text-sm font-semibold text-ink-secondary dark:text-[var(--text-secondary)] mb-4">
            Evolution du solde mensuel
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="soldeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--fin-green)" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="var(--fin-green)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `${Math.round(v / 100) * 100}`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => formatEur(v)} labelStyle={{ fontSize: 12 }} />
              <ReferenceLine y={0} stroke="var(--fin-red)" strokeDasharray="4 4" strokeWidth={1} />
              <ReferenceLine y={avgBalance} stroke="var(--fin-amber)" strokeDasharray="4 2" strokeWidth={1} label={{ value: "Moy.", position: "right", fontSize: 10 }} />
              <Area type="monotone" dataKey="solde" stroke="var(--fin-green)" strokeWidth={2} fill="url(#soldeGrad)" dot={{ r: 3, fill: "var(--fin-green)" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Graphe SSF ── */}
      {snapshots.length >= 2 && (
        <div className="[background:var(--bg-surface)] dark:bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] dark:border-[var(--border)] p-5">
          <p className="text-sm font-semibold text-ink-secondary dark:text-[var(--text-secondary)] mb-4">
            Evolution du score de sante financiere (SSF)
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => [`${v}/100`, "SSF"]} />
              <ReferenceLine y={75} stroke="var(--fin-green)" strokeDasharray="4 2" strokeWidth={1} label={{ value: "Solide", position: "right", fontSize: 10 }} />
              <ReferenceLine y={50} stroke="var(--fin-amber)" strokeDasharray="4 2" strokeWidth={1} label={{ value: "Stable", position: "right", fontSize: 10 }} />
              <Line type="monotone" dataKey="ssf" stroke="var(--brand-2)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Tableau historique détaillé ── */}
      <div className="[background:var(--bg-surface)] dark:bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] dark:border-[var(--border)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)] dark:border-[var(--border)]">
          <p className="text-sm font-semibold text-ink-secondary dark:text-[var(--text-secondary)]">
            Detail par mois
          </p>
        </div>
        <div className="divide-y divide-[var(--border)] dark:divide-[var(--border)]">
          {[...snapshots].reverse().map((s) => (
            <HistoryRow key={s.month} snapshot={s} average={avgBalance} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Sous-composants ────────────────────────────────────────────────────────────

function SummaryCard({
  label, value, sub, positive = false, negative = false,
}: {
  label: string; value: string; sub: string; positive?: boolean; negative?: boolean;
}) {
  return (
    <div className="[background:var(--bg-surface)] dark:bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] dark:border-[var(--border)] p-4">
      <p className="text-xs text-ink-muted dark:text-[var(--text-muted)]">{label}</p>
      <p className={clsx(
        "text-lg font-mono font-bold mt-1",
        positive  ? "text-[var(--fin-green)] dark:text-[var(--fin-green)]" :
        negative  ? "text-red-600 dark:text-[var(--fin-red)]" :
        "text-ink-primary dark:text-[#e8e8e6]"
      )}>
        {value}
      </p>
      <p className="text-[10px] text-ink-muted dark:text-[var(--text-muted)] mt-0.5">{sub}</p>
    </div>
  );
}

function CompareRow({
  label, current, diff, diffLabel,
}: {
  label: string; current: string; diff: number; diffLabel: string;
}) {
  return (
    <div>
      <p className="text-xs text-ink-muted dark:text-[var(--text-muted)]">{label}</p>
      <p className="text-sm font-mono font-semibold text-ink-primary dark:text-[#e8e8e6]">{current}</p>
      <p className={clsx(
        "text-[10px] font-medium mt-0.5",
        diff > 0 ? "text-[var(--fin-green)] dark:text-[var(--fin-green)]" :
        diff < 0 ? "text-red-500 dark:text-[var(--fin-red)]" :
        "text-ink-muted"
      )}>
        {diffLabel}
      </p>
    </div>
  );
}

function HistoryRow({ snapshot, average }: { snapshot: MonthlySnapshot; average: number }) {
  const isAboveAvg = snapshot.balanceMonthly >= average;
  return (
    <div className="flex items-center px-5 py-3 gap-4">
      <div className="w-16 text-xs font-medium text-ink-muted dark:text-[#6b6b67] flex-shrink-0">
        {monthLabel(snapshot.month)}
      </div>
      <div className="flex-1 min-w-0 grid grid-cols-3 gap-3">
        <div>
          <p className="text-[10px] text-ink-muted dark:text-[var(--text-muted)]">Revenus</p>
          <p className="text-xs font-mono text-ink-secondary dark:text-[var(--text-secondary)]">
            {formatEur(snapshot.totalIncomeMonthly)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-ink-muted dark:text-[var(--text-muted)]">Dépenses</p>
          <p className="text-xs font-mono text-ink-secondary dark:text-[var(--text-secondary)]">
            {formatEur(snapshot.totalExpensesMonthly)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-ink-muted dark:text-[var(--text-muted)]">Solde</p>
          <p className={clsx(
            "text-xs font-mono font-semibold",
            snapshot.balanceMonthly >= 0 ? "text-[var(--fin-green)] dark:text-[var(--fin-green)]" : "text-red-500 dark:text-[var(--fin-red)]"
          )}>
            {formatEur(snapshot.balanceMonthly)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="text-right">
          <p className="text-[10px] text-ink-muted dark:text-[var(--text-muted)]">SSF</p>
          <p className="text-xs font-mono font-semibold text-ink-secondary dark:text-[var(--text-secondary)]">
            {snapshot.healthScore}
          </p>
        </div>
        <div className={clsx(
          "w-2 h-2 rounded-full flex-shrink-0",
          isAboveAvg ? "bg-emerald-400" : "bg-amber-400"
        )} />
      </div>
    </div>
  );
}
