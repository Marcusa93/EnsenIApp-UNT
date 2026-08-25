import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BookOpenCheck,
  CalendarDays,
  ClipboardList,
  Gauge,
  Layers,
  MessageCircleQuestion,
  Sparkles,
} from "lucide-react";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, formatDuration, formatPercent, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/markdown";
import { Avatar, Badge, Card, CardDescription, CardHeader, CardTitle, EmptyState, PageHeader, Progress, Stat } from "@/components/ui";
import { RevealGroup, RevealItem } from "@/components/shell";
import { getActiveCourse } from "@/components/docente/active-course";
import { StudentStatusBadge } from "../_components/status-badge";
import { StatusActions } from "../_components/status-actions";
import { getStudentDetail } from "./_components/student-detail-data";
import { StudentReportButton } from "./_components/report-button";
import { Timeline } from "./_components/timeline";

export const metadata: Metadata = { title: "Ficha de estudiante · EnsenIA UNT" };

const ALERT_LABEL: Record<string, string> = {
  dificultad_reiterada: "Dificultad reiterada",
  bajo_desempeno: "Bajo desempeño",
  inactividad: "Inactividad",
  consulta_sin_responder: "Consulta sin responder",
};

const SUBMISSION_LABEL: Record<string, string> = {
  en_progreso: "En progreso",
  entregada: "Entregada",
  corregida: "Corregida",
  reabierta: "Reabierta",
};

const QUESTION_LABEL: Record<string, string> = {
  abierta: "Abierta",
  respondida_ia: "Respondida por IA",
  respondida_docente: "Respondida por docente",
  cerrada: "Cerrada",
};

function difficultyTone(d: number) {
  if (d >= 4) return "text-accent-3";
  if (d >= 3) return "text-warning";
  return "text-success";
}

