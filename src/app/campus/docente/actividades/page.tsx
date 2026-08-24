import Link from "next/link";
import type { Metadata } from "next";
import { ClipboardList, Plus, Users } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button, EmptyState, PageHeader } from "@/components/ui";
import { CourseSwitcher } from "@/components/docente/course-switcher";
import { getActiveCourse } from "@/components/docente/active-course";
import { getTeacherActivityRows } from "@/components/activities/queries";
import { ActivitiesTable } from "./_components/activities-table";

export const metadata: Metadata = { title: "Actividades · EnsenIA UNT" };

export default async function DocenteActividadesPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string; estado?: string }>;
}) {
  const { user, profile } = await requireRole("docente", "admin");
  const supabase = await createClient();
  const { course: c, estado } = await searchParams;
  const { course, courses } = await getActiveCourse(supabase, user.id, profile.role, c);

  if (!course) {
    return (
      <>
        <PageHeader eyebrow="Docente · Actividades" title="Actividades" />
        <EmptyState
          icon={Users}
          title="Todavía no tenés cursos asignados"
          description="Un administrador tiene que asignarte a un curso para que puedas crear actividades."
        />
      </>
    );
  }

  const rows = await getTeacherActivityRows(supabase, [course.id]);

  return (
    <>
      <PageHeader
        eyebrow={`Docente · ${course.subject?.name ?? "Actividades"}`}
        title="Actividades"
        description="Lecturas, cuestionarios y entregas del curso. Creá en borrador, publicá cuando esté lista y cerrá al terminar."
        actions={
          <>
            <CourseSwitcher courses={courses} activeCourseId={course.id} />
            <Button asChild leftIcon={<Plus />}>
              <Link href="/campus/docente/actividades/nueva">Nueva actividad</Link>
            </Button>
          </>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Todavía no hay actividades en este curso"
          description="Creá la primera: podés partir de una grabación procesada y dejar que la IA sugiera título, consigna y preguntas."
          action={
            <Button asChild leftIcon={<Plus />}>
              <Link href="/campus/docente/actividades/nueva">Crear actividad</Link>
            </Button>
          }
        />
      ) : (
        <ActivitiesTable rows={rows} initialFilter={estado} />
      )}
    </>
  );
}
