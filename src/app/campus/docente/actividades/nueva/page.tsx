import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Sparkles, Users } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, Button, EmptyState, PageHeader } from "@/components/ui";
import { getActiveCourse } from "@/components/docente/active-course";
import {
  getCourseClasses,
  getEnrolledStudents,
  getMaterialsForClasses,
  getRecordingContext,
} from "@/components/activities/queries";
import { ActivityForm } from "@/components/activities/activity-form";

export const metadata: Metadata = { title: "Nueva actividad · EnsenIA UNT" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function NuevaActividadPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string; recordingId?: string; classId?: string }>;
}) {
  const { user, profile } = await requireRole("docente", "admin");
  const supabase = await createClient();
  const { course: c, recordingId, classId } = await searchParams;

  // Si viene una grabación, el curso activo es el de esa grabación.
  const recording = recordingId && UUID_RE.test(recordingId) ? await getRecordingContext(supabase, recordingId) : null;
  // Si viene una clase (link "crear actividad" desde la página de la clase),
  // preseleccionamos esa clase y su curso.
  const linkedClass =
    !recording && classId && UUID_RE.test(classId)
      ? (await supabase.from("classes").select("id, course_id").eq("id", classId).maybeSingle()).data
      : null;
  const { course } = await getActiveCourse(
    supabase,
    user.id,
    profile.role,
    recording?.course_id ?? linkedClass?.course_id ?? c,
  );

  if (!course) {
    return (
      <>
        <PageHeader eyebrow="Docente · Actividades" title="Nueva actividad" />
        <EmptyState
          icon={Users}
          title="Todavía no tenés cursos asignados"
          description="Un administrador tiene que asignarte a un curso para que puedas crear actividades."
        />
      </>
    );
  }

  const [classes, students] = await Promise.all([
    getCourseClasses(supabase, [course.id]),
    getEnrolledStudents(supabase, course.id),
  ]);
  const materials = await getMaterialsForClasses(
    supabase,
    classes.map((k) => k.id),
  );

  return (
    <>
      <PageHeader
        top={
          <Button asChild variant="ghost" size="sm" leftIcon={<ArrowLeft />}>
            <Link href="/campus/docente/actividades">Actividades</Link>
          </Button>
        }
        eyebrow={`Docente · ${course.name} · ${course.term}`}
        title="Nueva actividad"
        description="Elegí el tipo, armá el contenido, definí destinatarios y fecha límite. Podés guardar como borrador y publicar más tarde."
        actions={
          recording ? (
            <Badge tone="accent-2" dot className="max-w-full whitespace-normal">
              Desde grabación: {recording.title?.trim() || recording.class_topic}
            </Badge>
          ) : undefined
        }
      />

      {/* Asistencia IA: violeta, el color del Laboratorio. Sólo cuando hay grabación de la que partir. */}
      {recording && (
        <div className="paper mb-6 flex items-start gap-3 rounded-2xl border border-border border-l-[3px] border-l-accent-3 bg-surface px-4 py-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-accent-3/10 text-accent-3">
            <Sparkles className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 text-sm">
            <p className="font-display font-bold tracking-tight">Podés dejar que la IA arme el borrador</p>
            <p className="mt-0.5 text-muted">
              Con «Sugerir con IA» se proponen título, consigna y preguntas a partir de la grabación. Revisá y ajustá lo
              que haga falta antes de publicar.
            </p>
          </div>
        </div>
      )}

      <ActivityForm
        mode="create"
        courseId={course.id}
        courseName={`${course.name} · ${course.term}`}
        classes={classes}
        materials={materials}
        students={students}
        recording={recording}
        initialClassId={linkedClass && linkedClass.course_id === course.id ? linkedClass.id : null}
      />
    </>
  );
}
