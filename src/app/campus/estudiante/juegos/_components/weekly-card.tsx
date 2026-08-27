"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { CalendarClock, Gift, Loader2, Sparkles } from "lucide-react";
import { Badge, Button, Card, CardTitle, Progress } from "@/components/ui";
import type { WeeklyStatus } from "@/lib/games/weekly";
import { WEEKLY_XP } from "@/lib/games/weekly";

/**
 * Desafío de la semana: una meta que se renueva los lunes.
 *
 * Es el motor de hábito del juego, así que la tarjeta va arriba de todo y dice
 * siempre tres cosas: cuánto falta, cuánto queda de tiempo y qué se gana.
 */
export function WeeklyCard({ status }: { status: WeeklyStatus }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [reward, setReward] = React.useState<{ xp: number; unlocked: string[] } | null>(null);

  const pct = Math.min(100, Math.round((status.correct / status.target) * 100));

  const restante = React.useMemo(() => {
    const ms = new Date(status.endsAt).getTime() - Date.now();
    if (ms <= 0) return "termina hoy";
    const dias = Math.floor(ms / 86_400_000);
    if (dias >= 1) return `quedan ${dias} ${dias === 1 ? "día" : "días"}`;
    const horas = Math.max(1, Math.floor(ms / 3_600_000));
    return `quedan ${horas} ${horas === 1 ? "hora" : "horas"}`;
  }, [status.endsAt]);

  async function claim() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/games/weekly", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "No pudimos acreditar la recompensa.");
      setReward({ xp: data.xp, unlocked: data.unlocked ?? [] });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos acreditar la recompensa.");
    } finally {
      setBusy(false);
    }
  }

  if (reward) {
    return (
      <Card highlight>
        <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
          <p className="text-4xl" aria-hidden>
            🎁
          </p>
          <p className="eyebrow mt-2 text-accent-3">Semana cumplida</p>
          <p className="mt-1 text-lg font-semibold">
            +{reward.xp} XP
          </p>
          {reward.unlocked.length > 0 && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-accent-2">
              <Sparkles className="size-4" aria-hidden />
              Desbloqueaste: {reward.unlocked.join(", ")}
            </p>
          )}
          <p className="mt-2 text-xs text-muted">La próxima meta arranca el lunes.</p>
        </motion.div>
      </Card>
    );
  }

  return (
    <Card highlight={status.done && !status.claimed}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <CardTitle eyebrow="Desafío de la semana" as="h2" className="flex items-center gap-2">
          <CalendarClock className="size-4 text-accent-3" aria-hidden />
          {status.target} aciertos antes del lunes
        </CardTitle>
        <Badge size="sm" tone={status.done ? "accent-3" : "muted"}>
          {status.claimed ? "Cobrado" : restante}
        </Badge>
      </div>

      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
        Esta semana destacamos <strong className="text-foreground">{status.gameName}</strong>, pero suman los aciertos
        de cualquier juego.
      </p>

      <div className="mt-3">
        <Progress value={pct} tone={status.done ? "accent-3" : "accent"} />
        <p className="mt-1.5 font-mono text-[11px] uppercase tracking-widest text-muted">
          {status.correct} de {status.target} aciertos
          {status.weeksDone > 0 && ` · ${status.weeksDone} ${status.weeksDone === 1 ? "semana cumplida" : "semanas cumplidas"}`}
        </p>
      </div>

      {status.done && !status.claimed && (
        <div className="mt-4">
          <Button onClick={claim} disabled={busy} leftIcon={busy ? <Loader2 className="animate-spin" /> : <Gift />}>
            Cobrar {WEEKLY_XP} XP
          </Button>
        </div>
      )}

      {!status.done && (
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          Cumplir semanas seguidas abre equipo que no se consigue de ninguna otra forma.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}
    </Card>
  );
}
