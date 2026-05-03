// =============================================================================
// Fichier  : src/components/Assistant/LocalAssistantChat.tsx
// Auteur   : KREMER Régis
// Desc.    : Assistant conversationnel local-first basé sur les données réelles.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-05-03 | KREMER Régis | Création — assistant utile non gadget
//   2026-05-03 | KREMER Régis | Correction UX — layout compatible panneau latéral large
//   2026-05-03 | KREMER Régis | Ajout — mémoire de session, contexte et raisonnement visible
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { clsx } from "clsx";
import { useProfileStore } from "@/store/profileStore";
import { useSimulationStore } from "@/store/simulationStore";
import { useAccountingStore } from "@/store/accountingStore";
import { useCalculator } from "@/hooks/useCalculator";
import {
  answerLocalQuestion,
  initialAssistantAnswer,
  initialAssistantMemory,
  type AssistantAction,
  type AssistantAnswer,
  type AssistantMetric,
  type AssistantSessionMemory,
  type AssistantToneLevel,
  type LocalAssistantContext,
} from "@/services/localAssistant";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  answer?: AssistantAnswer;
}

interface LevelStyle {
  bg: string;
  border: string;
  color: string;
  label: string;
}

const LEVEL_STYLES: Record<AssistantToneLevel, LevelStyle> = {
  critical: { bg: "--fin-red-bg", border: "--fin-red-border", color: "--fin-red", label: "Critique" },
  danger: { bg: "--fin-red-bg", border: "--fin-red-border", color: "--fin-red", label: "Danger" },
  vigilance: { bg: "--fin-amber-bg", border: "--fin-amber-border", color: "--fin-amber", label: "Vigilance" },
  info: { bg: "--fin-blue-bg", border: "--fin-blue-border", color: "--fin-blue", label: "Info" },
  conseil: { bg: "--fin-green-bg", border: "--fin-green-border", color: "--fin-green", label: "Conseil" },
};

const QUICK_PROMPTS = [
  "Pourquoi mon solde est négatif ?",
  "Comment économiser 200 € ce mois ?",
  "Puis-je acheter 400 € ?",
  "Quelles sont mes priorités ?",
  "Que faire maintenant ?",
  "Explique ton raisonnement",
];

function iconPath(level: AssistantToneLevel): string {
  if (level === "critical" || level === "danger") {
    return "M7 1.25 13.3 12H.7L7 1.25Zm0 3.25a.75.75 0 0 0-.75.75v2.8a.75.75 0 0 0 1.5 0v-2.8A.75.75 0 0 0 7 4.5Zm0 5.1a.85.85 0 1 0 0 1.7.85.85 0 0 0 0-1.7Z";
  }
  if (level === "conseil") {
    return "M7 1a6 6 0 1 0 0 12A6 6 0 0 0 7 1Zm2.8 4.6a.75.75 0 0 0-1.1-1L6.1 7.45 5.25 6.6a.75.75 0 1 0-1.06 1.06l1.4 1.4a.75.75 0 0 0 1.06 0L9.8 5.6Z";
  }
  return "M7 1a6 6 0 1 0 0 12A6 6 0 0 0 7 1Zm-.75 4.4a.75.75 0 0 1 1.5 0v4a.75.75 0 0 1-1.5 0v-4ZM7 3.1a.82.82 0 1 1 0 1.64.82.82 0 0 1 0-1.64Z";
}

function AssistantIcon({ level }: { level: AssistantToneLevel }): ReactElement {
  const style = LEVEL_STYLES[level];
  return (
    <span
      className="flex h-9 w-9 items-center justify-center rounded-2xl"
      style={{ background: `var(${style.bg})`, color: `var(${style.color})` }}
    >
      <svg viewBox="0 0 14 14" className="h-4 w-4" fill="currentColor">
        <path fillRule="evenodd" clipRule="evenodd" d={iconPath(level)} />
      </svg>
    </span>
  );
}

function MetricsGrid({ metrics }: { metrics: AssistantMetric[] }): ReactElement | null {
  if (metrics.length === 0) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {metrics.map((metric) => (
        <div
          key={`${metric.label}-${metric.value}`}
          className="rounded-2xl border p-3"
          style={{ borderColor: "var(--border)", background: "var(--bg-surface-2)" }}
        >
          <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>
            {metric.label}
          </p>
          <p className="mt-1 text-base font-black" style={{ color: "var(--text-primary)" }}>
            {metric.value}
          </p>
          {metric.detail ? <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{metric.detail}</p> : null}
        </div>
      ))}
    </div>
  );
}

