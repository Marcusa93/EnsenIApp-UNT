import Link from "next/link";
import { CalendarDays, GraduationCap } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getStudentCourses } from "@/lib/courses";
import { createClient } from "@/lib/supabase/server";
import { Button, EmptyState, PageHeader } from "@/components/ui";
import { getStudentClasses } from "./_lib/data";
import { ClassTimeline } from "./_components/class-timeline";

export const metadata = { title: "Clases · EnsenIA UNT" };

export default async function StudentClassesPage() {
  const { user, profile } = await requireRole("estudiante");
  const supabase = await createClient();
  const courses = await getStudentCourses(supabase, user.id);

  if (courses.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Estudiante · Clases" title="Cronograma" />
        <EmptyState
          icon={GraduationCap}
          title="Todavía no estás inscripto en ninguna comisión"
          description={
            profile.status === "pendiente"
              ? "Tu cuenta está pendiente de validación: cuando el equipo docente te agregue al padrón vas a ver acá el cronograma."
              : "Si ya cursás la materia, avisale al equipo docente para que te agregue al padrón de la comisión."
          }
          action={
            <Button asChild variant="secondary">
              <Link href="/campus/estudiante/consultas">Escribir al equipo docente</Link>
            </Button>
          }
        />
      </>
    );
  }

  const classes = await getStudentClasses(
    supabase,
    courses.map((c) => ({ id: c.id, name: c.name, subject_id: c.subject_id })),
  );
  const withRecording = classes.filter((c) => c.recordings_count > 0).length;
  const upcoming = classes.filter((c) => c.state === "hoy" || c.state === "proxima" || c.state === "futura").length;

  return (
    <>
      <PageHeader
        eyebrow="Estudiante · Clases"
        title="Cronograma"
        description={
          courses.length === 1
            ? `${courses[0].name} · ${classes.length} ${classes.length === 1 ? "clase" : "clases"}, ${withRecording} con grabación y ${upcoming} por delante.`
            : `${courses.length} comisiones · ${classes.length} clases, ${withRecording} con grabación y ${upcoming} por delante.`
        }
      />

      {classes.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          tone="accent-2"
          title="El cronograma todavía está vacío"
          description="Cuando el equipo docente cargue las fechas vas a ver acá cada clase con su tema, docente y accesos a la grabación."
          action={
            <Button asChild variant="secondary">
              <Link href="/campus/estudiante">Volver a Hoy</Link>
            </Button>
          }
        />
      ) : (
        <ClassTimeline
          classes={classes}
          courses={courses.map((c) => ({ id: c.id, name: c.name }))}
        />
      )}
    </>
  );
}
