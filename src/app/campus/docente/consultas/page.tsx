import type { Metadata } from "next";
import { BarChart3, Bot, CheckCheck, MessageCircleQuestion } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, PageHeader, Stat } from "@/components/ui";
import { RevealGroup, RevealItem } from "@/components/shell";
import { getActiveCourse } from "@/components/docente/active-course";
import { CourseSwitcher } from "@/components/docente/course-switcher";
import { getConsultasData } from "./_components/consultas-data";
import { ConsultasTabs, type ConsultasTab } from "./_components/consultas-tabs";
import { QuestionsPanel } from "./_components/questions-panel";
import { PollsPanel } from "./_components/polls-panel";

export const metadata: Metadata = { title: "Consultas · EnsenIA UNT" };

export default async function ConsultasPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string; tab?: string; classId?: string }>;
}) {
  const { user, profile } = await requireRole("docente", "admin");
  const supabase = await createClient();
  const sp = await searchParams;
  const { course, courses } = await getActiveCourse(supabase, user.id, profile.role, sp.course);

  if (!course) {
    return (
      <>
        <PageHeader eyebrow="Docente · Consultas" title="Consultas y encuestas" />
        <EmptyState
          icon={MessageCircleQuestion}
          title="Todavía no tenés cursos asignados"
          description="Un administrador tiene que asignarte a un curso para responder consultas y crear encuestas."
        />
      </>
    );
  }

  const data = await getConsultasData(supabase, course.id);
  const initialTab: ConsultasTab = sp.tab === "encuestas" ? "encuestas" : "consultas";
  const open = data.questions.filter((q) => q.status === "abierta").length;
  const aiAnswered = data.questions.filter((q) => q.status === "respondida_ia").length;
  const teacherAnswered = data.questions.filter((q) => q.status === "respondida_docente").length;
  const openPolls = data.polls.filter((p) => p.status === "open").length;

  return (
    <>
      <PageHeader
        eyebrow={`Docente · ${course.subject?.name ?? "Consultas"}`}
        title="Consultas y encuestas"
        description={`${course.name} · ${course.term}. La voz de los estudiantes: dudas con respuesta IA para revisar, y encuestas rápidas con resultados en vivo.`}
        actions={<CourseSwitcher courses={courses} activeCourseId={course.id} />}
      />

      <RevealGroup className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" stagger={0.05}>
        <RevealItem>
          <Stat
            label="Abiertas"
            value={open}
            icon={<MessageCircleQuestion />}
            tone={open > 0 ? "accent-3" : "muted"}
            hint="Sin ninguna respuesta"
          />
        </RevealItem>
        <RevealItem>
          <Stat
            label="Respondidas por IA"
            value={aiAnswered}
            icon={<Bot />}
            tone={aiAnswered > 0 ? "accent-2" : "muted"}
            hint="Esperan tu revisión"
          />
        </RevealItem>
        <RevealItem>
          <Stat label="Respondidas por docente" value={teacherAnswered} icon={<CheckCheck />} tone="accent" hint="Con respuesta del equipo" />
        </RevealItem>
        <RevealItem>
          <Stat
            label="Encuestas abiertas"
            value={openPolls}
            icon={<BarChart3 />}
            tone={openPolls > 0 ? "accent-2" : "muted"}
            hint={`${data.polls.length} en total`}
          />
        </RevealItem>
      </RevealGroup>

      <ConsultasTabs
        initial={initialTab}
        counts={{ consultas: data.questions.length, encuestas: data.polls.length }}
        consultas={<QuestionsPanel questions={data.questions} />}
        encuestas={
          <PollsPanel
            courseId={course.id}
            polls={data.polls}
            classes={data.classes}
            enrolledCount={data.enrolledCount}
            initialClassId={sp.classId}
          />
        }
      />
    </>
  );
}
