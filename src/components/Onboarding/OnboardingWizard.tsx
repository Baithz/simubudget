// =============================================================================
// Fichier  : src/components/Onboarding/OnboardingWizard.tsx
// Auteur   : KREMER Régis
// Desc.    : Wizard onboarding 5 étapes — collecte du profil utilisateur.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Régis | Création Phase 0 (3 étapes placeholder)
//   2026-04-26 | KREMER Régis | Refonte complète 5 étapes Phase 1
//   2026-04-29 | KREMER Régis | Phase 9.1 — reset profil et synchro Mes Comptes
//   2026-04-29 | KREMER Régis | Phase 9.2 — saisie personne A/B, revenus couple nominatifs
//   2026-05-01 | KREMER Régis | Phase 11 — labels intelligents (prénom/nom dès saisie),
//                               placeholders neutres, design professionnel Phase 10,
//                               récap enrichi, accents complets
//   2026-05-01 | KREMER Régis | Phase 12B — création profil depuis le selector
//   2026-05-01 | KREMER Régis | ZIP 7.1 — choix PIN lors de la création profil
//   2026-05-02 | KREMER Régis | Correction création profil isolée — départ vierge, sans reprise du profil actif
//   2026-05-02 | KREMER Régis | Correction lint ESLint 9 — variables inutilisées et règles React adaptées
//   2026-05-02 | KREMER Régis | Correction Phase 14.1 — mode nouveau profil strictement vierge et isolation des stores
// =============================================================================

import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useProfileStore }    from "@/store/profileStore";
import { hashProfilePin, useProfileListStore } from "@/store/profileListStore";
import { useAccountingStore } from "@/store/accountingStore";
import { useScenarioStore } from "@/store/scenarioStore";
import { usePurchaseStore } from "@/store/purchaseStore";
import { useProfile }         from "@/hooks/useProfile";
import { DEFAULT_PROFILE }    from "@/types/profile";
import type {
  UserProfile, Situation, AplZone, EmploymentType,
  HousingType, HeatingType,
} from "@/types/profile";
import { formatEur } from "@/utils/formatCurrency";
import PinSetupModal from "@/components/ProfileSelector/PinSetupModal";

// ─── Constantes ─────────────────────────────────────────────────────────────

const STEPS = ["Identité", "Revenus", "Logement", "Charges", "Récapitulatif"];
const PROFILE_SESSION_KEY = "simubudget-profile-session-active";

const EMPLOYMENT_LABELS: Record<string, string> = {
  cdi: "CDI", cdd: "CDD", freelance: "Indépendant / Freelance",
  unemployed: "Sans emploi / Chômage", retired: "Retraité(e)", other: "Autre",
};

const SITUATION_LABELS: Record<string, string> = {
  single: "Célibataire", couple: "En couple",
  separated: "Séparé(e)", cohabiting: "En colocation",
};

const HOUSING_LABELS: Record<string, string> = {
  tenant: "Locataire", owner: "Propriétaire",
  colocation: "Colocation", hosted: "Hébergé(e) gratuitement",
};

// ─── Utilitaires ─────────────────────────────────────────────────────────────

/** Retourne "Prénom Nom" si rempli, sinon le fallback */
function fullName(firstName: string, lastName: string, fallback: string): string {
  const full = `${firstName} ${lastName}`.trim();
  return full.length > 0 ? full : fallback;
}

function isCouple(situation: UserProfile["situation"]): boolean {
  return situation === "couple" || situation === "cohabiting";
}

function normalizeProfile(draft: UserProfile): UserProfile {
  const holder = draft.holder ?? { firstName: "", lastName: "" };
  if (!isCouple(draft.situation)) {
    const { partner: _p, partnerSalaryNet: _ps, ...rest } = draft;
    return { ...rest, holder };
  }
  const ep = draft.partner;
  const firstName = ep?.firstName ?? "";
  const lastName  = ep?.lastName  ?? "";
  const salaryNet = ep?.salaryNet ?? draft.partnerSalaryNet ?? 0;
  const partner = {
    name:           fullName(firstName, lastName, "Partenaire"),
    firstName,
    lastName,
    salaryNet,
    bonusAnnual:    ep?.bonusAnnual ?? 0,
    employmentType: ep?.employmentType ?? "cdi" as EmploymentType,
    otherIncome:    ep?.otherIncome ?? 0,
  };
  return { ...draft, holder, partner, partnerSalaryNet: salaryNet };
}

