import Link from "next/link";
import type { Metadata } from "next";
import {
  Activity,
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  CalendarPlus,
  ClipboardCheck,
  Gauge,
  MessageCircleQuestion,
  Radio,
  Users,
} from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatRelative } from "@/lib/format";
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  Progress,
  Stat,
} from "@/components/ui";
import { RevealGroup, RevealItem } from "@/components/shell";
import { CourseSwitcher } from "@/components/docente/course-switcher";
import { getActiveCourse } from "@/components/docente/active-course";
import { RecordingStatusBadge } from "@/components/docente/recording-status-badge";
import { getDashboardData, USAGE_DAYS } from "./_components/dashboard-data";
import { AlertsPanel } from "./_components/alerts-panel";
import { UsageChart } from "./_components/usage-chart";
import { DifficultyChart } from "./_components/difficulty-chart";

export const metadata: Metadata = { title: "Panel docente · EnsenIA UNT" };

const STEP_LABEL: Record<string, string> = {
  transcribe: "Transcribiendo audio",
  compile: "Compilando transcripción",
  summary: "Generando resumen",
  cards: "Generando placas",
  simplified_facil: "Versión simple (fácil)",
  simplified_intermedio: "Versión simple (intermedia)",
};

export default async function DocentePanelPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string }>;
}) {
  const { user, profile } = await requireRole("docente", "admin");
  const supabase = await createClient();
  const { course: c } = await searchParams;
  const { course, courses } = await getActiveCourse(supabase, user.id, profile.role, c);

  if (!course) {
    return (
      <>
        <PageHeader eyebrow="Docente · Panel" title="Centro de comando" />
        <EmptyState
          icon={Users}
          title="Todavía no tenés cursos asignados"
          description="Un administrador tiene que asignarte a un curso desde Administración para que puedas ver el panel."
        />
      </>
    );
  }

  const data = await getDashboardData(supabase, course.id);
  const eng = data.engagement;
  const enrolled = eng?.enrolled ?? 0;
  const active7d = eng?.active_7d ?? 0;
  const activeRatio = enrolled > 0 ? Math.round((active7d / enrolled) * 100) : null;
  const avgDifficulty = eng?.avg_difficulty;
  const hasUsage = data.usageByDay.some((d) => d.events > 0);

  return (
    <>
      <PageHeader
        eyebrow={`Docente · ${course.subject?.name ?? "Panel"}`}
        title="Centro de comando"
        description={`${course.name} · ${course.term}. Datos vivos del curso: actividad, alertas, clases y pipeline de grabaciones.`}
        actions={
          <>
            <CourseSwitcher courses={courses} activeCourseId={course.id} />
            <Button asChild variant="secondary" leftIcon={<CalendarPlus />}>
              <Link href="/campus/docente/clases">Cronograma</Link>
            </Button>
          </>
        }
      />

      <RevealGroup className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" stagger={0.05}>
        <RevealItem>
          <Stat label="Inscriptos" value={enrolled} icon={<Users />} hint="Con inscripción activa" />
        </RevealItem>
        <RevealItem>
          <Stat
            label="Activos · 7 días"
            value={active7d}
            icon={<Activity />}
            tone="accent-2"
            delta={activeRatio === null ? undefined : `${activeRatio} % del curso`}
            hint="Estudiantes con al menos un evento"
          />
        </RevealItem>
        <RevealItem>
          <Stat
            label="Consultas abiertas"
            value={eng?.questions_open ?? 0}
            icon={<MessageCircleQuestion />}
            tone="accent-3"
            hint={`${eng?.questions_total ?? 0} en total`}
          />
        </RevealItem>
        <RevealItem>
          <Stat
            label="Dificultad promedio"
            value={avgDifficulty == null ? "—" : Number(avgDifficulty).toFixed(1)}
            icon={<Gauge />}
            tone={avgDifficulty != null && Number(avgDifficulty) >= 3.5 ? "accent-3" : "accent"}
            hint="Escala 1–5 en check-ins"
          />
        </RevealItem>
        <RevealItem>
          <Stat
            label="Sin corregir"
            value={data.pendingGradingTotal}
            icon={<ClipboardCheck />}
            tone={data.pendingGradingTotal > 0 ? "accent-3" : "muted"}
            hint={
              data.pendingGradingTotal === 0
                ? "Estás al día"
                : `En ${data.pendingGrading.length} ${data.pendingGrading.length === 1 ? "actividad" : "actividades"}`
            }
          />
        </RevealItem>
      </RevealGroup>

      {data.pendingGrading.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle eyebrow="Para corregir">Entregas esperando devolución</CardTitle>
            <CardDescription>
              Son las que necesitan tu lectura: los cuestionarios ya se corrigen solos.
            </CardDescription>
          </CardHeader>
          <ul className="flex flex-col gap-2">
            {data.pendingGrading.map((a) => (
              <li key={a.activityId}>
                <Link
                  href={`/campus/docente/actividades/${a.activityId}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-surface-2/50 px-3.5 py-3 transition hover:border-accent/45 hover:bg-surface-2"
                >
                  <Badge tone="accent-3" size="sm">
                    {a.pendientes}
                  </Badge>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{a.title}</span>
                    {a.dueAt && (
                      <span className="block font-mono text-[10px] uppercase tracking-widest text-muted">
                        Venció {formatRelative(a.dueAt)}
                      </span>
                    )}
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="flex min-w-0 flex-col gap-4">
          <AlertsPanel courseId={course.id} initialAlerts={data.alerts} />

          <Card>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div>
                <CardTitle eyebrow="Telemetría">Uso por día</CardTitle>
                <CardDescription>
                  Eventos de los inscriptos en los últimos {USAGE_DAYS} días y estudiantes activos por jornada.
                </CardDescription>
              </div>
              <div className="hidden shrink-0 items-center gap-3 font-mono text-[11px] uppercase tracking-widest text-muted sm:flex">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-sm bg-accent" aria-hidden /> Eventos
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-accent-2" aria-hidden /> Activos
                </span>
              </div>
            </CardHeader>
            {hasUsage ? (
              <UsageChart data={data.usageByDay} />
            ) : (
              <EmptyState
                compact
                tone="muted"
                icon={Activity}
                title="Sin actividad registrada"
                description="Cuando los estudiantes empiecen a usar el campus vas a ver la curva de uso acá."
              />
            )}
            {data.usageTruncated && (
              <p className="mt-2 text-xs text-muted">Se muestran los primeros 20 000 eventos del período.</p>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle eyebrow="Voz del estudiante">Dificultad por clase</CardTitle>
              <CardDescription>Promedio de los check-ins (1 = muy fácil, 5 = muy difícil).</CardDescription>
            </CardHeader>
            {data.difficultyByClass.length > 0 ? (
              <>
                <DifficultyChart data={data.difficultyByClass} />
                <ol className="mt-3 grid gap-1 text-xs text-muted sm:grid-cols-2">
                  {data.difficultyByClass.map((d, i) => (
                    <li key={d.class_id} className="flex items-baseline gap-2 truncate">
                      <span className="font-mono text-accent">C{i + 1}</span>
                      <Link href={`/campus/docente/clases/${d.class_id}`} className="truncate hover:text-foreground">
                        {d.topic}
                      </Link>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <EmptyState
                compact
                tone="muted"
                icon={Gauge}
                title="Todavía no hay check-ins"
                description="Los estudiantes marcan qué tan difícil les resultó cada clase; acá vas a ver el promedio."
              />
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div>
                <CardTitle eyebrow="Pipeline IA">Grabaciones en proceso</CardTitle>
                <CardDescription>Transcripción y generación de contenidos en curso.</CardDescription>
              </div>
              <Badge tone={data.recordingsInProgress.length ? "accent" : "muted"} dot live={data.recordingsInProgress.length > 0}>
                {data.recordingsInProgress.length}
              </Badge>
            </CardHeader>
            {data.recordingsInProgress.length === 0 ? (
              <EmptyState
                compact
                tone="muted"
                icon={Radio}
                title="Nada en proceso"
                description="Subí una grabación desde la página de una clase para procesarla con IA."
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {data.recordingsInProgress.map((r) => (
                  <li key={r.id} className="rounded-xl border border-border bg-surface-2/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        href={`/campus/docente/clases/${r.class_id}`}
                        className="min-w-0 truncate text-sm font-medium hover:text-accent"
                      >
                        {r.title ?? r.class_topic}
                      </Link>
                      <RecordingStatusBadge status={r.status} />
                    </div>
                    {r.status === "error" ? (
                      <p className="mt-1.5 text-xs text-danger">Falló el procesamiento. Reintentá desde la clase.</p>
                    ) : (
                      <Progress
                        className="mt-2"
                        size="sm"
                        value={r.progress}
                        showValue
                        label={r.current_step ? (STEP_LABEL[r.current_step] ?? r.current_step) : "En cola"}
                        tone="accent-2"
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div>
                <CardTitle eyebrow="Cronograma">Próximas clases</CardTitle>
                <CardDescription>Con el estado de su grabación.</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm" rightIcon={<ArrowRight />}>
                <Link href="/campus/docente/clases">Ver todas</Link>
              </Button>
            </CardHeader>
            {data.upcomingClasses.length === 0 ? (
              <EmptyState
                compact
                tone="muted"
                icon={CalendarDays}
                title="No hay clases próximas"
                description="Cargá el cronograma para que estudiantes y docentes vean qué viene."
                action={
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/campus/docente/clases">Cargar clases</Link>
                  </Button>
                }
              />
            ) : (
              <ol className="flex flex-col divide-y divide-border">
                {data.upcomingClasses.map((cls) => (
                  <li key={cls.id}>
                    <Link
                      href={`/campus/docente/clases/${cls.id}`}
                      className="group flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                    >
                      <span className="w-16 shrink-0 font-mono text-[11px] uppercase tracking-widest text-muted">
                        {formatDate(cls.class_date)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium group-hover:text-accent">
                        {cls.topic}
                      </span>
                      <RecordingStatusBadge status={cls.recording?.status} published={cls.recording?.published} />
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div>
                <CardTitle eyebrow="Consultas">Abiertas recientes</CardTitle>
                <CardDescription>Esperan una respuesta docente.</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm" rightIcon={<ArrowRight />}>
                <Link href="/campus/docente/consultas">Responder</Link>
              </Button>
            </CardHeader>
            {data.openQuestions.length === 0 ? (
              <EmptyState
                compact
                tone="accent-2"
                icon={BookOpenCheck}
                title="Sin consultas pendientes"
                description="Todas las consultas de los estudiantes tienen respuesta."
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {data.openQuestions.map((q) => (
                  <li key={q.id} className="rounded-xl border border-border bg-surface-2/60 p-3">
                    <p className="line-clamp-2 text-sm leading-snug">{q.question}</p>
                    <p className="mt-1.5 flex items-center gap-2 font-mono text-[11px] text-muted">
                      <span className="truncate">{q.student_name ?? "Anónimo"}</span>
                      <span aria-hidden>·</span>
                      <span>{formatRelative(q.created_at)}</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
