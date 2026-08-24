"use client";

import * as React from "react";
import { GraduationCap, Plus, UserMinus, Users } from "lucide-react";
import { Avatar, Badge, Button, Card, CardDescription, CardHeader, CardTitle, EmptyState, Select } from "@/components/ui";
import { ROLE_LABEL, roleTone } from "@/components/shell";
import type { AdminAssignment, AdminCourse, AdminProfile } from "../_lib/data";
import { assignTeacher, unassignTeacher } from "../actions";
import { useAction } from "./use-action";
import { Feedback } from "./feedback";

export function AssignmentsTab({
  courses,
  assignments,
  profiles,
}: {
  courses: AdminCourse[];
  assignments: AdminAssignment[];
  profiles: AdminProfile[];
}) {
  const teachers = React.useMemo(
    () =>
      profiles
        .filter((p) => (p.role === "docente" || p.role === "admin") && p.status !== "bloqueado")
        .sort((a, b) => a.full_name.localeCompare(b.full_name, "es")),
    [profiles],
  );

  if (courses.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No hay cursos para asignar"
        description="Creá un curso en la pestaña Cursos y después asigná docentes acá."
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <section aria-label="Asignaciones por curso" className="flex flex-col gap-3">
        {courses.map((course) => (
          <CourseAssignments
            key={course.id}
            course={course}
            assigned={assignments.filter((a) => a.course_id === course.id)}
            teachers={teachers}
          />
        ))}
      </section>

      <aside aria-labelledby="teachers-heading" className="flex flex-col gap-3">
        <h2 id="teachers-heading" className="eyebrow">
          Docentes y admins · {teachers.length}
        </h2>
        {teachers.length === 0 ? (
          <EmptyState
            compact
            icon={GraduationCap}
            tone="accent-3"
            title="Sin docentes"
            description="Cambiá el rol de un usuario a Docente desde la pestaña Usuarios."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {teachers.map((t) => {
              const count = assignments.filter((a) => a.teacher_id === t.id).length;
              return (
                <li key={t.id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
                  <Avatar name={t.full_name} src={t.avatar_url} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.full_name}</p>
                    <p className="truncate text-xs text-muted">{t.email}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge tone={roleTone(t.role)} size="sm">
                      {ROLE_LABEL[t.role]}
                    </Badge>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
                      {count} curso{count === 1 ? "" : "s"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </aside>
    </div>
  );
}

function CourseAssignments({
  course,
  assigned,
  teachers,
}: {
  course: AdminCourse;
  assigned: AdminAssignment[];
  teachers: AdminProfile[];
}) {
  const { pending, error, success, run } = useAction();
  const [selected, setSelected] = React.useState("");
  const assignedIds = new Set(assigned.map((a) => a.teacher_id));
  const available = teachers.filter((t) => !assignedIds.has(t.id));

  const add = async () => {
    if (!selected) return;
    const result = await run(() => assignTeacher({ courseId: course.id, teacherId: selected }), "Docente asignado.");
    if (result.ok) setSelected("");
  };

  const remove = (teacherId: string) =>
    run(() => unassignTeacher({ courseId: course.id, teacherId }), "Docente quitado del curso.");

  return (
    <Card padding="sm">
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle as="h3" eyebrow={course.subject?.name ?? "Materia"}>
            {course.name} <span className="font-normal text-muted">· {course.term}</span>
          </CardTitle>
          <CardDescription>
            {assigned.length === 0
              ? "Sin docentes asignados: nadie ve este curso en el panel docente."
              : `${assigned.length} docente${assigned.length === 1 ? "" : "s"} con acceso al curso.`}
          </CardDescription>
        </div>
      </CardHeader>

      {assigned.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {assigned.map((a) => (
            <li key={a.teacher_id} className="flex items-center gap-3 rounded-xl border border-border bg-surface-2/60 px-3 py-2">
              <Avatar name={a.teacher?.full_name} src={a.teacher?.avatar_url} size="xs" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{a.teacher?.full_name ?? "Usuario eliminado"}</p>
                {a.teacher?.email && <p className="truncate text-xs text-muted">{a.teacher.email}</p>}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="hover:text-danger"
                leftIcon={<UserMinus />}
                disabled={pending}
                onClick={() => void remove(a.teacher_id)}
                aria-label={`Quitar a ${a.teacher?.full_name ?? "docente"} de ${course.name}`}
              >
                Quitar
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Select
          aria-label={`Docente a asignar en ${course.name}`}
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          placeholder={available.length === 0 ? "No quedan docentes por asignar" : "Elegí un docente…"}
          options={available.map((t) => ({ value: t.id, label: `${t.full_name} · ${t.email}` }))}
          disabled={available.length === 0 || pending}
          className="flex-1"
        />
        <Button onClick={add} disabled={!selected} loading={pending} leftIcon={<Plus />} className="h-11">
          Asignar
        </Button>
      </div>
      <Feedback error={error} success={success} className="mt-2" />
    </Card>
  );
}
