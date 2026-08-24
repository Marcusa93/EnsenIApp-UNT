import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Clock, Mail } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatDuration } from "@/lib/format";
import { Avatar, Badge, Button, Card, CardHeader, CardTitle, PageHeader } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { ActivityTypeBadge, SubmissionStatusBadge } from "@/components/activities/badges";
import { AnswersView } from "@/components/activities/answers-view";
import { parseEssayAnswers } from "@/components/activities/model";
import { getActivityById, getSubmissionById, isTeacherOfCourse, signMaterialUrl } from "@/components/activities/queries";
import { GradingForm } from "./_components/grading-form";

export const metadata: Metadata = { title: "Corregir entrega · EnsenIA UNT" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CorregirEntregaPage({
  params,
}: {
  params: Promise<{ activityId: string; submissionId: string }>;
}) {
  const { user, profile } = await requireRole("docente", "admin");
  const { activityId, submissionId } = await params;
  if (!UUID_RE.test(activityId) || !UUID_RE.test(submissionId)) notFound();

  const supabase = await createClient();
  const [activity, submission] = await Promise.all([
    getActivityById(supabase, activityId),
    getSubmissionById(supabase, submissionId),
  ]);
  if (!activity || !submission || submission.activity_id !== activity.id) notFound();
  if (!(await isTeacherOfCourse(supabase, user.id, profile.role, activity.course_id))) notFound();

  const essay = activity.type === "entrega" ? parseEssayAnswers(submission.answers) : null;
  const fileUrl = essay?.file_path ? await signMaterialUrl(supabase, essay.file_path) : null;

  return (
    <>
      <PageHeader
        top={
          <Button asChild variant="ghost" size="sm" leftIcon={<ArrowLeft />}>
            <Link href={`/campus/docente/actividades/${activity.id}`}>{activity.title}</Link>
          </Button>
        }
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <SubmissionStatusBadge status={submission.status} size="sm" />
            <ActivityTypeBadge type={activity.type} size="sm" />
          </span>
        }
        title={
          <span className="inline-flex items-center gap-3">
            <Avatar name={submission.student?.full_name} size="md" />
            {submission.student?.full_name ?? "Estudiante"}
          </span>
        }
        description={
          <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs">
            {submission.student?.email && (
              <span className="inline-flex items-center gap-1.5">
                <Mail className="size-3.5" aria-hidden /> {submission.student.email}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5" aria-hidden /> {formatDuration(submission.time_spent_seconds)} dedicados
            </span>
            {submission.submitted_at && <span>Entregada {formatDateTime(submission.submitted_at)}</span>}
            {activity.due_at && submission.submitted_at && new Date(submission.submitted_at) > new Date(activity.due_at) && (
              <Badge tone="warning" size="sm">
                Fuera de término
              </Badge>
            )}
          </span>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle eyebrow="Respuestas">Lo que entregó</CardTitle>
            </CardHeader>
            {submission.status === "en_progreso" ? (
              <p className="mb-3 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                Todavía no entregó: estás viendo el borrador autoguardado.
              </p>
            ) : null}
            <AnswersView activity={activity} submission={submission} fileUrl={fileUrl} />
          </Card>

          {activity.instructions_md && (
            <Card>
              <CardHeader>
                <CardTitle eyebrow="Consigna">{activity.title}</CardTitle>
              </CardHeader>
              <Markdown size="sm">{activity.instructions_md}</Markdown>
            </Card>
          )}
        </div>

        <div className="min-w-0">
          <GradingForm
            submissionId={submission.id}
            activityId={activity.id}
            status={submission.status}
            maxScore={activity.max_score ?? 10}
            initialScore={submission.score}
            autoScore={submission.auto_score}
            initialFeedback={submission.teacher_feedback_md ?? ""}
            aiFeedback={submission.ai_feedback_md}
          />
        </div>
      </div>
    </>
  );
}
