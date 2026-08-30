"use client";

import * as React from "react";
import { motion } from "motion/react";
import { ArrowRight, Bot, Loader2, Play, X } from "lucide-react";
import { Badge, Button, Progress, Select } from "@/components/ui";
import { OperatorAvatar } from "@/components/avatar/operator-avatar";
import { GAMES } from "@/lib/games/config";
import { NIVEL_LABEL, type Botudiante } from "@/lib/games/botudiantes";
import { track } from "@/lib/telemetry/track";
import { cn } from "@/lib/utils";

/**
 * Práctica contra un Botudiante, sin salir del Aula Magna. El flujo es el
 * mismo stepper de 5 preguntas de siempre; acá el rival es un bot que se
 * corrige en el servidor junto con vos, así el resultado llega de una.
 */

interface Challenge {
  id: string;
  prompt: string;
  options: string[];
}

interface Resultado {
  correct: number;
  total: number;
  xp: number;
  bonusXp: number;
  bot: { correct: number; total: number };
  won: boolean;
  draw: boolean;
}

interface ClaseOption {
  id: string;
  topic: string;
}

type Fase = "intro" | "cargando" | "jugando" | "enviando" | "resultado";

export function BotDuel({
  bot,
  clases,
  onClose,
  onTerminado,
}: {
  bot: Botudiante;
  clases: ClaseOption[];
  onClose: () => void;
  /** Para que la página refresque XP/tabla al cerrar una práctica terminada. */
  onTerminado: () => void;
}) {
  const [fase, setFase] = React.useState<Fase>("intro");
  const [game, setGame] = React.useState(GAMES[0]?.key ?? "duelo");
  const [claseId, setClaseId] = React.useState<string>("");
  const [challenges, setChallenges] = React.useState<Challenge[]>([]);
  const [index, setIndex] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<string, number>>({});
  const [picked, setPicked] = React.useState<number | null>(null);
  const [resultado, setResultado] = React.useState<Resultado | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const startedAt = React.useRef(0);

  const current = challenges[index] ?? null;

  async function empezar() {
    setFase("cargando");
    setError(null);
    try {
      const res = await fetch("/api/duels/bot/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game, classId: claseId || null, botId: bot.id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "No pudimos armar la práctica.");
      setChallenges(data.challenges ?? []);
      setIndex(0);
      setAnswers({});
      setPicked(null);
      startedAt.current = Date.now();
      setFase("jugando");
      track("duel_created", { entity_type: "botudiante", entity_id: bot.id, metadata: { game, nivel: bot.nivel } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos armar la práctica.");
      setFase("intro");
    }
  }

  function elegir(i: number) {
    if (picked != null || !current) return;
    setPicked(i);
    setAnswers((prev) => ({ ...prev, [current.id]: i }));
  }

  async function siguiente() {
    if (!current) return;
    if (index + 1 < challenges.length) {
      setIndex((i) => i + 1);
      setPicked(null);
      return;
    }
    setFase("enviando");
    try {
      const res = await fetch("/api/duels/bot/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game,
          classId: claseId || null,
          botId: bot.id,
          durationSeconds: Math.round((Date.now() - startedAt.current) / 1000),
          answers: Object.entries(answers).map(([id, chosen]) => ({ id, chosen })),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "No pudimos guardar la práctica.");
      setResultado(data as Resultado);
      setFase("resultado");
      track("duel_finished", { entity_type: "botudiante", entity_id: bot.id, metadata: { correct: data.correct, won: data.won } });
      onTerminado();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos guardar la práctica.");
      setFase("jugando");
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[85] flex items-end justify-center bg-black/55 p-3 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Práctica contra ${bot.nombre}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 24, scale: 0.98 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 16, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="border-gradient flex max-h-[86vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-transparent bg-surface"
      >
        <header className="flex items-center gap-2.5 border-b border-border px-4 py-3">
          <OperatorAvatar config={bot.config} size={40} bust className="shrink-0 rounded-full" title={bot.nombre} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-sm font-semibold leading-tight">
              {bot.nombre}
              <Badge size="sm" tone="accent-2">
                <Bot className="size-3" aria-hidden /> Bot
              </Badge>
            </p>
            <p className="text-[11px] text-muted">Botudiante · Nivel {NIVEL_LABEL[bot.nivel].toLowerCase()} · no es un estudiante real</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex size-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {(fase === "intro" || fase === "cargando") && (
            <div className="flex flex-col gap-3">
              <p className="text-sm leading-relaxed text-muted">{bot.descripcion}</p>
              <p className="text-[11px] leading-relaxed text-muted">
                Practicar contra Botudiantes suma el mismo XP que cualquier partida
                {bot.winBonus > 0 && <> — y si le ganás, +{bot.winBonus} XP extra</>}. Ideal para farmear repasando.
              </p>

              <div>
                <label htmlFor="bot-juego" className="text-xs font-medium text-muted">
                  Juego
                </label>
                <div className="mt-1.5">
                  <Select id="bot-juego" value={game} onChange={(e) => setGame(e.target.value as typeof game)}>
                    {GAMES.map((g) => (
                      <option key={g.key} value={g.key}>
                        {g.emoji} {g.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div>
                <label htmlFor="bot-clase" className="text-xs font-medium text-muted">
                  Sobre qué material
                </label>
                <div className="mt-1.5">
                  <Select id="bot-clase" value={claseId} onChange={(e) => setClaseId(e.target.value)}>
                    <option value="">Toda la materia</option>
                    {clases.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.topic}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {error && (
                <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                  {error}
                </p>
              )}

              <Button
                onClick={empezar}
                disabled={fase === "cargando"}
                leftIcon={fase === "cargando" ? <Loader2 className="animate-spin" /> : <Play />}
              >
                Empezar la práctica
              </Button>
            </div>
          )}

          {(fase === "jugando" || fase === "enviando") && current && (
            <div>
              <Progress value={((index + (picked != null ? 1 : 0)) / challenges.length) * 100} size="sm" tone="accent-2" />
              <p className="mt-1.5 font-mono text-[10px] uppercase tracking-widest text-muted">
                {index + 1} de {challenges.length}
              </p>

              <p className="mt-4 text-base font-medium leading-snug">{current.prompt}</p>
              <ul className="mt-3 flex flex-col gap-2">
                {current.options.map((opt, i) => {
                  const esta = picked === i;
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => elegir(i)}
                        disabled={picked != null}
                        className={cn(
                          "w-full rounded-xl border px-3.5 py-2.5 text-left text-sm transition",
                          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                          picked != null
                            ? esta
                              ? "border-accent-2 bg-accent-2/10 text-foreground"
                              : "border-border bg-surface-2/40 text-muted"
                            : "border-border bg-surface-2/60 hover:border-accent-2/50 hover:bg-surface-2",
                        )}
                      >
                        {opt}
                      </button>
                    </li>
                  );
                })}
              </ul>

              {error && (
                <p role="alert" className="mt-3 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                  {error}
                </p>
              )}

              <div className="mt-4 flex justify-end">
                <Button
                  onClick={siguiente}
                  disabled={picked == null || fase === "enviando"}
                  leftIcon={fase === "enviando" ? <Loader2 className="animate-spin" /> : undefined}
                  rightIcon={fase !== "enviando" ? <ArrowRight /> : undefined}
                >
                  {index + 1 < challenges.length ? "Siguiente" : "Terminar"}
                </Button>
              </div>
            </div>
          )}

          {fase === "resultado" && resultado && (
            <div className="text-center">
              <p className="text-4xl" aria-hidden>
                {resultado.won ? "🏆" : resultado.draw ? "🤝" : "🤖"}
              </p>
              <h3 className="mt-3 text-xl font-semibold tracking-tight">
                Vos: {resultado.correct} de {resultado.total} · {bot.nombre}: {resultado.bot.correct} de {resultado.bot.total}
              </h3>
              <p className="mt-2 text-sm text-muted">
                {resultado.won && "¡Le ganaste al bot!"}
                {resultado.draw && "Empate con el bot. La próxima lo bajás."}
                {!resultado.won && !resultado.draw && "Esta vez ganó el bot. Repasá la clase y volvé."}
              </p>
              <p className="mt-1 font-mono text-sm text-foreground">
                +{resultado.xp} XP{resultado.bonusXp > 0 && ` +${resultado.bonusXp} XP de bonus`}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Button onClick={empezar} leftIcon={<Play />}>
                  Otra ronda
                </Button>
                <Button variant="secondary" onClick={onClose}>
                  Volver al aula
                </Button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
