// =============================================================================
// Fichier  : src/components/Housing/PurchaseModule/PurchaseModule.tsx
// Auteur   : KREMER Régis
// Desc.    : Module simulation achat V2 — saisie guidée, validation et résultats fiabilisés.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Régis | Création Phase 0
//   2026-05-01 | KREMER Régis | Phase 11 — Fix 6 : formatYears pluriel conditionnel
//   2026-04-26 | KREMER Régis | Refonte complète Phase 1 — tous les onglets
//   2026-04-29 | KREMER Régis | Refonte Phase 8 — wrapper premium fluide
//   2026-04-30 | KREMER Régis | Phase 10 — tokens CSS, accents, inputs premium,
//                               BuyVsRentChart branché, focus ring token
//   2026-05-01 | KREMER Régis | ZIP 8 — Refonte simulation achat V2 : validation, UX guidée,
//                               garde-fous de saisie et résultats professionnels
// =============================================================================

import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { clsx } from "clsx";
import { usePurchaseStore } from "../../../store/purchaseStore";
import { useProfileStore } from "../../../store/profileStore";
import { useUIStore } from "../../../store/uiStore";
import { usePurchase } from "../../../hooks/usePurchase";
import SliderInput from "../../shared/SliderInput";
import AlertBadge from "../../shared/AlertBadge";
import DebtGauge from "./DebtGauge";
import { BuyVsRentChart } from "./BuyVsRentChart";
import { formatEur, formatPct, formatYears } from "../../../utils/formatCurrency";
import type { PurchaseInput, PurchaseResult, PropertyCondition, PropertyType, PropertyUsage } from "../../../types/purchase";
import type { UserProfile } from "../../../types/profile";

const TABS = ["Bien", "Financement", "Aides", "Résultats", "Achat vs Location"];
const INPUT_CLS = "input-premium";
const SIMULATION_DEBOUNCE_MS = 650;

type IssueSeverity = "blocking" | "warning" | "info";

interface PurchaseIssue {
  id: string;
  severity: IssueSeverity;
  title: string;
  detail: string;
  tabIndex: number;
}

interface ActionSuggestion {
  id: string;
  title: string;
  detail: string;
  tabIndex: number;
}

export default function PurchaseModule() {
  const {
    input,
    result,
    loading,
    error,
    updateInput,
    clearResult,
    setLoading,
    setError,
  } = usePurchaseStore();
  const profile = useProfileStore((s) => s.profile);
  const { purchaseActiveTab: tab, setPurchaseTab } = useUIStore();
  const { simulate } = usePurchase();

  const profileMonthlyIncome = useMemo(() => getProfileMonthlyIncome(profile), [profile]);
  const profileHouseholdSize = useMemo(() => getProfileHouseholdSize(profile), [profile]);

  useEffect(() => {
    if (!profile) return;
    if (profileMonthlyIncome > 0 && Math.round(input.monthlyIncome) !== Math.round(profileMonthlyIncome)) {
      updateInput("monthlyIncome", profileMonthlyIncome);
    }
    if (profileHouseholdSize > 0 && input.householdSize !== profileHouseholdSize) {
      updateInput("householdSize", profileHouseholdSize);
    }
    if (input.age <= 0) {
      updateInput("age", 30);
    }
  }, [
    input.age,
    input.householdSize,
    input.monthlyIncome,
    profile,
    profileHouseholdSize,
    profileMonthlyIncome,
    updateInput,
  ]);

  const issues = useMemo(() => validatePurchaseInput(input), [input]);
  const blockingIssues = issues.filter((issue) => issue.severity === "blocking");
  const canSimulate = blockingIssues.length === 0;

  useEffect(() => {
    if (!profile) return;

    if (!canSimulate) {
      clearResult();
      setLoading(false);
      setError(null);
      return;
    }

    const timer = window.setTimeout(() => {
      void simulate();
    }, SIMULATION_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [canSimulate, clearResult, profile, setError, setLoading, simulate]);

  const outcome = result ? getPurchaseOutcome(result) : null;
  const suggestions = result ? buildActionSuggestions(input, result) : [];

  if (!profile) {
    return (
      <div className="p-8 text-center" style={{ color: "var(--text-muted)" }}>
        Aucun profil.{" "}
        <a href="#/onboarding" className="font-semibold underline" style={{ color: "var(--brand-1)" }}>
          Créez votre profil
        </a>
      </div>
    );
  }

  return (
    <div className="page-shell space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1
            className="font-display text-2xl font-extrabold"
            style={{ letterSpacing: "-0.04em", color: "var(--text-primary)" }}
          >
            Simulation Achat
          </h1>
          <p className="mt-1 text-sm font-medium" style={{ color: "var(--text-muted)" }}>
            Construisez un projet immobilier fiable : prix, apport, crédit, PTZ et reste à vivre.
          </p>
        </div>

        <ProjectStatusBadge result={result} issues={issues} loading={loading} />
      </div>

      <ProjectSummary input={input} result={result} issues={issues} />

      <div className="tab-bar">
        {TABS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setPurchaseTab(i)}
            className={clsx("tab-btn", tab === i && "active")}
          >
            {label}
          </button>
        ))}
      </div>

      {issues.length > 0 && (
        <ValidationPanel issues={issues} onGoToTab={setPurchaseTab} />
      )}

      {error && canSimulate && (
        <div
          className="rounded-2xl p-4 text-sm font-semibold"
          style={{
            background: "var(--fin-red-bg)",
            color: "var(--fin-red)",
            border: "1px solid var(--fin-red-border)",
          }}
        >
          Calcul indisponible pour le moment : {error}
        </div>
      )}

      {tab === 0 && <PropertyTab input={input} updateInput={updateInput} />}
      {tab === 1 && <FinancingTab input={input} result={result} updateInput={updateInput} />}
      {tab === 2 && <AidsTab input={input} result={result} updateInput={updateInput} />}
      {tab === 3 && (
        <ResultsTab
          result={result}
          loading={loading && canSimulate}
          canSimulate={canSimulate}
          outcome={outcome}
          suggestions={suggestions}
          onGoToTab={setPurchaseTab}
        />
      )}
      {tab === 4 && <BuyVsRentTab result={result} canSimulate={canSimulate} />}
    </div>
  );
}

