"use client";

import * as React from "react";
import { Check, KeyRound, Loader2, Send } from "lucide-react";
import { Button, Card, CardTitle, Textarea } from "@/components/ui";
import { resetStudentPassword, sendStudentMessage } from "../actions";

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

      <ReponerClave courseId={courseId} studentId={studentId} nombre={nombre} />
    </Card>
  );
}

/**
 * Reposición de contraseña: para cuando alguien no puede entrar.
 *
 * Está detrás de una confirmación porque invalida la contraseña actual: si el
 * estudiante sí podía entrar, después de esto no puede hasta que le pases la
 * nueva.
 */
function ReponerClave({ courseId, studentId, nombre }: { courseId: string; studentId: string; nombre: string }) {
  const [confirmando, setConfirmando] = React.useState(false);
  const [generando, setGenerando] = React.useState(false);
  const [nueva, setNueva] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function reponer() {
    setGenerando(true);
    setError(null);
    const res = await resetStudentPassword({ course_id: courseId, student_id: studentId });
    setGenerando(false);
    setConfirmando(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setNueva(res.data.password);
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      {nueva ? (
        <div className="rounded-xl border border-success/30 bg-success/10 p-3">
          <p className="text-sm font-medium text-success">Contraseña repuesta. Pasásela a {nombre}:</p>
          <p className="mt-1.5 select-all font-mono text-lg tracking-wide text-foreground">{nueva}</p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
            Anotala ahora: no se puede volver a ver. Cuando entre, el campus le va a pedir que elija una propia.
          </p>
        </div>
      ) : confirmando ? (
        <div className="rounded-xl border border-warning/35 bg-warning/10 p-3">
          <p className="text-sm">
            Se genera una contraseña nueva y la actual deja de servir. Sólo hacelo si {nombre} no puede entrar.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void reponer()} loading={generando} leftIcon={<KeyRound />}>
              Sí, reponer
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmando(false)} disabled={generando}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted">¿No puede entrar? Generale una contraseña nueva para pasarle.</p>
          <Button size="sm" variant="secondary" leftIcon={<KeyRound />} onClick={() => setConfirmando(true)}>
            Reponer contraseña
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
