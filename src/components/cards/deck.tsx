"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CloudOff, Keyboard, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Progress } from "@/components/ui/progress";
import { Tooltip } from "@/components/ui/tooltip";
import { track, useFocusTracking } from "@/lib/telemetry";
import type { IndexedCard } from "@/components/class-content/parse";
import { FlipCard } from "./flip-card";
import { QuizCard } from "./quiz-card";
import { ConceptCard } from "./concept-card";
import { SessionSummary } from "./session-summary";
import { useCardProgress } from "./use-card-progress";
import type { ProgressMap, SessionOutcome, SessionStats } from "./types";

export interface DeckProps {
  studentId: string;
  recordingId: string;
  classId: string;
  classTopic: string;
  recordingTitle: string | null;
  cards: IndexedCard[];
  initialProgress: { card_index: number; known: boolean; attempts: number; correct: number }[];
}

/** Orden de estudio: primero no conocidas (falladas antes), después conocidas; estable por índice. */
export function orderForStudy(cards: IndexedCard[], progress: ProgressMap): IndexedCard[] {
  const rank = (c: IndexedCard) => {
    const p = progress[c.index];
    if (!p) return 1; // nunca vista
    if (!p.known) return p.attempts > p.correct ? 0 : 1; // fallada primero
    return 2;
  };
  return [...cards].sort((a, b) => rank(a) - rank(b) || a.index - b.index);
}

export function computeStats(outcomes: SessionOutcome[]): SessionStats {
  const quiz = outcomes.filter((o) => o.type === "quiz");
  const misses = new Map<string, number>();
  for (const o of outcomes) {
    if (!o.known && o.tag) misses.set(o.tag, (misses.get(o.tag) ?? 0) + 1);
  }
  return {
    total: outcomes.length,
    known: outcomes.filter((o) => o.known).length,
    quizTotal: quiz.length,
    quizCorrect: quiz.filter((o) => o.correct).length,
    weakTags: Array.from(misses, ([tag, m]) => ({ tag, misses: m }))
      .sort((a, b) => b.misses - a.misses)
      .slice(0, 5),
    toReview: outcomes.filter((o) => !o.known).map((o) => o.index),
  };
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
}

/**
 * Mazo inmersivo de placas: flashcards (flip 3D + swipe), quiz con feedback y conceptos.
 * Persiste card_progress con escritura resiliente y emite telemetría de cada interacción.
 */
