// =============================================================================
// Fichier  : src/components/Accounting/AccountingModule.tsx
// Auteur   : KREMER Regis
// Desc.    : Module Mes Comptes avec pilotage mensuel, validation et clôture
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation Phase 3
//   2026-04-27 | KREMER Regis | Phase 6 - couple, objectifs, historique
//   2026-04-29 | KREMER Regis | Phase 8.1 - contraste clair, dépenses groupees, historique securise
//   2026-04-29 | KREMER Regis | Phase 9 - mois actif, validation charges recurrentes, clôture mensuelle
//   2026-04-29 | KREMER Regis | Phase 9.1 - correction champs dépenses compacts et actions reinitialisation
//   2026-04-29 | KREMER Regis | Phase 9.2 - libelles personne A/B dans revenus, dépenses et couple
//   2026-05-01 | KREMER Régis | Phase 11 — Fix 4 : statuts lignes validated/ignored non modifiables
//   2026-05-01 | KREMER Régis | Phase 12A — crédits intelligents : affichage enrichi, formulaires, simulation
//   2026-05-01 | KREMER Régis | Patch 12A.1 — Formulaire crédit : type et durée en années
//   2026-05-01 | KREMER Régis | Phase 12C — charges saisonnières + réel vs prévu
//   2026-05-01 | KREMER Régis | ZIP 5 — affichage scoring avant/après et contexte profil
//   2026-05-01 | KREMER Régis | ZIP 6 — onglet Analyse données avancées
//   2026-05-01 | KREMER Régis | Patch 8.1 — stabilité onglets Mes Comptes
//   2026-05-01 | KREMER Régis | Phase 13 — onglet enveloppes budgétaires
//   2026-05-01 | KREMER Régis | Phase 13B — pédagogie et aide UX méthode enveloppes
// =============================================================================

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { clsx } from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { useAccountingStore } from "@/store/accountingStore";
import { useProfileStore } from "@/store/profileStore";
import {
  CATEGORY_LABELS, CATEGORY_COLORS, CATEGORY_ORDER, INCOME_LABELS,
  type ExpenseCategory, type IncomeType, type Frequency, type ExpenseOwner,
  type AccountingRecommendation, type MonthlyExpenseLine, type MonthlyBudget,
  type ExpenseLine, type EnvelopeStatus,
} from "@/types/accounting";
import { formatEur } from "@/utils/formatCurrency";
import type { CreditType } from "@/types/profile";
import { CoupleView } from "./CoupleView";
import { GoalsPanel } from "./GoalsPanel";
import { HistoryPanel } from "./HistoryPanel";
import { DataInsightsPanel } from "./DataInsightsPanel";

const FREQ_LABELS: Record<Frequency, string> = {
  weekly:  "Hebdomadaire",
  monthly: "Mensuel",
  annual:  "Annuel",
};

const MONTH_OPTIONS: Array<{ value: string; label: string }> = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
].map((label, index) => ({ value: String(index + 1), label }));

const CREDIT_TYPE_LABELS: Record<CreditType, string> = {
  immo:      "Immobilier",
  auto:      "Auto",
  conso:     "Consommation",
  revolving: "Revolving",
};

const CREDIT_TYPE_OPTIONS: Array<{ value: CreditType; label: string }> = Object.entries(CREDIT_TYPE_LABELS)
  .map(([value, label]) => ({ value: value as CreditType, label }));

function ownerLabel(owner: ExpenseOwner, personName: string, partnerName: string): string {
  if (owner === "me") return personName;
  if (owner === "partner") return partnerName;
  return "Commun";
}

function personNameFromProfile(profile: ReturnType<typeof useProfileStore.getState>["profile"]): string {
  const full = `${profile.holder?.firstName ?? ""} ${profile.holder?.lastName ?? ""}`.trim();
  return full.length > 0 ? full : "Personne A";
}

function partnerNameFromProfile(profile: ReturnType<typeof useProfileStore.getState>["profile"]): string {
  if (!profile.partner) return "Personne B";
  const full = `${profile.partner.firstName ?? ""} ${profile.partner.lastName ?? ""}`.trim();
  return full.length > 0 ? full : profile.partner.name || "Personne B";
}

