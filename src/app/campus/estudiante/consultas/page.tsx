import Link from "next/link";
import { Feather, GraduationCap, MessageCircleQuestion, Users } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getPrimaryCourse } from "@/lib/courses";
import { createClient } from "@/lib/supabase/server";
import { Badge, Button, EmptyState, PageHeader } from "@/components/ui";
import { RevealGroup, RevealItem } from "@/components/shell";
import { PageViewTracker } from "../_components/page-view-tracker";
import type { ClassOption } from "./_components/ask-question-form";
import { QuestionCard, type QuestionItem } from "./_components/question-card";

export const metadata = { title: "Consultas · EnsenIA UNT" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuidOrNull(v: string | string[] | undefined): string | null {
  const s = Array.isArray(v) ? v[0] : v;
  return s && UUID_RE.test(s) ? s : null;
}

function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

interface RawQuestion {
  id: string;
  student_id: string;
  question: string;
  status: QuestionItem["status"];
  ai_answer_md: string | null;
  teacher_answer_md: string | null;
  answered_by: string | null;
  is_anonymous: boolean;
  is_public: boolean;
  created_at: string;
  answered_at: string | null;
  class: ClassOption | ClassOption[] | null;
}

const QUESTION_SELECT =
  "id, student_id, question, status, ai_answer_md, teacher_answer_md, answered_by, is_anonymous, is_public, created_at, answered_at, class:classes(id, topic, class_date)";

export default async function ConsultasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ user, profile }, params] = await Promise.all([requireRole("estudiante"), searchParams]);
  const supabase = await createClient();
  const course = await getPrimaryCourse(supabase, user.id, profile.role);
  // La puerta de la duda es Alberdi: si llegan acá con una clase para preguntar,
  // los mandamos directo al chat con esa clase enfocada.
  const askClassId = uuidOrNull(params.classId);
  const alberdiHref = askClassId ? `/campus/estudiante/alberdi?classId=${askClassId}` : "/campus/estudiante/alberdi";

  if (!course) {
    return (
      <>
        <PageViewTracker entityType="student_questions" />
        <PageHeader eyebrow="Estudiante · Consultas" title="Consultas" />
        <EmptyState
          icon={GraduationCap}
          title="Necesitás estar inscripto en una comisión para consultar"
          description={
            profile.status === "pendiente"
              ? "Tu cuenta está pendiente de validación. Cuando el equipo docente te agregue al padrón vas a poder hacer consultas y ver las de tus compañeros."
              : "Si ya cursás la materia, avisale al equipo docente para que te agregue al padrón."
          }
        />
      </>
    );
  }

  const [mineRes, publicRes, facultyRes] = await Promise.all([
    supabase
      .from("student_questions")
      .select(QUESTION_SELECT)
      .eq("student_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("student_questions")
      .select(QUESTION_SELECT)
      .eq("course_id", course.id)
      .eq("is_public", true)
      .neq("student_id", user.id)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase.from("faculty").select("profile_id, full_name").eq("subject_id", course.subject_id),
  ]);

  for (const [name, res] of [
    ["mine", mineRes],
    ["public", publicRes],
  ] as const) {
    if (res.error) {
      console.error(`[consultas] ${name}`, res.error);
      throw new Error("No pudimos cargar tus consultas. Reintentá en unos segundos.");
    }
  }
  if (facultyRes.error) console.error("[consultas] faculty", facultyRes.error);

  const teacherName = new Map<string, string>();
  for (const f of facultyRes.data ?? []) if (f.profile_id) teacherName.set(f.profile_id, f.full_name);

  // Nombres de compañeros: RLS de profiles no los expone a estudiantes → se muestran como "Un compañero".
  const toItem = (r: RawQuestion): QuestionItem => ({
    id: r.id,
    question: r.question,
    status: r.status,
    ai_answer_md: r.ai_answer_md,
    teacher_answer_md: r.teacher_answer_md,
    teacher_name: r.answered_by ? (teacherName.get(r.answered_by) ?? null) : null,
    is_anonymous: r.is_anonymous,
    is_public: r.is_public,
    created_at: r.created_at,
    answered_at: r.answered_at,
    class: one(r.class),
    author_name: null,
  });

  const mine = ((mineRes.data ?? []) as unknown as RawQuestion[]).map(toItem);
  const publicOnes = ((publicRes.data ?? []) as unknown as RawQuestion[]).map(toItem);

  const open = mine.filter((q) => q.status === "abierta").length;
  const byTeacher = mine.filter((q) => q.status === "respondida_docente").length;

  return (
    <>
      <PageViewTracker entityType="student_questions" entityId={course.id} />
      <PageHeader
        eyebrow={`Estudiante · ${course.name}`}
        title="Mis consultas al equipo docente"
        description="Acá viven las consultas que escalaste desde Alberdi y las respuestas del equipo docente. Para preguntar, la puerta es siempre Alberdi."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {open > 0 && (
              <Badge tone="warning" dot live>
                {open} esperando respuesta
              </Badge>
            )}
            {byTeacher > 0 && <Badge tone="success">{byTeacher} respondidas</Badge>}
            <Button asChild leftIcon={<Feather />}>
              <Link href={alberdiHref}>Preguntarle a Alberdi</Link>
            </Button>
          </div>
        }
      />

      <div className="mx-auto flex max-w-3xl flex-col gap-8">
          <section aria-labelledby="mis-consultas">
            <div className="mb-3 flex items-center gap-2">
              <MessageCircleQuestion className="size-4 text-accent" aria-hidden />
              <h2 id="mis-consultas" className="eyebrow">
                Mis consultas
              </h2>
            </div>
            {mine.length === 0 ? (
              <EmptyState
                compact
                icon={MessageCircleQuestion}
                title="Todavía no escalaste ninguna consulta"
                description="Preguntale a Alberdi; si su respuesta no te alcanza, tocá “Enviar al equipo docente” y la vas a seguir desde acá."
                action={
                  <Button asChild variant="secondary" size="sm">
                    <Link href={alberdiHref}>Abrir Alberdi</Link>
                  </Button>
                }
              />
            ) : (
              <RevealGroup className="flex flex-col gap-3" stagger={0.05}>
                {mine.map((q) => (
                  <RevealItem key={q.id}>
                    <QuestionCard item={q} />
                  </RevealItem>
                ))}
              </RevealGroup>
            )}
          </section>

          <section aria-labelledby="consultas-publicas">
            <div className="mb-3 flex items-center gap-2">
              <Users className="size-4 text-accent-2" aria-hidden />
              <h2 id="consultas-publicas" className="eyebrow">
                Consultas públicas del curso
              </h2>
              <span className="ml-auto font-mono text-[11px] text-muted">{publicOnes.length}</span>
            </div>
            {publicOnes.length === 0 ? (
              <EmptyState
                compact
                tone="accent-2"
                icon={Users}
                title="Nadie compartió consultas todavía"
                description="Cuando un compañero marque una consulta como pública, la vas a ver acá con su respuesta para aprender de las dudas de todos."
              />
            ) : (
              <RevealGroup className="flex flex-col gap-3" stagger={0.05}>
                {publicOnes.map((q) => (
                  <RevealItem key={q.id}>
                    <QuestionCard item={q} mine={false} />
                  </RevealItem>
                ))}
              </RevealGroup>
            )}
          </section>
      </div>
    </>
  );
}