export function Deck({ studentId, recordingId, classId, classTopic, recordingTitle, cards, initialProgress }: DeckProps) {
  const reduce = useReducedMotion();
  const { progress, record, pendingWrites, lastWrite } = useCardProgress({ studentId, recordingId, initial: initialProgress });
  useFocusTracking("recording", recordingId);

  const [queue, setQueue] = React.useState<IndexedCard[]>(() => orderForStudy(cards, progress));
  const [pos, setPos] = React.useState(0);
  const [flipped, setFlipped] = React.useState(false);
  const [selected, setSelected] = React.useState<number | null>(null);
  const [outcomes, setOutcomes] = React.useState<SessionOutcome[]>([]);
  const [phase, setPhase] = React.useState<"playing" | "done">("playing");
  const [direction, setDirection] = React.useState<1 | -1>(1);
  const sessionStart = React.useRef<number | null>(null);
  const completedRef = React.useRef(false);

  React.useEffect(() => {
    if (sessionStart.current === null) sessionStart.current = Date.now();
  }, []);

  const current = queue[pos];
  const total = queue.length;
  const knownTotal = React.useMemo(
    () => cards.filter((c) => progress[c.index]?.known).length,
    [cards, progress],
  );

  const startSession = React.useCallback(
    (subset: IndexedCard[]) => {
      setQueue(subset);
      setPos(0);
      setFlipped(false);
      setSelected(null);
      setOutcomes([]);
      setPhase("playing");
      setDirection(1);
      sessionStart.current = Date.now();
      completedRef.current = false;
    },
    [],
  );

  const finish = React.useCallback(
    (all: SessionOutcome[]) => {
      setPhase("done");
      if (completedRef.current) return;
      completedRef.current = true;
      const stats = computeStats(all);
      void track("cards_session_completed", {
        entity_type: "recording",
        entity_id: recordingId,
        metadata: {
          class_id: classId,
          total: stats.total,
          known: stats.known,
          quiz_total: stats.quizTotal,
          quiz_correct: stats.quizCorrect,
          weak_tags: stats.weakTags.map((t) => t.tag),
          duration_ms: sessionStart.current == null ? null : Date.now() - sessionStart.current,
        },
      });
    },
    [recordingId, classId],
  );

  const advance = React.useCallback(
    (all: SessionOutcome[]) => {
      if (pos + 1 >= total) {
        finish(all);
        return;
      }
      setDirection(1);
      setPos((p) => p + 1);
      setFlipped(false);
      setSelected(null);
    },
    [pos, total, finish],
  );

  const flip = React.useCallback(() => {
    if (!current || current.card.type !== "flashcard") return;
    setFlipped((f) => {
      if (!f) {
        void track("card_flipped", {
          entity_type: "recording",
          entity_id: recordingId,
          metadata: { class_id: classId, card_index: current.index },
        });
      }
      return !f;
    });
  }, [current, recordingId, classId]);

  const mark = React.useCallback(
    (known: boolean) => {
      if (!current || current.card.type === "quiz") return;
      record(current.index, { known });
      void track("card_marked", {
        entity_type: "recording",
        entity_id: recordingId,
        metadata: { class_id: classId, card_index: current.index, known, type: current.card.type },
      });
      const next = [...outcomes, { index: current.index, type: current.card.type, tag: current.card.tag, known }];
      setOutcomes(next);
      advance(next);
    },
    [current, record, recordingId, classId, outcomes, advance],
  );

  const answer = React.useCallback(
    (option: number) => {
      if (!current || current.card.type !== "quiz" || selected !== null) return;
      const correct = option === current.card.correct_index;
      setSelected(option);
      record(current.index, { known: correct, correct });
      void track("quiz_answered", {
        entity_type: "recording",
        entity_id: recordingId,
        metadata: { class_id: classId, card_index: current.index, option, correct },
      });
      setOutcomes((prev) => [...prev, { index: current.index, type: "quiz", tag: current.card.tag, known: correct, correct }]);
    },
    [current, selected, record, recordingId, classId],
  );

  const continueQuiz = React.useCallback(() => {
    if (selected === null) return;
    advance(outcomes);
  }, [selected, advance, outcomes]);

  // Atajos de teclado: espacio flip, 1-4 opciones, ← repasar / → la sé o continuar.
  React.useEffect(() => {
    if (phase !== "playing" || !current) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = current.card.type;
      if (e.key === " " && t === "flashcard") {
        e.preventDefault();
        flip();
      } else if (/^[1-6]$/.test(e.key) && t === "quiz") {
        const i = Number(e.key) - 1;
        if (i < current.card.options.length) {
          e.preventDefault();
          answer(i);
        }
      } else if (e.key === "ArrowRight") {
        if (t === "quiz") {
          if (selected !== null) {
            e.preventDefault();
            continueQuiz();
          }
        } else if (t === "concept" || flipped) {
          e.preventDefault();
          mark(true);
        }
      } else if (e.key === "ArrowLeft") {
        if (t === "concept" || (t === "flashcard" && flipped)) {
          e.preventDefault();
          mark(false);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, current, flip, answer, mark, continueQuiz, flipped, selected]);

  const syncNote =
    pendingWrites > 0
      ? "Guardando tu progreso…"
      : lastWrite === "queued"
        ? "Estás sin conexión: tu progreso quedó guardado y se sincroniza solo."
        : lastWrite === "rejected"
          ? "No pudimos guardar el último avance. Tu sesión sigue, pero revisá la conexión."
          : null;

  const stats = React.useMemo(() => computeStats(outcomes), [outcomes]);
  const title = recordingTitle?.trim() || classTopic;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      {/* Barra superior */}
      <header className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" aria-label="Salir de las placas">
          <Link href={`/campus/estudiante/clases/${classId}`}>
            <X />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="eyebrow truncate">Placas · {title}</p>
          <Progress
            value={phase === "done" ? 100 : total > 0 ? (pos / total) * 100 : 0}
            tone={phase === "done" ? "success" : "accent"}
            size="sm"
            aria-label="Avance de la sesión"
            className="mt-1.5"
          />
        </div>
        <span className="shrink-0 font-mono text-xs tabular-nums text-muted" aria-live="polite">
          {phase === "done" ? `${total}/${total}` : `${Math.min(pos + 1, total)}/${total}`}
        </span>
        <Tooltip
          side="bottom"
          content={
            <span className="flex flex-col gap-1 text-xs">
              <span><Kbd>espacio</Kbd> dar vuelta</span>
              <span><Kbd>1</Kbd>–<Kbd>4</Kbd> elegir opción</span>
              <span><Kbd>←</Kbd> repasar · <Kbd>→</Kbd> la sé / continuar</span>
            </span>
          }
        >
          <button
            type="button"
            aria-label="Atajos de teclado"
            className="hidden size-9 items-center justify-center rounded-xl border border-border text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring sm:flex"
          >
            <Keyboard className="size-4" aria-hidden />
          </button>
        </Tooltip>
      </header>

      {pendingWrites === 0 && lastWrite === "queued" && phase === "playing" && (
        <p role="status" className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/8 px-3 py-2 text-xs text-warning">
          <CloudOff className="size-3.5" aria-hidden />
          Sin conexión: el progreso se guarda localmente y se envía cuando vuelva la red.
        </p>
      )}

      {phase === "done" ? (
        <SessionSummary
          stats={stats}
          classId={classId}
          classTopic={classTopic}
          knownTotal={knownTotal}
          cardsTotal={cards.length}
          syncNote={syncNote}
          onReviewMissed={() => {
            const set = new Set(stats.toReview);
            startSession(cards.filter((c) => set.has(c.index)));
          }}
          onRestartAll={() => startSession(orderForStudy(cards, progress))}
        />
      ) : current ? (
        <div className="relative min-h-[26rem]">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={`${current.index}-${pos}`}
              custom={direction}
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: 48 * direction, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: -48 * direction, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              aria-live="polite"
            >
              {current.card.type === "flashcard" && (
                <FlipCard
                  question={current.card.question}
                  answer={current.card.answer}
                  tag={current.card.tag}
                  flipped={flipped}
                  onFlip={flip}
                  onMark={mark}
                />
              )}
              {current.card.type === "quiz" && (
                <QuizCard
                  question={current.card.question}
                  options={current.card.options}
                  correctIndex={current.card.correct_index}
                  explanation={current.card.explanation}
                  tag={current.card.tag}
                  selected={selected}
                  onSelect={answer}
                  onContinue={continueQuiz}
                />
              )}
              {current.card.type === "concept" && (
                <ConceptCard title={current.card.title} bodyMd={current.card.body_md} tag={current.card.tag} onMark={mark} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      ) : null}

      {phase === "playing" && (
        <p className="text-center text-xs text-muted">
          {stats.known}/{outcomes.length} conocidas en esta sesión
          {progress[current?.index ?? -1]?.known ? " · esta ya la marcaste antes" : ""}
        </p>
      )}
    </div>
  );
}