function createBlankProfile(): UserProfile {
  const now = new Date().toISOString();
  return {
    ...DEFAULT_PROFILE,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    holder: { firstName: "", lastName: "" },
    salaryNet: 0,
    bonusAnnual: 0,
    allocationsTotal: 0,
    pensionReceived: 0,
    rentalIncome: 0,
    otherIncome: 0,
    currentHousing: {
      ...DEFAULT_PROFILE.currentHousing,
      rent: 0,
      charges: 0,
      surface: 0,
    },
    phoneInternet: 0,
    insuranceTotal: 0,
    pensionPaid: 0,
    otherFixed: 0,
    department: "",
    city: "",
  };
}

// ─── Wizard principal ────────────────────────────────────────────────────────

export function OnboardingWizard() {
  const navigate        = useNavigate();
  const [searchParams]  = useSearchParams();
  const isNewProfileMode = searchParams.get("new") === "1";
  const { profile: currentProfile, setProfile, completeOnboarding, reset } = useProfileStore();
  const activeProfileId = useProfileListStore((state) => state.activeProfileId);
  const setActiveProfile = useProfileListStore((state) => state.setActive);
  const ensureProfileEntry = useProfileListStore((state) => state.ensureProfileEntry);
  const updateProfileEntry = useProfileListStore((state) => state.updateEntry);
  const syncFromProfile = useAccountingStore((s) => s.syncFromProfile);
  const resetAccounting = useAccountingStore((s) => s.resetAccounting);
  const clearScenarios = useScenarioStore((s) => s.clearEvents);
  const clearPurchaseResult = usePurchaseStore((s) => s.clearResult);
  const { saveProfile, loading, error } = useProfile();

  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<UserProfile>(() =>
    normalizeProfile(!isNewProfileMode && activeProfileId ? { ...currentProfile } : createBlankProfile())
  );
  const [pendingProfile, setPendingProfile] = useState<UserProfile | null>(null);

  function update<K extends keyof UserProfile>(key: K, value: UserProfile[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function finalizeProfile(profile: UserProfile, pinHash: string | null): Promise<void> {
    const ensuredId = ensureProfileEntry(profile);
    if (pinHash !== null) {
      updateProfileEntry(ensuredId, { pinHash });
    }
    const finalProfile = { ...profile, id: ensuredId };
    setActiveProfile(ensuredId);
    sessionStorage.setItem(PROFILE_SESSION_KEY, ensuredId);
    if (isNewProfileMode) {
      resetAccounting();
      clearScenarios();
      clearPurchaseResult();
    }
    setProfile(finalProfile);
    syncFromProfile(finalProfile);
    completeOnboarding();
    await saveProfile(finalProfile);
    navigate("/", { replace: true });
  }

  async function handleFinish() {
    const normalized = normalizeProfile(draft);
    const profileId = isNewProfileMode ? crypto.randomUUID() : activeProfileId ?? crypto.randomUUID();
    const profile: UserProfile = {
      ...normalized,
      id:        profileId,
      createdAt: normalized.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (isNewProfileMode || !activeProfileId) {
      setPendingProfile(profile);
      return;
    }
    await finalizeProfile(profile, null);
  }

  async function confirmCreationPin(pin: string): Promise<void> {
    if (!pendingProfile) return;
    const pinHash = await hashProfilePin(pin);
    await finalizeProfile(pendingProfile, pinHash);
  }

  async function skipCreationPin(): Promise<void> {
    if (!pendingProfile) return;
    await finalizeProfile(pendingProfile, null);
  }

  function handleReset() {
    const ok = window.confirm(
      "Réinitialiser le profil et Mes Comptes ? Cette action efface les revenus, charges, mois validés et historiques locaux."
    );
    if (!ok) return;
    reset();
    resetAccounting();
    setDraft(isNewProfileMode ? createBlankProfile() : normalizeProfile({ ...useProfileStore.getState().profile }));
    setStep(0);
  }


  // Label personnalisé dès que prénom/nom saisis
  const holderLabel = fullName(draft.holder.firstName, draft.holder.lastName, "Vous");

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
      style={{ background: "var(--bg-base)" }}
    >
      <AnimatePresence>
        {pendingProfile && (
          <PinSetupModal
            title="Protéger ce profil"
            description="Définissez un PIN de 4 à 6 chiffres ou continuez sans protection."
            onConfirm={(pin) => void confirmCreationPin(pin)}
            onSkip={() => void skipCreationPin()}
            onCancel={() => setPendingProfile(null)}
          />
        )}
      </AnimatePresence>

      {/* ── En-tête ───────────────────────────────────────────────────── */}
      <div className="w-full max-w-xl mb-6">
        <div className="flex items-baseline gap-3 mb-1">
          <h1
            className="font-display text-2xl font-extrabold gradient-brand-text"
            style={{ letterSpacing: "-0.04em" }}
          >
            SimuBudget
          </h1>
          <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
            Étape {step + 1} sur {STEPS.length} — {STEPS[step]}
          </span>
        </div>

        {/* Barre de progression segmentée */}
        <div className="flex gap-1 mt-3">
          {STEPS.map((s, i) => (
            <motion.div
              key={s}
              className="flex-1 h-1 rounded-full"
              style={{
                background: i < step
                  ? "var(--brand-1)"
                  : i === step
                  ? "var(--brand-2)"
                  : "var(--border)",
              }}
              animate={{ opacity: i <= step ? 1 : 0.5 }}
              transition={{ duration: 0.3 }}
            />
          ))}
        </div>
      </div>

      {/* ── Carte principale ──────────────────────────────────────────── */}
      <div
        className="w-full max-w-xl rounded-2xl p-8"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.22 }}
          >
            {step === 0 && <StepIdentite  draft={draft} update={update} />}
            {step === 1 && <StepRevenus   draft={draft} update={update} holderLabel={holderLabel} />}
            {step === 2 && <StepLogement  draft={draft} update={update} />}
            {step === 3 && <StepCharges   draft={draft} update={update} />}
            {step === 4 && <StepRecap     draft={draft} holderLabel={holderLabel} />}
          </motion.div>
        </AnimatePresence>

        {error && (
          <p className="mt-4 text-sm font-medium" style={{ color: "var(--fin-red)" }}>
            {error}
          </p>
        )}

        {/* ── Navigation ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 mt-8 pt-6"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <div className="flex gap-2">
            <button type="button" className="reset-danger-btn" onClick={handleReset}>
              Réinitialiser
            </button>
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0}
              className="btn-ghost"
            >
              ← Retour
            </button>
          </div>

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="btn-brand px-6"
            >
              Suivant →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              disabled={loading}
              className="btn-brand px-6"
              style={{ opacity: loading ? 0.6 : 1 }}
            >
              {loading ? "Enregistrement…" : "Démarrer SimuBudget ✓"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Étape 1 — Identité
// =============================================================================
function StepIdentite({
  draft, update,
}: {
  draft:  UserProfile;
  update: <K extends keyof UserProfile>(k: K, v: UserProfile[K]) => void;
}) {
  const showCouple = isCouple(draft.situation);

  return (
    <div className="space-y-6">
      <StepHeader
        title="Votre identité"
        sub="Ces informations personnalisent l'application et calculent vos droits aux aides."
      />

      {/* Identité principale */}
      <div
        className="rounded-xl p-4 space-y-4"
        style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border)" }}
      >
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
          Votre identité
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Prénom">
            <input
              type="text"
              value={draft.holder.firstName}
              onChange={(e) => update("holder", { ...draft.holder, firstName: e.target.value })}
              placeholder="Votre prénom"
              className={inputCls}
              autoFocus
            />
          </Field>
          <Field label="Nom">
            <input
              type="text"
              value={draft.holder.lastName}
              onChange={(e) => update("holder", { ...draft.holder, lastName: e.target.value })}
              placeholder="Votre nom de famille"
              className={inputCls}
            />
          </Field>
        </div>
      </div>

      {/* Situation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Situation familiale">
          <Select
            value={draft.situation}
            onChange={(v) => update("situation", v as Situation)}
            options={[
              { value: "single",     label: "Célibataire" },
              { value: "couple",     label: "En couple" },
              { value: "separated",  label: "Séparé(e)" },
              { value: "cohabiting", label: "En colocation" },
            ]}
          />
        </Field>
        <Field label="Statut professionnel">
          <Select
            value={draft.employmentType}
            onChange={(v) => update("employmentType", v as EmploymentType)}
            options={[
              { value: "cdi",        label: "CDI" },
              { value: "cdd",        label: "CDD" },
              { value: "freelance",  label: "Indépendant / Freelance" },
              { value: "unemployed", label: "Sans emploi / Chômage" },
              { value: "retired",    label: "Retraité(e)" },
              { value: "other",      label: "Autre" },
            ]}
          />
        </Field>
      </div>

      {/* Localisation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Ville de résidence">
          <input
            type="text"
            value={draft.city}
            onChange={(e) => update("city", e.target.value)}
            placeholder="Ex : Lyon, Paris, Nantes…"
            className={inputCls}
          />
        </Field>
        <Field label="Département (code)">
          <input
            type="text"
            value={draft.department}
            onChange={(e) => update("department", e.target.value)}
            placeholder="Ex : 69, 75, 44…"
            maxLength={3}
            className={inputCls}
          />
        </Field>
      </div>

      <Field label="Zone APL">
        <Select
          value={String(draft.aplZone)}
          onChange={(v) => update("aplZone", Number(v) as AplZone)}
          options={[
            { value: "1", label: "Zone 1 — Paris et petite couronne" },
            { value: "2", label: "Zone 2 — Grandes agglomérations" },
            { value: "3", label: "Zone 3 — Reste du territoire" },
          ]}
        />
      </Field>

      {/* Identité partenaire — apparaît dynamiquement si couple */}
      {showCouple && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl p-4 space-y-4"
          style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border-brand)" }}
        >
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--brand-1)" }}>
            Identité du / de la partenaire
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Prénom">
              <input
                type="text"
                value={draft.partner?.firstName ?? ""}
                onChange={(e) => update("partner", {
                  ...(draft.partner ?? { name: "", firstName: "", lastName: "", salaryNet: 0, bonusAnnual: 0, employmentType: "cdi" as EmploymentType, otherIncome: 0 }),
                  firstName: e.target.value,
                  name: fullName(e.target.value, draft.partner?.lastName ?? "", "Partenaire"),
                })}
                placeholder="Prénom du / de la partenaire"
                className={inputCls}
              />
            </Field>
            <Field label="Nom">
              <input
                type="text"
                value={draft.partner?.lastName ?? ""}
                onChange={(e) => update("partner", {
                  ...(draft.partner ?? { name: "", firstName: "", lastName: "", salaryNet: 0, bonusAnnual: 0, employmentType: "cdi" as EmploymentType, otherIncome: 0 }),
                  lastName: e.target.value,
                  name: fullName(draft.partner?.firstName ?? "", e.target.value, "Partenaire"),
                })}
                placeholder="Nom du / de la partenaire"
                className={inputCls}
              />
            </Field>
          </div>
          <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
            Les revenus du / de la partenaire seront saisis à l'étape suivante.
          </p>
        </motion.div>
      )}
    </div>
  );
}

