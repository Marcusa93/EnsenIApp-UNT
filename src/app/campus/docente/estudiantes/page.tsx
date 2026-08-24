import type { Metadata } from "next";
import { Activity, AlertTriangle, UserCheck, Users } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, PageHeader, Stat } from "@/components/ui";
import { RevealGroup, RevealItem } from "@/components/shell";
import { getActiveCourse } from "@/components/docente/active-course";
import { CourseSwitcher } from "@/components/docente/course-switcher";
import { getStudentsData } from "./_components/students-data";
import { StudentsTabs, type StudentsTab } from "./_components/students-tabs";
import { EnrolledTable } from "./_components/enrolled-table";
import { RosterPanel } from "./_components/roster-panel";
import { PendingList } from "./_components/pending-list";

export const metadata: Metadata = { title: "Estudiantes · EnsenIA UNT" };

const TABS: StudentsTab[] = ["inscriptos", "padron", "pendientes"];

export default async function EstudiantesPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string; tab?: string }>;
}) {
  const { user, profile } = await requireRole("docente", "admin");
  const supabase = await createClient();
  const sp = await searchParams;
  const { course, courses } = await getActiveCourse(supabase, user.id, profile.role, sp.course);

  if (!course) {
    return (
      <>
        <PageHeader eyebrow="Docente · Estudiantes" title="Estudiantes" />
        <EmptyState
          icon={Users}
          title="Todavía no tenés cursos asignados"
          description="Un administrador tiene que asignarte a un curso para gestionar el padrón y los inscriptos."
        />
      </>
    );
  }

  const data = await getStudentsData(supabase, course.id);
  const initialTab: StudentsTab = TABS.includes(sp.tab as StudentsTab) ? (sp.tab as StudentsTab) : "inscriptos";
  const active7d = data.enrolled.filter((s) => s.events_7d > 0).length;
  const withAlerts = data.enrolled.filter((s) => s.open_alerts > 0).length;

  return (
    <>
      <PageHeader
        eyebrow={`Docente · ${course.subject?.name ?? "Estudiantes"}`}
        title="Estudiantes"
        description={`${course.name} · ${course.term}. Inscriptos, padrón oficial y perfiles pendientes de validación.`}
        actions={<CourseSwitcher courses={courses} activeCourseId={course.id} />}
      />

      <RevealGroup className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" stagger={0.05}>
        <RevealItem>
          <Stat label="Inscriptos" value={data.enrolled.length} icon={<Users />} hint="Con inscripción activa" />
        </RevealItem>
        <RevealItem>
          <Stat
            label="Activos · 7 días"
            value={active7d}
            icon={<Activity />}
            tone="accent-2"
            hint={data.enrolled.length ? `${Math.round((active7d / data.enrolled.length) * 100)} % del curso` : "Sin inscriptos"}
          />
        </RevealItem>
        <RevealItem>
          <Stat
            label="Pendientes"
            value={data.pending.length}
            icon={<UserCheck />}
            tone={data.pending.length > 0 ? "accent-3" : "muted"}
            hint="Inscriptos fuera del padrón"
          />
        </RevealItem>
        <RevealItem>
          <Stat
            label="Con alertas"
            value={withAlerts}
            icon={<AlertTriangle />}
            tone={withAlerts > 0 ? "accent-3" : "muted"}
            hint="Alertas abiertas"
          />
        </RevealItem>
      </RevealGroup>

      <StudentsTabs
        initial={initialTab}
        counts={{ inscriptos: data.enrolled.length, padron: data.roster.length, pendientes: data.pending.length }}
        inscriptos={
          <EnrolledTable
            courseId={course.id}
            courseName={course.name}
            students={data.enrolled}
            usageTruncated={data.usageTruncated}
          />
        }
        padron={<RosterPanel courseId={course.id} courseName={course.name} roster={data.roster} />}
        pendientes={<PendingList courseId={course.id} students={data.pending} />}
      />
    </>
  );
}
