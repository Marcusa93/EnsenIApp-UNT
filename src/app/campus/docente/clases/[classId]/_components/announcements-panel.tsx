"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Megaphone, Plus, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import type { ClassAnnouncement } from "@/components/docente/class-data";
import { formatRelative } from "@/lib/format";
import { createAnnouncement, deleteAnnouncement } from "../actions";

export interface AnnouncementsPanelProps {
  classId: string;
  announcements: ClassAnnouncement[];
}

/** Avisos de la clase (y generales del curso), con alta y baja. */
export function AnnouncementsPanel({ classId, announcements }: AnnouncementsPanelProps) {
  const router = useRouter();
  const formId = React.useId();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [scope, setScope] = React.useState<"clase" | "curso">("clase");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrors({});
    startTransition(async () => {
      const res = await createAnnouncement({ class_id: classId, title, body, scope });
      if (!res.ok) {
        setError(res.error);
        setErrors(res.fieldErrors ?? {});
        return;
      }
      setTitle("");
      setBody("");
      setOpen(false);
      router.refresh();
    });
  };

  const remove = (id: string) => {
    setError(null);
    setDeleting(id);
    startTransition(async () => {
      const res = await deleteAnnouncement(classId, id);
      setDeleting(null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle eyebrow="Comunicación">Avisos</CardTitle>
          <CardDescription>Los estudiantes los ven en su inicio y en la clase.</CardDescription>
        </div>
        <Button size="sm" variant={open ? "ghost" : "secondary"} leftIcon={<Plus />} onClick={() => setOpen((o) => !o)}>
          {open ? "Cerrar" : "Nuevo aviso"}
        </Button>
      </CardHeader>

      {error && (
        <p className="mb-3 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <AnimatePresence initial={false}>
        {open && (
          <motion.form
            id={formId}
            key="form"
            onSubmit={submit}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden"
            noValidate
          >
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2/50 p-4">
              <Field label="Título" htmlFor={`${formId}-title`} required error={errors.title}>
                <Input
                  id={`${formId}-title`}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={160}
                  placeholder="Ej.: Cambio de aula para la próxima clase"
                  invalid={Boolean(errors.title)}
                />
              </Field>
              <Field label="Mensaje" htmlFor={`${formId}-body`} required error={errors.body}>
                <Textarea
                  id={`${formId}-body`}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={3}
                  maxLength={4000}
                  invalid={Boolean(errors.body)}
                />
              </Field>
              <Field label="Alcance" htmlFor={`${formId}-scope`}>
                <Select
                  id={`${formId}-scope`}
                  value={scope}
                  onChange={(e) => setScope(e.target.value === "curso" ? "curso" : "clase")}
                  options={[
                    { value: "clase", label: "Sólo esta clase" },
                    { value: "curso", label: "Todo el curso" },
                  ]}
                />
              </Field>
              <div className="flex justify-end">
                <Button type="submit" size="sm" loading={pending && deleting === null} leftIcon={<Megaphone />}>
                  Publicar aviso
                </Button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {announcements.length === 0 ? (
        <EmptyState
          compact
          tone="muted"
          icon={Megaphone}
          title="Sin avisos"
          description="Publicá consignas, cambios de horario o recordatorios para esta clase."
        />
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Avisos">
          <AnimatePresence initial={false}>
            {announcements.map((a) => (
              <motion.li
                key={a.id}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 16 }}
                className="flex items-start gap-3 rounded-xl border border-border bg-surface-2/60 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge size="sm" tone={a.class_id ? "accent" : "accent-2"}>
                      {a.class_id ? "Clase" : "Curso"}
                    </Badge>
                    <span className="font-mono text-[11px] text-muted">
                      {a.author_name ?? "Docente"} · {formatRelative(a.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium leading-snug">{a.title}</p>
                  <p className="mt-0.5 whitespace-pre-line text-sm text-muted">{a.body}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 hover:text-danger"
                  aria-label={`Eliminar aviso ${a.title}`}
                  loading={deleting === a.id}
                  onClick={() => remove(a.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </Card>
  );
}
