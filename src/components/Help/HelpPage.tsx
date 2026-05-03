// =============================================================================
// Fichier  : src/components/Help/HelpPage.tsx
// Auteur   : KREMER Régis
// Desc.    : Guide utilisateur complet, dynamique et actionnable pour SimuBudget.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-05-01 | KREMER Regis | ZIP 7 — création de la page d'aide utilisateur
//   2026-05-01 | KREMER Regis | Phase 13B — ajout aide méthode des enveloppes
//   2026-05-03 | KREMER Régis | Guide V2 — refonte interactive, contextuelle et actionnable
//   2026-05-03 | KREMER Régis | Guide V3 — ajout mode d'emploi complet, parcours, FAQ et cas concrets
// =============================================================================

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { clsx } from "clsx";
import { useProfileStore } from "@/store/profileStore";
import { useAccountingStore } from "@/store/accountingStore";
import { useReconciliationStore } from "@/store/reconciliationStore";
import { useSimulationStore } from "@/store/simulationStore";
import { CATEGORY_LABELS, type ExpenseCategory } from "@/types/accounting";
import { formatEur } from "@/utils/formatCurrency";

interface GuideAction {
  label: string;
  to: string;
  variant: "primary" | "secondary";
}

interface GuideStep {
  id: string;
  title: string;
  description: string;
  status: "done" | "active" | "todo";
  action: GuideAction;
}

interface ContextAction {
  title: string;
  detail: string;
  level: "critical" | "warning" | "success" | "info";
  action: GuideAction;
}

interface TopicCard {
  id: string;
  eyebrow: string;
  title: string;
  summary: string;
  steps: string[];
  avoid: string[];
  action: GuideAction;
  secondaryAction?: GuideAction;
}

interface FaqItem {
  question: string;
  answer: string;
}

type GuideTab = "start" | "modules" | "imports" | "decisions" | "faq";

function levelStyle(level: ContextAction["level"]): { bg: string; border: string; color: string; label: string } {
  if (level === "critical") {
    return { bg: "var(--fin-red-bg)", border: "var(--fin-red-border)", color: "var(--fin-red)", label: "Priorité" };
  }
  if (level === "warning") {
    return { bg: "var(--fin-amber-bg)", border: "var(--fin-amber-border)", color: "var(--fin-amber)", label: "À surveiller" };
  }
  if (level === "success") {
    return { bg: "var(--fin-green-bg)", border: "var(--fin-green-border)", color: "var(--fin-green)", label: "Bonne base" };
  }
  return { bg: "var(--fin-blue-bg)", border: "var(--fin-blue-border)", color: "var(--fin-blue)", label: "Conseil" };
}

function topExpenseLabel(expenseByCategory: Partial<Record<ExpenseCategory, number>>): string {
  const entries = Object.entries(expenseByCategory) as Array<[ExpenseCategory, number]>;
  const top = entries
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1])[0];

  if (!top) return "aucun poste dominant";
  return `${CATEGORY_LABELS[top[0]]} (${formatEur(top[1])})`;
}

function ButtonLink({ action }: { action: GuideAction }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(action.to)}
      className={clsx(
        "inline-flex items-center justify-center rounded-2xl px-4 py-2 text-xs font-extrabold transition active:scale-[0.98]",
        action.variant === "primary" ? "btn-brand" : "btn-mini",
      )}
    >
      {action.label}
    </button>
  );
}

function StatusPill({ status }: { status: GuideStep["status"] }) {
  const label = status === "done" ? "OK" : status === "active" ? "À faire" : "Ensuite";
  return (
    <span
      className="rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em]"
      style={{
        background: status === "done" ? "var(--fin-green-bg)" : status === "active" ? "var(--fin-amber-bg)" : "var(--bg-surface-2)",
        color: status === "done" ? "var(--fin-green)" : status === "active" ? "var(--fin-amber)" : "var(--text-muted)",
        border: `1px solid ${status === "done" ? "var(--fin-green-border)" : status === "active" ? "var(--fin-amber-border)" : "var(--border)"}`,
      }}
    >
      {label}
    </span>
  );
}