function PropertyTab({
  input,
  updateInput,
}: {
  input: PurchaseInput;
  updateInput: <K extends keyof PurchaseInput>(key: K, value: PurchaseInput[K]) => void;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card p-6 space-y-5">
      <SectionIntro
        title="Le bien visé"
        text="Renseignez le prix réel du projet. Les frais de notaire, la garantie et le capital à emprunter seront recalculés automatiquement."
      />

      <SliderInput
        label="Prix du bien"
        value={input.propertyPrice}
        min={50000}
        max={1000000}
        step={5000}
        format={(v) => `${(v / 1000).toFixed(0)} k€`}
        onChange={(v) => updateInput("propertyPrice", v)}
      />

      <SliderInput
        label="Surface"
        value={input.surface}
        min={10}
        max={300}
        step={1}
        unit="m²"
        onChange={(v) => updateInput("surface", v)}
      />

      <ChoiceGrid<PropertyType>
        label="Type de bien"
        value={input.propertyType}
        options={[
          { value: "apartment", label: "Appartement", detail: "Charges de copropriété probables" },
          { value: "house", label: "Maison", detail: "Entretien annuel à anticiper" },
          { value: "land_build", label: "Terrain + construction", detail: "Projet plus long et plus variable" },
          { value: "vefa", label: "VEFA / neuf", detail: "Frais réduits, livraison future" },
        ]}
        onChange={(value) => {
          updateInput("propertyType", value);
          if (value === "vefa") updateInput("isNew", true);
        }}
      />

      <ChoiceGrid<PropertyCondition>
        label="État du bien"
        value={input.condition}
        options={[
          { value: "good", label: "Bon état", detail: "Pas de gros travaux prévus" },
          { value: "to_renovate", label: "À rénover", detail: "Budget travaux recommandé" },
          { value: "energy_sieve", label: "DPE F/G", detail: "Risque charges + revente" },
        ]}
        onChange={(value) => updateInput("condition", value)}
      />

      {input.condition !== "good" && (
        <NumberField
          label="Budget travaux estimé"
          value={input.renovationBudget}
          suffix="€"
          min={0}
          helper="Ajoutez une enveloppe réaliste. Un bien à rénover sans budget travaux fausse le reste à vivre."
          onChange={(value) => updateInput("renovationBudget", value)}
        />
      )}

      <div className="space-y-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
        <CheckboxOption
          label="Bien neuf / VEFA — frais de notaire réduits"
          checked={input.isNew || input.propertyType === "vefa"}
          onChange={(v) => updateInput("isNew", v)}
        />
        <CheckboxOption
          label="Primo-accédant — permet de tester le PTZ"
          checked={input.isFirstTimeBuyer}
          onChange={(v) => updateInput("isFirstTimeBuyer", v)}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 pt-3 border-t md:grid-cols-2" style={{ borderColor: "var(--border)" }}>
        <TextField
          label="Ville"
          value={input.city}
          placeholder="Ex : Lyon"
          helper="La ville sert à estimer la zone PTZ et la comparaison achat/location."
          onChange={(value) => updateInput("city", value)}
        />
        <TextField
          label="Département"
          value={input.department}
          placeholder="Ex : 69"
          maxLength={3}
          helper="Deux chiffres, ou 2A / 2B pour la Corse."
          onChange={(value) => updateInput("department", value)}
        />
      </div>
    </motion.div>
  );
}

