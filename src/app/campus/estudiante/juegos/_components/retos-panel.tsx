"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Loader2, Play, Swords, Trophy, X } from "lucide-react";
import { Badge, Button, Card, CardTitle, Select } from "@/components/ui";
import { track } from "@/lib/telemetry/track";
import { cn } from "@/lib/utils";
import type { GameKey, GameMeta } from "@/lib/games/config";
import { RondaRepaso, type RepasoResult } from "@/components/games/ronda-repaso";

interface ClassOption {
  id: string;
  topic: string;
  date: string;
}

interface Classmate {
  id: string;
  callsign: string;
}

interface DuelRow {
  id: string;
  game: string;
  classTopic: string;
  isChallenger: boolean;
  otherCallsign: string;
  status: "pendiente" | "completado" | "rechazado";
  myCorrect: number | null;
  myTotal: number | null;
  otherCorrect: number | null;
  otherTotal: number | null;
  iAnswered: boolean;
  won: boolean;
  draw: boolean;
}

interface Challenge {
  id: string;
  prompt: string;
  options: string[];
}

interface SubmitResult {
  correct: number;
  total: number;
  xp: number;
  results: RepasoResult[];
  bonusXp: number;
  done: boolean;
  opponentCorrect?: number;
  opponentTotal?: number;
  won?: boolean;
  draw?: boolean;
}

type Phase = "list" | "form" | "loading" | "playing" | "sending" | "done";

/** Reto en curso: dónde está parado (armándolo, jugando, esperando resultado). */
interface ActiveDuel {
  duelId: string;
  gameKey: string;
  gameName: string;
  otherCallsign: string;
}