// =============================================================================
// Étape 2 — Revenus
// =============================================================================
function StepRevenus({
  draft, update, holderLabel,
}: {
  draft:        UserProfile;
  update:       <K extends keyof UserProfile>(k: K, v: UserProfile[K]) => void;
  holderLabel:  string;
}) {
  const showCouple = isCouple(draft.situation);
  const partnerLabel = draft.partner
    ? fullName(draft.partner.firstName, draft.partner.lastName, "Partenaire")
    : "Partenaire";

  const totalIncome =
    draft.salaryNet +
    (draft.partner?.salaryNet ?? draft.partnerSalaryNet ?? 0) +
    draft.allocationsTotal +
    draft.otherIncome +
    draft.bonusAnnual / 12;

  return (
    <div className="space-y-5">
      <StepHeader
        title="Vos revenus"
        sub="En euros nets mensuels, après impôts et prélèvements sociaux."
      />

      {/* Revenus personne principale */}
      <div
        className="rounded-xl p-4 space-y-4"
        style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border)" }}
      >
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
          {holderLabel}
        </p>
        <Field label="Salaire net mensuel">
          <NumberInput
            value={draft.salaryNet}
            onChange={(v) => update("salaryNet", v)}
            suffix="€/mois"
          />
        </Field>
        <Field label="Primes annuelles (lissées automatiquement sur 12 mois)">
          <NumberInput
            value={draft.bonusAnnual}
            onChange={(v) => update("bonusAnnual", v)}
            suffix="€/an"
          />
        </Field>
      </div>

      {/* Revenus partenaire */}
      {showCouple && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl p-4 space-y-4"
          style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border-brand)" }}
        >
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--brand-1)" }}>
            {partnerLabel}
          </p>
          <Field label="Salaire net mensuel">
            <NumberInput
              value={draft.partner?.salaryNet ?? 0}
              onChange={(v) => {
                const p = draft.partner ?? { name: partnerLabel, firstName: "", lastName: "", salaryNet: 0, bonusAnnual: 0, employmentType: "cdi" as EmploymentType, otherIncome: 0 };
                update("partner", { ...p, salaryNet: v });
                update("partnerSalaryNet", v);
              }}
              suffix="€/mois"
            />
          </Field>
          <Field label="Primes annuelles">
            <NumberInput
              value={draft.partner?.bonusAnnual ?? 0}
              onChange={(v) => {
                const p = draft.partner ?? { name: partnerLabel, firstName: "", lastName: "", salaryNet: 0, bonusAnnual: 0, employmentType: "cdi" as EmploymentType, otherIncome: 0 };
                update("partner", { ...p, bonusAnnual: v });
              }}
              suffix="€/an"
            />
          </Field>
        </motion.div>
      )}

      {/* Revenus communs */}
      <div className="space-y-4">
        <Field label="Allocations — CAF, chômage, AAH, RSA… (montant mensuel total)">
          <NumberInput
            value={draft.allocationsTotal}
            onChange={(v) => update("allocationsTotal", v)}
            suffix="€/mois"
          />
        </Field>
        <Field label="Autres revenus — loyers, freelance, dividendes…">
          <NumberInput
            value={draft.otherIncome}
            onChange={(v) => update("otherIncome", v)}
            suffix="€/mois"
          />
        </Field>
      </div>

      {/* Total dynamique */}
      <div
        className="flex items-center justify-between rounded-xl px-4 py-3"
        style={{ background: "var(--fin-green-bg)", border: "1px solid var(--fin-green-border)" }}
      >
        <span className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
          Revenu mensuel total estimé
        </span>
        <span className="font-mono text-lg font-extrabold tabular-nums" style={{ color: "var(--fin-green)" }}>
          {formatEur(totalIncome)}
        </span>
      </div>
    </div>
  );
}