function FinancingTab({
  input,
  result,
  updateInput,
}: {
  input: PurchaseInput;
  result: PurchaseResult | null;
  updateInput: <K extends keyof PurchaseInput>(key: K, value: PurchaseInput[K]) => void;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
      <div className="card p-6 space-y-5">
        <SectionIntro
          title="Financement"
          text="Le calcul bancaire dépend surtout des revenus mensuels, de l'apport, des crédits en cours et de la durée."
        />

        <NumberField
          label="Revenus nets mensuels du foyer"
          value={input.monthlyIncome}
          suffix="€/mois"
          min={0}
          helper="Montant mensuel réellement disponible avant loyer et crédits. Pour un couple, indiquez les deux salaires cumulés."
          onChange={(value) => updateInput("monthlyIncome", value)}
        />

        <SliderInput
          label="Apport personnel"
          value={input.downPayment}
          min={0}
          max={300000}
          step={1000}
          format={(v) => `${(v / 1000).toFixed(0)} k€`}
          onChange={(v) => updateInput("downPayment", v)}
        />

        <SliderInput
          label="Durée du crédit"
          value={input.loanDurationYears}
          min={10}
          max={25}
          step={1}
          unit="ans"
          onChange={(v) => updateInput("loanDurationYears", v)}
        />

        <SliderInput
          label="Autres crédits en cours"
          value={input.otherLoansMonthly}
          min={0}
          max={2000}
          step={10}
          onChange={(v) => updateInput("otherLoansMonthly", v)}
        />

        <div className="grid grid-cols-1 gap-3 pt-3 border-t md:grid-cols-2" style={{ borderColor: "var(--border)" }}>
          <OptionalNumberField
            label="Taux d'intérêt connu"
            value={input.interestRate}
            suffix="%"
            min={0}
            max={10}
            step={0.01}
            placeholder={`Auto (~3,5 % sur ${input.loanDurationYears} ans)`}
            helper="Laissez vide si vous n'avez pas encore de proposition bancaire."
            onChange={(value) => updateInput("interestRate", value)}
          />
          <OptionalNumberField
            label="Assurance emprunteur connue"
            value={input.insuranceRate}
            suffix="%"
            min={0}
            max={2}
            step={0.01}
            placeholder="Auto selon âge"
            helper="Taux annuel. Vous pouvez le laisser vide au stade simulation."
            onChange={(value) => updateInput("insuranceRate", value)}
          />
        </div>
      </div>

      <div className="card p-6 space-y-3">
        <SectionIntro
          title="Lecture rapide"
          text="Ces indicateurs évitent de regarder uniquement la mensualité."
        />
        <InfoRow label="Prix du bien" value={formatEur(input.propertyPrice)} />
        <InfoRow label="Apport" value={`${formatEur(input.downPayment)} (${formatPct(safeRatio(input.downPayment, input.propertyPrice))})`} />
        <InfoRow label="Revenus mensuels" value={formatEur(input.monthlyIncome)} />
        <InfoRow label="Autres crédits" value={formatEur(input.otherLoansMonthly)} />
        {result && (
          <div className="pt-2 mt-2 border-t" style={{ borderColor: "var(--border)" }}>
            <InfoRow label="Capital à emprunter" value={formatEur(result.loanAmount)} bold />
            <InfoRow label="Coût total opération" value={formatEur(result.totalOperationCost)} />
          </div>
        )}
      </div>
    </motion.div>
  );
}

