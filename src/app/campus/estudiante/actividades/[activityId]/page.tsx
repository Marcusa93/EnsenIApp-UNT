import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, ExternalLink, FileDown, Hourglass, Link2, Lock } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { Badge, Button, Card, CardHeader, CardTitle, PageHeader, ProgressRing } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { ActivityTypeBadge, SubmissionStatusBadge } from "@/components/activities/badges";
import { AnswersView } from "@/components/activities/answers-view";
import { Countdown } from "@/components/activities/countdown";
import {
  canStudentEdit,
  effectiveScore,
  formatScore,
  isEditableType,
  isSubmitted,
  moduleLinkForActivity,
  parseEssayAnswers,
  parseQuizContent,
  parseTextContent,
} from "@/components/activities/model";
import {
  getActivityById,
  getMaterialsByIds,
  getOwnSubmission,
  signMaterialUrl,
  type MaterialOption,
} from "@/components/activities/queries";
import { ActivityRunner } from "./_components/activity-runner";

export const metadata: Metadata = { title: "Actividad · EnsenIA UNT" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface SignedMaterial extends MaterialOption {
  href: string | null;
}

export default async function ActividadEstudiantePage({ params }: { params: Promise<{ activityId: string }> }) {
  const { user } = await requireRole("estudiante");
  const { activityId } = await params;
  if (!UUID_RE.test(activityId)) notFound();

  const supabase = await createClient();
  const activity = await getActivityById(supabase, activityId);
  if (!activity) notFound();

  const back = (
    <Button asChild variant="ghost" size="sm" leftIcon={<ArrowLeft />}>
      <Link href="/campus/estudiante/actividades">Actividades</Link>
    </Button>
  );

  // Placas / debate / encuesta viven en sus propios módulos.
  if (!isEditableType(activity.type)) {
    const link = moduleLinkForActivity(activity, "estudiante");
    return (
      <>
        <PageHeader
          top={back}
          eyebrow={<ActivityTypeBadge type={activity.type} size="sm" />}
          title={activity.title}
          description={activity.class ? activity.class.topic : undefined}
        />
        {activity.instructions_md && (
          <Card className="mb-4">
            <Markdown>{activity.instructions_md}</Markdown>
          </Card>
        )}
        <Card highlight className="flex flex-col items-start gap-3">
          <Badge tone="accent-2" dot>
            Se realiza en otro módulo
          </Badge>
          <p className="text-sm text-muted">Esta actividad se hace desde su propio espacio del campus.</p>
          {link && (
            <Button asChild rightIcon={<ExternalLink />}>
              <Link href={link.href}>{link.label}</Link>
            </Button>
          )}
        </Card>
      </>
    );
  }

  const submission = await getOwnSubmission(supabase, activityId, user.id);
  const canEdit = canStudentEdit(activity, submission);
  const submitted = isSubmitted(submission?.status);
  const text = activity.type !== "cuestionario" ? parseTextContent(activity.content) : null;
  const quiz = activity.type === "cuestionario" ? parseQuizContent(activity.content) : null;

  const rawMaterials = text?.material_ids?.length ? await getMaterialsByIds(supabase, text.material_ids) : [];
  const materials: SignedMaterial[] = await Promise.all(
    rawMaterials.map(async (m) => ({
      ...m,
      href: m.url ?? (m.storage_path ? await signMaterialUrl(supabase, m.storage_path) : null),
    })),
  );

  const essay = submitted && activity.type === "entrega" ? parseEssayAnswers(submission?.answers) : null;
  const essayFileUrl = essay?.file_path ? await signMaterialUrl(supabase, essay.file_path) : null;

  const maxScore = activity.max_score ?? 10;
  const score = submission ? effectiveScore(submission) : null;
  const graded = submission?.status === "corregida";

  return (
    <>
      <PageHeader
        top={back}
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <ActivityTypeBadge type={activity.type} size="sm" />
            <SubmissionStatusBadge status={submission?.status} size="sm" />
            {activity.status === "closed" && (
              <Badge tone="muted" size="sm">
                <Lock className="size-3" aria-hidden /> Cerrada
              </Badge>
            )}
          </span>
        }
        title={activity.title}
        description={activity.class ? activity.class.topic : undefined}
        actions={canEdit ? <Countdown dueAt={activity.due_at} className="text-sm" /> : undefined}
      />

      <div className="flex flex-col gap-4">
        {/* Resultado de la corrección */}
        {graded && submission && (
          <Card highlight className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex shrink-0 items-center gap-4">
              <ProgressRing
                value={score != null && maxScore > 0 ? Math.max(0, Math.min(100, (score / maxScore) * 100)) : 0}
                tone={score != null && score >= maxScore * 0.6 ? "success" : "warning"}
                size={72}
                label="Puntaje obtenido"
              >
                <span className="font-mono text-sm tabular-nums">{formatScore(score, null)}</span>
              </ProgressRing>
              <div>
                <span className="eyebrow">Corregida</span>
                <p className="mt-1 font-mono text-sm tabular-nums">{formatScore(score, maxScore)}</p>
                {submission.graded_at && (
                  <p className="mt-0.5 font-mono text-[11px] text-muted">{formatDateTime(submission.graded_at)}</p>
                )}
              </div>
            </div>
            <div className="min-w-0 flex-1 sm:border-l sm:border-border sm:pl-4">
              <span className="eyebrow">Feedback del equipo docente</span>
              {submission.teacher_feedback_md ? (
                <div className="mt-2">
                  <Markdown size="sm">{submission.teacher_feedback_md}</Markdown>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted">Sin comentarios escritos. Si tenés dudas, escribí en Consultas.</p>
              )}
            </div>
          </Card>
        )}

        {/* Entregada, esperando corrección */}
        {submission?.status === "entregada" && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-accent-2/30 bg-accent-2/10 px-4 py-3 text-sm">
            <Hourglass className="size-4 shrink-0 text-accent-2" aria-hidden />
            <span>
              Entregaste {submission.submitted_at ? formatDateTime(submission.submitted_at) : ""}. El equipo docente la
              está revisando.
            </span>
            {activity.type === "cuestionario" && submission.auto_score != null && (
              <Badge tone="accent-2">auto {formatScore(submission.auto_score, maxScore)}</Badge>
            )}
          </div>
        )}

        {/* Cerrada sin entregar */}
        {!submission && activity.status === "closed" && (
          <div className="flex items-center gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
            <Lock className="size-4 shrink-0" aria-hidden />
            La actividad cerró y no llegaste a entregar. Si creés que es un error, escribile al equipo docente.
          </div>
        )}

        {/* Consigna */}
        {activity.instructions_md && (
          <Card>
            <CardHeader>
              <CardTitle eyebrow="Consigna">Qué hay que hacer</CardTitle>
            </CardHeader>
            <Markdown size="sm">{activity.instructions_md}</Markdown>
          </Card>
        )}

        {/* Texto de la lectura / material de apoyo */}
        {text?.body_md && (
          <Card>
            <CardHeader>
              <CardTitle eyebrow={activity.type === "lectura" ? "Lectura" : "Material de apoyo"}>
                {activity.type === "lectura" ? "Texto para leer" : "Para tener a mano"}
              </CardTitle>
            </CardHeader>
            <Markdown>{text.body_md}</Markdown>
          </Card>
        )}

        {/* Materiales vinculados */}
        {materials.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle eyebrow="Materiales">Archivos y enlaces</CardTitle>
            </CardHeader>
            <ul className="flex flex-col gap-1.5">
              {materials.map((m) => (
                <li key={m.id}>
                  {m.href ? (
                    <a
                      href={m.href}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-sm transition-colors hover:border-accent/60"
                    >
                      {m.url ? (
                        <Link2 className="size-4 shrink-0 text-accent-2" aria-hidden />
                      ) : (
                        <FileDown className="size-4 shrink-0 text-accent-2" aria-hidden />
                      )}
                      <span className="min-w-0 flex-1 truncate">{m.title}</span>
                      <Badge size="sm">{m.kind}</Badge>
                    </a>
                  ) : (
                    <p className="flex items-center gap-3 rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-sm text-muted">
                      <FileDown className="size-4 shrink-0" aria-hidden />
                      {m.title} — no disponible ahora
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* Lo que entregaste (vista posterior a la entrega) */}
        {submitted && submission && (
          <Card>
            <CardHeader>
              <CardTitle eyebrow="Tu entrega">Lo que respondiste</CardTitle>
            </CardHeader>
            <AnswersView activity={activity} submission={submission} fileUrl={essayFileUrl} revealAnswers />
          </Card>
        )}

        {/* Realizar / editar */}
        {canEdit && (
          <ActivityRunner
            activityId={activity.id}
            type={activity.type}
            studentId={user.id}
            maxScore={maxScore}
            quizQuestions={quiz?.questions.map((q) => ({ id: q.id, prompt: q.prompt, options: q.options })) ?? null}
            allowFileUpload={activity.type === "entrega" ? Boolean(text?.allow_file_upload) : false}
            initialAnswers={submission?.answers ?? null}
            initialTimeSpent={submission?.time_spent_seconds ?? 0}
            initialStatus={submission?.status ?? null}
            reopened={submission?.status === "reabierta"}
          />
        )}
      </div>
    </>
  );
}