// =============================================================================
// Étape 3 — Logement actuel
// =============================================================================
function StepLogement({
  draft, update,
}: {
  draft:  UserProfile;
  update: <K extends keyof UserProfile>(k: K, v: UserProfile[K]) => void;
}) {
  const h = draft.currentHousing;

  function updateH<K extends keyof typeof h>(key: K, value: typeof h[K]) {
    update("currentHousing", { ...h, [key]: value });
  }

  return (
    <div className="space-y-5">
      <StepHeader
        title="Votre logement actuel"
        sub="Ces données servent à calculer votre reste à vivre réel et vos droits à l'APL."
      />

      <Field label="Statut de logement">
        <Select
          value={h.type}
          onChange={(v) => updateH("type", v as HousingType)}
          options={[
            { value: "tenant",     label: "Locataire" },
            { value: "owner",      label: "Propriétaire (crédit en cours)" },
            { value: "colocation", label: "Colocation" },
            { value: "hosted",     label: "Hébergé(e) gratuitement" },
          ]}
        />
      </Field>

      {(h.type === "tenant" || h.type === "colocation") && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Loyer hors charges">
            <NumberInput value={h.rent ?? 0} onChange={(v) => updateH("rent", v)} suffix="€/mois" />
          </Field>
          <Field label="Provision pour charges">
            <NumberInput value={h.charges ?? 0} onChange={(v) => updateH("charges", v)} suffix="€/mois" />
          </Field>
        </div>
      )}

      {h.type === "owner" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Mensualité crédit immobilier">
            <NumberInput value={h.purchaseLoanMonthly ?? 0} onChange={(v) => updateH("purchaseLoanMonthly", v > 0 ? v : undefined)} suffix="€/mois" />
          </Field>
          <Field label="Charges de copropriété">
            <NumberInput value={h.condoFees ?? 0} onChange={(v) => updateH("condoFees", v > 0 ? v : undefined)} suffix="€/mois" />
          </Field>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Surface du logement">
          <NumberInput value={h.surface} onChange={(v) => updateH("surface", v)} suffix="m²" />
        </Field>
        <Field label="Type de chauffage">
          <Select
            value={h.heatingType}
            onChange={(v) => updateH("heatingType", v as HeatingType)}
            options={[
              { value: "collective",          label: "Collectif (inclus charges)" },
              { value: "individual_gas",      label: "Individuel — gaz" },
              { value: "individual_electric", label: "Individuel — électrique" },
            ]}
          />
        </Field>
      </div>
    </div>
  );
}

