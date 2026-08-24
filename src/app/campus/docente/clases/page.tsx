import type { Metadata } from "next";
import { CalendarDays, Radio, Users } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, PageHeader, Stat } from "@/components/ui";
import { RevealGroup, RevealItem } from "@/components/shell";
import { CourseSwitcher } from "@/components/docente/course-switcher";
import { getActiveCourse } from "@/components/docente/active-course";
import { getCourseClasses, getTeachingStaff } from "@/components/docente/class-data";
import { ClassList } from "./_components/class-list";

export const metadata: Metadata = { title: "Cronograma · EnsenIA UNT" };

export default async function DocenteClasesPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string }>;
}) {
  const { user, profile } = await requireRole("docente", "admin");
  const supabase = await createClient();
  const { course: requested } = await searchParams;
  const { course, courses } = await getActiveCourse(supabase, user.id, profile.role, requested);

  if (!course) {
    return (
      <>
        <PageHeader eyebrow="Docente · Clases" title="Cronograma" />
        <EmptyState
          icon={Users}
          title="Todavía no tenés cursos asignados"
          description="Un administrador tiene que asignarte a un curso para que puedas cargar el cronograma."
        />
      </>
    );
  }

  const [classes, staff] = await Promise.all([getCourseClasses(supabase, course.id), getTeachingStaff(supabase)]);
  const dictadas = classes.filter((c) => c.state === "pasada").length;
  const conGrabacion = classes.filter((c) => c.recording?.status === "ready").length;
  const publicadas = classes.filter((c) => c.recording?.status === "ready" && c.recording.published).length;
  const checkins = classes.reduce((acc, c) => acc + c.checkins_count, 0);

  return (
    <>
      <PageHeader
        eyebrow={`Docente · ${course.subject?.name ?? "Clases"}`}
        title="Cronograma"
        description={`${course.name} · ${course.term}. Creá, editá o importá clases; cada una tiene sus materiales, avisos y grabaciones.`}
        actions={<CourseSwitcher courses={courses} activeCourseId={course.id} />}
      />

      <RevealGroup className="mb-6 grid gap-4 sm:grid-cols-3" stagger={0.05}>
        <RevealItem>
          <Stat
            label="Clases"
            value={classes.length}
            icon={<CalendarDays />}
            hint={`${dictadas} dictadas · ${classes.length - dictadas} por venir`}
          />
        </RevealItem>
        <RevealItem>
          <Stat
            label="Grabaciones listas"
            value={conGrabacion}
            icon={<Radio />}
            tone="accent-2"
            hint={`${publicadas} publicadas para estudiantes`}
          />
        </RevealItem>
        <RevealItem>
          <Stat label="Check-ins" value={checkins} icon={<Users />} tone="accent-3" hint="Respuestas de dificultad acumuladas" />
        </RevealItem>
      </RevealGroup>

      <ClassList courseId={course.id} classes={classes} staff={staff} />
    </>
  );
}
