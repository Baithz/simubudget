// =============================================================================
// Fichier  : src/components/Help/HelpPage.tsx
// Auteur   : KREMER Régis
// Desc.    : Guide utilisateur SimuBudget — aide claire et non technique.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-05-01 | KREMER Régis | ZIP 7 — création de la page d'aide utilisateur
// =============================================================================

import { motion } from "framer-motion";

interface HelpSection {
  title: string;
  lead: string;
  steps: string[];
  tip?: string;
}

const HELP_SECTIONS: HelpSection[] = [
  {
    title: "Choisir un profil",
    lead: "Chaque profil est un espace indépendant. Les comptes, simulations, scénarios et réglages restent séparés.",
    steps: [
      "Au démarrage, cliquez sur le profil que vous voulez utiliser.",
      "Utilisez Nouveau profil pour créer un espace pour une autre personne, un couple ou une situation de test.",
      "Ajoutez un code PIN si plusieurs personnes utilisent le même ordinateur.",
    ],
    tip: "Un profil peut servir à votre situation réelle, un autre à tester un projet sans mélanger les données.",
  },
  {
    title: "Compléter ou modifier son profil",
    lead: "Le profil sert de base à tous les calculs. Plus il est juste, plus les résultats sont utiles.",
    steps: [
      "Renseignez votre situation, vos revenus, votre logement et vos charges principales.",
      "En couple, renseignez les revenus de chaque personne pour obtenir une analyse plus équilibrée.",
      "Vous pouvez revenir sur ces informations avec le bouton Modifier sous votre profil.",
    ],
  },
  {
    title: "Lire la vue d’ensemble",
    lead: "La vue d’ensemble vous donne une réponse rapide : votre budget est-il confortable, fragile ou à surveiller ?",
    steps: [
      "Regardez d’abord le Score de Santé Financière et le reste à vivre mensuel.",
      "Lisez les alertes prioritaires avant de regarder les détails.",
      "Utilisez les actions rapides pour aller directement vers le module utile.",
    ],
  },
  {
    title: "Piloter Mes Comptes",
    lead: "Mes Comptes sert à suivre le mois réel, ligne par ligne, sans perdre la vision globale.",
    steps: [
      "Dans Dépenses, validez les charges réellement passées ce mois-ci.",
      "Corrigez le montant réel si une charge est différente du montant prévu.",
      "Ignorez une ligne uniquement si elle ne concerne pas ce mois.",
      "Clôturez le mois quand tout est vérifié pour figer l’historique.",
    ],
    tip: "Le bouton Valider confirme une dépense. Il ne supprime rien et ne clôture pas le mois.",
  },
  {
    title: "Suivre les crédits",
    lead: "Les crédits sont suivis dans le temps pour anticiper la capacité qui sera libérée.",
    steps: [
      "Ajoutez le type de crédit, la durée restante et l’établissement prêteur.",
      "SimuBudget affiche le nombre de mois restants sous la ligne du crédit.",
      "À chaque clôture mensuelle, la durée restante diminue automatiquement.",
      "Les recommandations signalent les crédits bientôt terminés.",
    ],
  },
  {
    title: "Utiliser le rapport annuel",
    lead: "Le rapport annuel donne une vision plus large : dépenses, fiscalité estimée et pistes d’optimisation.",
    steps: [
      "Consultez-le après avoir renseigné votre profil et vos comptes.",
      "Comparez les catégories de dépenses pour repérer les postes qui pèsent le plus.",
      "Gardez en tête que les montants fiscaux restent indicatifs.",
    ],
  },
  {
    title: "Comprendre le conseiller expert",
    lead: "Le conseiller expert transforme vos données en recommandations concrètes et classées par priorité.",
    steps: [
      "Commencez par les recommandations critiques ou danger.",
      "Regardez l’impact estimé avant/après lorsqu’il est disponible.",
      "Cliquez sur les actions proposées pour aller au bon module ou ouvrir une source officielle.",
    ],
    tip: "Les recommandations ne remplacent pas un conseiller financier. Elles servent à décider quoi vérifier en premier.",
  },
  {
    title: "Gérer les paramètres",
    lead: "Les paramètres permettent d’adapter l’application à votre usage sans casser vos simulations.",
    steps: [
      "Changez le thème, la taille du texte et les préférences d’affichage.",
      "Renommez le profil actif ou ajoutez un code PIN.",
      "Utilisez Changer de compte pour revenir au choix du profil.",
      "Gardez l’export JSON pour sauvegarder un profil avant une grosse modification.",
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10">
      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="mb-8"
      >
        <p className="section-label">Aide</p>
        <h1 className="mt-2 font-display text-4xl font-extrabold tracking-[-0.05em] text-ink-primary">
          Bien utiliser SimuBudget
        </h1>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-ink-muted">
          Ce guide explique les fonctions principales avec des mots simples. L’objectif est de vous aider à savoir où cliquer, quoi vérifier et comment interpréter les résultats.
        </p>
      </motion.header>

      <div className="grid gap-4 lg:grid-cols-2">
        {HELP_SECTIONS.map((section, index) => (
          <motion.article
            key={section.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: index * 0.025 }}
            className="rounded-[24px] p-5"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-soft)" }}
          >
            <div className="mb-4 flex items-start gap-3">
              <span
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl text-sm font-extrabold"
                style={{ background: "var(--brand-soft)", color: "var(--brand-1)", border: "1px solid var(--border-brand)" }}
              >
                {index + 1}
              </span>
              <div>
                <h2 className="font-display text-xl font-extrabold tracking-[-0.035em] text-ink-primary">{section.title}</h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-ink-muted">{section.lead}</p>
              </div>
            </div>

            <ol className="space-y-2">
              {section.steps.map((step, stepIndex) => (
                <li key={step} className="flex gap-2 text-sm font-medium leading-6 text-ink-secondary">
                  <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full" style={{ background: "var(--brand-1)" }} />
                  <span>{stepIndex + 1}. {step}</span>
                </li>
              ))}
            </ol>

            {section.tip && (
              <div
                className="mt-4 rounded-2xl px-4 py-3 text-sm font-semibold leading-6"
                style={{ background: "var(--fin-blue-bg)", border: "1px solid var(--fin-blue-border)", color: "var(--text-secondary)" }}
              >
                <span className="font-extrabold" style={{ color: "var(--fin-blue)" }}>Astuce : </span>
                {section.tip}
              </div>
            )}
          </motion.article>
        ))}
      </div>
    </div>
  );
}
