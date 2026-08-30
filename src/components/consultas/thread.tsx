"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { Button, Textarea } from "@/components/ui";
import { formatRelative } from "@/lib/format";
import { replyToQuestion } from "@/lib/consultas/thread";
import type { UserRole } from "@/lib/types/helpers";
import { cn } from "@/lib/utils";

/**
 * El ida y vuelta de una consulta, para las dos puntas.
 *
 * Antes la consulta moría en la primera respuesta: si el estudiante no entendía,
 * tenía que abrir otra desde cero y el docente perdía el hilo. Acá se ve la
 * conversación completa y cualquiera de los dos puede seguir escribiendo.
 *
 * `viewerRole` sólo decide de qué lado se dibuja cada burbuja y cómo se nombra a
 * quien escribió; quién tiene permiso de responder lo resuelve la policy.
 */

export interface ThreadMessage {
  id: string;
  body: string;
  author_role: UserRole;
  author_name: string | null;
  created_at: string;
}

export function ConsultaThread({
  questionId,
  messages,
  viewerRole,
  /** En consultas anónimas el docente no ve quién escribió. */
  hideStudentName = false,
  className,
}: {
  questionId: string;
  messages: ThreadMessage[];
  viewerRole: UserRole;
  hideStudentName?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [enviando, setEnviando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const texto = body.trim();
    if (!texto || enviando) return;
    setEnviando(true);
    setError(null);
    const result = await replyToQuestion({ questionId, body: texto });
    setEnviando(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBody("");
    router.refresh();
  }

  function nombreDe(m: ThreadMessage): string {
    if (m.author_role === "estudiante") return hideStudentName ? "Estudiante" : (m.author_name ?? "Estudiante");
    return m.author_name ?? "Equipo docente";
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {messages.length > 0 && (
        <ul className="flex flex-col gap-2">
          {messages.map((m) => {
            // "Mío" es del lado de quien mira: el estudiante ve sus mensajes a la
            // derecha; el docente, los suyos (y los de cualquier colega).
            const mio = viewerRole === "estudiante" ? m.author_role === "estudiante" : m.author_role !== "estudiante";
            return (
              <li key={m.id} className={cn("flex", mio ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl border px-3 py-2",
                    mio ? "border-accent/30 bg-accent/10" : "border-border bg-surface-2/60",
                  )}
                >
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
                    {nombreDe(m)} · {formatRelative(m.created_at)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed">{m.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={enviar} className="flex flex-col gap-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          maxLength={4000}
          placeholder={
            viewerRole === "estudiante"
              ? "Repreguntá o agradecé la respuesta…"
              : "Respondele al estudiante…"
          }
          aria-label="Escribir un mensaje en la consulta"
        />
        {error && (
          <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            disabled={!body.trim() || enviando}
            leftIcon={enviando ? <Loader2 className="animate-spin" /> : <Send />}
          >
            Enviar
          </Button>
        </div>
      </form>
    </div>
  );
}
