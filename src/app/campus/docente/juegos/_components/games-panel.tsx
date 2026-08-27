"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardTitle, Switch } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { GameMeta } from "@/lib/games/config";
import { setGameEnabled, deleteChallenges } from "../actions";

interface RecordingRow {
  id: string;
  title: string | null;
  published: boolean;
  classTopic: string;
  classDate: string;
}

export function GamesPanel({
  courseId,
  games,
  recordings,
  challengeCounts,
}: {
  courseId: string;
  games: (GameMeta & { enabled: boolean })[];
  recordings: RecordingRow[];
  challengeCounts: Record<string, Record<string, number>>;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  const [local, setLocal] = React.useState(() => Object.fromEntries(games.map((g) => [g.key, g.enabled])));

  async function toggle(key: string, next: boolean) {
    setPending(`toggle-${key}`);
    setError(null);
    setNote(null);
    setLocal((prev) => ({ ...prev, [key]: next }));

    const res = await setGameEnabled({ course_id: courseId, game: key as "duelo", enabled: next });
    if (!res.ok) {
      setLocal((prev) => ({ ...prev, [key]: !next }));
      setError(res.error);
    } else {
      router.refresh();
    }
    setPending(null);
  }

  async function generate(recordingId: string) {
    setPending(`gen-${recordingId}`);
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/games/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordingId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "No se pudieron generar los desafíos.");

      const detail = Object.entries(data.generated as Record<string, number>)
        .map(([g, n]) => `${n} de ${g}`)
        .join(", ");
      setNote(
        `Listo: ${detail}.${data.problems?.length ? ` Pendiente: ${(data.problems as string[]).join(" ")}` : ""}`,
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron generar los desafíos.");
    } finally {
      setPending(null);
    }
  }

  async function remove(recordingId: string) {
    setPending(`del-${recordingId}`);
    setError(null);
    setNote(null);
    const res = await deleteChallenges({ course_id: courseId, recording_id: recordingId });
    if (!res.ok) setError(res.error);
    else router.refresh();
    setPending(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardTitle eyebrow="Disponibilidad" as="h2">
          Qué juegos ve la comisión
        </CardTitle>
        <div className="mt-4 flex flex-col gap-4">
          {games.map((g) => (
            <Switch
              key={g.key}
              checked={local[g.key] ?? true}
              onCheckedChange={(v) => toggle(g.key, v)}
              disabled={pending === `toggle-${g.key}`}
              label={
                <span className="flex items-center gap-2">
                  <span aria-hidden>{g.emoji}</span>
                  {g.name}
                </span>
              }
              description={g.tagline}
            />
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle eyebrow="Banco de desafíos" as="h2">
          Generar desde las grabaciones
        </CardTitle>

        {recordings.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            Todavía no hay grabaciones procesadas en esta comisión. Subí una clase y, cuando termine el procesamiento,
            vas a poder generar los desafíos acá.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2.5">
            {recordings.map((r) => {
              const counts = challengeCounts[r.id] ?? {};
              const total = Object.values(counts).reduce((a, b) => a + b, 0);
              const busy = pending === `gen-${r.id}`;
              return (
                <li key={r.id} className="rounded-2xl border border-border bg-surface-2/40 p-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug">{r.classTopic}</p>
                      <p className="mt-0.5 font-mono text-[11px] uppercase tracking-widest text-muted">
                        {r.classDate}
                        {!r.published && " · sin publicar"}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {total === 0 ? (
                          <Badge size="sm" tone="muted">
                            Sin desafíos
                          </Badge>
                        ) : (
                          games.map((g) =>
                            counts[g.key] ? (
                              <Badge key={g.key} size="sm" tone="accent-2">
                                {g.emoji} {counts[g.key]}
                              </Badge>
                            ) : null,
                          )
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      {total > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Borrar los desafíos de esta clase"
                          onClick={() => remove(r.id)}
                          disabled={pending === `del-${r.id}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant={total > 0 ? "secondary" : "primary"}
                        onClick={() => generate(r.id)}
                        disabled={busy}
                        leftIcon={busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
                      >
                        {busy ? "Generando…" : total > 0 ? "Regenerar" : "Generar"}
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <p className={cn("mt-3 text-xs leading-relaxed", "text-muted")}>
          Generar puede tardar hasta un minuto por clase: la IA lee la transcripción completa para que las preguntas
          salgan de lo que realmente se dijo.
        </p>

        {note && <p className="mt-3 rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">{note}</p>}
        {error && (
          <p role="alert" className="mt-3 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </p>
        )}
      </Card>
    </div>
  );
}
