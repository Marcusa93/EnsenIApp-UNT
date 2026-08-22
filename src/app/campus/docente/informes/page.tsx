import Link from "next/link";
import { FileBarChart } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCoursesForRole } from "@/lib/courses";
import { PageHeader, EmptyState, Button } from "@/components/ui";
import { ReportRequestForm } from "@/components/informes/report-request-form";
import { ReportList } from "@/components/informes/report-list";

export const metadata = { title: "Informes · EnsenIA UNT" };

interface PageProps {
  searchParams: Promise<{ course?: string; scope?: string; student?: string; class?: string; activity?: string }>;
}

export default async function InformesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const { user, profile } = await requireRole("docente", "admin");
  const supabase = await createClient();

  const courses = await getCoursesForRole(supabase, user.id, profile.role);
  const course = courses.find((c) => c.id === sp.course) ?? courses[0] ?? null;

  if (!course) {
    return (
      <>
        <PageHeader eyebrow="Docente · Informes" title="Informes a demanda" />
        <EmptyState
          icon={FileBarChart}
          title="Todavía no tenés un curso asignado"
          description="Pedile a un administrador que te asigne a la comisión para poder pedir informes."
          action={
            <Button asChild variant="secondary">
              <Link href="/campus/docente">Volver al panel</Link>
            </Button>
          }
        />
      </>
    );
  }

  const [classesRes, activitiesRes, studentsRes, reportsRes] = await Promise.all([
    supabase
      .from("classes")
      .select("id, topic, class_date")
      .eq("course_id", course.id)
      .order("class_date", { ascending: false }),
    supabase
      .from("activities")
      .select("id, title, status")
      .eq("course_id", course.id)
      .neq("status", "draft")
      .order("created_at", { ascending: false }),
    supabase
      .from("enrollments")
      .select("student_id, student:profiles(id, full_name)")
      .eq("course_id", course.id)
      .eq("status", "active"),
    supabase
      .from("report_requests")
      .select("id, scope, filters, status, created_at, completed_at")
      .eq("course_id", course.id)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const firstError = classesRes.error ?? activitiesRes.error ?? studentsRes.error ?? reportsRes.error;
  if (firstError) {
    console.error("[informes] carga", { courseId: course.id, error: firstError });
    throw new Error("No se pudieron cargar los datos para pedir informes.");
  }

  const students = (studentsRes.data ?? [])
    .map((r) => {
      const s = r.student as { id: string; full_name: string } | { id: string; full_name: string }[] | null;
      return Array.isArray(s) ? s[0] : s;
    })
    .filter((s): s is { id: string; full_name: string } => s != null)
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "es"));

  return (
    <>
      <PageHeader
        eyebrow={`Docente · Informes · ${course.name}`}
        title="Informes a demanda"
        description="Pedí un informe sobre cómo se está cursando: la IA analiza los datos agregados del campus y te devuelve hallazgos con evidencia y recomendaciones concretas."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <ReportRequestForm
          courseId={course.id}
          classes={classesRes.data ?? []}
          activities={activitiesRes.data ?? []}
          students={students}
          initial={{
            scope: sp.scope,
            student_id: sp.student,
            class_id: sp.class,
            activity_id: sp.activity,
          }}
        />
        <ReportList
          reports={reportsRes.data ?? []}
          classes={classesRes.data ?? []}
          activities={activitiesRes.data ?? []}
          students={students}
        />
      </div>
    </>
  );
}
