"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, ArrowUp, MessageSquareText, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button, Card, CardDescription, CardHeader, CardTitle, EmptyState, Field, Input } from "@/components/ui";
import type { LivePrompt } from "@/lib/live/types";
import { createPrompt, deletePrompt, reorderPrompts, updatePrompt } from "../actions";

export interface PromptBankProps {
  classId: string;
  prompts: LivePrompt[];
}

/** Banco de disparadoras de nube de palabras: crear, editar, reordenar, borrar. */
export function PromptBank({ classId, prompts }: PromptBankProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [question, setQuestion] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingText, setEditingText] = React.useState("");
  const [busyId, setBusyId] = React.useState<string | null>(null);

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await createPrompt({ classId, question });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setQuestion("");
      router.refresh();
    });
  }

  function startEdit(p: LivePrompt) {
    setEditingId(p.id);
    setEditingText(p.question);
  }

  function saveEdit() {
    if (!editingId || !editingText.trim()) return;
    const id = editingId;
    setBusyId(id);
    setError(null);
    startTransition(async () => {
      const res = await updatePrompt({ classId, id, question: editingText });
      setBusyId(null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setEditingId(null);
      router.refresh();
    });
  }

  function remove(id: string) {
    setBusyId(id);
    setError(null);
    startTransition(async () => {
      const res = await deletePrompt({ classId, id });
      setBusyId(null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= prompts.length) return;
    const ordered = [...prompts];
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    setError(null);
    startTransition(async () => {
      const res = await reorderPrompts({ classId, orderedIds: ordered.map((p) => p.id) });
      if (!res.ok) setError(res.error);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle eyebrow="Sesión en vivo">Disparadoras (nube de palabras)</CardTitle>
        <CardDescription>
          Preguntas de una palabra o frase corta. Las vas a activar una por una durante la clase — cada estudiante ve el
          cambio al instante.
        </CardDescription>
      </CardHeader>

      {error && (
        <p className="mb-3 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={add} className="mb-4 flex gap-2">
        <Field label="Nueva disparadora" htmlFor="new-prompt" className="flex-1">
          <Input
            id="new-prompt"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder='Ej.: "En una palabra: ¿qué es esto?"'
            maxLength={240}
          />
        </Field>
        <Button type="submit" className="mt-auto" loading={pending} disabled={!question.trim()} leftIcon={<Plus />}>
          Agregar
        </Button>
      </form>

      {prompts.length === 0 ? (
        <EmptyState
          compact
          tone="muted"
          icon={MessageSquareText}
          title="Todavía no armaste disparadoras"
          description="Agregá al menos una para poder iniciar una sesión en vivo."
        />
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Disparadoras de la clase">
          <AnimatePresence initial={false}>
            {prompts.map((p, i) => (
              <motion.li
                key={p.id}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 16 }}
                className="flex items-start gap-2 rounded-xl border border-border bg-surface-2/60 p-3"
              >
                <span className="mt-1.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-surface font-mono text-[11px] text-muted">
                  {i + 1}
                </span>

                {editingId === p.id ? (
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Input
                      autoFocus
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      maxLength={240}
                      onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                    />
                    <Button size="sm" loading={busyId === p.id} onClick={saveEdit} disabled={!editingText.trim()}>
                      Guardar
                    </Button>
                    <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label="Cancelar" onClick={() => setEditingId(null)}>
                      <X className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="min-w-0 flex-1 text-sm leading-snug">{p.question}</p>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button variant="ghost" size="icon" className="size-8" aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)}>
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8" aria-label="Bajar" disabled={i === prompts.length - 1} onClick={() => move(i, 1)}>
                        <ArrowDown className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8" aria-label={`Editar ${p.question}`} onClick={() => startEdit(p)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 hover:text-danger"
                        aria-label={`Borrar ${p.question}`}
                        loading={busyId === p.id}
                        onClick={() => remove(p.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </Card>
  );
}