function ProgressRail({ steps }: { steps: GuideStep[] }) {
  const done = steps.filter((step) => step.status === "done").length;
  const percent = Math.round((done / steps.length) * 100);

  return (
    <section className="card p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="section-label">Parcours conseillé</p>
          <h2 className="mt-2 font-display text-2xl font-extrabold tracking-[-0.04em] text-ink-primary">
            Par où commencer aujourd’hui ?
          </h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-ink-muted">
            Ce parcours tient compte de votre profil, de vos comptes, de vos imports et de vos objectifs.
          </p>
        </div>
        <div className="rounded-2xl px-4 py-3 text-right" style={{ background: "var(--brand-soft)", border: "1px solid var(--border-brand)" }}>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em]" style={{ color: "var(--brand-1)" }}>Avancement</p>
          <p className="font-display text-3xl font-extrabold text-ink-primary">{percent} %</p>
        </div>
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full" style={{ background: "var(--bg-surface-2)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, background: "var(--brand-gradient)" }} />
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-4">
        {steps.map((step, index) => (
          <motion.article
            key={step.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, delay: index * 0.025 }}
            className="rounded-[22px] p-4"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-soft)" }}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-2xl text-xs font-extrabold" style={{ background: "var(--brand-soft)", color: "var(--brand-1)", border: "1px solid var(--border-brand)" }}>
                {index + 1}
              </span>
              <StatusPill status={step.status} />
            </div>
            <h3 className="font-display text-lg font-extrabold tracking-[-0.035em] text-ink-primary">{step.title}</h3>
            <p className="mt-1 min-h-[72px] text-sm font-semibold leading-6 text-ink-muted">{step.description}</p>
            <div className="mt-4">
              <ButtonLink action={step.action} />
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  );
}

function ContextActionCard({ action }: { action: ContextAction }) {
  const style = levelStyle(action.level);
  return (
    <article className="rounded-[24px] p-5" style={{ background: style.bg, border: `1px solid ${style.border}` }}>
      <p className="text-xs font-extrabold uppercase tracking-[0.16em]" style={{ color: style.color }}>{style.label}</p>
      <h3 className="mt-2 font-display text-xl font-extrabold tracking-[-0.035em] text-ink-primary">{action.title}</h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-ink-secondary">{action.detail}</p>
      <div className="mt-4">
        <ButtonLink action={action.action} />
      </div>
    </article>
  );
}