// =============================================================================
// Étape 4 — Charges fixes
// =============================================================================
function StepCharges({
  draft, update,
}: {
  draft:  UserProfile;
  update: <K extends keyof UserProfile>(k: K, v: UserProfile[K]) => void;
}) {
  return (
    <div className="space-y-5">
      <StepHeader
        title="Vos charges fixes"
        sub="Laissez à 0 si vous n'êtes pas concerné(e). Ces montants s'ajoutent automatiquement à vos comptes."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Téléphone & Internet">
          <NumberInput value={draft.phoneInternet} onChange={(v) => update("phoneInternet", v)} suffix="€/mois" />
        </Field>
        <Field label="Assurances (habitation, auto, mutuelle…)">
          <NumberInput value={draft.insuranceTotal} onChange={(v) => update("insuranceTotal", v)} suffix="€/mois" />
        </Field>
        <Field label="Pension alimentaire versée">
          <NumberInput value={draft.pensionPaid} onChange={(v) => update("pensionPaid", v)} suffix="€/mois" />
        </Field>
        <Field label="Pension alimentaire reçue">
          <NumberInput value={draft.pensionReceived} onChange={(v) => update("pensionReceived", v)} suffix="€/mois" />
        </Field>
        <Field label="Autres charges fixes récurrentes">
          <NumberInput value={draft.otherFixed} onChange={(v) => update("otherFixed", v)} suffix="€/mois" />
        </Field>
        <Field label="Épargne de précaution actuelle">
          <NumberInput value={draft.savingsMonths} onChange={(v) => update("savingsMonths", v)} suffix="mois de charges" step={0.5} />
        </Field>
      </div>
    </div>
  );
}

