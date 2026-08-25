import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, PageHeader } from "@/components/ui";
import { getStudentActivities } from "@/components/activities/queries";
import { StudentActivitiesList, type StudentActivityItem } from "./_components/student-activities-list";

export const metadata: Metadata = { title: "Actividades · EnsenIA UNT" };

export default async function EstudianteActividadesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { user } = await requireRole("estudiante");
  const supabase = await createClient();
  const [{ tab }, fullRows] = await Promise.all([searchParams, getStudentActivities(supabase, user.id)]);

  // DTO liviano: sin content ni answers (evita mandar respuestas correctas al cliente).
  const rows: StudentActivityItem[] = fullRows.map((r) => ({
    id: r.id,
    type: r.type,
    status: r.status,
    title: r.title,
    due_at: r.due_at,
    max_score: r.max_score,
    class_topic: r.class?.topic ?? null,
    submission: r.submission
      ? {
          status: r.submission.status,
          score: r.submission.score,
          auto_score: r.submission.auto_score,
          submitted_at: r.submission.submitted_at,
          graded_at: r.submission.graded_at,
        }
      : null,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Estudiante · Actividades"
        title="Actividades"
        description="Lecturas, cuestionarios y entregas de la cursada. Lo que escribís se guarda solo, incluso sin conexión."
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Todavía no hay actividades para vos"
          description="Cuando el equipo docente publique una lectura, un cuestionario o una entrega, la vas a ver acá."
        />
      ) : (
        <StudentActivitiesList rows={rows} initialTab={tab} />
      )}
    </>
  );
}
