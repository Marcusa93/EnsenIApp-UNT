"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, Flame, Loader2, Play, RotateCcw, Sparkles, X } from "lucide-react";
import { Badge, Button, Card, Progress, Select } from "@/components/ui";
import { Reveal } from "@/components/shell/reveal";
import { track } from "@/lib/telemetry/track";
import { cn } from "@/lib/utils";
import type { GameMeta, Level } from "@/lib/games/config";

interface ClassOption {
  id: string;
  topic: string;
  date: string;
}

interface Challenge {
  id: string;
  prompt: string;
  options: string[];
  classId: string | null;
}

interface ResultRow {
  id: string;
  chosen: number;
  correct: boolean;
  correctIndex: number;
  explanation: string | null;
  sourceQuote: string | null;
  sourceSeconds: number | null;
  classId: string | null;
}

interface FinishPayload {
  correct: number;
  total: number;
  xp: number;
  results: ResultRow[];
  stats: {
    totalXp: number;
    streakDays: number;
    level: Level;
    next: Level | null;
    ratio: number;
    xpForNext: number;
    leveledUp: boolean;
  };
}

type Phase = "idle" | "loading" | "playing" | "sending" | "done";

const TONE_RING: Record<GameMeta["tone"], string> = {
  accent: "border-accent/30 bg-accent/10 text-accent",
  "accent-2": "border-accent-2/30 bg-accent-2/10 text-accent-2",
  "accent-3": "border-accent-3/30 bg-accent-3/10 text-accent-3",
};