// =============================================================================
// Étape 5 — Récapitulatif
// =============================================================================
function StepRecap({
  draft, holderLabel,
}: {
  draft:        UserProfile;
  holderLabel:  string;
}) {
  const partnerLabel = draft.partner
    ? fullName(draft.partner.firstName, draft.partner.lastName, "Partenaire")
    : null;

  const totalIncome =
    draft.salaryNet +
    (draft.partner?.salaryNet ?? draft.partnerSalaryNet ?? 0) +
    draft.allocationsTotal +
    draft.otherIncome +
    draft.bonusAnnual / 12;

  const totalFixed =
    draft.phoneInternet +
    draft.insuranceTotal +
    draft.pensionPaid +
    draft.otherFixed;

  const housing =
    (draft.currentHousing.rent ?? 0) +
    (draft.currentHousing.charges ?? 0) +
    (draft.currentHousing.purchaseLoanMonthly ?? 0) +
    (draft.currentHousing.condoFees ?? 0);

  const roughRdv = totalIncome - housing - totalFixed;

  return (
    <div className="space-y-5">
      <StepHeader
        title="Récapitulatif"
        sub="Vérifiez vos informations avant de lancer SimuBudget."
      />

      {/* Identité */}
      <Section label="Identité">
        <RecapRow label="Titulaire" value={holderLabel} />
        {partnerLabel && <RecapRow label="Partenaire" value={partnerLabel} />}
        <RecapRow label="Situation" value={SITUATION_LABELS[draft.situation] ?? draft.situation} />
        <RecapRow label="Emploi" value={EMPLOYMENT_LABELS[draft.employmentType] ?? draft.employmentType} />
        <RecapRow label="Ville" value={`${draft.city}${draft.department ? ` (${draft.department})` : ""}`} />
      </Section>

      {/* Revenus */}
      <Section label="Revenus">
        <RecapRow label={`Salaire — ${holderLabel}`} value={formatEur(draft.salaryNet) + "/mois"} />
        {(draft.partner?.salaryNet ?? 0) > 0 && partnerLabel && (
          <RecapRow label={`Salaire — ${partnerLabel}`} value={formatEur(draft.partner!.salaryNet) + "/mois"} />
        )}
        <RecapRow label="Revenus totaux" value={formatEur(totalIncome) + "/mois"} highlight />
      </Section>

      {/* Logement */}
      <Section label="Logement">
        <RecapRow label="Statut" value={HOUSING_LABELS[draft.currentHousing.type] ?? draft.currentHousing.type} />
        <RecapRow label="Coût logement" value={formatEur(housing) + "/mois"} />
      </Section>

      {/* Reste à vivre estimé */}
      <div
        className="flex items-center justify-between rounded-xl px-4 py-3"
        style={{
          background: roughRdv >= 300 ? "var(--fin-green-bg)" : roughRdv >= 0 ? "var(--fin-amber-bg)" : "var(--fin-red-bg)",
          border: `1px solid ${roughRdv >= 300 ? "var(--fin-green-border)" : roughRdv >= 0 ? "var(--fin-amber-border)" : "var(--fin-red-border)"}`,
        }}
      >
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
            Reste à vivre estimé
          </p>
          <p className="text-xs font-medium mt-0.5" style={{ color: "var(--text-muted)" }}>
            Avant alimentation et transport — le calcul complet sera sur le dashboard.
          </p>
        </div>
        <span
          className="font-mono text-xl font-extrabold tabular-nums"
          style={{
            color: roughRdv >= 300 ? "var(--fin-green)"
                 : roughRdv >= 0  ? "var(--fin-amber)"
                 : "var(--fin-red)",
          }}
        >
          {formatEur(roughRdv)}
        </span>
      </div>
    </div>
  );
}