function monthTitle(month: string): string {
  const [yearRaw, monthRaw] = month.split("-");
  const year = Number.parseInt(yearRaw ?? "2026", 10);
  const monthIndex = Number.parseInt(monthRaw ?? "1", 10) - 1;
  return new Date(year, monthIndex, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

export function AccountingModule() {
  const [tab, setTab] = useState(0);
  const store = useAccountingStore();
  const profile = useProfileStore((s) => s.profile);
  const budget = store.getBudget();
  const recs = store.getRecommendations();
  const isCouple = profile?.situation === "couple" || profile?.situation === "cohabiting";
  const personName = personNameFromProfile(profile);
  const partnerName = partnerNameFromProfile(profile);

  useEffect(() => {
    store.ensureMonth();
  }, [store.activeMonth]);

  const tabs = useMemo(() => [
    "Bilan",
    "Enveloppes",
    "Revenus",
    "Dépenses",
    "Optimisation",
    ...(isCouple ? ["Couple"] : []),
    "Objectifs",
    "Historique",
    "Analyse",
  ], [isCouple]);

  const objectifsIndex = isCouple ? 6 : 5;
  const historiqueIndex = isCouple ? 7 : 6;
  const analyseIndex = isCouple ? 8 : 7;

  useEffect(() => {
    if (tab > tabs.length - 1) {
      setTab(Math.max(0, tabs.length - 1));
    }
  }, [tab, tabs.length]);

  return (
    <div className="page-shell space-y-6">
      <Header store={store} />

      <div className="flex gap-1 rounded-2xl p-1 overflow-x-auto border [background:var(--bg-surface-2)] [border-color:var(--border)]">
        {tabs.map((label, i) => (
          <button
            key={label}
            onClick={() => setTab(i)}
            className={clsx(
              "flex-shrink-0 py-2.5 px-4 rounded-xl text-xs font-semibold transition-all",
              tab === i
                ? "card text-ink-primary shadow-sm"
                : "text-ink-secondary hover:text-ink-primary hover:[background:var(--bg-surface-2)]"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {tab === 0 && <BilanTab store={store} budget={budget} recs={recs} />}
          {tab === 1 && <EnvelopeTab store={store} />}
          {tab === 2 && <RevenusTab store={store} isCouple={isCouple} personName={personName} partnerName={partnerName} />}
          {tab === 3 && <DépensesTab store={store} isCouple={isCouple} personName={personName} partnerName={partnerName} />}
          {tab === 4 && <OptimisationTab recs={recs} />}
          {isCouple && tab === 5 && <CoupleView />}
          {tab === objectifsIndex && <GoalsPanel />}
          {tab === historiqueIndex && <HistoryPanel />}
          {tab === analyseIndex && <DataInsightsPanel />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Header({ store }: { store: ReturnType<typeof useAccountingStore.getState> }) {
  const summary = store.getMonthSummary();
  return (
    <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-ink-primary">Mes Comptes</h1>
        <p className="text-sm text-ink-secondary mt-1">
          Pilotage mensuel réel : validez les charges récurrentes, ajoutez les dépenses du mois, puis clôturez.
        </p>
      </div>
      <div className="card rounded-2xl border [border-color:var(--border)] p-2 flex items-center gap-2 shadow-card">
        <button className="month-nav-btn" onClick={() => store.shiftActiveMonth(-1)} aria-label="Mois précédent">←</button>
        <div className="px-3 min-w-44 text-center">
          <p className="text-xs text-ink-muted">Mois actif</p>
          <p className="text-sm font-bold text-ink-primary capitalize">{monthTitle(store.activeMonth)}</p>
        </div>
        <button className="month-nav-btn" onClick={() => store.shiftActiveMonth(1)} aria-label="Mois suivant">→</button>
        <div className={clsx("ml-2 px-3 py-2 rounded-xl text-xs font-bold", summary.isClosed ? "text-[var(--fin-green)] [background:var(--fin-green-bg)] border border-[var(--fin-green-border)]" : "text-[var(--fin-amber)] [background:var(--fin-amber-bg)] border border-[var(--fin-amber-border)]")}>
          {summary.isClosed ? "Clôturé" : `${summary.pendingCount} à valider`}
        </div>
      </div>
    </div>
  );
}

function BilanTab({ store, budget, recs }: {
  store: ReturnType<typeof useAccountingStore.getState>;
  budget: MonthlyBudget;
  recs: AccountingRecommendation[];
}) {
  const summary = store.getMonthSummary();
  const monthLines = store.getMonthExpenses().filter((line) => line.status !== "ignored");
  const plannedTotal = monthLines.reduce((sum, line) => sum + (line.plannedAmount ?? line.amount), 0);
  const realTotal = monthLines.reduce((sum, line) => sum + line.amount, 0);
  const realDelta = realTotal - plannedTotal;
  const pieData = Object.entries(budget.expenseByCategory)
    .filter(([, v]) => v > 0)
    .map(([cat, value]) => ({
      name: CATEGORY_LABELS[cat as ExpenseCategory],
      value: Math.round(value),
      color: CATEGORY_COLORS[cat as ExpenseCategory],
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  return (
    <div className="space-y-5">
      <MonthPilotCard store={store} />

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <MetricCard label="Solde validé" value={`${budget.balanceMonthly >= 0 ? "+" : ""}${formatEur(budget.balanceMonthly)}`} tone={budget.balanceMonthly >= 0 ? "green" : "red"} sub="revenus - dépenses validées" />
        <MetricCard label="Projection fin de mois" value={`${summary.projectedBalance >= 0 ? "+" : ""}${formatEur(summary.projectedBalance)}`} tone={summary.projectedBalance >= 0 ? "green" : "amber"} sub="selon le rythme actuel" />
        <MetricCard label="Dépenses réelles" value={formatEur(realTotal)} sub={`Prévu : ${formatEur(plannedTotal)}`} />
        <MetricCard label="Écart prévu/réel" value={`${realDelta >= 0 ? "+" : ""}${formatEur(realDelta)}`} tone={realDelta <= 0 ? "green" : "amber"} sub="sur les lignes traitées du mois" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card rounded-2xl border [border-color:var(--border)] p-5 shadow-card">
          <p className="text-sm font-semibold text-ink-primary mb-4">Répartition des dépenses du mois</p>
          {pieData.length === 0 ? (
            <EmptyState label="Aucune dépense validée" sub="Validez les charges récurrentes ou ajoutez une dépense réelle." />
          ) : (
            <div className="flex gap-6 items-center">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={52} outerRadius={78} dataKey="value" paddingAngle={2}>
                    {pieData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatEur(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2 min-w-0">
                {pieData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-sm text-ink-secondary truncate flex-1">{item.name}</span>
                    <span className="text-sm font-mono font-semibold text-ink-primary">{formatEur(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="card rounded-2xl border [border-color:var(--border)] p-5 shadow-card">
          <p className="text-sm font-semibold text-ink-primary mb-4">Actions utiles</p>
          <div className="grid gap-3">
            <ActionButton label="Valider toutes les charges fixes" sub="Passe toutes les lignes en attente au statut validé." onClick={() => store.getMonthExpenses().filter((l) => l.status === "pending" && l.isFixed).forEach((l) => store.validateMonthlyExpense(l.id))} />
            <ActionButton label={summary.isClosed ? "Réouvrir le mois" : "Clôturer le mois"} sub={summary.isClosed ? "Autorise les modifications du mois." : "Fige le mois et alimente l'historique."} onClick={() => summary.isClosed ? store.reopenMonth() : store.closeMonth()} />
          </div>
          {recs.length > 0 && (
            <div className="mt-5 space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-ink-muted">Recommandations rapides</p>
              {recs.slice(0, 3).map((rec) => <RecommendationLine key={rec.id} rec={rec} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


function EnvelopeTab({ store }: { store: ReturnType<typeof useAccountingStore.getState> }) {
  const settings = store.envelopeSettings;
  const [showGuide, setShowGuide] = useState(false);
  const statuses = store.getEnvelopeStatuses();
  const [fromCategory, setFromCategory] = useState<ExpenseCategory>("food");
  const [toCategory, setToCategory] = useState<ExpenseCategory>("savings");
  const [transferAmount, setTransferAmount] = useState(0);
  const totalPlanned = statuses.reduce((sum, status) => sum + status.planned, 0);
  const totalSpent = statuses.reduce((sum, status) => sum + status.spent, 0);
  const totalRemaining = totalPlanned - totalSpent;
  const periodLabel = settings.period === "weekly" ? "semaine" : "mois";
  const positiveStatuses = statuses.filter((status) => status.remaining > 0 && !status.isSavingsEnvelope);
  const hasStatuses = statuses.length > 0;

  function quickSaveRemainder(): void {
    const amount = Math.round(positiveStatuses.reduce((sum, status) => sum + status.remaining, 0) * 100) / 100;
    if (amount <= 0) return;
    store.addMonthlyExpense({
      month: store.activeMonth,
      label: "Reste des enveloppes vers épargne",
      category: "savings",
      amount,
      plannedAmount: amount,
      realAmount: amount,
      isFixed: false,
      isMandatory: false,
      owner: "shared",
      status: "added",
      notes: "envelope:remaining-to-savings",
    });
  }

  return (
    <div className="space-y-5">
      <div className="card rounded-2xl border [border-color:var(--border)] p-5 shadow-card overflow-hidden relative">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-start via-brand-mid to-brand-end" />
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest font-bold text-ink-muted">Méthode des enveloppes</p>
            <h2 className="text-xl font-bold text-ink-primary mt-1">Piloter les dépenses variables sans doublon</h2>
            <p className="text-sm text-ink-secondary mt-2 max-w-3xl">
              La méthode des enveloppes sert à piloter les dépenses variables avant qu’elles ne dérapent. SimuBudget transforme vos catégories du mois en enveloppes : vous voyez le montant prévu, ce qui est déjà dépensé et ce qu’il reste.
            </p>
            <p className="text-xs font-semibold text-ink-muted mt-2 max-w-3xl">
              À garder sur le compte : loyer, crédits, assurances, énergie et abonnements prélevés. À suivre en enveloppes : alimentation, carburant, loisirs, restaurant, santé, habillement, cadeaux, vacances et imprévus.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={clsx("btn-secondary", settings.enabled && "ring-2 ring-[var(--brand-glow)]")}
              onClick={() => store.setEnvelopeMode(!settings.enabled)}
            >
              {settings.enabled ? "Mode actif" : "Activer"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowGuide((value) => !value)}
            >
              Comment ça marche ?
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => store.setEnvelopeMode(settings.enabled, settings.period === "monthly" ? "weekly" : "monthly")}
            >
              Vue {settings.period === "monthly" ? "mensuelle" : "hebdomadaire"}
            </button>
          </div>
        </div>
      </div>

      {showGuide && <EnvelopeGuide />}

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <MetricCard label={`Budget enveloppes / ${periodLabel}`} value={formatEur(totalPlanned)} sub="Total prévu sur les catégories variables" />
        <MetricCard label={`Dépensé / ${periodLabel}`} value={formatEur(totalSpent)} tone={totalSpent <= totalPlanned ? "green" : "amber"} sub="Somme des dépenses suivies" />
        <MetricCard label="Reste disponible" value={`${totalRemaining >= 0 ? "+" : ""}${formatEur(totalRemaining)}`} tone={totalRemaining >= 0 ? "green" : "red"} sub="À conserver ou transférer vers épargne" />
        <MetricCard label="Enveloppes surveillées" value={String(statuses.filter((status) => status.health === "watch" || status.health === "danger").length)} tone="amber" sub="Dépassement ou seuil proche" />
      </div>

      {!settings.enabled && (
        <div className="rounded-2xl p-4 text-sm font-semibold" style={{ background: "var(--fin-amber-bg)", color: "var(--fin-amber)", border: "1px solid var(--fin-amber-border)" }}>
          Le mode enveloppes est désactivé. Les calculs restent disponibles, mais aucune recommandation spécifique enveloppe ne sera priorisée.
        </div>
      )}

      {!hasStatuses ? (
        <EmptyState label="Aucune enveloppe à afficher" sub="Ajoutez ou validez des dépenses variables pour créer automatiquement vos enveloppes." />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {statuses.map((status) => <EnvelopeCard key={status.category} status={status} />)}
        </div>
      )}

      <div className="card rounded-2xl border [border-color:var(--border)] p-5 shadow-card space-y-4">
        <div>
          <p className="text-sm font-bold text-ink-primary">Rééquilibrer les enveloppes</p>
          <p className="text-xs text-ink-secondary mt-1">
            Utilisez ce bloc uniquement pour déplacer un reste prévu d'une enveloppe vers une autre. Cela crée deux lignes de rééquilibrage traçables dans le mois actif.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <SelectInput label="Depuis" value={fromCategory} options={CATEGORY_ORDER.map((cat) => ({ value: cat, label: CATEGORY_LABELS[cat] }))} onChange={(value) => setFromCategory(value as ExpenseCategory)} />
          <SelectInput label="Vers" value={toCategory} options={CATEGORY_ORDER.map((cat) => ({ value: cat, label: CATEGORY_LABELS[cat] }))} onChange={(value) => setToCategory(value as ExpenseCategory)} />
          <NumberInput label="Montant (€)" value={transferAmount} onChange={setTransferAmount} />
          <div className="flex items-end">
            <button type="button" className="btn-brand w-full" onClick={() => store.redistributeEnvelopeRemaining(fromCategory, toCategory, transferAmount)}>
              Rééquilibrer
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={quickSaveRemainder}>
            Transférer les restes vers l'épargne
          </button>
        </div>
      </div>
    </div>
  );
}

function EnvelopeGuide() {
  const steps = [
    {
      title: "1. Je pars de mon budget réel",
      text: "SimuBudget utilise vos revenus, vos charges fixes et vos dépenses prévues pour connaître votre reste à vivre.",
    },
    {
      title: "2. Je ne mets pas tout en enveloppes",
      text: "Les charges fixes restent dans le budget classique : loyer, crédits, assurances, téléphone, internet, énergie. Elles doivent rester disponibles sur le compte.",
    },
    {
      title: "3. Je crée mes limites de dépenses variables",
      text: "Chaque catégorie variable devient une enveloppe : alimentation, transport, loisirs, santé, habillement, restaurants, cadeaux, vacances ou imprévus.",
    },
    {
      title: "4. Je suis le mois en temps réel",
      text: "Prévu correspond au montant autorisé. Dépensé correspond au réel saisi ou validé. Restant indique ce que vous pouvez encore utiliser.",
    },
    {
      title: "5. Je redistribue seulement si nécessaire",
      text: "S’il reste 30 € en loisirs mais qu’il manque 30 € en carburant, le rééquilibrage crée une trace au lieu de modifier les chiffres en silence.",
    },
    {
      title: "6. Je réajuste après 2 ou 3 mois",
      text: "Une enveloppe rouge tous les mois n’est pas un échec : c’est le signal qu’il faut revoir le montant prévu ou l’habitude de dépense.",
    },
  ];

  return (
    <div className="card rounded-2xl border [border-color:var(--border)] p-5 shadow-card">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest font-bold text-ink-muted">Guide rapide</p>
          <h3 className="text-lg font-extrabold text-ink-primary mt-1">Comprendre les enveloppes dans SimuBudget</h3>
          <p className="text-sm text-ink-secondary mt-2 max-w-3xl">
            Ici, il n’est pas obligatoire de retirer des espèces. L’idée est la même : réserver une somme maximale par poste variable, suivre ce qui sort, puis garder ou réaffecter ce qui reste.
          </p>
        </div>
        <div className="rounded-2xl px-4 py-3 text-sm font-bold" style={{ background: "var(--fin-blue-bg)", color: "var(--fin-blue)", border: "1px solid var(--fin-blue-border)" }}>
          Vert = maîtrisé · Orange = proche limite · Rouge = dépassé
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {steps.map((step) => (
          <div key={step.title} className="rounded-2xl p-4" style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
            <p className="text-sm font-extrabold text-ink-primary">{step.title}</p>
            <p className="text-xs font-semibold leading-5 text-ink-secondary mt-2">{step.text}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="rounded-2xl p-4" style={{ background: "var(--fin-green-bg)", border: "1px solid var(--fin-green-border)" }}>
          <p className="text-sm font-extrabold" style={{ color: "var(--fin-green)" }}>Exemple maîtrisé</p>
          <p className="text-xs font-semibold text-ink-secondary mt-1">Alimentation : 420 € prévus, 315 € dépensés, 105 € disponibles.</p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: "var(--fin-amber-bg)", border: "1px solid var(--fin-amber-border)" }}>
          <p className="text-sm font-extrabold" style={{ color: "var(--fin-amber)" }}>Exemple à surveiller</p>
          <p className="text-xs font-semibold text-ink-secondary mt-1">Loisirs : 120 € prévus, 108 € dépensés. Il reste peu de marge.</p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: "var(--fin-red-bg)", border: "1px solid var(--fin-red-border)" }}>
          <p className="text-sm font-extrabold" style={{ color: "var(--fin-red)" }}>Exemple dépassé</p>
          <p className="text-xs font-semibold text-ink-secondary mt-1">Restaurant : 80 € prévus, 112 € dépensés. Dépassement de 32 €.</p>
        </div>
      </div>
    </div>
  );
}

function EnvelopeCard({ status }: { status: EnvelopeStatus }) {
  const percent = Math.min(100, Math.round(status.percent * 100));
  const color = status.health === "safe" ? "var(--fin-green)" : status.health === "watch" ? "var(--fin-amber)" : status.health === "danger" ? "var(--fin-red)" : "var(--text-muted)";
  const bg = status.health === "safe" ? "var(--fin-green-bg)" : status.health === "watch" ? "var(--fin-amber-bg)" : status.health === "danger" ? "var(--fin-red-bg)" : "var(--bg-surface-2)";
  const remainingLabel = status.remaining >= 0 ? `${formatEur(status.remaining)} disponibles` : `${formatEur(Math.abs(status.remaining))} de dépassement`;

  return (
    <div className="card rounded-2xl border [border-color:var(--border)] p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink-primary truncate">{status.label}</p>
          <p className="text-xs text-ink-secondary mt-1">{remainingLabel}</p>
        </div>
        <span className="rounded-full px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider" style={{ background: bg, color }}>
          {percent}%
        </span>
      </div>
      <div className="mt-4 h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-surface-3)" }}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, percent)}%`, background: color }} />
      </div>
      <div className="mt-3 flex items-center justify-between text-xs font-semibold">
        <span style={{ color: "var(--text-muted)" }}>Dépensé : {formatEur(status.spent)}</span>
        <span style={{ color: "var(--text-muted)" }}>Prévu : {formatEur(status.planned)}</span>
      </div>
    </div>
  );
}
function MonthPilotCard({ store }: { store: ReturnType<typeof useAccountingStore.getState> }) {
  const summary = store.getMonthSummary();
  return (
    <div className="card rounded-2xl border [border-color:var(--border)] p-5 shadow-card overflow-hidden relative">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-start via-brand-mid to-brand-end" />
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest font-bold text-ink-muted">Pilotage mensuel</p>
          <h2 className="text-xl font-bold text-ink-primary mt-1 capitalize">{monthTitle(summary.month)}</h2>
          <p className="text-sm text-ink-secondary mt-1">
            {summary.pendingCount > 0
              ? `${summary.pendingCount} dépense(s) récurrente(s) attendent votre validation.`
              : "Toutes les dépenses récurrentes du mois sont traitées."}
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 min-w-[420px] max-w-full">
          <MiniStat label="Validées" value={summary.validatedCount} tone="green" />
          <MiniStat label="Ajoutées" value={summary.addedCount} tone="blue" />
          <MiniStat label="Ignorées" value={summary.ignoredCount} tone="amber" />
          <MiniStat label="Jours restants" value={summary.daysRemaining} />
        </div>
      </div>
      <div className="mt-4 h-2 rounded-full [background:var(--bg-surface-2)] overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-brand-start to-brand-mid" style={{ width: `${Math.round(summary.validationProgress * 100)}%` }} />
      </div>
    </div>
  );
}

function RevenusTab({ store, isCouple, personName, partnerName }: {
  store: ReturnType<typeof useAccountingStore.getState>;
  isCouple: boolean;
  personName: string;
  partnerName: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ label: "", type: "salary" as IncomeType, amount: 0, frequency: "monthly" as Frequency, isTaxable: true, owner: "me" as ExpenseOwner });

  function save() {
    if (!form.label.trim() || form.amount <= 0) return;
    if (editId) store.updateIncome(editId, form);
    else store.addIncome(form);
    setShowForm(false);
    setEditId(null);
    setForm({ label: "", type: "salary", amount: 0, frequency: "monthly", isTaxable: true, owner: "me" });
  }

  function edit(id: string) {
    const line = store.incomes.find((item) => item.id === id);
    if (!line) return;
    setForm({ label: line.label, type: line.type, amount: line.amount, frequency: line.frequency, isTaxable: line.isTaxable, owner: line.owner });
    setEditId(id);
    setShowForm(true);
  }

  return (
    <div className="space-y-4">
      <Toolbar title="Revenus récurrents" action="Ajouter un revenu" onAction={() => setShowForm(true)} />
      {showForm && (
        <IncomeForm form={form} setForm={setForm} isCouple={isCouple} personName={personName} partnerName={partnerName} onSave={save} onCancel={() => { setShowForm(false); setEditId(null); }} />
      )}
      {store.incomes.length === 0 ? <EmptyState label="Aucun revenu saisi" sub="Ajoutez vos revenus pour alimenter le bilan mensuel." /> : (
        <div className="grid gap-3">
          {store.incomes.map((line) => (
            <LineCard key={line.id} label={line.label} sub={`${INCOME_LABELS[line.type]} · ${FREQ_LABELS[line.frequency]} · ${ownerLabel(line.owner, personName, partnerName)}`} amount={line.monthlyAmount} onEdit={() => edit(line.id)} onDelete={() => store.removeIncome(line.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function DépensesTab({ store, isCouple, personName, partnerName }: {
  store: ReturnType<typeof useAccountingStore.getState>;
  isCouple: boolean;
  personName: string;
  partnerName: string;
}) {
  const [showPlannedForm, setShowPlannedForm] = useState(false);
  const [showRealForm, setShowRealForm] = useState(false);
  const [plannedForm, setPlannedForm] = useState<PlannedForm>(createEmptyPlannedForm());
  const [realForm, setRealForm] = useState({ label: "", category: "other" as ExpenseCategory, amount: 0, isFixed: false, isMandatory: false, owner: "me" as ExpenseOwner });
  const lines = store.getMonthExpenses();
  const groups = useMemo(() => groupMonthlyExpenses(lines), [lines]);

  function savePlanned() {
    if (!plannedForm.label.trim() || plannedForm.amount <= 0) return;
    const expenseData: Omit<ExpenseLine, "id" | "monthlyAmount" | "annualAmount"> = {
      label: plannedForm.label.trim(),
      category: plannedForm.category,
      amount: plannedForm.amount,
      frequency: plannedForm.frequency,
      isFixed: plannedForm.isFixed,
      isMandatory: plannedForm.isMandatory,
      owner: plannedForm.owner,
    };

    if (plannedForm.frequency === "annual" && plannedForm.annualMonth !== "") {
      expenseData.annualMonth = plannedForm.annualMonth;
    }

    if (plannedForm.category === "credit") {
      const remainingMonths = Math.max(0, Math.round(plannedForm.remainingMonths));
      if (remainingMonths > 0) {
        expenseData.remainingMonths = remainingMonths;
      }
      if (plannedForm.creditType !== "") {
        expenseData.creditType = plannedForm.creditType;
      }
      const lender = plannedForm.lender.trim();
      if (lender.length > 0) {
        expenseData.lender = lender;
      }
    }

    store.addExpense(expenseData);
    setShowPlannedForm(false);
    setPlannedForm(createEmptyPlannedForm());
  }

  function saveReal() {
    if (!realForm.label.trim() || realForm.amount <= 0) return;
    store.addMonthlyExpense({ ...realForm, month: store.activeMonth, status: "added" });
    setShowRealForm(false);
    setRealForm({ label: "", category: "other", amount: 0, isFixed: false, isMandatory: false, owner: "me" });
  }

  return (
    <div className="space-y-4">
      <Toolbar title="Dépenses du mois" action="Ajouter une dépense réelle" onAction={() => setShowRealForm(true)} secondaryAction="Nouvelle charge récurrente" onSecondaryAction={() => setShowPlannedForm(true)} />

      {showRealForm && <MonthlyExpenseForm form={realForm} setForm={setRealForm} isCouple={isCouple} personName={personName} partnerName={partnerName} onSave={saveReal} onCancel={() => setShowRealForm(false)} />}
      {showPlannedForm && <PlannedExpenseForm form={plannedForm} setForm={setPlannedForm} isCouple={isCouple} personName={personName} partnerName={partnerName} onSave={savePlanned} onCancel={() => setShowPlannedForm(false)} />}

      {groups.length === 0 ? <EmptyState label="Aucune dépense pour ce mois" sub="Ajoutez une charge récurrente ou une dépense réelle." /> : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.category} className="card rounded-2xl border [border-color:var(--border)] shadow-card overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between [background:var(--bg-surface-2)] border-b [border-color:var(--border)]">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[group.category] }} />
                  <div>
                    <p className="font-bold text-ink-primary">{CATEGORY_LABELS[group.category]}</p>
                    <p className="text-xs text-ink-muted">{group.items.length} ligne(s)</p>
                  </div>
                </div>
                <p className="font-mono font-bold text-ink-primary">{formatEur(group.total)}</p>
              </div>
              <div className="divide-y [divide-color:var(--border)]">
                {group.items.map((line) => <MonthlyExpenseRow key={line.id} line={line} store={store} personName={personName} partnerName={partnerName} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function groupMonthlyExpenses(lines: MonthlyExpenseLine[]): Array<{ category: ExpenseCategory; total: number; items: MonthlyExpenseLine[] }> {
  return CATEGORY_ORDER.map((category) => {
    const items = lines.filter((line) => line.category === category);
    return { category, items, total: items.filter((line) => line.status !== "ignored").reduce((sum, line) => sum + line.amount, 0) };
  }).filter((group) => group.items.length > 0);
}

function OptimisationTab({ recs }: { recs: AccountingRecommendation[] }) {
  if (recs.length === 0) return <EmptyState label="Aucune recommandation critique" sub="Le mois est cohérent avec vos revenus et vos charges validées." />;
  return (
    <div className="grid gap-3">
      {recs.map((rec) => <RecommendationLine key={rec.id} rec={rec} expanded />)}
    </div>
  );
}

function IncomeForm({ form, setForm, isCouple, personName, partnerName, onSave, onCancel }: {
  form: { label: string; type: IncomeType; amount: number; frequency: Frequency; isTaxable: boolean; owner: ExpenseOwner };
  setForm: (form: { label: string; type: IncomeType; amount: number; frequency: Frequency; isTaxable: boolean; owner: ExpenseOwner }) => void;
  isCouple: boolean;
  personName: string;
  partnerName: string;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <FormShell title="Revenu" onSave={onSave} onCancel={onCancel}>
      <TextInput label="Libellé" value={form.label} onChange={(value) => setForm({ ...form, label: value })} />
      <SelectInput label="Type" value={form.type} options={Object.entries(INCOME_LABELS).map(([value, label]) => ({ value, label }))} onChange={(value) => setForm({ ...form, type: value as IncomeType })} />
      <NumberInput label="Montant" value={form.amount} onChange={(value) => setForm({ ...form, amount: value })} />
      <SelectInput label="Fréquence" value={form.frequency} options={Object.entries(FREQ_LABELS).map(([value, label]) => ({ value, label }))} onChange={(value) => setForm({ ...form, frequency: value as Frequency })} />
      {isCouple && <OwnerInput value={form.owner} personName={personName} partnerName={partnerName} onChange={(owner) => setForm({ ...form, owner })} />}
    </FormShell>
  );
}

// Phase 12A — type enrichi pour PlannedExpenseForm
// Patch 12A.1 — ajout du type de crédit et d'une saisie en années.
type PlannedForm = {
  label: string;
  category: ExpenseCategory;
  amount: number;
  frequency: Frequency;
  isFixed: boolean;
  isMandatory: boolean;
  owner: ExpenseOwner;
  remainingMonths: number;
  remainingYears: number;
  creditType: CreditType | "";
  lender: string;
  annualMonth: number | "";
};

function createEmptyPlannedForm(): PlannedForm {
  return {
    label: "",
    category: "other",
    amount: 0,
    frequency: "monthly",
    isFixed: true,
    isMandatory: true,
    owner: "me",
    remainingMonths: 0,
    remainingYears: 0,
    creditType: "",
    lender: "",
    annualMonth: "",
  };
}

function normalizeDurationYears(value: number): number {
  return Math.max(0, Math.round(value));
}

function monthsFromYears(years: number): number {
  return normalizeDurationYears(years) * 12;
}

function creditDurationLabel(remainingMonths: number): string {
  if (remainingMonths <= 0) return "Durée non renseignée";
  const years = Math.floor(remainingMonths / 12);
  const months = remainingMonths % 12;
  const yearLabel = years > 0 ? `${years} ${years === 1 ? "an" : "ans"}` : "";
  const monthLabel = months > 0 ? `${months} mois` : "";
  const humanDuration = [yearLabel, monthLabel].filter(Boolean).join(" et ");
  return `Durée totale : ${remainingMonths} mois${humanDuration.length > 0 ? ` (${humanDuration})` : ""}`;
}

function computeEndDate(remainingMonths: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + remainingMonths);
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function PlannedExpenseForm({ form, setForm, isCouple, personName, partnerName, onSave, onCancel }: {
  form: PlannedForm;
  setForm: (form: PlannedForm) => void;
  isCouple: boolean;
  personName: string;
  partnerName: string;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="rounded-2xl p-5 space-y-4"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-brand)", boxShadow: "var(--shadow-md)" }}
    >
      {/* En-tête */}
      <div className="flex items-center gap-2 pb-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="h-4 w-1 rounded-full" style={{ background: "var(--brand-1)" }} />
        <p className="font-display text-sm font-extrabold" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          Charge récurrente
        </p>
      </div>

      {/* Ligne 1 : Libellé + Catégorie */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextInput label="Libellé" value={form.label} onChange={(value) => setForm({ ...form, label: value })} placeholder="Ex : Loyer, Crédit auto…" />
        <CategoryInput
          value={form.category}
          onChange={(category) => {
            if (category !== "credit") {
              setForm({ ...form, category, remainingMonths: 0, remainingYears: 0, creditType: "", lender: "" });
              return;
            }
            setForm({ ...form, category });
          }}
        />
      </div>

      {/* Ligne 2 : Montant + Fréquence */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <NumberInput label="Montant (€)" value={form.amount} onChange={(value) => setForm({ ...form, amount: value })} />
        <SelectInput
          label="Fréquence"
          value={form.frequency}
          options={Object.entries(FREQ_LABELS).map(([value, label]) => ({ value, label }))}
          onChange={(value) => {
            const frequency = value as Frequency;
            setForm({ ...form, frequency, annualMonth: frequency === "annual" ? form.annualMonth : "" });
          }}
        />
      </div>

      {form.frequency === "annual" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SelectInput
            label="Mois de prélèvement"
            value={form.annualMonth === "" ? "" : String(form.annualMonth)}
            options={[{ value: "", label: "Lisser sur 12 mois" }, ...MONTH_OPTIONS]}
            onChange={(value) => {
              const annualMonth = value === "" ? "" : Number.parseInt(value, 10);
              setForm({ ...form, annualMonth });
            }}
          />
          <div className="rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: "var(--bg-surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
            {form.annualMonth === ""
              ? "Montant annuel lissé dans le pilotage mensuel."
              : "Charge injectée uniquement sur le mois choisi avec le montant complet."}
          </div>
        </div>
      )}

      {/* Ligne 3 : Fixe + Obligatoire + Owner (même ligne) */}
      <div className="flex flex-wrap items-center gap-6">
        <ToggleInput label="Fixe" checked={form.isFixed} onChange={(checked) => setForm({ ...form, isFixed: checked })} />
        <ToggleInput label="Obligatoire" checked={form.isMandatory} onChange={(checked) => setForm({ ...form, isMandatory: checked })} />
        {isCouple && (
          <div className="flex-1 min-w-[200px]">
            <OwnerInput value={form.owner} personName={personName} partnerName={partnerName} onChange={(owner) => setForm({ ...form, owner })} />
          </div>
        )}
      </div>

      {/* Phase 12A — Bloc crédit : visible uniquement si catégorie = Crédits */}
      {form.category === "credit" && (
        <div
          className="rounded-xl p-4 space-y-3"
          style={{ background: "var(--fin-blue-bg)", border: "1px solid var(--fin-blue-border)" }}
        >
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--fin-blue)" }}>
            Détails du crédit
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectInput
              label="Type de crédit"
              value={form.creditType}
              options={[{ value: "", label: "À préciser" }, ...CREDIT_TYPE_OPTIONS]}
              onChange={(value) => setForm({ ...form, creditType: value as CreditType | "" })}
            />
            <NumberInput
              label="Durée restante (années)"
              value={form.remainingYears}
              onChange={(value) => {
                const remainingYears = normalizeDurationYears(value);
                setForm({ ...form, remainingYears, remainingMonths: monthsFromYears(remainingYears) });
              }}
            />
            <NumberInput
              label="Mois restants"
              value={form.remainingMonths}
              onChange={(value) => {
                const remainingMonths = Math.max(0, Math.round(value));
                setForm({ ...form, remainingMonths, remainingYears: Math.floor(remainingMonths / 12) });
              }}
            />
            <TextInput
              label="Établissement prêteur (optionnel)"
              value={form.lender}
              onChange={(value) => setForm({ ...form, lender: value })}
              placeholder="Ex : Crédit Agricole, BNP…"
            />
          </div>
          <div className="rounded-xl px-3 py-2" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold" style={{ color: "var(--fin-blue)" }}>
              {creditDurationLabel(form.remainingMonths)}
            </p>
            {form.remainingMonths > 0 && (
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                Date de fin estimée :{" "}
                <span className="font-bold" style={{ color: "var(--text-primary)" }}>
                  {computeEndDate(form.remainingMonths)}
                </span>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
        <button type="button" className="btn-secondary" onClick={onCancel}>Annuler</button>
        <button type="button" className="btn-brand" onClick={onSave}>Enregistrer</button>
      </div>
    </div>
  );
}

function MonthlyExpenseForm({ form, setForm, isCouple, personName, partnerName, onSave, onCancel }: {
  form: { label: string; category: ExpenseCategory; amount: number; isFixed: boolean; isMandatory: boolean; owner: ExpenseOwner };
  setForm: (form: { label: string; category: ExpenseCategory; amount: number; isFixed: boolean; isMandatory: boolean; owner: ExpenseOwner }) => void;
  isCouple: boolean;
  personName: string;
  partnerName: string;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="rounded-2xl p-5 space-y-4"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-brand)", boxShadow: "var(--shadow-md)" }}
    >
      <div className="flex items-center gap-2 pb-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="h-4 w-1 rounded-full" style={{ background: "var(--brand-1)" }} />
        <p className="font-display text-sm font-extrabold" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          Dépense réelle du mois
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextInput label="Libellé" value={form.label} onChange={(value) => setForm({ ...form, label: value })} placeholder="Ex : Courses, Restaurant…" />
        <CategoryInput value={form.category} onChange={(category) => setForm({ ...form, category })} />
      </div>
      <NumberInput label="Montant (€)" value={form.amount} onChange={(value) => setForm({ ...form, amount: value })} />
      <div className="flex flex-wrap items-center gap-6">
        <ToggleInput label="Fixe" checked={form.isFixed} onChange={(checked) => setForm({ ...form, isFixed: checked })} />
        <ToggleInput label="Obligatoire" checked={form.isMandatory} onChange={(checked) => setForm({ ...form, isMandatory: checked })} />
        {isCouple && (
          <div className="flex-1 min-w-[200px]">
            <OwnerInput value={form.owner} personName={personName} partnerName={partnerName} onChange={(owner) => setForm({ ...form, owner })} />
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
        <button type="button" className="btn-secondary" onClick={onCancel}>Annuler</button>
        <button type="button" className="btn-brand" onClick={onSave}>Enregistrer</button>
      </div>
    </div>
  );
}

function MonthlyExpenseRow({ line, store, personName, partnerName }: { line: MonthlyExpenseLine; store: ReturnType<typeof useAccountingStore.getState>; personName: string; partnerName: string }) {
  const isClosed   = store.getMonthSummary(line.month).isClosed;
  // Fix 4 — logique statuts : validated et ignored = non modifiable
  const isEditable = !isClosed && (line.status === "pending" || line.status === "added");

  return (
    <div className={clsx("monthly-expense-row", line.status === "ignored" && "opacity-55")}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-ink-primary truncate">{line.label}</p>
          <StatusBadge status={line.status} />
          {line.isMandatory && <span className="badge-soft">Obligatoire</span>}
          {line.isFixed && <span className="badge-soft">Fixe</span>}
        </div>
        <p className="text-xs text-ink-muted mt-0.5">
          {ownerLabel(line.owner, personName, partnerName)} · {line.sourceExpenseId ? "récurrente proposée" : "ajout du mois"}
          {line.creditLender && ` · ${line.creditLender}`}
        </p>
        {/* Phase 12A — affichage crédit enrichi */}
        {line.creditRemainingMonths !== undefined && (
          <div className="flex items-center gap-2 mt-1">
            <span
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: line.creditEndsThisMonth ? "var(--fin-green)" : "var(--text-muted)" }}
            >
              {line.creditEndsThisMonth
                ? "✓ Dernier mois — capacité bientôt libérée"
                : `Encore ${line.creditRemainingMonths} mois`}
            </span>
            <div
              className="h-1 rounded-full overflow-hidden"
              style={{ width: 60, background: "var(--bg-surface-3)" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(4, Math.min(96, (1 - line.creditRemainingMonths / Math.max(line.creditRemainingMonths + 12, 1)) * 100))}%`,
                  background: line.creditEndsThisMonth ? "var(--fin-green)" : "var(--fin-amber)",
                }}
              />
            </div>
          </div>
        )}
        {line.plannedAmount !== undefined && line.realAmount !== undefined && (
          <p className="text-[11px] font-semibold mt-1" style={{ color: line.amount > line.plannedAmount ? "var(--fin-amber)" : "var(--fin-green)" }}>
            Prévu : {formatEur(line.plannedAmount)} · Réel : {formatEur(line.realAmount)} · Écart : {line.amount - line.plannedAmount >= 0 ? "+" : ""}{formatEur(line.amount - line.plannedAmount)}
          </p>
        )}
      </div>
      <input
        aria-label={`Montant ${line.label}`}
        className="expense-amount-input"
        type="number"
        value={line.realAmount ?? line.amount}
        disabled={!isEditable}
        onChange={(event) => {
          const realAmount = Number(event.target.value);
          store.updateMonthlyExpense(line.id, { realAmount, amount: realAmount });
        }}
      />
      <div className="monthly-expense-actions">
        {line.status === "pending" && !isClosed && (
          <button className="btn-mini-green" onClick={() => store.validateMonthlyExpense(line.id)}>Valider</button>
        )}
        {(line.status === "pending" || line.status === "added") && !isClosed && (
          <button className="btn-mini" onClick={() => store.ignoreMonthlyExpense(line.id)}>Ignorer</button>
        )}
        {line.status === "ignored" && !isClosed && (
          <button className="btn-mini" onClick={() => store.restoreMonthlyExpense(line.id)}>Restaurer</button>
        )}
        {isEditable && (
          <button className="icon-btn" onClick={() => store.updateMonthlyExpense(line.id, { status: "ignored" })} title="Retirer du mois">×</button>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, tone = "neutral" }: { label: string; value: string; sub: string; tone?: "neutral" | "green" | "amber" | "red" }) {
  const toneClass = tone === "green" ? "text-[var(--fin-green)]" : tone === "amber" ? "text-[var(--fin-amber)]" : tone === "red" ? "text-[var(--fin-red)]" : "text-ink-primary";
  return (
    <div className="card rounded-2xl border [border-color:var(--border)] p-5 shadow-card">
      <p className="text-xs uppercase tracking-widest font-bold text-ink-muted">{label}</p>
      <p className={clsx("text-2xl font-mono font-black mt-2", toneClass)}>{value}</p>
      <p className="text-xs text-ink-secondary mt-1">{sub}</p>
    </div>
  );
}

function MiniStat({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "green" | "blue" | "amber" }) {
  const toneClass = tone === "green" ? "text-[var(--fin-green)]" : tone === "blue" ? "text-[var(--fin-blue)]" : tone === "amber" ? "text-[var(--fin-amber)]" : "text-ink-primary";
  return (
    <div className="rounded-xl [background:var(--bg-surface-2)] border [border-color:var(--border)] p-3">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className={clsx("text-xl font-mono font-black", toneClass)}>{value}</p>
    </div>
  );
}

function Toolbar({ title, action, onAction, secondaryAction, onSecondaryAction }: { title: string; action: string; onAction: () => void; secondaryAction?: string; onSecondaryAction?: () => void }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <h2 className="text-lg font-bold text-ink-primary">{title}</h2>
      <div className="flex gap-2">
        {secondaryAction && onSecondaryAction && <button className="btn-secondary" onClick={onSecondaryAction}>{secondaryAction}</button>}
        <button className="btn-brand" onClick={onAction}>{action}</button>
      </div>
    </div>
  );
}

function LineCard({ label, sub, amount, onEdit, onDelete }: { label: string; sub: string; amount: number; onEdit: () => void; onDelete: () => void }) {
  return (
    <div
      className="flex items-center gap-4 rounded-xl px-4 py-3.5 transition-colors"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-xs)" }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{label}</p>
        <p className="text-xs mt-0.5 truncate font-medium" style={{ color: "var(--text-muted)" }}>{sub}</p>
      </div>
      <span className="font-mono text-sm font-bold tabular-nums flex-shrink-0" style={{ color: "var(--text-primary)" }}>
        {formatEur(amount)}<span className="font-normal text-xs" style={{ color: "var(--text-muted)" }}>/mois</span>
      </span>
      <button type="button" className="icon-btn" onClick={onEdit} title="Modifier">
        <svg viewBox="0 0 14 14" fill="currentColor" className="h-3.5 w-3.5">
          <path d="M10.013 1.513a1.75 1.75 0 0 1 2.475 2.474L5.226 11.25a2.75 2.75 0 0 1-.892.596l-2.047.848a.75.75 0 0 1-.98-.98l.848-2.047a2.75 2.75 0 0 1 .596-.892l7.262-7.262Z"/>
        </svg>
      </button>
      <button type="button" className="icon-btn" onClick={onDelete} title="Supprimer" style={{ color: "var(--fin-red)" }}>
        <svg viewBox="0 0 14 14" fill="currentColor" className="h-3.5 w-3.5">
          <path fillRule="evenodd" d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L5.94 7l-1.72 1.72a.75.75 0 1 0 1.06 1.06L7 8.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L8.06 7l1.72-1.72a.75.75 0 0 0-1.06-1.06L7 5.94 5.28 4.22Z" clipRule="evenodd"/>
        </svg>
      </button>
    </div>
  );
}

function RecommendationLine({ rec, expanded = false }: { rec: AccountingRecommendation; expanded?: boolean }) {
  const bgVar     = rec.level === "critical" || rec.level === "danger" ? "--fin-red-bg"
    : rec.level === "vigilance" ? "--fin-amber-bg"
    : rec.level === "info"     ? "--fin-blue-bg"
    : "--fin-green-bg";
  const borderVar = rec.level === "critical" || rec.level === "danger" ? "--fin-red-border"
    : rec.level === "vigilance" ? "--fin-amber-border"
    : rec.level === "info"     ? "--fin-blue-border"
    : "--fin-green-border";
  const colorVar  = rec.level === "critical" || rec.level === "danger" ? "--fin-red"
    : rec.level === "vigilance" ? "--fin-amber"
    : rec.level === "info"     ? "--fin-blue"
    : "--fin-green";
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: `var(${bgVar})`, border: `1px solid var(${borderVar})` }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-bold" style={{ color: `var(${colorVar})` }}>{rec.title}</p>
        {rec.impactLabel && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider" style={{ background: "var(--bg-surface-2)", color: "var(--fin-green)", border: "1px solid var(--fin-green-border)" }}>
            {rec.impactLabel}
          </span>
        )}
      </div>
      {rec.profileContext && (
        <p className="text-[11px] mt-1 font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{rec.profileContext}</p>
      )}
      {rec.scoreBefore !== undefined && rec.scoreAfter !== undefined && (
        <p className="text-xs mt-1 font-semibold" style={{ color: "var(--text-secondary)" }}>
          Score estimé : {rec.scoreBefore} → {rec.scoreAfter}
        </p>
      )}
      <p className="text-xs mt-1 font-medium" style={{ color: "var(--text-secondary)" }}>{rec.detail}</p>
      {expanded && rec.action && (
        <p className="text-xs mt-2 font-semibold" style={{ color: "var(--text-secondary)" }}>
          Action : {rec.action}
        </p>
      )}
    </div>
  );
}

function ActionButton({ label, sub, onClick }: { label: string; sub: string; onClick: () => void }) {
  return (
    <button className="text-left rounded-xl border [border-color:var(--border)] [background:var(--bg-surface-2)] p-4 hover:shadow-card transition-all" onClick={onClick}>
      <p className="font-bold text-ink-primary">{label}</p>
      <p className="text-xs text-ink-secondary mt-1">{sub}</p>
    </button>
  );
}

function EmptyState({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="card rounded-2xl border [border-color:var(--border)] p-8 text-center shadow-card">
      <p className="font-bold text-ink-primary">{label}</p>
      <p className="text-sm text-ink-secondary mt-1">{sub}</p>
    </div>
  );
}

function FormShell({ title, children, onSave, onCancel }: { title: string; children: ReactNode; onSave: () => void; onCancel: () => void }) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background:  "var(--bg-surface)",
        border:      "1px solid var(--border-brand)",
        boxShadow:   "var(--shadow-md)",
      }}
    >
      {/* En-tête formulaire */}
      <div
        className="flex items-center gap-2 mb-5 pb-3"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div
          className="h-4 w-1 rounded-full"
          style={{ background: "var(--brand-1)" }}
        />
        <p
          className="font-display text-sm font-extrabold"
          style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}
        >
          {title}
        </p>
      </div>

      {/* Corps — grille responsive 2 colonnes max */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {children}
      </div>

      {/* Actions */}
      <div
        className="flex justify-end gap-2 mt-5 pt-4"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Annuler
        </button>
        <button type="button" className="btn-brand" onClick={onSave}>
          Enregistrer
        </button>
      </div>
    </div>
  );
}

function TextInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-bold" style={{ color: "var(--text-secondary)", letterSpacing: ".01em" }}>
        {label}
      </span>
      <input
        className="input-premium"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-bold" style={{ color: "var(--text-secondary)", letterSpacing: ".01em" }}>
        {label}
      </span>
      <input
        className="input-premium font-mono"
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

function SelectInput({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-bold" style={{ color: "var(--text-secondary)", letterSpacing: ".01em" }}>
        {label}
      </span>
      <select
        className="input-premium"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );
}

function CategoryInput({ value, onChange }: { value: ExpenseCategory; onChange: (value: ExpenseCategory) => void }) {
  return <SelectInput label="Catégorie" value={value} options={CATEGORY_ORDER.map((cat) => ({ value: cat, label: CATEGORY_LABELS[cat] }))} onChange={(next) => onChange(next as ExpenseCategory)} />;
}

function OwnerInput({ value, personName, partnerName, onChange }: { value: ExpenseOwner; personName: string; partnerName: string; onChange: (value: ExpenseOwner) => void }) {
  return <SelectInput label="Propriétaire" value={value} options={[{ value: "me", label: personName }, { value: "partner", label: partnerName }, { value: "shared", label: "Commun" }]} onChange={(next) => onChange(next as ExpenseOwner)} />;
}

function ToggleInput({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      {/* Checkbox custom tokens CSS */}
      <div
        onClick={() => onChange(!checked)}
        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded transition-all cursor-pointer"
        style={{
          border:     `2px solid ${checked ? "var(--brand-1)" : "var(--border-hover)"}`,
          background: checked ? "var(--brand-1)" : "var(--bg-input)",
          boxShadow:  checked ? "0 0 0 3px var(--brand-glow)" : "none",
        }}
      >
        {checked && (
          <svg viewBox="0 0 10 10" fill="white" className="h-3 w-3">
            <path fillRule="evenodd" d="M8.5 2.5 4 7 1.5 4.5" stroke="white" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round" clipRule="evenodd"/>
          </svg>
        )}
      </div>
      <span
        className="text-sm font-semibold select-none"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </span>
    </label>
  );
}

function StatusBadge({ status }: { status: MonthlyExpenseLine["status"] }) {
  const labels: Record<MonthlyExpenseLine["status"], string> = {
    pending:   "À valider",
    validated: "Validée",
    added:     "Ajoutée",
    ignored:   "Ignorée",
  };
  const bgColor   = status === "validated" || status === "added"
    ? "var(--fin-green-bg)"
    : status === "pending"
    ? "var(--fin-amber-bg)"
    : "var(--bg-surface-2)";
  const textColor = status === "validated" || status === "added"
    ? "var(--fin-green)"
    : status === "pending"
    ? "var(--fin-amber)"
    : "var(--text-muted)";
  const borderColor = status === "validated" || status === "added"
    ? "var(--fin-green-border)"
    : status === "pending"
    ? "var(--fin-amber-border)"
    : "var(--border)";
  return (
    <span
      className="text-[10px] px-2 py-0.5 rounded-full font-bold"
      style={{ background: bgColor, color: textColor, border: `1px solid ${borderColor}` }}
    >
      {labels[status]}
    </span>
  );
}
