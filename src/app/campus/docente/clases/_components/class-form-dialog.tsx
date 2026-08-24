"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog, Field, Input, Select, Textarea } from "@/components/ui";
import type { StaffOption } from "@/components/docente/class-data";
import type { ClassInput } from "@/components/docente/class-schema";
import { createClass, updateClass } from "../actions";

export interface ClassFormValues {
  id?: string;
  class_date: string;
  topic: string;
  teacher_id: string | null;
  teacher_name?: string | null;
  summary: string | null;
  sort_order: number;
}

export interface ClassFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  staff: StaffOption[];
  /** Si viene, es edición. */
  initial?: ClassFormValues | null;
  onSaved?: (id: string) => void;
}

const EMPTY: ClassFormValues = { class_date: "", topic: "", teacher_id: null, summary: null, sort_order: 0 };

/** Alta / edición de una clase del cronograma. */
export function ClassFormDialog({ open, onOpenChange, courseId, staff, initial, onSaved }: ClassFormDialogProps) {
  const router = useRouter();
  const formId = React.useId();
  const [values, setValues] = React.useState<ClassFormValues>(initial ?? EMPTY);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  // Reinicia el formulario cada vez que se abre (patrón "ajustar estado durante el render").
  const resetKey = open ? (initial?.id ?? "new") : null;
  const [prevResetKey, setPrevResetKey] = React.useState(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    if (resetKey !== null) {
      setValues(initial ?? EMPTY);
      setErrors({});
      setFormError(null);
    }
  }

  const staffOptions = React.useMemo(() => {
    const opts = staff.map((s) => ({ value: s.id, label: `${s.full_name}${s.role === "admin" ? " · admin" : ""}` }));
    if (values.teacher_id && !staff.some((s) => s.id === values.teacher_id)) {
      opts.unshift({ value: values.teacher_id, label: values.teacher_name ?? "Docente asignado" });
    }
    return [{ value: "", label: "Sin asignar" }, ...opts];
  }, [staff, values.teacher_id, values.teacher_name]);

  const set = <K extends keyof ClassFormValues>(key: K, v: ClassFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    const input: ClassInput = {
      course_id: courseId,
      class_date: values.class_date,
      topic: values.topic,
      teacher_id: values.teacher_id ?? "",
      summary: values.summary ?? "",
      sort_order: values.sort_order,
    };
    startTransition(async () => {
      const res = initial?.id ? await updateClass(initial.id, input) : await createClass(input);
      if (!res.ok) {
        setFormError(res.error);
        setErrors(res.fieldErrors ?? {});
        return;
      }
      const id = initial?.id ?? (res.data as { id: string } | undefined)?.id ?? "";
      onOpenChange(false);
      router.refresh();
      onSaved?.(id);
    });
  };

  const isEdit = Boolean(initial?.id);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !pending && onOpenChange(o)}
      title={isEdit ? "Editar clase" : "Nueva clase"}
      description={isEdit ? "Los cambios se reflejan al instante para los estudiantes." : "Sumá una clase al cronograma del curso."}
      dismissable={!pending}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} loading={pending}>
            {isEdit ? "Guardar cambios" : "Crear clase"}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {formError && (
          <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
            {formError}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
          <Field label="Fecha" htmlFor={`${formId}-date`} required error={errors.class_date}>
            <Input
              id={`${formId}-date`}
              type="date"
              required
              value={values.class_date}
              onChange={(e) => set("class_date", e.target.value)}
              invalid={Boolean(errors.class_date)}
            />
          </Field>
          <Field label="Orden" htmlFor={`${formId}-order`} error={errors.sort_order} hint="mismo día">
            <Input
              id={`${formId}-order`}
              type="number"
              min={0}
              max={999}
              value={values.sort_order}
              onChange={(e) => set("sort_order", Number(e.target.value) || 0)}
              invalid={Boolean(errors.sort_order)}
            />
          </Field>
        </div>
        <Field label="Tema" htmlFor={`${formId}-topic`} required error={errors.topic}>
          <Input
            id={`${formId}-topic`}
            required
            maxLength={200}
            placeholder="Ej.: Protección de datos personales y consentimiento"
            value={values.topic}
            onChange={(e) => set("topic", e.target.value)}
            invalid={Boolean(errors.topic)}
          />
        </Field>
        <Field
          label="Docente a cargo"
          htmlFor={`${formId}-teacher`}
          error={errors.teacher_id}
          description={staff.length <= 1 ? "Sólo ves tu propio perfil; un admin puede asignar a otros docentes." : undefined}
        >
          <Select
            id={`${formId}-teacher`}
            value={values.teacher_id ?? ""}
            onChange={(e) => set("teacher_id", e.target.value || null)}
            options={staffOptions}
          />
        </Field>
        <Field label="Resumen" htmlFor={`${formId}-summary`} error={errors.summary} hint="opcional">
          <Textarea
            id={`${formId}-summary`}
            rows={4}
            maxLength={4000}
            placeholder="De qué va la clase, bibliografía sugerida, consignas previas…"
            value={values.summary ?? ""}
            onChange={(e) => set("summary", e.target.value)}
            invalid={Boolean(errors.summary)}
          />
        </Field>
      </form>
    </Dialog>
  );
}