// =============================================================================
// Composants UI partagés
// =============================================================================

function StepHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-2">
      <h2
        className="font-display text-xl font-extrabold"
        style={{ letterSpacing: "-0.03em", color: "var(--text-primary)" }}
      >
        {title}
      </h2>
      <p className="text-sm font-medium mt-1" style={{ color: "var(--text-muted)" }}>
        {sub}
      </p>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--border)" }}
    >
      <div
        className="px-4 py-2 text-xs font-bold uppercase tracking-widest"
        style={{ background: "var(--bg-surface-2)", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}
      >
        {label}
      </div>
      <div className="divide-y" style={{ borderColor: "var(--border)" }}>
        {children}
      </div>
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2.5 rounded-lg text-sm font-medium outline-none transition-all " +
  "bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-primary)] " +
  "placeholder:text-[var(--text-placeholder)] " +
  "focus:border-[var(--border-active)] focus:shadow-[0_0_0_3px_rgba(6,214,160,0.12)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-bold" style={{ color: "var(--text-secondary)", letterSpacing: ".01em" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Select({
  value, onChange, options,
}: {
  value:    string;
  onChange: (v: string) => void;
  options:  { value: string; label: string }[];
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function NumberInput({
  value, onChange, suffix, step = 1,
}: {
  value:    number;
  onChange: (v: number) => void;
  suffix?:  string;
  step?:    number;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={0}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className={inputCls}
      />
      {suffix && (
        <span className="text-xs font-semibold whitespace-nowrap flex-shrink-0" style={{ color: "var(--text-muted)" }}>
          {suffix}
        </span>
      )}
    </div>
  );
}

function RecapRow({
  label, value, highlight = false,
}: {
  label:      string;
  value:      string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <span
        className="text-xs font-bold font-mono tabular-nums"
        style={{ color: highlight ? "var(--text-primary)" : "var(--text-secondary)" }}
      >
        {value}
      </span>
    </div>
  );
}