function mmss(seconds: number): string {
  const t = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

export function GameLauncher({
  games,
  classes,
  runsByGame,
}: {
  games: GameMeta[];
  classes: ClassOption[];
  runsByGame: Record<string, number>;
}) {
  const router = useRouter();
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [game, setGame] = React.useState<GameMeta | null>(null);
  const [classId, setClassId] = React.useState<string>("");
  const [challenges, setChallenges] = React.useState<Challenge[]>([]);
  const [index, setIndex] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<string, number>>({});
  const [picked, setPicked] = React.useState<number | null>(null);
  const [outcome, setOutcome] = React.useState<FinishPayload | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const startedAt = React.useRef<number>(0);

  const current = challenges[index] ?? null;

  async function start(meta: GameMeta) {
    setPhase("loading");
    setError(null);
    setGame(meta);
    try {
      const res = await fetch("/api/games/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game: meta.key, classId: classId || null }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "No pudimos armar la partida.");

      setChallenges(data.challenges ?? []);
      setIndex(0);
      setAnswers({});
      setPicked(null);
      setOutcome(null);
      startedAt.current = Date.now();
      setPhase("playing");
      track("game_started", { entity_type: "juego", entity_id: classId || undefined, metadata: { game: meta.key } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos armar la partida.");
      setPhase("idle");
      setGame(null);
    }
  }

  function choose(optionIndex: number) {
    if (picked != null || !current) return;
    setPicked(optionIndex);
    setAnswers((prev) => ({ ...prev, [current.id]: optionIndex }));
  }

  async function next() {
    if (!game || !current) return;

    if (index + 1 < challenges.length) {
      setIndex((i) => i + 1);
      setPicked(null);
      return;
    }

    setPhase("sending");
    try {
      const res = await fetch("/api/games/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game: game.key,
          classId: classId || null,
          durationSeconds: Math.round((Date.now() - startedAt.current) / 1000),
          answers: Object.entries(answers).map(([id, chosen]) => ({ id, chosen })),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "No pudimos guardar la partida.");

      setOutcome(data as FinishPayload);
      setPhase("done");
      track("game_finished", {
        entity_type: "juego",
        entity_id: classId || undefined,
        metadata: { game: game.key, correct: data.correct, total: data.total, xp: data.xp },
      });
      // Refresca nivel, racha y tabla de posiciones del server component.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos guardar la partida.");
      setPhase("playing");
    }
  }

  function reset() {
    setPhase("idle");
    setGame(null);
    setChallenges([]);
    setOutcome(null);
    setPicked(null);
    setError(null);
  }

  // ---------------------------------------------------------------- resultados
  if (phase === "done" && outcome && game) {
    const perfect = outcome.correct === outcome.total;
    return (
      <Reveal>
        <Card highlight>
          <div className="text-center">
            <p className="text-5xl" aria-hidden>
              {perfect ? "🏆" : outcome.correct > outcome.total / 2 ? "👏" : "📚"}
            </p>
            <p className="eyebrow mt-3 text-accent-2">{game.name}</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              {outcome.correct} de {outcome.total}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {perfect ? "Partida perfecta." : outcome.correct === 0 ? "Repasá la clase y volvé." : "Bien ahí."}{" "}
              <span className="font-mono text-foreground">+{outcome.xp} XP</span>
            </p>

            {outcome.stats.leveledUp && (
              <motion.p
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-accent-3/40 bg-accent-3/10 px-3 py-2 text-sm font-medium text-accent-3"
              >
                <Sparkles className="size-4" aria-hidden />
                ¡Subiste a {outcome.stats.level.name}!
              </motion.p>
            )}

            <div className="mx-auto mt-5 max-w-sm">
              <Progress value={Math.round(outcome.stats.ratio * 100)} tone="accent-2" />
              <p className="mt-2 text-xs text-muted">
                {outcome.stats.next
                  ? `${outcome.stats.totalXp} XP · faltan ${outcome.stats.xpForNext} para ${outcome.stats.next.name}`
                  : `${outcome.stats.totalXp} XP · último nivel`}
              </p>
              {outcome.stats.streakDays > 1 && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-warning">
                  <Flame className="size-3.5" aria-hidden /> {outcome.stats.streakDays} días seguidos jugando
                </p>
              )}
            </div>
          </div>

          {/* Repaso: qué se falló y por qué */}
          <ul className="mt-6 flex flex-col gap-2.5">
            {outcome.results.map((r) => {
              const ch = challenges.find((c) => c.id === r.id);
              if (!ch) return null;
              return (
                <li
                  key={r.id}
                  className={cn(
                    "rounded-2xl border p-3.5",
                    r.correct ? "border-success/30 bg-success/5" : "border-danger/30 bg-danger/5",
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                        r.correct ? "bg-success/20 text-success" : "bg-danger/20 text-danger",
                      )}
                      aria-hidden
                    >
                      {r.correct ? <Check className="size-3" /> : <X className="size-3" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug">{ch.prompt}</p>
                      {!r.correct && (
                        <p className="mt-1 text-[13px] text-muted">
                          Era: <span className="text-foreground">{ch.options[r.correctIndex]}</span>
                        </p>
                      )}
                      {r.explanation && <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{r.explanation}</p>}
                      {r.sourceQuote && (
                        <p className="mt-2 border-l-2 border-border pl-2.5 text-[12px] italic leading-relaxed text-muted">
                          “{r.sourceQuote}”
                          {r.sourceSeconds != null && r.classId && (
                            <Link
                              href={`/campus/estudiante/clases/${r.classId}`}
                              className="ml-1.5 not-italic text-accent hover:underline"
                            >
                              [{mmss(r.sourceSeconds)}]
                            </Link>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button onClick={() => start(game)} leftIcon={<RotateCcw />}>
              Otra partida
            </Button>
            <Button variant="secondary" onClick={reset}>
              Elegir otro juego
            </Button>
          </div>
        </Card>
      </Reveal>
    );
  }

  // ------------------------------------------------------------------ jugando
  if ((phase === "playing" || phase === "sending") && current && game) {
    const answered = picked != null;
    return (
      <Card highlight>
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow text-accent-2">
            {game.emoji} {game.name}
          </p>
          <button
            type="button"
            onClick={reset}
            className="rounded-lg px-2 py-1 text-xs text-muted transition hover:bg-surface-2 hover:text-foreground"
          >
            Salir
          </button>
        </div>

        <div className="mt-3">
          <Progress value={((index + (answered ? 1 : 0)) / challenges.length) * 100} size="sm" tone="accent-2" />
          <p className="mt-1.5 font-mono text-[10px] uppercase tracking-widest text-muted">
            {index + 1} de {challenges.length}
          </p>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.18 }}
          >
            <p className="mt-5 text-lg font-medium leading-snug">{current.prompt}</p>

            <ul className="mt-4 flex flex-col gap-2">
              {current.options.map((opt, i) => {
                const isPicked = picked === i;
                return (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => choose(i)}
                      disabled={answered}
                      className={cn(
                        "w-full rounded-xl border px-4 py-3 text-left text-sm transition",
                        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                        answered
                          ? isPicked
                            ? "border-accent bg-accent/10 text-foreground"
                            : "border-border bg-surface-2/40 text-muted"
                          : "border-border bg-surface-2/60 hover:border-accent/50 hover:bg-surface-2",
                      )}
                    >
                      {opt}
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        </AnimatePresence>

        {error && (
          <p role="alert" className="mt-3 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end">
          <Button
            onClick={next}
            disabled={!answered || phase === "sending"}
            leftIcon={phase === "sending" ? <Loader2 className="animate-spin" /> : undefined}
            rightIcon={phase !== "sending" ? <ArrowRight /> : undefined}
          >
            {index + 1 < challenges.length ? "Siguiente" : "Terminar"}
          </Button>
        </div>
      </Card>
    );
  }

  // --------------------------------------------------------------------- menú
  return (
    <div className="flex flex-col gap-4">
      {classes.length > 0 && (
        <Reveal delay={0.05}>
          <Card padding="sm">
            <label htmlFor="juego-clase" className="text-xs font-medium text-muted">
              Sobre qué material querés jugar
            </label>
            <div className="mt-2">
              <Select
                id="juego-clase"
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                aria-label="Elegí la clase"
              >
                <option value="">Toda la materia</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.date.slice(8, 10)}/{c.date.slice(5, 7)} · {c.topic}
                  </option>
                ))}
              </Select>
            </div>
          </Card>
        </Reveal>
      )}

      {error && (
        <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {games.map((g, i) => (
          <Reveal key={g.key} delay={0.05 * (i + 2)}>
            <Card interactive className="flex h-full flex-col">
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-2xl border text-xl",
                    TONE_RING[g.tone],
                  )}
                  aria-hidden
                >
                  {g.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold leading-tight">{g.name}</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted">{g.tagline}</p>
                </div>
              </div>

              <p className="mt-3 text-xs leading-relaxed text-muted">{g.how}</p>

              <div className="mt-4 flex items-center justify-between gap-2">
                {runsByGame[g.key] ? (
                  <Badge size="sm" tone="muted">
                    {runsByGame[g.key]} {runsByGame[g.key] === 1 ? "partida" : "partidas"}
                  </Badge>
                ) : (
                  <Badge size="sm" tone="accent-2">
                    Nuevo
                  </Badge>
                )}
                <Button
                  size="sm"
                  onClick={() => start(g)}
                  disabled={phase === "loading"}
                  leftIcon={phase === "loading" && game?.key === g.key ? <Loader2 className="animate-spin" /> : <Play />}
                >
                  Jugar
                </Button>
              </div>
            </Card>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
