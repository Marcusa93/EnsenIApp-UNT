"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, Loader2, NotebookPen, Sparkles, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Switch,
  Textarea,
} from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { formatRelative } from "@/lib/format";
import type { ClassNote } from "@/components/docente/class-data";
import { deleteClassNotes, saveClassNotes } from "../actions";

const MINIMO = 80;

/**
 * El apunte de la clase: la puerta de entrada para las clases que NO se graban.
 *
 * No todas las clases se graban, y sin grabación el campus se quedaba sin nada
 * que mostrar y sin material para generar desafíos. Con el apunte, la clase
 * tiene contenido igual: lo lee el estudiante, lo lee Alberdi y de ahí salen
 * las preguntas de los juegos.
 */
export function ApuntePanel({
  classId,
  note,
  tieneGrabacion,
}: {
  classId: string;
  note: ClassNote | null;
  /** Con grabación el apunte es opcional; sin ella, es lo único que hay. */
  tieneGrabacion: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = React.useState(note?.body_md ?? "");
  const [publicado, setPublicado] = React.useState(note?.published ?? true);
  const [modo, setModo] = React.useState<"escribir" | "previsualizar">("escribir");
  const [guardando, setGuardando] = React.useState(false);
  const [guardado, setGuardado] = React.useState(false);
  const [borrando, setBorrando] = React.useState(false);
  const [generando, setGenerando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [nota, setNota] = React.useState<string | null>(null);

  const limpio = body.trim();
  const cambio = limpio !== (note?.body_md ?? "").trim() || publicado !== (note?.published ?? true);
  const corto = limpio.length > 0 && limpio.length < MINIMO;
  // Generar desde un borrador dejaría al estudiante jugando sobre un texto que
  // no puede leer (y el repaso le mostraría la cita igual).
  const enBorrador = note != null && !note.published;

  async function guardar() {
    setGuardando(true);
    setError(null);
    setNota(null);
    const res = await saveClassNotes({ class_id: classId, body_md: limpio, published: publicado });
    setGuardando(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setGuardado(true);
    window.setTimeout(() => setGuardado(false), 2500);
    router.refresh();
  }

  async function borrar() {
    setBorrando(true);
    setError(null);
    const res = await deleteClassNotes(classId);
    setBorrando(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setBody("");
    setPublicado(true);
    router.refresh();
  }

  async function generarDesafios() {
    setGenerando(true);
    setError(null);
    setNota(null);
    try {
      const res = await fetch("/api/games/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "No se pudieron generar los desafíos.");
      const detalle = Object.entries((data.generated ?? {}) as Record<string, number>)
        .map(([g, n]) => `${n} de ${g}`)
        .join(", ");
      setNota(`Listo: ${detalle}. Ya están jugables en El Expediente.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron generar los desafíos.");
    } finally {
      setGenerando(false);
    }
  }

  return (
    <Card highlight={!tieneGrabacion && !note}>
      <CardHeader>
        <CardTitle eyebrow="Apunte de la clase" as="h2" className="flex flex-wrap items-center gap-2">
          <NotebookPen className="size-4 text-accent-2" aria-hidden />
          {note ? "El texto de esta clase" : "Escribir la clase"}
          {note && (
            <Badge size="sm" tone={note.published ? "accent-2" : "muted"}>
              {note.published ? "Publicado" : "Borrador"}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          {tieneGrabacion
            ? "Opcional: notas o síntesis que acompañen a la grabación. La comisión lo lee junto a la clase."
            : "Para las clases que no se graban. Lo que escribas acá es el contenido de la clase: lo lee la comisión, lo usa Alberdi para responder y de ahí salen los desafíos de los juegos."}
        </CardDescription>
      </CardHeader>

      <div className="mt-3 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div role="tablist" aria-label="Apunte" className="flex gap-1.5">
            {(["escribir", "previsualizar"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={modo === m}
                onClick={() => setModo(m)}
                className={
                  modo === m
                    ? "h-8 rounded-full border border-accent bg-accent/15 px-3 font-mono text-[11px] uppercase tracking-widest text-foreground"
                    : "h-8 rounded-full border border-border bg-surface px-3 font-mono text-[11px] uppercase tracking-widest text-muted transition-colors hover:border-accent/50 hover:text-foreground"
                }
              >
                {m === "escribir" ? "Escribir" : "Ver como queda"}
              </button>
            ))}
          </div>
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted">
            {limpio.length.toLocaleString("es-AR")} caracteres
          </span>
        </div>

        {modo === "escribir" ? (
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={14}
            maxLength={60_000}
            aria-label="Apunte de la clase"
            placeholder={`Pegá tus notas, el guion de la clase o una síntesis. Se admite Markdown.

## De qué se trató
...

## Conceptos
- **Dato personal**: toda información referida a una persona humana determinada o determinable.

## Para el parcial
...`}
            className="font-mono text-[13px] leading-relaxed"
          />
        ) : (
          <div className="min-h-[10rem] rounded-2xl border border-border bg-surface-2/40 p-4">
            {limpio ? (
              <Markdown size="sm">{limpio}</Markdown>
            ) : (
              <p className="text-sm text-muted">Todavía no escribiste nada.</p>
            )}
          </div>
        )}

        <Switch
          checked={publicado}
          onCheckedChange={setPublicado}
          label="Visible para la comisión"
          description={
            publicado
              ? "Lo ven en la página de la clase apenas guardes."
              : "Queda como borrador: sólo lo ve el equipo docente."
          }
        />

        {corto && (
          <p className="rounded-xl border border-warning/35 bg-warning/10 px-3 py-2 text-xs text-warning">
            Con menos de {MINIMO} caracteres la IA no tiene de dónde sacar preguntas. Contá un poco más.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => void guardar()}
            disabled={!cambio || !limpio || corto || guardando}
            leftIcon={guardando ? <Loader2 className="animate-spin" /> : guardado ? <Check /> : <NotebookPen />}
          >
            {guardado ? "Guardado" : "Guardar apunte"}
          </Button>

          {note && (
            <>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void generarDesafios()}
                disabled={generando || cambio || enBorrador}
                leftIcon={generando ? <Loader2 className="animate-spin" /> : <Sparkles />}
              >
                {generando ? "Generando…" : "Generar desafíos con este apunte"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void borrar()}
                disabled={borrando}
                leftIcon={borrando ? <Loader2 className="animate-spin" /> : <Trash2 />}
              >
                Borrar
              </Button>
            </>
          )}

          {note && (
            <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-muted">
              <Eye className="size-3.5" aria-hidden />
              {formatRelative(note.updated_at)}
            </span>
          )}
        </div>

        {cambio && note && (
          <p className="text-xs text-muted">
            Guardá los cambios antes de generar desafíos: la IA lee lo que está guardado, no lo que ves en pantalla.
          </p>
        )}

        {enBorrador && !cambio && (
          <p className="text-xs text-muted">
            Para generar desafíos publicá el apunte: si no, el estudiante jugaría sobre un texto que no puede leer.
          </p>
        )}

        {nota && (
          <p className="rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">{nota}</p>
        )}
        {error && (
          <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </p>
        )}
      </div>
    </Card>
  );
}