function AnswerActions({ actions, onAction }: { actions: AssistantAction[]; onAction: (action: AssistantAction) => void }): ReactElement | null {
  if (actions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {actions.map((action) => (
        <button
          key={`${action.kind}-${action.value}`}
          type="button"
          onClick={() => onAction(action)}
          className="rounded-full border px-3 py-2 text-xs font-black uppercase tracking-[0.12em] transition hover:-translate-y-0.5"
          style={{ borderColor: "var(--border)", background: "var(--bg-surface-2)", color: "var(--text-secondary)" }}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

function AnswerCard({ answer, onAction, onPrompt }: { answer: AssistantAnswer; onAction: (action: AssistantAction) => void; onPrompt: (prompt: string) => void }): ReactElement {
  const style = LEVEL_STYLES[answer.level];
  return (
    <div
      className="rounded-[28px] border p-5 shadow-sm"
      style={{ borderColor: `var(${style.border})`, background: "var(--bg-surface)", boxShadow: "var(--shadow-soft)" }}
    >
      <div className="flex items-start gap-3">
        <AssistantIcon level={answer.level} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-black" style={{ color: "var(--text-primary)" }}>{answer.title}</h3>
            <span
              className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
              style={{ background: `var(${style.bg})`, color: `var(${style.color})` }}
            >
              {style.label}
            </span>
          </div>
          <p className="mt-1 text-sm font-bold" style={{ color: "var(--text-secondary)" }}>{answer.summary}</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <MetricsGrid metrics={answer.metrics} />
        {answer.contextNote ? (
          <p
            className="rounded-2xl px-3 py-2 text-xs font-bold"
            style={{ background: "var(--sidebar-bg-soft)", color: "var(--text-muted)" }}
          >
            {answer.contextNote}
          </p>
        ) : null}
        <div className="space-y-2">
          {answer.lines.map((line) => (
            <p key={line} className="text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
              {line}
            </p>
          ))}
        </div>
        {answer.reasoningSteps.length > 0 ? (
          <details className="rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "var(--bg-surface-2)" }}>
            <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>
              Raisonnement utilisé
            </summary>
            <ol className="mt-3 space-y-1 pl-4 text-xs leading-5" style={{ color: "var(--text-secondary)" }}>
              {answer.reasoningSteps.map((step) => (
                <li key={step} className="list-decimal">{step}</li>
              ))}
            </ol>
          </details>
        ) : null}
        <AnswerActions actions={answer.actions} onAction={onAction} />
        <div className="flex flex-wrap gap-2 border-t pt-3" style={{ borderColor: "var(--border)" }}>
          {answer.followUps.slice(0, 3).map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onPrompt(prompt)}
              className="rounded-full px-3 py-2 text-xs font-bold transition hover:-translate-y-0.5"
              style={{ background: "var(--sidebar-bg-soft)", color: "var(--text-secondary)" }}
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function UserBubble({ text }: { text: string }): ReactElement {
  return (
    <div className="flex justify-end">
      <div
        className="max-w-[760px] rounded-[24px] px-4 py-3 text-sm font-bold"
        style={{ background: "var(--brand-1)", color: "white" }}
      >
        {text}
      </div>
    </div>
  );
}

function EmptyProfileState(): ReactElement {
  return (
    <div className="p-8 text-center" style={{ color: "var(--text-muted)" }}>
      <p className="text-lg font-black" style={{ color: "var(--text-primary)" }}>Aucun profil actif.</p>
      <p className="mt-2 text-sm">Crée ou sélectionne un profil pour obtenir des réponses chiffrées.</p>
    </div>
  );
}

export default function LocalAssistantChat(): ReactElement {
  const navigate = useNavigate();
  const profile = useProfileStore((state) => state.profile);
  const result = useSimulationStore((state) => state.result);
  const { calculate } = useCalculator();

  const activeMonth = useAccountingStore((state) => state.activeMonth);
  const budget = useAccountingStore((state) => state.getBudgetForMonth(activeMonth));
  const summary = useAccountingStore((state) => state.getMonthSummary(activeMonth));
  const envelopes = useAccountingStore((state) => state.getEnvelopeStatuses(activeMonth));
  const recommendations = useAccountingStore((state) => state.getRecommendations());
  const monthExpenses = useAccountingStore((state) => state.getMonthExpenses(activeMonth));
  const recurringExpenses = useAccountingStore((state) => state.expenses);
  const snapshots = useAccountingStore((state) => state.snapshots);

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [memory, setMemory] = useState<AssistantSessionMemory>(() => initialAssistantMemory());

  useEffect(() => {
    if (profile && !result) void calculate(profile);
  }, [calculate, profile, result]);

  const context = useMemo<LocalAssistantContext>(() => ({
    activeMonth,
    result,
    budget,
    summary,
    envelopes,
    recommendations,
    monthExpenses,
    recurringExpenses,
    snapshots,
  }), [activeMonth, budget, envelopes, monthExpenses, recommendations, recurringExpenses, result, snapshots, summary]);

  useEffect(() => {
    if (!profile || messages.length > 0) return;
    const answer = initialAssistantAnswer(context);
    setMessages([{ id: crypto.randomUUID(), role: "assistant", text: answer.summary, answer }]);
  }, [context, messages.length, profile]);

  if (!profile) return <EmptyProfileState />;

  function submitQuestion(question: string): void {
    const clean = question.trim();
    if (!clean) return;
    const response = answerLocalQuestion(clean, context, memory);
    setMemory(response.memory);
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", text: clean },
      { id: crypto.randomUUID(), role: "assistant", text: response.answer.summary, answer: response.answer },
    ]);
    setInput("");
  }

  function handleAction(action: AssistantAction): void {
    if (action.kind === "route") {
      navigate(action.value);
      return;
    }
    submitQuestion(action.value);
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-6 2xl:p-8">
      <section
        className="relative overflow-hidden rounded-[32px] border p-6 2xl:p-8"
        style={{ borderColor: "var(--border)", background: "var(--bg-surface)", boxShadow: "var(--shadow-soft)" }}
      >
        <div className="absolute inset-x-0 top-0 h-1" style={{ background: "var(--gradient-brand)" }} />
        <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-end 2xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
              Assistant financier local
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>
              Pose une question, obtiens une réponse chiffrée.
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
              Les réponses utilisent ton profil, tes comptes, les imports validés, les enveloppes et les recommandations locales. Aucune donnée n'est envoyée sur le réseau.
            </p>
          </div>
          <div
            className="rounded-2xl border px-4 py-3 text-sm font-black"
            style={{ borderColor: "var(--border)", background: "var(--bg-surface-2)", color: "var(--text-secondary)" }}
          >
            Mode déterministe · Données locales
          </div>
        </div>
      </section>

      <section className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
              >
                {message.role === "user" ? (
                  <UserBubble text={message.text} />
                ) : message.answer ? (
                  <AnswerCard answer={message.answer} onAction={handleAction} onPrompt={submitQuestion} />
                ) : null}
              </motion.div>
            ))}
          </div>

          <form
            className="rounded-[28px] border p-3"
            style={{ borderColor: "var(--border)", background: "var(--bg-surface)", boxShadow: "var(--shadow-soft)" }}
            onSubmit={(event) => {
              event.preventDefault();
              submitQuestion(input);
            }}
          >
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ex : Comment économiser 200 € ce mois ?"
                className="min-h-12 flex-1 rounded-2xl border px-4 text-sm font-semibold outline-none transition focus:ring-2"
                style={{ borderColor: "var(--border)", background: "var(--bg-surface-2)", color: "var(--text-primary)", boxShadow: "none" }}
              />
              <button
                type="submit"
                className="rounded-2xl px-5 py-3 text-sm font-black uppercase tracking-[0.14em] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: "var(--brand-1)", color: "white" }}
                disabled={input.trim().length === 0}
              >
                Analyser
              </button>
            </div>
          </form>
        </div>

        <aside className="space-y-4">
          <div
            className="rounded-[28px] border p-5"
            style={{ borderColor: "var(--border)", background: "var(--bg-surface)", boxShadow: "var(--shadow-soft)" }}
          >
            <h2 className="text-sm font-black uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>
              Questions utiles
            </h2>
            <div className="mt-4 space-y-2">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => submitQuestion(prompt)}
                  className={clsx("w-full rounded-2xl border px-4 py-3 text-left text-sm font-bold transition hover:-translate-y-0.5")}
                  style={{ borderColor: "var(--border)", background: "var(--bg-surface-2)", color: "var(--text-secondary)" }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div
            className="rounded-[28px] border p-5"
            style={{ borderColor: "var(--border)", background: "var(--bg-surface)", boxShadow: "var(--shadow-soft)" }}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-black uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>
                Mémoire de session
              </h2>
              <button
                type="button"
                onClick={() => { setMemory(initialAssistantMemory()); setMessages([]); }}
                className="rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] transition hover:-translate-y-0.5"
                style={{ background: "var(--sidebar-bg-soft)", color: "var(--text-secondary)" }}
              >
                Réinitialiser
              </button>
            </div>
            <div className="mt-3 space-y-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              <p>Échanges suivis : <strong>{memory.turnCount}</strong></p>
              <p>Sujet actif : <strong>{memory.focus ?? "aucun"}</strong></p>
              {memory.lastAmount ? <p>Dernier montant : <strong>{memory.lastAmount.toLocaleString("fr-FR")} €</strong></p> : null}
            </div>
          </div>

          <div
            className="rounded-[28px] border p-5"
            style={{ borderColor: "var(--border)", background: "var(--bg-surface)", boxShadow: "var(--shadow-soft)" }}
          >
            <h2 className="text-sm font-black uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>
              Limites assumées
            </h2>
            <p className="mt-3 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
              L'assistant produit des estimations de pilotage budgétaire. Il ne remplace pas une simulation CAF, bancaire, fiscale ou un conseil professionnel réglementé.
            </p>
          </div>
        </aside>
      </section>
    </div>
  );
}