function TopicGuideCard({ topic, index }: { topic: TopicCard; index: number }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: index * 0.025 }}
      className="card p-5"
    >
      <p className="section-label">{topic.eyebrow}</p>
      <h3 className="mt-2 font-display text-2xl font-extrabold tracking-[-0.045em] text-ink-primary">{topic.title}</h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-ink-muted">{topic.summary}</p>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <div className="rounded-[22px] p-4" style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em]" style={{ color: "var(--brand-1)" }}>Comment faire</p>
          <ol className="mt-3 space-y-2">
            {topic.steps.map((step, stepIndex) => (
              <li key={step} className="flex gap-2 text-sm font-semibold leading-6 text-ink-secondary">
                <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold" style={{ background: "var(--brand-soft)", color: "var(--brand-1)", border: "1px solid var(--border-brand)" }}>
                  {stepIndex + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-[22px] p-4" style={{ background: "var(--fin-amber-bg)", border: "1px solid var(--fin-amber-border)" }}>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em]" style={{ color: "var(--fin-amber)" }}>À éviter</p>
          <ul className="mt-3 space-y-2">
            {topic.avoid.map((item) => (
              <li key={item} className="flex gap-2 text-sm font-semibold leading-6 text-ink-secondary">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--fin-amber)" }} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <ButtonLink action={topic.action} />
        {topic.secondaryAction ? <ButtonLink action={topic.secondaryAction} /> : null}
      </div>
    </motion.article>
  );
}

function TabButton({ tab, activeTab, label, onClick }: { tab: GuideTab; activeTab: GuideTab; label: string; onClick: (tab: GuideTab) => void }) {
  const active = tab === activeTab;
  return (
    <button
      type="button"
      onClick={() => onClick(tab)}
      className="rounded-2xl px-4 py-2 text-xs font-extrabold uppercase tracking-[0.12em] transition"
      style={{
        background: active ? "var(--brand-soft)" : "var(--bg-surface)",
        color: active ? "var(--brand-1)" : "var(--text-muted)",
        border: `1px solid ${active ? "var(--border-brand)" : "var(--border)"}`,
      }}
    >
      {label}
    </button>
  );
}

function InfoPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="font-display text-2xl font-extrabold tracking-[-0.04em] text-ink-primary">{title}</h2>
      <div className="mt-4 text-sm font-semibold leading-7 text-ink-secondary">{children}</div>
    </section>
  );
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Quelle est la différence entre prévu, réel et rapproché ?",
    answer: "Prévu correspond à ce que vous aviez saisi dans Mes Comptes. Réel correspond aux transactions importées ou aux lignes validées. Rapproché signifie qu’une prévision et une transaction bancaire représentent la même dépense.",
  },
  {
    question: "L’import bancaire modifie-t-il mes dépenses manuelles ?",
    answer: "Non. L’import ajoute une lecture réelle du mois, mais il ne supprime pas vos prévisions et ne les écrase pas. Vous gardez toujours la main.",
  },
  {
    question: "Quand dois-je clôturer un mois ?",
    answer: "Clôturez seulement quand les lignes du mois sont vérifiées. La clôture fige l’historique et permet de comparer les mois suivants plus proprement.",
  },
  {
    question: "Pourquoi mon solde peut être différent de mon compte bancaire ?",
    answer: "SimuBudget raisonne par mois budgétaire. Certaines dépenses peuvent être prévues mais pas encore débitées, ou importées sans être rapprochées. Le rapprochement sert précisément à clarifier ces écarts.",
  },
  {
    question: "À quoi sert l’assistant si tout est déjà affiché ?",
    answer: "L’assistant transforme les chiffres en plan d’action. Il est utile pour comprendre une anomalie, tester un achat, prioriser une économie ou expliquer un scénario.",
  },
  {
    question: "Les scénarios modifient-ils mes données ?",
    answer: "Non. Les scénarios simulent un futur possible. Ils ne changent pas votre profil, vos comptes ni vos imports.",
  },
];

export default function HelpPage() {
  const [activeTab, setActiveTab] = useState<GuideTab>("start");
  const profile = useProfileStore((state) => state.profile);
  const hasCompletedOnboarding = useProfileStore((state) => state.hasCompletedOnboarding);
  const result = useSimulationStore((state) => state.result);
  const activeMonth = useAccountingStore((state) => state.activeMonth);
  const incomes = useAccountingStore((state) => state.incomes);
  const expenses = useAccountingStore((state) => state.expenses);
  const monthlyExpenses = useAccountingStore((state) => state.monthlyExpenses);
  const budget = useAccountingStore((state) => state.getBudget());
  const recommendations = useAccountingStore((state) => state.getRecommendations());
  const importedTransactions = useReconciliationStore((state) => state.transactions);

  const validatedMonthLines = useMemo(
    () => monthlyExpenses.filter((line) => line.month === activeMonth && (line.status === "validated" || line.status === "added")),
    [activeMonth, monthlyExpenses],
  );

  const hasProfile = profile !== null && hasCompletedOnboarding;
  const hasAccountingBase = incomes.length > 0 || expenses.length > 0;
  const hasRealMonth = validatedMonthLines.length > 0;
  const hasImports = importedTransactions.some((tx) => tx.status !== "ignored");
  const goalsCount = profile?.savingsGoals?.length ?? 0;
  const balance = result?.realDisposableIncome ?? budget.balanceMonthly;
  const mainRecommendation = recommendations[0];

  const steps = useMemo<GuideStep[]>(() => ([
    {
      id: "profile",
      title: "1. Poser la base",
      description: hasProfile
        ? "Votre profil est prêt : SimuBudget peut utiliser votre situation, vos revenus et vos charges principales."
        : "Commencez par renseigner votre situation, vos revenus, votre logement et vos charges principales.",
      status: hasProfile ? "done" : "active",
      action: { label: hasProfile ? "Modifier le profil" : "Créer mon profil", to: "/onboarding", variant: hasProfile ? "secondary" : "primary" },
    },
    {
      id: "accounts",
      title: "2. Construire Mes Comptes",
      description: hasAccountingBase
        ? "Votre base comptable existe. Vérifiez revenus, charges fixes, crédits et enveloppes variables."
        : "Ajoutez les revenus, charges fixes, crédits et enveloppes. C’est la base du reste à vivre.",
      status: hasAccountingBase ? "done" : hasProfile ? "active" : "todo",
      action: { label: "Ouvrir Mes Comptes", to: "/accounting", variant: hasAccountingBase ? "secondary" : "primary" },
    },
    {
      id: "real",
      title: "3. Passer au réel",
      description: hasImports
        ? "Des transactions ont été importées. Utilisez le rapprochement pour expliquer les écarts."
        : "Importez un relevé bancaire pour comparer le prévu et le réel, sans écraser vos saisies.",
      status: hasImports ? "done" : hasAccountingBase ? "active" : "todo",
      action: { label: hasImports ? "Voir le rapprochement" : "Importer un relevé", to: "/accounting", variant: hasImports ? "secondary" : "primary" },
    },
    {
      id: "future",
      title: "4. Décider et projeter",
      description: goalsCount > 0
        ? "Vos objectifs existent. Vérifiez leur faisabilité avec le reste à vivre réel et les scénarios."
        : "Créez un objectif ou testez un scénario pour savoir si une décision tient dans le temps.",
      status: goalsCount > 0 ? "done" : hasRealMonth ? "active" : "todo",
      action: { label: goalsCount > 0 ? "Suivre mes objectifs" : "Créer un objectif", to: "/accounting", variant: goalsCount > 0 ? "secondary" : "primary" },
    },
  ]), [goalsCount, hasAccountingBase, hasImports, hasProfile, hasRealMonth]);

  const contextActions = useMemo<ContextAction[]>(() => {
    const actions: ContextAction[] = [];

    if (balance < 0) {
      actions.push({
        title: "Votre solde mensuel est négatif",
        detail: `Le mois affiche ${formatEur(balance)}. Le poste le plus lourd est ${topExpenseLabel(budget.expenseByCategory)}. Commencez par les priorités et le rapprochement.`,
        level: "critical",
        action: { label: "Voir les priorités", to: "/assistant", variant: "primary" },
      });
    } else if (balance > 0) {
      actions.push({
        title: "Vous avez une marge positive",
        detail: `Votre reste à vivre estimé est de ${formatEur(balance)}. Vous pouvez renforcer l’épargne, accélérer un objectif ou tester un achat.`,
        level: "success",
        action: { label: "Créer un objectif", to: "/accounting", variant: "primary" },
      });
    }

    if (!hasImports) {
      actions.push({
        title: "Passez du prévu au réel",
        detail: "Un import bancaire validé permet de voir les écarts exacts par enveloppe et d’éviter les décisions basées uniquement sur une estimation.",
        level: "info",
        action: { label: "Importer un relevé", to: "/accounting", variant: "primary" },
      });
    }

    if (mainRecommendation) {
      actions.push({
        title: mainRecommendation.title,
        detail: mainRecommendation.detail,
        level: mainRecommendation.level === "critical" || mainRecommendation.level === "danger" ? "warning" : "info",
        action: { label: "Demander un plan", to: "/assistant", variant: "secondary" },
      });
    }

    return actions.slice(0, 3);
  }, [balance, budget.expenseByCategory, hasImports, mainRecommendation]);

  const moduleTopics = useMemo<TopicCard[]>(() => ([
    {
      id: "dashboard",
      eyebrow: "Vue d’ensemble",
      title: "Lire le tableau de bord en 5 secondes",
      summary: "La vue d’ensemble sert à savoir si le mois est confortable, fragile ou critique.",
      steps: [
        "Regardez le reste à vivre : positif = marge, négatif = alerte immédiate.",
        "Lisez le résumé du mois : situation, point de vigilance, opportunité.",
        "Ouvrez les actions recommandées seulement si une alerte demande une décision.",
        "Consultez la timeline pour repérer un crédit qui se termine ou une charge annuelle à venir.",
      ],
      avoid: [
        "Ne jugez pas votre situation uniquement avec le score SSF.",
        "Ne décidez pas d’un achat sans vérifier son impact avec le bouton rapide.",
      ],
      action: { label: "Ouvrir la vue d’ensemble", to: "/", variant: "primary" },
      secondaryAction: { label: "Tester un achat", to: "/", variant: "secondary" },
    },
    {
      id: "accounting",
      eyebrow: "Mes Comptes",
      title: "Piloter le mois ligne par ligne",
      summary: "Mes Comptes transforme vos revenus, charges, crédits et enveloppes en reste à vivre exploitable.",
      steps: [
        "Renseignez d’abord les revenus et les charges fixes.",
        "Ajoutez les dépenses variables sous forme d’enveloppes mensuelles.",
        "Validez les lignes réellement passées ce mois-ci.",
        "Ignorez une ligne uniquement si elle ne concerne pas le mois.",
        "Clôturez seulement quand tout est vérifié.",
      ],
      avoid: [
        "Ne clôturez pas un mois incomplet.",
        "Ne confondez pas Valider avec Clôturer : valider confirme une ligne, clôturer fige le mois.",
      ],
      action: { label: "Ouvrir Mes Comptes", to: "/accounting", variant: "primary" },
      secondaryAction: { label: "Voir le rapport annuel", to: "/report", variant: "secondary" },
    },
    {
      id: "housing",
      eyebrow: "Logement",
      title: "Tester location et achat immobilier",
      summary: "Les modules logement servent à vérifier si un loyer ou un achat tient réellement avec votre budget.",
      steps: [
        "Pour une location, saisissez le loyer charges comprises et vérifiez l’effort logement.",
        "Pour un achat, renseignez prix, apport, durée, taux et frais.",
        "Comparez toujours le reste à vivre après logement avec votre situation actuelle.",
        "Utilisez les résultats comme estimation, puis vérifiez auprès des organismes officiels si nécessaire.",
      ],
      avoid: [
        "Ne regardez pas seulement la mensualité de crédit.",
        "Ne considérez pas les aides estimées comme des droits garantis.",
      ],
      action: { label: "Tester une location", to: "/housing/location", variant: "primary" },
      secondaryAction: { label: "Tester un achat", to: "/housing/purchase", variant: "secondary" },
    },
    {
      id: "assistant",
      eyebrow: "Assistant",
      title: "Poser les bonnes questions",
      summary: "L’assistant est utile quand vous voulez transformer un chiffre en explication ou en plan d’action.",
      steps: [
        "Demandez pourquoi un solde est négatif, ou comment économiser un montant précis.",
        "Demandez l’impact d’un achat avant de le faire.",
        "Après une réponse, demandez : Explique ton raisonnement ou Que faire maintenant ?",
        "Utilisez le bouton flottant pour une question rapide, et l’onglet Conseiller expert pour une analyse plus profonde.",
      ],
      avoid: [
        "Ne posez pas une question trop vague si vous attendez une réponse chiffrée.",
        "Ne prenez pas l’assistant pour un conseiller financier réglementé.",
      ],
      action: { label: "Ouvrir le conseiller", to: "/assistant", variant: "primary" },
      secondaryAction: { label: "Voir les scénarios", to: "/scenarios", variant: "secondary" },
    },
  ]), []);

  const importTopics = useMemo<TopicCard[]>(() => ([
    {
      id: "import",
      eyebrow: "Import bancaire",
      title: "Importer sans perdre le contrôle",
      summary: "L’import ajoute les transactions réelles du mois. Il complète la saisie manuelle, il ne la remplace pas.",
      steps: [
        "Ouvrez Mes Comptes puis l’onglet Rapprochement.",
        "Importez un fichier CSV, XLSX, XLS, OFX, QFX ou QIF.",
        "Vérifiez la prévisualisation : date, libellé, montant, catégorie.",
        "Corrigez les catégories si besoin : SimuBudget apprend localement.",
        "Validez uniquement les transactions qui doivent entrer dans le mois.",
      ],
      avoid: [
        "Ne validez pas un fichier sans regarder les doublons possibles.",
        "Ne mélangez pas plusieurs mois dans le même import si votre banque exporte une période large.",
      ],
      action: { label: "Importer un relevé", to: "/accounting", variant: "primary" },
    },
    {
      id: "reconciliation",
      eyebrow: "Rapprochement",
      title: "Comprendre les écarts prévu / réel",
      summary: "Le rapprochement montre ce qui était prévu, ce qui est réellement passé, et les dépenses non prévues.",
      steps: [
        "Commencez par les paires déjà rapprochées automatiquement.",
        "Traitez les transactions non prévues : catégoriser, rapprocher ou ignorer.",
        "Comparez les totaux par enveloppe : prévu, réel, écart.",
        "Intégrez au mois uniquement quand la lecture vous paraît cohérente.",
      ],
      avoid: [
        "Ne supprimez pas une prévision parce qu’une transaction existe : rapprochez-la.",
        "N’ignorez pas une dépense réelle si elle explique un dépassement.",
      ],
      action: { label: "Voir le rapprochement", to: "/accounting", variant: "primary" },
    },
  ]), []);

  const decisionTopics = useMemo<TopicCard[]>(() => ([
    {
      id: "goals",
      eyebrow: "Objectifs",
      title: "Transformer une envie en plan réaliste",
      summary: "Un objectif indique combien il manque, combien épargner et combien de temps il faut avec votre rythme réel.",
      steps: [
        "Choisissez un type : épargne, achat, remboursement ou projet de vie.",
        "Renseignez le montant cible et l’épargne déjà disponible.",
        "Ajoutez une date cible si vous avez une échéance.",
        "Comparez le rythme actuel et le rythme nécessaire.",
        "Utilisez les actions proposées pour réduire l’écart.",
      ],
      avoid: [
        "Ne fixez pas un objectif sans tenir compte du reste à vivre réel.",
        "Ne basez pas un objectif sur un mois exceptionnellement favorable.",
      ],
      action: { label: "Créer un objectif", to: "/accounting", variant: "primary" },
    },
    {
      id: "scenarios",
      eyebrow: "Scénarios",
      title: "Tester les accidents et les décisions de vie",
      summary: "Les scénarios répondent à : que se passe-t-il si mes revenus baissent, si les prix montent ou si je combine deux risques ?",
      steps: [
        "Choisissez un scénario simple : perte d’emploi, inflation, déménagement, naissance.",
        "Regardez le nouveau reste à vivre et le delta par rapport au mois actuel.",
        "Testez un stress test si deux événements peuvent arriver ensemble.",
        "Lisez la durée soutenable pour savoir combien de mois vous pouvez tenir.",
      ],
      avoid: [
        "Ne prenez pas un scénario pour une prédiction exacte.",
        "Ne comparez pas deux scénarios sans regarder les hypothèses appliquées.",
      ],
      action: { label: "Ouvrir les scénarios", to: "/scenarios", variant: "primary" },
    },
  ]), []);

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-10">
      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="mb-7"
      >
        <p className="section-label">Aide intelligente</p>
        <div className="mt-2 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="font-display text-4xl font-extrabold tracking-[-0.055em] text-ink-primary">
              Guide utilisateur SimuBudget
            </h1>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-ink-muted">
              Ce guide explique comment utiliser SimuBudget concrètement : créer votre base, suivre le mois, importer vos relevés, rapprocher les données réelles, simuler l’avenir et décider sans vous perdre.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-2xl px-4 py-3" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink-muted">Solde</p>
              <p className={clsx("mt-1 font-mono text-sm font-extrabold", balance >= 0 ? "text-fin-green" : "text-fin-red")}>{formatEur(balance)}</p>
            </div>
            <div className="rounded-2xl px-4 py-3" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink-muted">Imports</p>
              <p className="mt-1 font-mono text-sm font-extrabold text-ink-primary">{importedTransactions.length}</p>
            </div>
            <div className="rounded-2xl px-4 py-3" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink-muted">Objectifs</p>
              <p className="mt-1 font-mono text-sm font-extrabold text-ink-primary">{goalsCount}</p>
            </div>
            <div className="rounded-2xl px-4 py-3" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink-muted">Mois</p>
              <p className="mt-1 font-mono text-sm font-extrabold text-ink-primary">{activeMonth}</p>
            </div>
          </div>
        </div>
      </motion.header>

      <div className="mb-6 flex flex-wrap gap-2">
        <TabButton tab="start" activeTab={activeTab} label="Démarrage" onClick={setActiveTab} />
        <TabButton tab="modules" activeTab={activeTab} label="Modules" onClick={setActiveTab} />
        <TabButton tab="imports" activeTab={activeTab} label="Import & réel" onClick={setActiveTab} />
        <TabButton tab="decisions" activeTab={activeTab} label="Décisions" onClick={setActiveTab} />
        <TabButton tab="faq" activeTab={activeTab} label="FAQ" onClick={setActiveTab} />
      </div>

      <div className="space-y-6">
        {activeTab === "start" ? (
          <>
            <ProgressRail steps={steps} />

            <section>
              <div className="mb-3">
                <p className="section-label">À faire maintenant</p>
                <h2 className="mt-2 font-display text-2xl font-extrabold tracking-[-0.04em] text-ink-primary">Actions recommandées</h2>
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                {contextActions.map((action) => <ContextActionCard key={action.title} action={action} />)}
              </div>
            </section>

            <InfoPanel title="Méthode simple d’utilisation">
              <ol className="grid gap-3 md:grid-cols-2">
                <li><strong>1.</strong> Je vérifie mon solde et mon résumé du mois.</li>
                <li><strong>2.</strong> Je contrôle Mes Comptes et les enveloppes qui dépassent.</li>
                <li><strong>3.</strong> J’importe mon relevé pour passer du prévu au réel.</li>
                <li><strong>4.</strong> Je rapproche les transactions importantes.</li>
                <li><strong>5.</strong> Je demande un plan à l’assistant si une alerte bloque.</li>
                <li><strong>6.</strong> Je teste un scénario avant une décision lourde.</li>
              </ol>
            </InfoPanel>
          </>
        ) : null}

        {activeTab === "modules" ? (
          <section className="grid gap-4 xl:grid-cols-2">
            {moduleTopics.map((topic, index) => <TopicGuideCard key={topic.id} topic={topic} index={index} />)}
          </section>
        ) : null}

        {activeTab === "imports" ? (
          <section className="grid gap-4 xl:grid-cols-2">
            {importTopics.map((topic, index) => <TopicGuideCard key={topic.id} topic={topic} index={index} />)}
          </section>
        ) : null}

        {activeTab === "decisions" ? (
          <section className="grid gap-4 xl:grid-cols-2">
            {decisionTopics.map((topic, index) => <TopicGuideCard key={topic.id} topic={topic} index={index} />)}
          </section>
        ) : null}

        {activeTab === "faq" ? (
          <section className="grid gap-4 lg:grid-cols-2">
            {FAQ_ITEMS.map((item) => (
              <article key={item.question} className="card p-5">
                <h3 className="font-display text-xl font-extrabold tracking-[-0.035em] text-ink-primary">{item.question}</h3>
                <p className="mt-2 text-sm font-semibold leading-7 text-ink-muted">{item.answer}</p>
              </article>
            ))}
          </section>
        ) : null}
      </div>
    </div>
  );
}
