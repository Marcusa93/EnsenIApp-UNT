import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, BarChart3, ClipboardPlus, Radio, Swords } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCourseById } from "@/lib/courses";
import { formatDateLong } from "@/lib/format";
import { Badge, Button, Card, CardDescription, CardHeader, CardTitle, PageHeader } from "@/components/ui";
import { Reveal } from "@/components/shell";
import { getTeacherClassDetail, getTeachingStaff } from "@/components/docente/class-data";
import { RecordingsPanel } from "@/components/recordings/recordings-panel";
import { ClassHeaderActions } from "./_components/class-header-actions";
import { AnnouncementsPanel } from "./_components/announcements-panel";
import { MaterialsPanel } from "./_components/materials-panel";
import { StudentVoice } from "./_components/student-voice";

export const metadata: Metadata = { title: "Clase · EnsenIA UNT" };

const STATE: Record<"pasada" | "hoy" | "proxima" | "futura", { label: string; tone: "muted" | "accent-3" | "accent" }> = {
  pasada: { label: "Dictada", tone: "muted" },
  hoy: { label: "Hoy", tone: "accent-3" },
  proxima: { label: "Próxima", tone: "accent" },
  futura: { label: "Programada", tone: "accent" },
};

export default async function DocenteClasePage({ params }: { params: Promise<{ classId: string }> }) {
  await requireRole("docente", "admin");
  const { classId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(classId)) notFound();

  const supabase = await createClient();
  const cls = await getTeacherClassDetail(supabase, classId);
  if (!cls) notFound();

  const [course, staff] = await Promise.all([getCourseById(supabase, cls.course_id), getTeachingStaff(supabase)]);
  const state = STATE[cls.state];

  return (
    <>
      <PageHeader
        top={
          <Link
            href="/campus/docente/clases"
            className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden /> Cronograma
          </Link>
        }
        eyebrow={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span>{course?.name ?? "Curso"}</span>
            <Badge tone={state.tone} size="sm" dot={cls.state === "hoy"} live={cls.state === "hoy"}>
              {state.label}
            </Badge>
          </span>
        }
        title={cls.topic}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="capitalize">{formatDateLong(cls.class_date)}</span>
            <span aria-hidden>·</span>
            <span>{cls.teacher_name ? `A cargo de ${cls.teacher_name}` : "Sin docente asignado"}</span>
          </span>
        }
        actions={
          <ClassHeaderActions
            courseId={cls.course_id}
            staff={staff}
            values={{
              id: cls.id,
              class_date: cls.class_date,
              topic: cls.topic,
              teacher_id: cls.teacher_id,
              teacher_name: cls.teacher_name,
              summary: cls.summary,
              sort_order: cls.sort_order,
            }}
          />
        }
      />

      {cls.summary && (
        <Reveal inView={false} className="mb-6">
          <Card padding="sm" className="bg-surface-2/40">
            <p className="eyebrow mb-1">Resumen de la clase</p>
            <p className="whitespace-pre-line text-sm leading-relaxed">{cls.summary}</p>
          </Card>
        </Reveal>
      )}

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="flex min-w-0 flex-col gap-4">
          <Reveal inView={false} delay={0.05}>
            <RecordingsPanel classId={cls.id} courseId={cls.course_id} />
          </Reveal>

          <Reveal inView={false} delay={0.1}>
            <Card highlight>
              <CardHeader>
                <CardTitle eyebrow="Desde esta clase">Crear con un clic</CardTitle>
                <CardDescription>Generá actividades, debates o encuestas vinculadas a esta clase.</CardDescription>
              </CardHeader>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <Button asChild variant="secondary" leftIcon={<ClipboardPlus />}>
                  <Link href={`/campus/docente/actividades/nueva?classId=${cls.id}`}>Actividad</Link>
                </Button>
                <Button asChild variant="secondary" leftIcon={<Swords />}>
                  <Link href={`/campus/debates/nuevo?classId=${cls.id}`}>Debate</Link>
                </Button>
                <Button asChild variant="secondary" leftIcon={<BarChart3 />}>
                  <Link href={`/campus/docente/consultas?tab=encuestas&classId=${cls.id}`}>Encuesta rápida</Link>
                </Button>
                <Button asChild variant="secondary" leftIcon={<Radio />}>
                  <Link href={`/campus/docente/clases/${cls.id}/vivo`}>Sesión en vivo</Link>
                </Button>
              </div>
            </Card>
          </Reveal>

          <Reveal inView={false} delay={0.15}>
            <MaterialsPanel classId={cls.id} materials={cls.materials} />
          </Reveal>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Reveal inView={false} delay={0.1}>
            <StudentVoice classId={cls.id} voice={cls.voice} />
          </Reveal>
          <Reveal inView={false} delay={0.15}>
            <AnnouncementsPanel classId={cls.id} announcements={cls.announcements} />
          </Reveal>
        </div>
      </div>
    </>
  );
}
