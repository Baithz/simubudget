// =============================================================================
// Fichier  : src/components/Accounting/DataInsightsPanel.tsx
// Auteur   : KREMER Régis
// Desc.    : Analyse avancée des données multi-profils, historique et projections.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-05-01 | KREMER Régis | Création ZIP 6 — exploitation données avancée
//   2026-05-03 | KREMER Régis | Phase 17 — analyse comportementale simple
// =============================================================================

import { useMemo, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid, Legend,
} from "recharts";
import { useAccountingStore } from "@/store/accountingStore";
import { useProfileListStore } from "@/store/profileListStore";
import { useProfileStore } from "@/store/profileStore";
import type { MonthlySnapshot, ProfileEntry, Situation, UserProfile } from "@/types/profile";
import { CATEGORY_LABELS, type AccountingState, type ExpenseCategory, type ExpenseLine, type IncomeLine, type MonthlyBudget } from "@/types/accounting";
import { formatEur, formatPct } from "@/utils/formatCurrency";
import { BehavioralInsights } from "@/components/Accounting/BehavioralInsights";

interface PersistedWrapper<T> {
  state?: Partial<T>;
}

interface ProfilePersistedState {
  profile?: UserProfile;
  hasCompletedOnboarding?: boolean;
}

interface ProfileDataPoint {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
  situation: Situation | "unknown";
  isCouple: boolean;
  totalIncomeMonthly: number;
  totalExpensesMonthly: number;
  balanceMonthly: number;
  savingsRate: number;
  debtRatio: number;
  snapshots: MonthlySnapshot[];
  closedMonthsCount: number;
  lastUsed: string;
  confidence: "complete" | "partial";
}

interface ProjectionPoint {
  month: string;
  monthLabel: string;
  balance: number;
  cumulative: number;
  reserveMonths: number;
}

const ACCOUNTING_KEY = "simubudget-accounting";
const PROFILE_KEY = "simubudget-profile";
const PROJECTION_MONTHS = 36;

function safeParse<T>(raw: string | null): PersistedWrapper<T> | null {
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as PersistedWrapper<T>;
  } catch {
    return null;
  }
}

function readScopedState<T>(baseKey: string, profileId: string): Partial<T> | null {
  const parsed = safeParse<T>(localStorage.getItem(`${baseKey}-${profileId}`));
  return parsed?.state ?? null;
}

function monthLabel(month: string): string {
  const [yearRaw, monthRaw] = month.split("-");
  const year = Number.parseInt(yearRaw ?? `${new Date().getFullYear()}`, 10);
  const monthIndex = Number.parseInt(monthRaw ?? "1", 10) - 1;
  return new Date(year, monthIndex, 1).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
}