export default async function EstudianteDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ course?: string }>;
}) {
  const [{ studentId }, sp] = await Promise.all([params, searchParams]);
  if (!z.guid().safeParse(studentId).success) notFound();
  const { user, profile } = await requireRole("docente", "admin");
  const supabase = await createClient();
  const { course } = await getActiveCourse(supabase, user.id, profile.role, sp.course);
  if (!course) notFound();

  const detail = await getStudentDetail(supabase, course.id, studentId);
  if (!detail) notFound();
  const { profile: s, stats } = detail;
  const openAlerts = detail.alerts.filter((a) => !a.resolved);

  return (
    <>
      <Link
        href="/campus/docente/estudiantes"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Volver a estudiantes
      </Link>

      <PageHeader
        eyebrow={`Ficha · ${course.name} · ${course.term}`}
        title={
          <span className="flex items-center gap-4">
            <Avatar name={s.full_name} size="lg" />
            <span>{s.full_name}</span>
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{s.email}</span>
            {s.dni && <span className="font-mono text-xs">DNI {s.dni}</span>}
            <span className="text-xs">
              Inscripto {formatRelative(s.enrolled_at)} · {s.last_seen_at ? `último acceso ${formatRelative(s.last_seen_at)}` : "sin accesos"}
            </span>
          </span>
        }
        top={
          <div className="flex flex-wrap items-center gap-2">
            <StudentStatusBadge status={s.status} size="md" />
            <Badge tone={s.in_roster ? "accent-2" : "warning"}>{s.in_roster ? "En el padrón" : "Fuera del padrón"}</Badge>
            {openAlerts.length > 0 && (
              <Badge tone="danger" dot>
                {openAlerts.length} {openAlerts.length === 1 ? "alerta abierta" : "alertas abiertas"}
              </Badge>
            )}
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusActions courseId={course.id} studentId={s.id} status={s.status} size="md" />
            <StudentReportButton courseId={course.id} studentId={s.id} />
          </div>
        }
      />

      <RevealGroup className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" stagger={0.05}>
        <RevealItem>
          <Stat
            label="Actividad · 30 días"
            value={stats.events_30d}
            icon={<Activity />}
            tone="accent-2"
            hint={`${stats.active_days_30d} ${stats.active_days_30d === 1 ? "día activo" : "días activos"}`}
          />
        </RevealItem>
        <RevealItem>
          <Stat
            label="Clases abiertas"
            value={`${stats.classes_opened}/${detail.classes.length}`}
            icon={<CalendarDays />}
            hint={stats.cards_known_ratio == null ? "Sin placas vistas" : `${formatPercent(stats.cards_known_ratio)} de placas conocidas`}
          />
        </RevealItem>
        <RevealItem>
          <Stat
            label="Entregas"
            value={stats.submitted}
            icon={<ClipboardList />}
            tone="accent"
            hint={stats.avg_score_ratio == null ? "Sin puntajes" : `Promedio ${formatPercent(stats.avg_score_ratio)}`}
          />
        </RevealItem>
        <RevealItem>
          <Stat
            label="Dificultad promedio"
            value={stats.avg_difficulty == null ? "—" : stats.avg_difficulty.toFixed(1)}
            icon={<Gauge />}
            tone={stats.avg_difficulty != null && stats.avg_difficulty >= 3.5 ? "accent-3" : "muted"}
            hint="Check-ins, escala 1–5"
          />
        </RevealItem>
      </RevealGroup>

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* Cursada */}
          <Card>
            <CardHeader>
              <CardTitle eyebrow="Cursada">Clases y placas</CardTitle>
              <CardDescription>Qué clases abrió, cómo le fue con las placas de cada grabación y qué dijo en el check-in.</CardDescription>
            </CardHeader>
            {detail.classes.length === 0 ? (
              <EmptyState compact tone="muted" icon={CalendarDays} title="El curso no tiene clases cargadas" />
            ) : (
              <ol className="divide-y divide-border">
                {detail.classes.map((c) => (
                  <li key={c.id} className="flex flex-col gap-2 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link href={`/campus/docente/clases/${c.id}`} className="font-medium hover:text-accent-2">
                          {c.topic}
                        </Link>
                        <p className="font-mono text-[11px] uppercase tracking-widest text-muted">
                          {formatDate(c.class_date)} · {c.opened ? `abierta ${formatRelative(c.opened_at)}` : "no abierta"}
                        </p>
                      </div>
                      {c.checkin ? (
                        <span className={cn("font-mono text-sm", difficultyTone(c.checkin.difficulty))} title="Dificultad reportada">
                          {c.checkin.difficulty}/5
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] uppercase tracking-widest text-muted">sin check-in</span>
                      )}
                    </div>
                    {c.checkin?.comment && (
                      <blockquote className="border-l-2 border-accent-3/60 pl-3 text-sm text-foreground/90">“{c.checkin.comment}”</blockquote>
                    )}
                    {c.recordings.map((r) => (
                      <div key={r.id} className="flex items-center gap-3 text-xs">
                        <Layers className="size-3.5 shrink-0 text-accent-2" aria-hidden />
                        <span className="min-w-0 flex-1 truncate text-muted">{r.title ?? "Grabación"}</span>
                        {r.cards_total > 0 ? (
                          <div className="w-40">
                            <Progress
                              value={r.cards_total ? (r.cards_known / r.cards_total) * 100 : 0}
                              size="sm"
                              tone="accent-2"
                              label={`${r.cards_known}/${r.cards_total} conocidas`}
                            />
                          </div>
                        ) : (
                          <span className="text-muted">sin placas</span>
                        )}
                      </div>
                    ))}
                  </li>
                ))}
              </ol>
            )}
          </Card>

          {/* Actividades */}
          <Card>
            <CardHeader>
              <CardTitle eyebrow="Actividades">Entregas y puntajes</CardTitle>
            </CardHeader>
            {detail.submissions.length === 0 ? (
              <EmptyState compact tone="muted" icon={ClipboardList} title="Todavía no empezó ninguna actividad" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="text-left font-mono text-[10px] uppercase tracking-widest text-muted">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Actividad</th>
                      <th className="py-2 pr-3 font-medium">Estado</th>
                      <th className="py-2 pr-3 text-right font-medium">Puntaje</th>
                      <th className="py-2 pr-3 text-right font-medium">Tiempo</th>
                      <th className="py-2 text-right font-medium">Entrega</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {detail.submissions.map((sub) => {
                      const v = sub.score ?? sub.auto_score;
                      const low = v != null && v <= sub.max_score * 0.4;
                      return (
                        <tr key={sub.id}>
                          <td className="py-2 pr-3">
                            <Link href={`/campus/docente/actividades/${sub.activity_id}`} className="font-medium hover:text-accent-2">
                              {sub.title}
                            </Link>
                            <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-muted">{sub.type}</span>
                          </td>
                          <td className="py-2 pr-3 text-muted">{SUBMISSION_LABEL[sub.status] ?? sub.status}</td>
                          <td className={cn("py-2 pr-3 text-right font-mono", low && "text-accent-3")}>
                            {v == null ? "—" : `${Number(v).toFixed(1)}/${sub.max_score}`}
                          </td>
                          <td className="py-2 pr-3 text-right font-mono text-muted">{formatDuration(sub.time_spent_seconds)}</td>
                          <td className="py-2 text-right text-muted">{sub.submitted_at ? formatDateTime(sub.submitted_at) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Consultas */}
          <Card>
            <CardHeader>
              <CardTitle eyebrow="Voz del estudiante">Consultas</CardTitle>
            </CardHeader>
            {detail.questions.length === 0 ? (
              <EmptyState compact tone="muted" icon={MessageCircleQuestion} title="No hizo consultas todavía" />
            ) : (
              <ul className="divide-y divide-border">
                {detail.questions.map((q) => (
                  <li key={q.id} className="py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={q.status === "abierta" ? "warning" : q.status === "respondida_docente" ? "success" : "muted"} size="sm">
                        {QUESTION_LABEL[q.status] ?? q.status}
                      </Badge>
                      {q.is_anonymous && (
                        <Badge tone="muted" size="sm">
                          Anónima
                        </Badge>
                      )}
                      {q.class_topic && <span className="text-xs text-muted">{q.class_topic}</span>}
                      <time dateTime={q.created_at} className="ml-auto font-mono text-[11px] text-muted">
                        {formatDateTime(q.created_at)}
                      </time>
                    </div>
                    <p className="mt-1.5 text-sm">{q.question}</p>
                    {q.teacher_answer_md && (
                      <div className="mt-2 rounded-xl border border-success/30 bg-success/5 p-3">
                        <Markdown size="sm">{q.teacher_answer_md}</Markdown>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {/* Alertas */}
          <Card className={cn(openAlerts.length > 0 && "border-accent-3/40")}>
            <CardHeader>
              <CardTitle eyebrow="Seguimiento">Alertas</CardTitle>
            </CardHeader>
            {detail.alerts.length === 0 ? (
              <EmptyState compact tone="muted" icon={AlertTriangle} title="Sin alertas" description="No se dispararon alertas automáticas para este estudiante." />
            ) : (
              <ul className="flex flex-col gap-2">
                {detail.alerts.map((a) => (
                  <li
                    key={a.id}
                    className={cn(
                      "rounded-xl border px-3 py-2.5",
                      a.resolved ? "border-border opacity-70" : "border-accent-3/40 bg-accent-3/5",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-accent-3">{ALERT_LABEL[a.kind] ?? a.kind}</span>
                      <span className="font-mono text-[11px] text-muted">{formatRelative(a.created_at)}</span>
                    </div>
                    <p className="mt-1 text-sm">{a.message}</p>
                    {a.resolved && <p className="mt-1 text-[11px] text-muted">Resuelta</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Feedback IA */}
          <Card>
            <CardHeader>
              <CardTitle eyebrow="IA">Devoluciones recibidas</CardTitle>
              <CardDescription>Feedback personalizado que el estudiante generó desde “Mi progreso”.</CardDescription>
            </CardHeader>
            {detail.feedbacks.length === 0 ? (
              <EmptyState compact tone="muted" icon={Sparkles} title="Todavía no generó devoluciones" />
            ) : (
              <ul className="flex flex-col gap-3">
                {detail.feedbacks.map((f) => (
                  <li key={f.id} className="rounded-xl border border-border p-3">
                    <div className="mb-2 flex items-center justify-between gap-2 font-mono text-[11px] uppercase tracking-widest text-muted">
                      <span className="truncate">{f.recording_title ?? "General"}</span>
                      <span>{formatDate(f.created_at)}</span>
                    </div>
                    <details>
                      <summary className="cursor-pointer text-sm text-accent-2">Ver devolución</summary>
                      <div className="mt-2">
                        <Markdown size="sm">{f.feedback_md}</Markdown>
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle eyebrow="Telemetría">Línea de tiempo</CardTitle>
            </CardHeader>
            <Timeline events={detail.timeline} truncated={detail.timelineTruncated} />
          </Card>

          <p className="flex items-center gap-2 text-xs text-muted">
            <BookOpenCheck className="size-3.5" aria-hidden />
            Los datos se muestran sólo al equipo docente del curso.
          </p>
        </div>
      </div>
    </>
  );
}
