"use client";

import * as React from "react";
import { BookOpen, Check, Copy, KeyRound, Pencil, Plus, RefreshCw, Trash2, Users } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  Field,
  Input,
  Select,
  Textarea,
  Tooltip,
} from "@/components/ui";
import { formatDate } from "@/lib/format";
import type { AdminCourse, AdminSubject } from "../_lib/data";
import { deleteCourse, deleteSubject, regenerateEnrollmentCode, upsertCourse, upsertSubject } from "../actions";
import { useAction } from "./use-action";
import { Feedback } from "./feedback";

export function CoursesTab({ subjects, courses }: { subjects: AdminSubject[]; courses: AdminCourse[] }) {
  // `session` remonta el diálogo en cada apertura: el formulario arranca limpio sin efectos de sincronización.
  const [subjectDialog, setSubjectDialog] = React.useState<{ open: boolean; subject: AdminSubject | null; session: number }>(
    { open: false, subject: null, session: 0 },
  );
  const [courseDialog, setCourseDialog] = React.useState<{ open: boolean; course: AdminCourse | null; session: number }>(
    { open: false, course: null, session: 0 },
  );
  const openSubjectDialog = (subject: AdminSubject | null) =>
    setSubjectDialog((s) => ({ open: true, subject, session: s.session + 1 }));
  const openCourseDialog = (course: AdminCourse | null) =>
    setCourseDialog((s) => ({ open: true, course, session: s.session + 1 }));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      {/* Materias */}
      <section aria-labelledby="subjects-heading" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="subjects-heading" className="eyebrow">
            Materias · {subjects.length}
          </h2>
          <Button size="sm" variant="secondary" leftIcon={<Plus />} onClick={() => openSubjectDialog(null)}>
            Nueva materia
          </Button>
        </div>
        {subjects.length === 0 ? (
          <EmptyState
            compact
            icon={BookOpen}
            title="Sin materias"
            description="Creá la materia antes de armar cursos o cuerpo docente."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {subjects.map((s) => (
              <SubjectRow
                key={s.id}
                subject={s}
                courseCount={courses.filter((c) => c.subject_id === s.id).length}
                onEdit={() => openSubjectDialog(s)}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Cursos */}
      <section aria-labelledby="courses-heading" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="courses-heading" className="eyebrow">
            Cursos · {courses.length}
          </h2>
          <Button
            size="sm"
            leftIcon={<Plus />}
            disabled={subjects.length === 0}
            onClick={() => openCourseDialog(null)}
          >
            Nuevo curso
          </Button>
        </div>
        {courses.length === 0 ? (
          <EmptyState
            compact
            icon={Users}
            tone="accent-2"
            title="Todavía no hay cursos"
            description={
              subjects.length === 0
                ? "Primero creá una materia; después el curso (comisión / año)."
                : "Creá el primer curso: los estudiantes se inscriben con su código."
            }
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {courses.map((c) => (
              <CourseRow key={c.id} course={c} onEdit={() => openCourseDialog(c)} />
            ))}
          </ul>
        )}
      </section>

      <SubjectDialog
        key={subjectDialog.session}
        open={subjectDialog.open}
        subject={subjectDialog.subject}
        onOpenChange={(open) => setSubjectDialog((s) => ({ ...s, open }))}
      />
      <CourseDialog
        key={courseDialog.session}
        open={courseDialog.open}
        course={courseDialog.course}
        subjects={subjects}
        onOpenChange={(open) => setCourseDialog((s) => ({ ...s, open }))}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

function SubjectRow({ subject, courseCount, onEdit }: { subject: AdminSubject; courseCount: number; onEdit: () => void }) {
  const { pending, error, run } = useAction();
  const [confirm, setConfirm] = React.useState(false);

  const remove = async () => {
    const result = await run(() => deleteSubject({ id: subject.id }));
    if (result.ok) setConfirm(false);
  };

  return (
    <li className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{subject.name}</p>
          {subject.description && <p className="mt-1 line-clamp-2 text-xs text-muted">{subject.description}</p>}
          <p className="mt-1.5 font-mono text-[10px] uppercase tracking-widest text-muted">
            {courseCount} curso{courseCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button size="icon" variant="ghost" className="size-8" aria-label={`Editar ${subject.name}`} onClick={onEdit}>
            <Pencil className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-8 hover:text-danger"
            aria-label={`Eliminar ${subject.name}`}
            onClick={() => setConfirm(true)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
      <Feedback error={error} className="mt-2" />
      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        size="sm"
        title="Eliminar materia"
        description={`Vas a eliminar "${subject.name}". Sólo se permite si no tiene cursos.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={remove} loading={pending} leftIcon={<Trash2 />}>
              Eliminar
            </Button>
          </>
        }
      />
    </li>
  );
}

function SubjectDialog({
  open,
  subject,
  onOpenChange,
}: {
  open: boolean;
  subject: AdminSubject | null;
  onOpenChange: (open: boolean) => void;
}) {
  // El componente se remonta en cada apertura (prop `key` del padre): el estado inicial ya viene de las props.
  const { pending, error, run } = useAction();
  const [name, setName] = React.useState(subject?.name ?? "");
  const [description, setDescription] = React.useState(subject?.description ?? "");
  const formId = React.useId();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await run(() => upsertSubject({ id: subject?.id, name, description }));
    if (result.ok) onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={subject ? "Editar materia" : "Nueva materia"}
      description="Una materia agrupa cursos (comisiones/años) y el cuerpo docente público."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} loading={pending} leftIcon={<Check />}>
            Guardar
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Nombre" htmlFor={`${formId}-name`} required>
          <Input
            id={`${formId}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Derecho de las Nuevas Tecnologías y Bioderecho"
            required
            minLength={3}
            autoFocus
          />
        </Field>
        <Field label="Descripción" htmlFor={`${formId}-desc`} hint="opcional">
          <Textarea
            id={`${formId}-desc`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Breve descripción que aparece en la landing y en el campus."
          />
        </Field>
        <Feedback error={error} />
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------

function CourseRow({ course, onEdit }: { course: AdminCourse; onEdit: () => void }) {
  const { pending, error, success, run } = useAction();
  const [confirm, setConfirm] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(course.enrollment_code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      console.error("[admin] clipboard", err);
    }
  };

  const regenerate = () =>
    run(() => regenerateEnrollmentCode({ id: course.id }), "Código regenerado. El anterior ya no sirve.");

  const remove = async () => {
    const result = await run(() => deleteCourse({ id: course.id }));
    if (result.ok) setConfirm(false);
  };

  return (
    <li>
      <Card padding="sm" className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-medium">{course.name}</p>
              <Badge tone="accent-2" size="sm">
                {course.term}
              </Badge>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted">{course.subject?.name ?? "Materia sin definir"}</p>
            <p className="mt-1.5 font-mono text-[10px] uppercase tracking-widest text-muted">
              {course.enrolled} inscripto{course.enrolled === 1 ? "" : "s"} · {course.teachers} docente
              {course.teachers === 1 ? "" : "s"} · creado {formatDate(course.created_at)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button size="icon" variant="ghost" className="size-8" aria-label={`Editar ${course.name}`} onClick={onEdit}>
              <Pencil className="size-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-8 hover:text-danger"
              aria-label={`Eliminar ${course.name}`}
              onClick={() => setConfirm(true)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border bg-surface-2/60 px-3 py-2">
          <KeyRound className="size-4 text-accent" aria-hidden />
          <span className="eyebrow text-[10px]">Código de inscripción</span>
          <code className="font-mono text-base font-semibold tracking-[0.2em] text-foreground">{course.enrollment_code}</code>
          <div className="ml-auto flex items-center gap-1">
            <Tooltip content={copied ? "Copiado" : "Copiar código"}>
              <Button size="icon" variant="ghost" className="size-8" aria-label="Copiar código" onClick={copyCode}>
                {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
              </Button>
            </Tooltip>
            <Tooltip content="Regenerar (invalida el actual)">
              <Button
                size="icon"
                variant="ghost"
                className="size-8"
                aria-label="Regenerar código de inscripción"
                onClick={regenerate}
                loading={pending}
              >
                <RefreshCw className="size-4" />
              </Button>
            </Tooltip>
          </div>
        </div>
        <Feedback error={error} success={success} />
      </Card>
      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        size="sm"
        title="Eliminar curso"
        description={`Vas a eliminar "${course.name}" (${course.term}). Sólo se permite si no tiene inscriptos ni clases.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={remove} loading={pending} leftIcon={<Trash2 />}>
              Eliminar
            </Button>
          </>
        }
      />
    </li>
  );
}

function CourseDialog({
  open,
  course,
  subjects,
  onOpenChange,
}: {
  open: boolean;
  course: AdminCourse | null;
  subjects: AdminSubject[];
  onOpenChange: (open: boolean) => void;
}) {
  // El componente se remonta en cada apertura (prop `key` del padre): el estado inicial ya viene de las props.
  const { pending, error, run } = useAction();
  const [subjectId, setSubjectId] = React.useState(course?.subject_id ?? subjects[0]?.id ?? "");
  const [name, setName] = React.useState(course?.name ?? "");
  const [term, setTerm] = React.useState(course?.term ?? String(new Date().getFullYear()));
  const formId = React.useId();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await run(() => upsertCourse({ id: course?.id, subjectId, name, term }));
    if (result.ok) onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={course ? "Editar curso" : "Nuevo curso"}
      description="El código de inscripción se genera solo; podés regenerarlo desde la lista."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} loading={pending} leftIcon={<Check />}>
            Guardar
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Materia" htmlFor={`${formId}-subject`} required>
          <Select
            id={`${formId}-subject`}
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            options={subjects.map((s) => ({ value: s.id, label: s.name }))}
            placeholder="Elegí una materia"
            required
          />
        </Field>
        <Field label="Nombre del curso" htmlFor={`${formId}-name`} required>
          <Input
            id={`${formId}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Comisión A"
            required
            minLength={2}
            autoFocus
          />
        </Field>
        <Field label="Período" htmlFor={`${formId}-term`} required hint="año o cuatrimestre">
          <Input id={`${formId}-term`} value={term} onChange={(e) => setTerm(e.target.value)} placeholder="2026" required />
        </Field>
        <Feedback error={error} />
      </form>
    </Dialog>
  );
}
