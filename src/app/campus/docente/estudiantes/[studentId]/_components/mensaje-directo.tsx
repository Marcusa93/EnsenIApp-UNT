"use client";

import * as React from "react";
import { Check, Loader2, Send } from "lucide-react";
import { Button, Card, CardTitle, Textarea } from "@/components/ui";
import { sendStudentMessage } from "../actions";

/**
 * El mensaje directo de la ficha: un empujón puntual con nombre y apellido.
 * Llega a la campana del estudiante (y al push). No abre un hilo — para
 * conversar está Consultas; esto es para iniciar el contacto sin esperar a
 * que el estudiante pregunte.
 */
export function MensajeDirecto({
  courseId,
  studentId,
  nombre,
}: {
  courseId: string;
  studentId: string;
  /** Nombre de pila, sólo para el placeholder. */
  nombre: string;
}) {
  const [body, setBody] = React.useState("");
  const [estado, setEstado] = React.useState<"idle" | "enviando" | "enviado">("idle");
  const [error, setError] = React.useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || estado === "enviando") return;
    setEstado("enviando");
    setError(null);
    const res = await sendStudentMessage({ course_id: courseId, student_id: studentId, body });
    if (!res.ok) {
      setError(res.error);
      setEstado("idle");
      return;
    }
    setBody("");
    setEstado("enviado");
    window.setTimeout(() => setEstado("idle"), 2500);
  }

  return (
    <Card>
      <CardTitle eyebrow="Contacto directo" as="h2">
        Mandarle un mensaje
      </CardTitle>
      <p className="mt-1 text-sm text-muted">
        Le llega a la campana del campus (y al celular si tiene los avisos prendidos), con tu nombre.
      </p>
      <form onSubmit={enviar} className="mt-3 flex flex-col gap-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder={`Ej.: ${nombre}, te reabrí la entrega para que la corrijas.`}
          aria-label="Mensaje para el estudiante"
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
            disabled={!body.trim() || estado === "enviando"}
            leftIcon={
              estado === "enviando" ? <Loader2 className="animate-spin" /> : estado === "enviado" ? <Check /> : <Send />
            }
          >
            {estado === "enviado" ? "Enviado" : "Enviar"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
