import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bell, CalendarDays, Check, Clock, Feather, Gamepad2, NotebookText, Paperclip, UserRound } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, Button, Card, CardDescription, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import { Reveal } from "@/components/shell/reveal";
import { Markdown } from "@/components/markdown";
import { CheckinCard } from "@/components/checkin/checkin-card";
import { MaterialsList } from "@/components/class-content/materials-list";
import { RecordingBlock } from "@/components/class-content/recording-block";
import { formatDate, formatDateLong, formatRelative } from "@/lib/format";
import { getClassDetail } from "../_lib/data";
import { ClassOpenedTracker } from "./_components/class-opened-tracker";

export async function generateMetadata({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("classes").select("topic").eq("id", classId).maybeSingle();
  return { title: data?.topic ? `${data.topic} · EnsenIA UNT` : "Clase · EnsenIA UNT" };
}

const STATE_BADGE = {
  hoy: { label: "Hoy", tone: "accent-2", live: true },
  proxima: { label: "Próxima", tone: "accent", live: false },
  futura: { label: "Próxima", tone: "accent", live: false },
  pasada: { label: "Pasada", tone: "muted", live: false },
} as const;

/**
 * Alberdi es IA: va en violeta (accent-3) como contorno, no relleno, porque el
 * violeta claro del tema "tinta" no sostiene AA con texto blanco encima.
 */
const ALBERDI_BUTTON = "border-accent-3/50 text-accent-3 hover:border-accent-3 hover:bg-accent-3/10";

export default async function ClassDetailPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  // El docente y el admin también pueden entrar: es la única forma honesta de
  // comprobar qué le quedó publicado al estudiante. Sus datos personales
  // (check-in, progreso) simplemente no existen y la página lo tolera.
  const { user, profile } = await requireRole("estudiante", "docente", "admin");
  const esVistaDocente = profile.role !== "estudiante";
  const supabase = await createClient();
  const cls = await getClassDetail(supabase, user.id, classId);
  if (!cls) notFound();

  const badge = STATE_BADGE[cls.state];
  const hasRecordings = cls.recordings.length > 0;
  const isPast = cls.state === "pasada";
  // No todas las clases se graban: cuando hay apunte, ESE es el contenido de la
  // clase y se muestra como tal, no como un premio consuelo.
  const hasNote = cls.note != null;
  const alberdiHref = `/campus/estudiante/alberdi?classId=${cls.id}`;

  return (
    <>
      {!esVistaDocente && <ClassOpenedTracker classId={cls.id} recordingIds={cls.recordings.map((r) => r.id)} />}

      {esVistaDocente && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-accent/35 bg-accent/10 px-4 py-2">
          <p className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
            <Badge size="sm" tone="accent">
              Vista de estudiante
            </Badge>
            <span className="text-muted">Así ve esta clase un estudiante de la comisión.</span>
          </p>
          <Button asChild variant="ghost" size="sm" className="-mr-2 text-accent hover:text-accent-deep">
            <Link href={`/campus/docente/clases/${cls.id}`}>
              <ArrowLeft className="size-4" aria-hidden />
              Volver a la vista docente
            </Link>
          </Button>
        </div>
      )}

      <PageHeader
        top={
          <Link
            href="/campus/estudiante/clases"
            className="-ml-1 inline-flex min-h-10 items-center gap-1.5 rounded-md px-1 text-sm text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Cronograma
          </Link>
        }
        eyebrow={
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate">{cls.course_name}</span>
            <Badge size="sm" tone={badge.tone} dot={badge.live} live={badge.live}>
              {badge.label}
            </Badge>
          </span>
        }
        title={cls.topic}
        description={
          <span className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4 shrink-0 text-accent-2" aria-hidden />
              <span className="capitalize">{formatDateLong(cls.class_date)}</span>
              <span className="font-mono text-xs tabular-nums">({formatDate(cls.class_date)})</span>
            </span>
            {cls.teacher && (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <UserRound className="size-4 shrink-0 text-accent" aria-hidden />
                <span className="truncate">{cls.teacher.full_name}</span>
                {cls.teacher.position && <span className="text-xs text-muted/80">· {cls.teacher.position}</span>}
              </span>
            )}
          </span>
        }
        actions={
          <Button asChild variant="outline" className={ALBERDI_BUTTON}>
            <Link href={alberdiHref}>
              <Feather className="size-4" aria-hidden />
              Preguntarle a Alberdi
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-12 lg:gap-6">
        {/* Columna principal */}
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-8">
          {cls.summary && (
            <Reveal>
              <Card>
                <CardTitle eyebrow="Resumen del cronograma" as="h2">
                  De qué trata la clase
                </CardTitle>
                <div className="mt-2">
                  <Markdown size="sm">{cls.summary}</Markdown>
                </div>
              </Card>
            </Reveal>
          )}

          {cls.note && (
            <Reveal delay={0.03}>
              {/* Sin grabación, el apunte ES la clase: tarjeta protagonista con pleca carmesí. */}
              <Card highlight={!hasRecordings}>
                <CardTitle eyebrow={hasRecordings ? "Apunte de la clase" : "Esta clase no se grabó"} as="h2" className="flex items-center gap-2">
                  <NotebookText className="size-4 shrink-0 text-accent" aria-hidden />
                  {hasRecordings ? "Notas del equipo docente" : "Lo que se dio en clase"}
                </CardTitle>
                <CardDescription className="mt-1">
                  {hasRecordings
                    ? "Notas que el equipo docente sumó a la grabación."
                    : "El equipo docente dejó el apunte con el contenido de la clase. Cuenta igual: podés jugar sobre esta clase y preguntarle a Alberdi."}
                </CardDescription>
                <div className="mt-3">
                  <Markdown size="sm">{cls.note.body_md}</Markdown>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                  <Button asChild variant="secondary">
                    <Link href={`/campus/estudiante/juegos?clase=${cls.id}`}>
                      <Gamepad2 className="size-4" aria-hidden />
                      Jugar con esta clase
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className={ALBERDI_BUTTON}>
                    <Link href={alberdiHref}>
                      <Feather className="size-4" aria-hidden />
                      Preguntarle a Alberdi
                    </Link>
                  </Button>
                </div>
              </Card>
            </Reveal>
          )}

          {hasRecordings ? (
            cls.recordings.map((rec, i) => (
              <Reveal key={rec.id} delay={0.05 * (i + 1)}>
                <RecordingBlock recording={rec} classId={cls.id} ordinal={cls.recordings.length > 1 ? i + 1 : undefined} />
              </Reveal>
            ))
          ) : hasNote ? null : (
            <Reveal delay={0.05}>
              <EmptyState
                icon={Clock}
                tone={isPast ? "accent" : "accent-2"}
                title={isPast ? "Esta clase todavía no tiene contenido cargado" : "El contenido llega después de la clase"}
                description={
                  isPast
                    ? "No todas las clases se graban. Cuando el equipo docente suba la grabación o deje el apunte, aparece acá. Mientras tanto tenés los materiales, los avisos y a Alberdi."
                    : "Después de la clase, el equipo docente sube la grabación o deja el apunte. Te avisamos en Hoy cuando esté."
                }
                action={
                  <Button asChild variant="outline" className={ALBERDI_BUTTON}>
                    <Link href={alberdiHref}>
                      <Feather className="size-4" aria-hidden />
                      Preguntale a Alberdi
                    </Link>
                  </Button>
                }
              />
            </Reveal>
          )}
        </div>

        {/* Columna lateral */}
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-4">
          {isPast || cls.state === "hoy" ? (
            cls.checkin ? (
              <Reveal delay={0.08}>
                <Card padding="sm" role="status">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-success/30 bg-success/12 text-success">
                      <Check className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="font-display text-sm font-semibold">Check-in registrado</p>
                      <p className="text-xs text-muted">
                        Dificultad <span className="font-mono tabular-nums">{cls.checkin.difficulty}/5</span> ·{" "}
                        {formatRelative(cls.checkin.created_at)}
                      </p>
                    </div>
                  </div>
                </Card>
              </Reveal>
            ) : !esVistaDocente ? (
              <Reveal delay={0.08}>
                <CheckinCard classId={cls.id} classTopic={cls.topic} studentId={user.id} />
              </Reveal>
            ) : null
          ) : null}

          <Reveal delay={0.12}>
            <Card>
              <CardTitle eyebrow="Materiales" as="h2" className="flex items-center gap-2">
                <Paperclip className="size-4 shrink-0 text-accent" aria-hidden />
                Bibliografía y enlaces
              </CardTitle>
              <div className="mt-3">
                <MaterialsList materials={cls.materials} />
              </div>
            </Card>
          </Reveal>

          <Reveal delay={0.16}>
            <Card>
              <CardTitle eyebrow="Avisos de esta clase" as="h2" className="flex items-center gap-2">
                <Bell className="size-4 shrink-0 text-accent" aria-hidden />
                Avisos
              </CardTitle>
              {cls.announcements.length === 0 ? (
                <CardDescription className="mt-2">No hay avisos específicos para esta clase.</CardDescription>
              ) : (
                <ul className="mt-3 flex flex-col gap-3" aria-label="Avisos">
                  {cls.announcements.map((a) => (
                    /* Cada aviso abre con la pleca: es la voz del equipo docente. */
                    <li key={a.id} className="pleca rounded-r-xl bg-surface-2/50 py-3 pr-3">
                      <p className="font-display text-sm font-semibold leading-snug">{a.title}</p>
                      <div className="mt-1">
                        <Markdown size="sm">{a.body}</Markdown>
                      </div>
                      <p className="mt-2 text-[11px] text-muted">{formatRelative(a.created_at)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </Reveal>
        </div>
      </div>
    </>
  );
}
