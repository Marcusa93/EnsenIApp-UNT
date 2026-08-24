import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCourseById } from "@/lib/courses";
import { formatDateTime } from "@/lib/format";
import { Badge, Button, PageHeader, Stat } from "@/components/ui";
import { RevealGroup, RevealItem } from "@/components/shell";
import { ActivityStatusBadge, ActivityTypeBadge } from "@/components/activities/badges";
import { isEditableType, moduleLinkForActivity } from "@/components/activities/model";
import {
  getActivityById,
  getAssignedStudentIds,
  getCourseClasses,
  getEnrolledStudents,
  getMaterialsForClasses,
  getSubmissionsForActivity,
  isTeacherOfCourse,
} from "@/components/activities/queries";
import { StatusControls } from "./_components/status-controls";
import { ActivityDetailTabs } from "./_components/activity-detail-tabs";

export const metadata: Metadata = { title: "Actividad · EnsenIA UNT" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ActividadDocentePage({
  params,
  searchParams,
}: {
  params: Promise<{ activityId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { user, profile } = await requireRole("docente", "admin");
  const [{ activityId }, { tab }] = await Promise.all([params, searchParams]);
  if (!UUID_RE.test(activityId)) notFound();

  const supabase = await createClient();
  const activity = await getActivityById(supabase, activityId);
  if (!activity) notFound();
  if (!(await isTeacherOfCourse(supabase, user.id, profile.role, activity.course_id))) notFound();

  const [course, submissions, assigned, classes, students] = await Promise.all([
    getCourseById(supabase, activity.course_id),
    getSubmissionsForActivity(supabase, activityId),
    getAssignedStudentIds(supabase, activityId),
    getCourseClasses(supabase, [activity.course_id]),
    getEnrolledStudents(supabase, activity.course_id),
  ]);
  const materials = await getMaterialsForClasses(
    supabase,
    classes.map((k) => k.id),
  );

  const assignedCount = activity.target === "todos" ? students.length : assigned.length;
  const submitted = submissions.filter((s) => s.status === "entregada" || s.status === "corregida").length;
  const graded = submissions.filter((s) => s.status === "corregida").length;
  const inProgress = submissions.length - submitted;
  const externalLink = isEditableType(activity.type) ? null : moduleLinkForActivity(activity, "docente");

  return (
    <>
      <PageHeader
        top={
          <Button asChild variant="ghost" size="sm" leftIcon={<ArrowLeft />}>
            <Link href="/campus/docente/actividades">Actividades</Link>
          </Button>
        }
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <ActivityStatusBadge status={activity.status} size="sm" />
            <ActivityTypeBadge type={activity.type} size="sm" />
          </span>
        }
        title={activity.title}
        description={
          <>
            {course ? `${course.name} · ${course.term}` : null}
            {activity.class ? ` · ${activity.class.topic}` : null}
            {activity.due_at ? ` · vence ${formatDateTime(activity.due_at)}` : " · sin fecha límite"}
            {activity.published_at ? ` · publicada ${formatDateTime(activity.published_at)}` : null}
          </>
        }
        actions={<StatusControls activityId={activity.id} status={activity.status} hasSubmissions={submissions.length > 0} />}
      />

      <RevealGroup className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" stagger={0.05}>
        <RevealItem>
          <Stat label="Asignados" value={assignedCount} hint={activity.target === "todos" ? "Todo el curso" : "Seleccionados"} />
        </RevealItem>
        <RevealItem>
          <Stat
            label="Entregadas"
            value={submitted}
            tone="accent-2"
            delta={assignedCount > 0 ? `${Math.round((submitted / assignedCount) * 100)} %` : undefined}
          />
        </RevealItem>
        <RevealItem>
          <Stat label="Corregidas" value={graded} tone="accent-3" hint={`${submitted - graded} por corregir`} />
        </RevealItem>
        <RevealItem>
          <Stat label="En progreso" value={inProgress} tone="muted" hint="Empezaron y no entregaron" />
        </RevealItem>
      </RevealGroup>

      {externalLink && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-accent-2/30 bg-accent-2/10 px-4 py-3 text-sm">
          <Badge tone="accent-2" size="sm">
            Módulo externo
          </Badge>
          <span className="text-muted">Este tipo de actividad se gestiona desde su propio módulo.</span>
          <Button asChild size="sm" variant="secondary" rightIcon={<ExternalLink />}>
            <Link href={externalLink.href}>{externalLink.label}</Link>
          </Button>
        </div>
      )}

      <ActivityDetailTabs
        activity={activity}
        submissions={submissions}
        initialTab={tab}
        editor={
          isEditableType(activity.type) && course
            ? {
                courseId: course.id,
                courseName: `${course.name} · ${course.term}`,
                classes,
                materials,
                students,
                assigned,
              }
            : null
        }
      />
    </>
  );
}