export function RetosPanel({
  games,
  classes,
  classmates,
  duels,
}: {
  games: GameMeta[];
  classes: ClassOption[];
  classmates: Classmate[];
  duels: DuelRow[];
}) {
  const router = useRouter();
  const [phase, setPhase] = React.useState<Phase>("list");
  const [error, setError] = React.useState<string | null>(null);

  // Formulario para mandar un reto nuevo.
  const [formGame, setFormGame] = React.useState<GameKey | "">(games[0]?.key ?? "");
  const [formClass, setFormClass] = React.useState(classes[0]?.id ?? "");
  const [formOpponent, setFormOpponent] = React.useState(classmates[0]?.id ?? "");

  const [active, setActive] = React.useState<ActiveDuel | null>(null);
  const [challenges, setChallenges] = React.useState<Challenge[]>([]);
  const [index, setIndex] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<string, number>>({});
  const [picked, setPicked] = React.useState<number | null>(null);
  const [result, setResult] = React.useState<SubmitResult | null>(null);
  const startedAt = React.useRef<number>(0);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const current = challenges[index] ?? null;

  const incoming = duels.filter((d) => !d.isChallenger && d.status === "pendiente" && !d.iAnswered);
  const sentPending = duels.filter((d) => d.isChallenger && d.status === "pendiente");
  const history = duels.filter((d) => d.status === "completado" || d.status === "rechazado");

  function gameName(key: string): string {
    return games.find((g) => g.key === key)?.name ?? key;
  }

  async function sendChallenge() {
    if (!formClass || !formOpponent || !formGame) return;
    setPhase("loading");
    setError(null);
    try {
      const res = await fetch("/api/duels/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game: formGame, classId: formClass, opponentId: formOpponent }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "No pudimos crear el reto.");

      const opponentName = classmates.find((c) => c.id === formOpponent)?.callsign ?? "tu compañero";
      setActive({ duelId: data.duelId, gameKey: formGame, gameName: gameName(formGame), otherCallsign: opponentName });
      setChallenges(data.challenges ?? []);
      setIndex(0);
      setAnswers({});
      setPicked(null);
      setResult(null);
      startedAt.current = Date.now();
      setPhase("playing");
      track("duel_created", { entity_type: "reto", entity_id: formClass, metadata: { game: formGame } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos crear el reto.");
      setPhase("form");
    }
  }

  async function playIncoming(duel: DuelRow) {
    setPhase("loading");
    setError(null);
    try {
      const res = await fetch(`/api/duels/${duel.id}/submit`);
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "No pudimos cargar el reto.");

      setActive({ duelId: duel.id, gameKey: duel.game, gameName: gameName(duel.game), otherCallsign: duel.otherCallsign });
      setChallenges(data.challenges ?? []);
      setIndex(0);
      setAnswers({});
      setPicked(null);
      setResult(null);
      startedAt.current = Date.now();
      setPhase("playing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos cargar el reto.");
      setPhase("list");
    }
  }

  async function decline(duelId: string) {
    setPendingId(duelId);
    setError(null);
    try {
      const res = await fetch(`/api/duels/${duelId}/decline`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "No pudimos rechazar el reto.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos rechazar el reto.");
    } finally {
      setPendingId(null);
    }
  }

  function choose(optionIndex: number) {
    if (picked != null || !current) return;
    setPicked(optionIndex);
    setAnswers((prev) => ({ ...prev, [current.id]: optionIndex }));
  }

  async function next() {
    if (!active || !current) return;
    if (index + 1 < challenges.length) {
      setIndex((i) => i + 1);
      setPicked(null);
      return;
    }

    setPhase("sending");
    try {
      const res = await fetch(`/api/duels/${active.duelId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          durationSeconds: Math.round((Date.now() - startedAt.current) / 1000),
          answers: Object.entries(answers).map(([id, chosen]) => ({ id, chosen })),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "No pudimos guardar tu respuesta.");

      setResult(data as SubmitResult);
      setPhase("done");
      track("duel_finished", { entity_type: "reto", entity_id: active.duelId, metadata: { correct: data.correct, total: data.total } });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos guardar tu respuesta.");
      setPhase("playing");
    }
  }

  function backToList() {
    setPhase("list");
    setActive(null);
    setChallenges([]);
    setResult(null);
    setPicked(null);
    setError(null);
  }

  // ------------------------------------------------------------------ jugando
  if ((phase === "playing" || phase === "sending") && current && active) {
    const answered = picked != null;
    return (
      <Card highlight>
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow text-accent-3">
            <Swords className="mr-1 inline size-3.5" aria-hidden />
            Reto contra {active.otherCallsign}
          </p>
          <button
            type="button"
            onClick={backToList}
            className="rounded-lg px-2 py-1 text-xs text-muted transition hover:bg-surface-2 hover:text-foreground"
          >
            Salir
          </button>
        </div>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted">
          {active.gameName} · {index + 1} de {challenges.length}
        </p>

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
                            ? "border-accent-3 bg-accent-3/10 text-foreground"
                            : "border-border bg-surface-2/40 text-muted"
                          : "border-border bg-surface-2/60 hover:border-accent-3/50 hover:bg-surface-2",
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

  // ------------------------------------------------------------------ resultado
  if (phase === "done" && result && active) {
    return (
      <Card highlight>
        <div className="text-center">
          <p className="text-4xl" aria-hidden>
            {!result.done ? "📨" : result.won ? "🏆" : result.draw ? "🤝" : "📚"}
          </p>
          <p className="eyebrow mt-3 text-accent-3">Reto contra {active.otherCallsign}</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            Vos: {result.correct} de {result.total}
            {result.done && ` · ${active.otherCallsign}: ${result.opponentCorrect} de ${result.opponentTotal}`}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {!result.done && "Le avisamos a tu rival. En cuanto juegue vas a ver quién ganó, acá mismo."}
            {result.done && result.won && "¡Ganaste el reto!"}
            {result.done && result.draw && "Empataron."}
            {result.done && !result.won && !result.draw && "Esta vez ganó tu rival."}
          </p>
          <p className="mt-1 font-mono text-sm text-foreground">
            +{result.xp} XP{result.bonusXp > 0 && ` +${result.bonusXp} XP de bonus`}
          </p>
        </div>

        {/* El repaso es lo que enseña: qué fallaste, por qué, y el minuto de la
            clase donde se dijo. El marcador solo no deja nada. */}
        <RondaRepaso challenges={challenges} results={result.results ?? []} className="mt-6" />

        <div className="mt-5 flex justify-center">
          <Button variant="secondary" onClick={backToList}>
            Volver a Retos
          </Button>
        </div>
      </Card>
    );
  }

  // ---------------------------------------------------------------- formulario
  if (phase === "form" || phase === "loading") {
    return (
      <Card>
        <CardTitle eyebrow="Retos" as="h2" className="flex items-center gap-2">
          <Swords className="size-4 text-accent-3" aria-hidden />
          Retar a un compañero
        </CardTitle>

        <div className="mt-3 flex flex-col gap-3">
          <div>
            <label htmlFor="reto-clase" className="text-xs font-medium text-muted">
              Clase
            </label>
            <div className="mt-1.5">
              <Select id="reto-clase" value={formClass} onChange={(e) => setFormClass(e.target.value)}>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.date.slice(8, 10)}/{c.date.slice(5, 7)} · {c.topic}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <label htmlFor="reto-juego" className="text-xs font-medium text-muted">
              Juego
            </label>
            <div className="mt-1.5">
              <Select id="reto-juego" value={formGame} onChange={(e) => setFormGame(e.target.value as GameKey)}>
                {games.map((g) => (
                  <option key={g.key} value={g.key}>
                    {g.emoji} {g.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <label htmlFor="reto-rival" className="text-xs font-medium text-muted">
              Rival
            </label>
            <div className="mt-1.5">
              <Select id="reto-rival" value={formOpponent} onChange={(e) => setFormOpponent(e.target.value)}>
                {classmates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.callsign}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            onClick={sendChallenge}
            disabled={phase === "loading" || !formClass || !formGame || !formOpponent}
            leftIcon={phase === "loading" ? <Loader2 className="animate-spin" /> : <Play />}
          >
            Jugar y mandar el reto
          </Button>
          <Button variant="secondary" onClick={backToList} disabled={phase === "loading"}>
            Cancelar
          </Button>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          Jugás las mismas 5 preguntas ya, y tu rival las juega cuando pueda. Nadie ve el puntaje del otro antes de jugar.
        </p>
      </Card>
    );
  }

  // -------------------------------------------------------------------- lista
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <CardTitle eyebrow="Retos" as="h2" className="flex items-center gap-2">
          <Swords className="size-4 text-accent-3" aria-hidden />
          Competí con la comisión
        </CardTitle>
        {classmates.length > 0 && games.length > 0 && classes.length > 0 && (
          <Button size="sm" onClick={() => setPhase("form")} leftIcon={<Swords />}>
            Retar
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}

      {classmates.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Todavía no hay más compañeros inscriptos en tu comisión para retar.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-4">
          {incoming.length > 0 && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-accent-3">Te retaron</p>
              <ul className="mt-2 flex flex-col gap-2">
                {incoming.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-accent-3/30 bg-accent-3/5 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{d.otherCallsign}</p>
                      <p className="truncate text-xs text-muted">
                        {gameName(d.game)} · {d.classTopic}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <Button size="sm" onClick={() => playIncoming(d)} leftIcon={<Play />}>
                        Jugar
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => decline(d.id)}
                        disabled={pendingId === d.id}
                        leftIcon={pendingId === d.id ? <Loader2 className="animate-spin" /> : <X />}
                      >
                        Rechazar
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {sentPending.length > 0 && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted">Esperando respuesta</p>
              <ul className="mt-2 flex flex-col gap-2">
                {sentPending.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 rounded-xl border border-border bg-surface-2/50 px-3 py-2.5">
                    <Badge size="sm" tone="muted">
                      Pendiente
                    </Badge>
                    <p className="min-w-0 flex-1 truncate text-sm">
                      {d.otherCallsign} · {gameName(d.game)} · {d.classTopic}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {history.length > 0 && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted">Historial</p>
              <ul className="mt-2 flex flex-col gap-2">
                {history.map((d) => (
                  <li key={d.id} className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-2/50 px-3 py-2.5">
                    {d.status === "rechazado" ? (
                      <Badge size="sm" tone="muted">
                        Rechazado
                      </Badge>
                    ) : d.draw ? (
                      <Badge size="sm" tone="muted">
                        Empate
                      </Badge>
                    ) : d.won ? (
                      <Badge size="sm" tone="success">
                        <Trophy className="size-3" aria-hidden /> Ganaste
                      </Badge>
                    ) : (
                      <Badge size="sm" tone="danger">
                        Perdiste
                      </Badge>
                    )}
                    <p className="min-w-0 flex-1 truncate text-sm text-muted">
                      {d.otherCallsign} · {gameName(d.game)}
                      {d.status === "completado" && ` · ${d.myCorrect}-${d.otherCorrect}`}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {incoming.length === 0 && sentPending.length === 0 && history.length === 0 && (
            <p className="text-sm text-muted">Todavía no retaste a nadie. Elegí un compañero y una clase para arrancar.</p>
          )}
        </div>
      )}
    </Card>
  );
}