function addMonths(monthKey: string, offset: number): string {
  const [yearRaw, monthRaw] = monthKey.split("-");
  const year = Number.parseInt(yearRaw ?? `${new Date().getFullYear()}`, 10);
  const monthIndex = Number.parseInt(monthRaw ?? "1", 10) - 1;
  const date = new Date(year, monthIndex + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function amountFromLine(line: ExpenseLine): number {
  return line.monthlyAmount;
}

function computeBudget(incomes: IncomeLine[], expenses: ExpenseLine[]): Pick<MonthlyBudget, "totalIncomeMonthly" | "totalExpensesMonthly" | "balanceMonthly" | "savingsRate" | "debtRatio"> {
  const totalIncomeMonthly = incomes.reduce((sum, line) => sum + line.monthlyAmount, 0);
  const totalExpensesMonthly = expenses.reduce((sum, line) => sum + amountFromLine(line), 0);
  const creditMonthly = expenses
    .filter((line) => line.category === "credit")
    .reduce((sum, line) => sum + amountFromLine(line), 0);
  const balanceMonthly = totalIncomeMonthly - totalExpensesMonthly;
  const savingsRate = totalIncomeMonthly > 0 ? Math.max(0, balanceMonthly) / totalIncomeMonthly : 0;
  const debtRatio = totalIncomeMonthly > 0 ? creditMonthly / totalIncomeMonthly : 0;
  return { totalIncomeMonthly, totalExpensesMonthly, balanceMonthly, savingsRate, debtRatio };
}

function readProfileData(entry: ProfileEntry): ProfileDataPoint {
  const accounting = readScopedState<AccountingState & { snapshots?: MonthlySnapshot[]; closedMonths?: string[] }>(ACCOUNTING_KEY, entry.id);
  const profileState = readScopedState<ProfilePersistedState>(PROFILE_KEY, entry.id);
  const profile = profileState?.profile;
  const incomes = accounting?.incomes ?? [];
  const expenses = accounting?.expenses ?? [];
  const snapshots = [...(accounting?.snapshots ?? [])].sort((a, b) => a.month.localeCompare(b.month));
  const budget = computeBudget(incomes, expenses);
  const situation = profile?.situation ?? "unknown";
  const isCouple = situation === "couple" || situation === "cohabiting";

  return {
    id: entry.id,
    name: entry.displayName,
    initials: entry.avatarInitials,
    avatarColor: entry.avatarColor,
    situation,
    isCouple,
    ...budget,
    snapshots,
    closedMonthsCount: accounting?.closedMonths?.length ?? 0,
    lastUsed: entry.lastUsed,
    confidence: profile && (incomes.length > 0 || expenses.length > 0) ? "complete" : "partial",
  };
}

function buildProjection(activeMonth: string, budget: Pick<MonthlyBudget, "balanceMonthly" | "totalExpensesMonthly">, reserveMonths: number): ProjectionPoint[] {
  const safeExpenses = Math.max(1, budget.totalExpensesMonthly);
  const reserveStart = Math.max(0, reserveMonths) * safeExpenses;
  return Array.from({ length: PROJECTION_MONTHS }, (_, index) => {
    const month = addMonths(activeMonth, index + 1);
    const cumulative = reserveStart + budget.balanceMonthly * (index + 1);
    return {
      month,
      monthLabel: monthLabel(month),
      balance: Math.round(budget.balanceMonthly),
      cumulative: Math.round(cumulative),
      reserveMonths: Math.max(0, cumulative / safeExpenses),
    };
  });
}

function trendLabel(snapshots: MonthlySnapshot[]): string {
  if (snapshots.length < 2) return "Historique insuffisant";
  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];
  if (!first || !last) return "Historique insuffisant";
  const delta = last.balanceMonthly - first.balanceMonthly;
  if (delta > 100) return `Amélioration de ${formatEur(delta)}/mois`;
  if (delta < -100) return `Dégradation de ${formatEur(Math.abs(delta))}/mois`;
  return "Tendance stable";
}

function situationLabel(situation: ProfileDataPoint["situation"]): string {
  switch (situation) {
    case "single": return "Solo";
    case "couple": return "Couple";
    case "cohabiting": return "Cohabitation";
    case "separated": return "Séparé";
    default: return "Profil";
  }
}

function byCategory(expenses: ExpenseLine[]): Record<ExpenseCategory, number> {
  const result = {} as Record<ExpenseCategory, number>;
  for (const expense of expenses) {
    result[expense.category] = (result[expense.category] ?? 0) + expense.monthlyAmount;
  }
  return result;
}

export function DataInsightsPanel() {
  const profiles = useProfileListStore((state) => state.profiles);
  const activeProfileId = useProfileListStore((state) => state.activeProfileId);
  const profile = useProfileStore((state) => state.profile);
  const accounting = useAccountingStore();
  const budget = accounting.getBudget();
  const activeMonth = accounting.activeMonth;
  const snapshots = accounting.getSnapshots();

  const profileData = useMemo(
    () => profiles.map((entry) => readProfileData(entry)).sort((a, b) => b.lastUsed.localeCompare(a.lastUsed)),
    [profiles]
  );

  const activeData = profileData.find((item) => item.id === activeProfileId) ?? null;
  const projection = useMemo(
    () => buildProjection(activeMonth, budget, profile.savingsMonths),
    [activeMonth, budget, profile.savingsMonths]
  );

  const soloProfiles = profileData.filter((item) => !item.isCouple);
  const coupleProfiles = profileData.filter((item) => item.isCouple);
  const avgSoloBalance = soloProfiles.length > 0
    ? soloProfiles.reduce((sum, item) => sum + item.balanceMonthly, 0) / soloProfiles.length
    : 0;
  const avgCoupleBalance = coupleProfiles.length > 0
    ? coupleProfiles.reduce((sum, item) => sum + item.balanceMonthly, 0) / coupleProfiles.length
    : 0;

  const currentCategories = byCategory(accounting.expenses);
  const topCategories = Object.entries(currentCategories)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const consolidatedBalance = profileData.reduce((sum, item) => sum + item.balanceMonthly, 0);
  const projectedReserveAtEnd = projection[projection.length - 1]?.reserveMonths ?? 0;

  return (
    <div className="space-y-5">
      <BehavioralInsights snapshots={snapshots} expenses={accounting.expenses} monthlyExpenses={accounting.monthlyExpenses} />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <InsightKpi label="Profils suivis" value={String(profileData.length)} detail={`${profileData.filter((item) => item.confidence === "complete").length} profil(s) exploitable(s)`} />
        <InsightKpi label="Solde consolidé" value={formatEur(consolidatedBalance)} detail="Somme mensuelle des profils locaux" positive={consolidatedBalance >= 0} />
        <InsightKpi label="Historique actif" value={`${snapshots.length} mois`} detail={trendLabel(snapshots)} />
        <InsightKpi label="Projection 36 mois" value={`${projectedReserveAtEnd.toFixed(1)} mois`} detail="Réserve estimée en fin de période" positive={projectedReserveAtEnd >= 3} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Panel title="Historique multi-profils" subtitle="Lecture des snapshots locaux par profil.">
          <div className="space-y-3">
            {profileData.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border p-4"
                style={{ background: "var(--bg-surface)", borderColor: item.id === activeProfileId ? "var(--brand-2)" : "var(--border)" }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-extrabold text-white" style={{ background: item.avatarColor }}>
                    {item.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold" style={{ color: "var(--text-primary)" }}>{item.name}</p>
                    <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                      {situationLabel(item.situation)} · {item.closedMonthsCount} mois clôturé(s) · {item.snapshots.length} snapshot(s)
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono font-extrabold" style={{ color: item.balanceMonthly >= 0 ? "var(--fin-green)" : "var(--fin-red)" }}>
                      {formatEur(item.balanceMonthly)}
                    </p>
                    <p className="text-[11px] font-bold" style={{ color: "var(--text-muted)" }}>{formatPct(item.savingsRate)}</p>
                  </div>
                </div>
              </motion.div>
            ))}
            {profileData.length === 0 && <EmptyState text="Aucun profil à analyser pour le moment." />}
          </div>
        </Panel>

        <Panel title="Comparaison solo / couple" subtitle="Vue consolidée par situation déclarée.">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <ComparisonCard label="Profils solo" count={soloProfiles.length} balance={avgSoloBalance} />
            <ComparisonCard label="Profils couple" count={coupleProfiles.length} balance={avgCoupleBalance} />
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={profileData.map((item) => ({ name: item.name, revenus: Math.round(item.totalIncomeMonthly), dépenses: Math.round(item.totalExpensesMonthly), solde: Math.round(item.balanceMonthly) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value: number) => formatEur(value)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="revenus" fill="var(--fin-green)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="dépenses" fill="var(--fin-red)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="solde" fill="var(--brand-2)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        <div className="xl:col-span-3">
          <Panel title="Projection consolidée long terme" subtitle="Projection locale à 36 mois sur le profil actif, sans modifier les calculs Rust.">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={projection}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} minTickGap={18} />
                  <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(value: number, name: string) => [name === "cumulative" ? formatEur(value) : value.toFixed(1), name === "cumulative" ? "Réserve projetée" : "Mois de réserve"]} />
                  <Line type="monotone" dataKey="cumulative" name="Réserve projetée" stroke="var(--brand-2)" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="reserveMonths" name="Mois de réserve" stroke="var(--fin-green)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>

        <div className="xl:col-span-2">
          <Panel title="Lecture actionnable" subtitle="Synthèse du profil actif.">
            <div className="space-y-4">
              <DataRow label="Profil actif" value={activeData?.name ?? "Profil actif"} />
              <DataRow label="Solde mensuel" value={formatEur(budget.balanceMonthly)} tone={budget.balanceMonthly >= 0 ? "positive" : "negative"} />
              <DataRow label="Taux d'épargne" value={formatPct(budget.savingsRate)} tone={budget.savingsRate >= 0.15 ? "positive" : "neutral"} />
              <DataRow label="Endettement" value={formatPct(budget.debtRatio)} tone={budget.debtRatio <= 0.35 ? "positive" : "negative"} />
              <div className="pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                <p className="text-xs font-extrabold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>Top postes</p>
                <div className="space-y-2">
                  {topCategories.map((item) => (
                    <div key={item.category} className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-bold" style={{ color: "var(--text-secondary)" }}>{CATEGORY_LABELS[item.category as ExpenseCategory] ?? item.category}</span>
                      <span className="font-mono font-extrabold" style={{ color: "var(--text-primary)" }}>{formatEur(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border shadow-card overflow-hidden" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
      <div className="px-5 py-4 border-b" style={{ background: "var(--bg-surface-2)", borderColor: "var(--border)" }}>
        <h3 className="text-sm font-extrabold" style={{ color: "var(--text-primary)" }}>{title}</h3>
        <p className="text-xs font-semibold mt-1" style={{ color: "var(--text-muted)" }}>{subtitle}</p>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function InsightKpi({ label, value, detail, positive }: { label: string; value: string; detail: string; positive?: boolean }) {
  return (
    <div className="rounded-3xl border p-5 shadow-card" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
      <p className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="mt-2 text-2xl font-mono font-extrabold" style={{ color: positive === undefined ? "var(--text-primary)" : positive ? "var(--fin-green)" : "var(--fin-red)" }}>{value}</p>
      <p className="mt-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{detail}</p>
    </div>
  );
}

function ComparisonCard({ label, count, balance }: { label: string; count: number; balance: number }) {
  return (
    <div className="rounded-2xl border p-4" style={{ background: "var(--bg-surface-2)", borderColor: "var(--border)" }}>
      <p className="text-xs font-extrabold" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="mt-2 text-xl font-mono font-extrabold" style={{ color: "var(--text-primary)" }}>{count}</p>
      <p className="text-xs font-bold" style={{ color: balance >= 0 ? "var(--fin-green)" : "var(--fin-red)" }}>{formatEur(balance)} moyen</p>
    </div>
  );
}

function DataRow({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "positive" | "negative" }) {
  const color = tone === "positive" ? "var(--fin-green)" : tone === "negative" ? "var(--fin-red)" : "var(--text-primary)";
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span className="text-sm font-mono font-extrabold" style={{ color }}>{value}</span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border p-6 text-center text-sm font-semibold" style={{ background: "var(--bg-surface-2)", borderColor: "var(--border)", color: "var(--text-muted)" }}>
      {text}
    </div>
  );
}