function AidsTab({
  input,
  result,
  updateInput,
}: {
  input: PurchaseInput;
  result: PurchaseResult | null;
  updateInput: <K extends keyof PurchaseInput>(key: K, value: PurchaseInput[K]) => void;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="card p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <SectionIntro
            title="Prêt à Taux Zéro (PTZ)"
            text="Le PTZ dépend du statut primo-accédant, de la zone, du nombre de personnes et du revenu fiscal N-2."
          />
          {result?.ptz.eligible ? (
            <span className="level-pill green">Éligible</span>
          ) : (
            <span className="level-pill" style={{ background: "var(--bg-surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
              À vérifier
            </span>
          )}
        </div>

        <OptionalNumberField
          label="Revenu fiscal de référence N-2"
          value={input.fiscalReferenceIncome}
          suffix="€/an"
          min={0}
          placeholder="Ex : 43 000"
          helper="Saisissez le montant annuel complet. Exemple : tapez 43000, pas 43. Laissez vide si vous ne l'avez pas."
          onChange={(value) => updateInput("fiscalReferenceIncome", value)}
        />

        {result?.ptz.eligible && result.ptz.amount ? (
          <div className="space-y-0 rounded-2xl p-4" style={{ background: "var(--fin-green-bg)", border: "1px solid var(--fin-green-border)" }}>
            <InfoRow label="Zone PTZ" value={result.ptz.zone ?? "—"} />
            <InfoRow label="Montant PTZ" value={formatEur(result.ptz.amount)} bold />
            <InfoRow label="Différé estimé" value={formatYears(result.ptz.deferralYears ?? 0)} />
            {result.monthlyPhase1 != null && <InfoRow label="Mensualité phase 1" value={formatEur(result.monthlyPhase1)} />}
            {result.monthlyPhase2 != null && <InfoRow label="Mensualité phase 2" value={formatEur(result.monthlyPhase2)} />}
          </div>
        ) : (
          <p className="rounded-2xl p-4 text-sm font-medium" style={{ background: "var(--bg-surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
            {input.isFirstTimeBuyer
              ? "Le calcul indiquera l'éligibilité lorsque le dossier aura des montants cohérents."
              : "Le PTZ est réservé aux primo-accédants pour une résidence principale."}
          </p>
        )}
      </div>

      <div className="card p-6 space-y-4">
        <SectionIntro
          title="Autres aides potentielles"
          text="Ces aides ne remplacent pas une vérification officielle, mais elles signalent les pistes à contrôler."
        />
        <CheckboxOption
          label="Employeur > 10 salariés — Action Logement possible"
          checked={input.employerOver10}
          onChange={(v) => updateInput("employerOver10", v)}
        />
        {input.employerOver10 && (
          <p className="text-xs font-semibold" style={{ color: "var(--fin-blue)" }}>
            Action Logement peut proposer un prêt complémentaire à taux réduit. À vérifier auprès de l'employeur.
          </p>
        )}
      </div>
    </motion.div>
  );
}

function ResultsTab({
  result,
  loading,
  canSimulate,
  outcome,
  suggestions,
  onGoToTab,
}: {
  result: PurchaseResult | null;
  loading: boolean;
  canSimulate: boolean;
  outcome: ReturnType<typeof getPurchaseOutcome> | null;
  suggestions: ActionSuggestion[];
  onGoToTab: (tab: number) => void;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {!canSimulate && (
        <EmptyState
          title="Simulation en attente"
          text="Complétez les champs signalés avant de calculer le projet. Les résultats ne s'affichent pas sur une saisie partielle."
        />
      )}

      {loading && canSimulate && (
        <div className="card p-6 text-center text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
          Calcul du projet en cours…
        </div>
      )}

      {canSimulate && result && outcome && (
        <>
          <OutcomeCard outcome={outcome} />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <MetricCard label="Mensualité" value={formatEur(result.monthlyPaymentWithInsurance)} detail="assurance incluse" />
            <div className="card p-5 xl:col-span-1">
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
                Taux d'endettement
              </p>
              <DebtGauge ratio={result.debtRatioPostPurchase} />
            </div>
            <MetricCard
              label="Reste à vivre post-achat"
              value={formatEur(result.disposableIncomePostPurchase)}
              detail="après mensualité et charges estimées"
              tone={result.disposableIncomePostPurchase < 0 ? "red" : result.disposableIncomePostPurchase < 600 ? "amber" : "green"}
            />
          </div>

          <div className="card p-5 space-y-0">
            <p className="text-sm font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>
              Détail du financement
            </p>
            <InfoRow label="Capital emprunté" value={formatEur(result.loanAmount)} />
            <InfoRow label="Total intérêts" value={formatEur(result.totalInterestPaid)} />
            <InfoRow label="Total assurance" value={formatEur(result.totalInsurancePaid)} />
            <InfoRow label="Coût total crédit" value={formatEur(result.totalInterestPaid + result.totalInsurancePaid)} bold />
            <div className="pt-2 mt-2 border-t" style={{ borderColor: "var(--border)" }}>
              <InfoRow label="Apport / prix" value={formatPct(result.downPaymentRatio)} bold />
              <InfoRow label="Épargne résiduelle" value={formatEur(result.residualSavings)} />
            </div>
          </div>

          {suggestions.length > 0 && (
            <div className="card p-5 space-y-3">
              <p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
                Actions possibles pour améliorer le dossier
              </p>
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  onClick={() => onGoToTab(suggestion.tabIndex)}
                  className="w-full rounded-2xl p-4 text-left transition hover:-translate-y-0.5"
                  style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border)" }}
                >
                  <span className="block text-sm font-extrabold" style={{ color: "var(--text-primary)" }}>
                    {suggestion.title}
                  </span>
                  <span className="mt-1 block text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                    {suggestion.detail}
                  </span>
                </button>
              ))}
            </div>
          )}

          {result.alerts.length > 0 && (
            <div className="space-y-2">
              {result.alerts.map((alert) => (
                <AlertBadge key={alert.id} {...alert} />
              ))}
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}

function BuyVsRentTab({ result, canSimulate }: { result: PurchaseResult | null; canSimulate: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {!canSimulate && (
        <EmptyState
          title="Comparaison indisponible"
          text="La comparaison achat/location sera disponible quand la simulation principale sera cohérente."
        />
      )}

      {canSimulate && result && (
        <>
          <div
            className="rounded-2xl p-6"
            style={{
              background: result.breakEvenYears <= 8
                ? "var(--fin-green-bg)"
                : result.breakEvenYears <= 12
                  ? "var(--fin-amber-bg)"
                  : "var(--fin-red-bg)",
              border: `1px solid ${
                result.breakEvenYears <= 8
                  ? "var(--fin-green-border)"
                  : result.breakEvenYears <= 12
                    ? "var(--fin-amber-border)"
                    : "var(--fin-red-border)"
              }`,
            }}
          >
            <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
              Point de bascule — l'achat devient rentable vs la location
            </p>
            <p className="text-4xl font-bold font-mono tabular-nums" style={{ color: "var(--text-primary)" }}>
              {formatYears(result.breakEvenYears)}
            </p>
            <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
              {result.breakEvenYears <= 8
                ? "Favorable si vous pensez garder le bien plusieurs années."
                : result.breakEvenYears <= 12
                  ? "À comparer avec votre stabilité professionnelle et familiale."
                  : "La location peut rester plus prudente à court ou moyen terme."}
            </p>
          </div>

          <div className="card p-6">
            <BuyVsRentChart result={result} breakEvenYear={result.breakEvenYears} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="card p-5 space-y-0">
              <p className="text-sm font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>
                Patrimoine constitué
              </p>
              <InfoRow label="À 5 ans" value={formatEur(result.wealthAt5Years)} />
              <InfoRow label="À 10 ans" value={formatEur(result.wealthAt10Years)} bold />
            </div>

            <div className="card p-5 space-y-0">
              <p className="text-sm font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>
                Loyer équivalent estimé
              </p>
              <InfoRow label="Loyer marché" value={formatEur(result.rentEquivalent)} />
              <InfoRow label="Mensualité simulée" value={formatEur(result.monthlyPaymentWithInsurance)} bold />
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}

function ProjectStatusBadge({
  result,
  issues,
  loading,
}: {
  result: PurchaseResult | null;
  issues: PurchaseIssue[];
  loading: boolean;
}) {
  const blocking = issues.some((issue) => issue.severity === "blocking");
  if (blocking) {
    return <StatusPill label="Saisie à compléter" tone="amber" />;
  }
  if (loading) {
    return <StatusPill label="Calcul en cours" tone="blue" />;
  }
  if (!result) {
    return <StatusPill label="Prêt à simuler" tone="blue" />;
  }
  const outcome = getPurchaseOutcome(result);
  return <StatusPill label={outcome.label} tone={outcome.tone} />;
}

function ProjectSummary({ input, result, issues }: { input: PurchaseInput; result: PurchaseResult | null; issues: PurchaseIssue[] }) {
  const blocking = issues.some((issue) => issue.severity === "blocking");
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <SummaryTile label="Prix" value={formatEur(input.propertyPrice)} />
      <SummaryTile label="Apport" value={formatEur(input.downPayment)} />
      <SummaryTile label="Durée" value={formatYears(input.loanDurationYears)} />
      <SummaryTile label="Revenus" value={formatEur(input.monthlyIncome)} />
      <SummaryTile
        label="Mensualité"
        value={blocking ? "—" : result ? formatEur(result.monthlyPaymentWithInsurance) : "En attente"}
        highlight={Boolean(result && !blocking)}
      />
    </div>
  );
}

function ValidationPanel({ issues, onGoToTab }: { issues: PurchaseIssue[]; onGoToTab: (tab: number) => void }) {
  return (
    <div className="grid gap-2">
      {issues.map((issue) => (
        <button
          key={issue.id}
          type="button"
          onClick={() => onGoToTab(issue.tabIndex)}
          className="rounded-2xl p-4 text-left transition hover:-translate-y-0.5"
          style={{
            background: issue.severity === "blocking" ? "var(--fin-red-bg)" : issue.severity === "warning" ? "var(--fin-amber-bg)" : "var(--fin-blue-bg)",
            border: `1px solid ${issue.severity === "blocking" ? "var(--fin-red-border)" : issue.severity === "warning" ? "var(--fin-amber-border)" : "var(--fin-blue-border)"}`,
          }}
        >
          <span
            className="text-[10px] font-extrabold uppercase tracking-widest"
            style={{ color: issue.severity === "blocking" ? "var(--fin-red)" : issue.severity === "warning" ? "var(--fin-amber)" : "var(--fin-blue)" }}
          >
            {issue.severity === "blocking" ? "À corriger" : issue.severity === "warning" ? "Vigilance" : "Info"}
          </span>
          <span className="mt-1 block text-sm font-extrabold" style={{ color: "var(--text-primary)" }}>
            {issue.title}
          </span>
          <span className="mt-1 block text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
            {issue.detail}
          </span>
        </button>
      ))}
    </div>
  );
}

function OutcomeCard({ outcome }: { outcome: ReturnType<typeof getPurchaseOutcome> }) {
  return (
    <div
      className="rounded-3xl p-6"
      style={{
        background: outcome.tone === "green" ? "var(--fin-green-bg)" : outcome.tone === "amber" ? "var(--fin-amber-bg)" : outcome.tone === "red" ? "var(--fin-red-bg)" : "var(--fin-blue-bg)",
        border: `1px solid ${outcome.tone === "green" ? "var(--fin-green-border)" : outcome.tone === "amber" ? "var(--fin-amber-border)" : outcome.tone === "red" ? "var(--fin-red-border)" : "var(--fin-blue-border)"}`,
      }}
    >
      <p
        className="text-xs font-extrabold uppercase tracking-widest"
        style={{ color: outcome.tone === "green" ? "var(--fin-green)" : outcome.tone === "amber" ? "var(--fin-amber)" : outcome.tone === "red" ? "var(--fin-red)" : "var(--fin-blue)" }}
      >
        Verdict dossier
      </p>
      <h2 className="mt-2 text-2xl font-extrabold" style={{ color: "var(--text-primary)" }}>
        {outcome.label}
      </h2>
      <p className="mt-2 text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
        {outcome.detail}
      </p>
    </div>
  );
}

function MetricCard({ label, value, detail, tone = "default" }: { label: string; value: string; detail: string; tone?: "default" | "green" | "amber" | "red" }) {
  const color = tone === "green" ? "var(--fin-green)" : tone === "amber" ? "var(--fin-amber)" : tone === "red" ? "var(--fin-red)" : "var(--text-primary)";
  return (
    <div className="card p-5">
      <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p className="text-3xl font-mono font-bold tabular-nums" style={{ color }}>
        {value}
      </p>
      <p className="text-xs mt-1 font-semibold" style={{ color: "var(--text-muted)" }}>
        {detail}
      </p>
    </div>
  );
}

function SummaryTile({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: highlight ? "var(--fin-green-bg)" : "var(--bg-surface-1)", border: `1px solid ${highlight ? "var(--fin-green-border)" : "var(--border)"}` }}>
      <p className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p className="mt-1 font-mono text-sm font-extrabold tabular-nums" style={{ color: highlight ? "var(--fin-green)" : "var(--text-primary)" }}>
        {value}
      </p>
    </div>
  );
}

function StatusPill({ label, tone }: { label: string; tone: "green" | "amber" | "red" | "blue" }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-4 py-2 text-xs font-extrabold uppercase tracking-widest"
      style={{
        background: tone === "green" ? "var(--fin-green-bg)" : tone === "amber" ? "var(--fin-amber-bg)" : tone === "red" ? "var(--fin-red-bg)" : "var(--fin-blue-bg)",
        color: tone === "green" ? "var(--fin-green)" : tone === "amber" ? "var(--fin-amber)" : tone === "red" ? "var(--fin-red)" : "var(--fin-blue)",
        border: `1px solid ${tone === "green" ? "var(--fin-green-border)" : tone === "amber" ? "var(--fin-amber-border)" : tone === "red" ? "var(--fin-red-border)" : "var(--fin-blue-border)"}`,
      }}
    >
      {label}
    </span>
  );
}

function SectionIntro({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h2 className="text-lg font-extrabold" style={{ color: "var(--text-primary)" }}>
        {title}
      </h2>
      <p className="mt-1 text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
        {text}
      </p>
    </div>
  );
}

function TextField({ label, value, placeholder, helper, maxLength, onChange }: { label: string; value: string; placeholder?: string; helper?: string; maxLength?: number; onChange: (value: string) => void }) {
  return (
    <label className="form-label">
      {label}
      <input
        type="text"
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        className={INPUT_CLS}
        onChange={(event) => onChange(event.target.value)}
      />
      {helper && <span className="mt-1 block text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>{helper}</span>}
    </label>
  );
}

function NumberField({ label, value, suffix, min, helper, onChange }: { label: string; value: number; suffix?: string; min?: number; helper?: string; onChange: (value: number) => void }) {
  return (
    <label className="form-label">
      {label}
      <div className="flex items-center gap-3">
        <input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          min={min}
          className={INPUT_CLS}
          onChange={(event) => onChange(toNumber(event.target.value))}
        />
        {suffix && <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>{suffix}</span>}
      </div>
      {helper && <span className="mt-1 block text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>{helper}</span>}
    </label>
  );
}

function OptionalNumberField({ label, value, suffix, min, max, step, placeholder, helper, onChange }: { label: string; value: number | undefined; suffix?: string; min?: number; max?: number; step?: number; placeholder?: string; helper?: string; onChange: (value: number | undefined) => void }) {
  return (
    <label className="form-label">
      {label}
      <div className="flex items-center gap-3">
        <input
          type="number"
          value={value ?? ""}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          className={INPUT_CLS}
          onChange={(event) => onChange(toOptionalNumber(event.target.value))}
        />
        {suffix && <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>{suffix}</span>}
      </div>
      {helper && <span className="mt-1 block text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>{helper}</span>}
    </label>
  );
}

function ChoiceGrid<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<{ value: T; label: string; detail: string }>; onChange: (value: T) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
        {label}
      </p>
      <div className="grid gap-2 md:grid-cols-2">
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className="rounded-2xl p-4 text-left transition hover:-translate-y-0.5"
              style={{
                background: active ? "linear-gradient(135deg, var(--brand-1), var(--brand-2))" : "var(--bg-input)",
                border: `1px solid ${active ? "transparent" : "var(--border)"}`,
                color: active ? "white" : "var(--text-secondary)",
              }}
            >
              <span className="block text-sm font-extrabold">{option.label}</span>
              <span className="mt-1 block text-xs font-semibold opacity-80">{option.detail}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function InfoRow({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="stat-row">
      <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className={clsx("font-mono text-xs tabular-nums", bold ? "font-bold" : "font-medium")} style={{ color: bold ? "var(--text-primary)" : "var(--text-secondary)" }}>
        {value}
      </span>
    </div>
  );
}

function CheckboxOption({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <div
        onClick={() => onChange(!checked)}
        className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-2 cursor-pointer transition-all"
        style={{ borderColor: checked ? "var(--brand-1)" : "var(--border)", background: checked ? "var(--brand-1)" : "var(--bg-input)" }}
      >
        {checked && (
          <svg viewBox="0 0 10 10" fill="white" className="h-2.5 w-2.5">
            <path fillRule="evenodd" d="M8.5 2.5 4 7 1.5 4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" clipRule="evenodd" />
          </svg>
        )}
      </div>
      <span className="text-sm font-medium transition-colors" style={{ color: "var(--text-secondary)" }}>
        {label}
      </span>
    </label>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="card p-8 text-center">
      <p className="text-lg font-extrabold" style={{ color: "var(--text-primary)" }}>
        {title}
      </p>
      <p className="mx-auto mt-2 max-w-xl text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
        {text}
      </p>
    </div>
  );
}

function validatePurchaseInput(input: PurchaseInput): PurchaseIssue[] {
  const issues: PurchaseIssue[] = [];

  if (input.propertyPrice < 50000) {
    issues.push({
      id: "price-too-low",
      severity: "blocking",
      title: "Prix du bien incomplet",
      detail: "Renseignez un prix réaliste avant de lancer le calcul. Le module achat ne calcule pas sur une saisie partielle.",
      tabIndex: 0,
    });
  }

  if (input.surface < 10) {
    issues.push({
      id: "surface-too-low",
      severity: "blocking",
      title: "Surface du bien incohérente",
      detail: "La surface sert à estimer le loyer équivalent et certains frais. Indiquez une surface en m².",
      tabIndex: 0,
    });
  }

  if (input.monthlyIncome < 1000) {
    issues.push({
      id: "income-too-low",
      severity: "blocking",
      title: "Revenus mensuels incomplets",
      detail: "Saisissez le revenu net mensuel du foyer. Exemple : 4300 €/mois, pas un montant annuel ni une saisie partielle.",
      tabIndex: 1,
    });
  }

  if (input.fiscalReferenceIncome !== undefined && input.fiscalReferenceIncome > 0 && input.fiscalReferenceIncome < 5000) {
    issues.push({
      id: "fiscal-income-partial",
      severity: "blocking",
      title: "Revenu fiscal N-2 incomplet",
      detail: "Pour 43 000 €, tapez 43000. Le calcul PTZ est bloqué tant que ce champ ressemble à une saisie partielle.",
      tabIndex: 2,
    });
  }

  if (input.downPayment < input.propertyPrice * 0.08) {
    issues.push({
      id: "down-payment-low",
      severity: "warning",
      title: "Apport faible",
      detail: "Un apport inférieur à 8-10 % couvre difficilement les frais annexes et fragilise le dossier bancaire.",
      tabIndex: 1,
    });
  }

  if (input.otherLoansMonthly > 0 && safeRatio(input.otherLoansMonthly, input.monthlyIncome) > 0.25) {
    issues.push({
      id: "other-loans-high",
      severity: "warning",
      title: "Crédits existants élevés",
      detail: "Les crédits déjà en cours réduisent fortement la capacité d'emprunt disponible pour le projet.",
      tabIndex: 1,
    });
  }

  if (input.condition === "energy_sieve") {
    issues.push({
      id: "energy-sieve",
      severity: "warning",
      title: "DPE F/G à surveiller",
      detail: "Un logement énergivore peut augmenter les charges et compliquer la revente. Ajoutez un budget travaux si nécessaire.",
      tabIndex: 0,
    });
  }

  return issues;
}

function getPurchaseOutcome(result: PurchaseResult): { label: string; detail: string; tone: "green" | "amber" | "red" | "blue" } {
  if (result.debtRatioPostPurchase > 0.40 || result.disposableIncomePostPurchase < 0) {
    return {
      label: "Refus probable",
      detail: "Le taux d'endettement ou le reste à vivre place le dossier en zone très difficile. Il faut modifier le prix, l'apport, la durée ou les crédits existants.",
      tone: "red",
    };
  }

  if (result.debtRatioPostPurchase > 0.35 || result.downPaymentRatio < 0.10 || result.disposableIncomePostPurchase < 800) {
    return {
      label: "Dossier fragile",
      detail: "Le projet peut être étudié, mais il reste proche des limites bancaires. Les alertes doivent être traitées avant visite ou offre.",
      tone: "amber",
    };
  }

  return {
    label: "Dossier cohérent",
    detail: "Le projet reste dans une zone lisible. Il faut encore vérifier les aides officielles, l'assurance et les frais réels avant engagement.",
    tone: "green",
  };
}

function buildActionSuggestions(input: PurchaseInput, result: PurchaseResult): ActionSuggestion[] {
  const suggestions: ActionSuggestion[] = [];

  if (result.debtRatioPostPurchase > 0.35) {
    suggestions.push({
      id: "lower-price",
      title: "Réduire le prix du bien ciblé",
      detail: "Un prix plus bas agit directement sur la mensualité et peut ramener le taux sous 35 %.",
      tabIndex: 0,
    });
    suggestions.push({
      id: "extend-duration",
      title: "Tester une durée plus longue",
      detail: "Allonger la durée réduit la mensualité, mais augmente le coût total du crédit. À utiliser comme levier de faisabilité.",
      tabIndex: 1,
    });
  }

  if (result.downPaymentRatio < 0.10) {
    suggestions.push({
      id: "increase-down-payment",
      title: "Renforcer l'apport",
      detail: `Visez au moins ${formatEur(input.propertyPrice * 0.10)} d'apport pour couvrir une partie des frais annexes.`,
      tabIndex: 1,
    });
  }

  if (input.otherLoansMonthly > 0) {
    suggestions.push({
      id: "reduce-loans",
      title: "Étudier les crédits en cours",
      detail: "Rembourser ou renégocier un crédit existant peut libérer de la capacité d'emprunt.",
      tabIndex: 1,
    });
  }

  if (input.isFirstTimeBuyer && !result.ptz.eligible) {
    suggestions.push({
      id: "check-ptz",
      title: "Vérifier le revenu fiscal N-2",
      detail: "Un revenu fiscal incomplet ou absent peut empêcher d'évaluer correctement le PTZ.",
      tabIndex: 2,
    });
  }

  return suggestions.slice(0, 4);
}

function getProfileMonthlyIncome(profile: UserProfile | null): number {
  if (!profile) return 0;
  const salary = profile.salaryNet ?? 0;
  const partnerSalary = profile.partner?.salaryNet ?? profile.partnerSalaryNet ?? 0;
  return Math.max(0, salary + partnerSalary);
}

function getProfileHouseholdSize(profile: UserProfile | null): number {
  if (!profile) return 1;
  const adults = profile.situation === "couple" || profile.partner ? 2 : 1;
  return adults + (profile.children?.length ?? 0);
}

function safeRatio(value: number, base: number): number {
  return base > 0 ? value / base : 0;
}

function toNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toOptionalNumber(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
