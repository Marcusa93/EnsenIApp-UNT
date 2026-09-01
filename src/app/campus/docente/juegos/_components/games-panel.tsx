"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, NotebookText, PlayCircle, Sparkles, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardTitle, Switch } from "@/components/ui";
import type { GameMeta } from "@/lib/games/config";
import { setGameEnabled, deleteChallenges } from "../actions";

/** Una clase con material del que se pueden sacar desafíos. */
export interface FuenteClase {
  classId: string;
  topic: string;
  classDate: string;
  /** Grabación procesada, si la hay. Null cuando la clase no se grabó. */
  recordingId: string | null;
  recordingPublished: boolean;
  tieneApunte: boolean;
  counts: Record<string, number>;
}

export function GamesPanel({
  courseId,
  games,
  fuentes,
}: {
  courseId: string;
  games: (GameMeta & { enabled: boolean })[];
  fuentes: FuenteClase[];
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

  async function generate(f: FuenteClase) {
    setPending(`gen-${f.classId}`);
    setError(null);
    setNote(null);
    try {
      // La grabación manda cuando existe: tiene minutos, y con minutos hay
      // «¿en qué minuto?». El apunte es la fuente de las clases sin grabar.
      const payload = f.recordingId ? { recordingId: f.recordingId } : { classId: f.classId };
      const res = await fetch("/api/games/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "No se pudieron generar los desafíos.");

      const detail = Object.entries(data.generated as Record<string, number>)
        .map(([g, n]) => `${n} de ${g}`)
        .join(", ");
      setNote(`Listo: ${detail}.${data.problems?.length ? ` Pendiente: ${(data.problems as string[]).join(" ")}` : ""}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron generar los desafíos.");
    } finally {
      setPending(null);
    }
  }

  async function remove(classId: string) {
    setPending(`del-${classId}`);
    setError(null);
    setNote(null);
    const res = await deleteChallenges({ course_id: courseId, class_id: classId });
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
          Generar desde el material de cada clase
        </CardTitle>

        {fuentes.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            Todavía no hay clases con material en esta comisión. Subí una grabación y esperá a que termine de
            procesarse, o escribí el apunte de una clase desde su ficha en el cronograma.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2.5">
            {fuentes.map((f) => {
              const total = Object.values(f.counts).reduce((a, b) => a + b, 0);
              const busy = pending === `gen-${f.classId}`;
              return (
                <li key={f.classId} className="rounded-2xl border border-border bg-surface-2/40 p-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/campus/docente/clases/${f.classId}`}
                        className="text-sm font-medium leading-snug underline-offset-4 hover:text-accent-2 hover:underline"
                      >
                        {f.topic}
                      </Link>
                      <p className="mt-0.5 font-mono text-[11px] uppercase tracking-widest text-muted">{f.classDate}</p>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {f.recordingId ? (
                          <Badge size="sm" tone="success">
                            <PlayCircle className="mr-1 inline size-3" aria-hidden />
                            Grabación{!f.recordingPublished && " (sin publicar)"}
                          </Badge>
                        ) : (
                          <Badge size="sm" tone="accent-2">
                            <NotebookText className="mr-1 inline size-3" aria-hidden />
                            Apunte
                          </Badge>
                        )}
                        {total === 0 ? (
                          <Badge size="sm" tone="muted">
                            Sin desafíos
                          </Badge>
                        ) : (
                          games.map((g) =>
                            f.counts[g.key] ? (
                              <Badge key={g.key} size="sm" tone="accent">
                                {g.emoji} {f.counts[g.key]}
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
                          aria-label={`Borrar los desafíos de ${f.topic}`}
                          onClick={() => remove(f.classId)}
                          disabled={pending === `del-${f.classId}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant={total > 0 ? "secondary" : "primary"}
                        onClick={() => generate(f)}
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

        <p className="mt-3 text-xs leading-relaxed text-muted">
          Generar puede tardar hasta un minuto por clase: la IA lee todo el material para que las preguntas salgan de
          lo que realmente se dio. Desde un apunte no se genera «¿en qué minuto?» — ese juego necesita la grabación.
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
