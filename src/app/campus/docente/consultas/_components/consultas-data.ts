import type { DbClient } from "@/lib/courses";
import type { Enums } from "@/lib/types/helpers";

export type QuestionStatus = Enums<"question_status">;
export type PollStatus = Enums<"poll_status">;

export interface QuestionItem {
  id: string;
  question: string;
  status: QuestionStatus;
  is_anonymous: boolean;
  is_public: boolean;
  created_at: string;
  answered_at: string | null;
  ai_answer_md: string | null;
  teacher_answer_md: string | null;
  /** null cuando la consulta es anónima. */
  student_name: string | null;
  class_topic: string | null;
  answered_by_name: string | null;
}

export interface PollOptionResult {
  label: string;
  votes: number;
}

export interface PollItem {
  id: string;
  question: string;
  status: PollStatus;
  allow_free_text: boolean;
  class_id: string | null;
  class_topic: string | null;
  created_at: string;
  responses: number;
  options: PollOptionResult[];
  free_texts: string[];
}

export interface ConsultasData {
  questions: QuestionItem[];
  polls: PollItem[];
  classes: { id: string; topic: string; class_date: string }[];
  enrolledCount: number;
}

interface NameEmbed {
  full_name: string;
}

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

/** Carga consultas, encuestas y clases del curso con el cliente RLS del docente. */
export async function getConsultasData(supabase: DbClient, courseId: string): Promise<ConsultasData> {
  const [questionsRes, pollsRes, classesRes, enrollRes] = await Promise.all([
    supabase
      .from("student_questions")
      .select(
        "id, question, status, is_anonymous, is_public, created_at, answered_at, ai_answer_md, teacher_answer_md, class_id, student:profiles!student_questions_student_id_fkey(full_name), answerer:profiles!student_questions_answered_by_fkey(full_name)",
      )
      .eq("course_id", courseId)
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("polls")
      .select("id, question, options, allow_free_text, status, class_id, created_at")
      .eq("course_id", courseId)
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("classes")
      .select("id, topic, class_date")
      .eq("course_id", courseId)
      .order("class_date", { ascending: false }),
    supabase
      .from("enrollments")
      .select("student_id", { count: "exact", head: true })
      .eq("course_id", courseId)
      .eq("status", "active"),
  ]);

  const firstError = questionsRes.error ?? pollsRes.error ?? classesRes.error ?? enrollRes.error;
  if (firstError) {
    console.error("[consultas] getConsultasData", { courseId, error: firstError });
    throw new Error("No se pudieron cargar las consultas del curso.");
  }

  const classes = classesRes.data ?? [];
  const topicOf = (classId: string | null) => classes.find((c) => c.id === classId)?.topic ?? null;

  const questions: QuestionItem[] = (questionsRes.data ?? []).map((q) => ({
    id: q.id,
    question: q.question,
    status: q.status,
    is_anonymous: q.is_anonymous,
    is_public: q.is_public,
    created_at: q.created_at,
    answered_at: q.answered_at,
    ai_answer_md: q.ai_answer_md,
    teacher_answer_md: q.teacher_answer_md,
    student_name: q.is_anonymous ? null : (one(q.student as NameEmbed | NameEmbed[] | null)?.full_name ?? null),
    class_topic: topicOf(q.class_id),
    answered_by_name: one(q.answerer as NameEmbed | NameEmbed[] | null)?.full_name ?? null,
  }));

  const pollRows = pollsRes.data ?? [];
  const pollIds = pollRows.map((p) => p.id);
  const { data: responses, error: rErr } = pollIds.length
    ? await supabase.from("poll_responses").select("poll_id, option_index, free_text").in("poll_id", pollIds)
    : { data: [] as { poll_id: string; option_index: number | null; free_text: string | null }[], error: null };
  if (rErr) {
    console.error("[consultas] poll_responses", { courseId, error: rErr });
    throw new Error("No se pudieron cargar las respuestas de las encuestas.");
  }
  const allResponses = responses ?? [];

  const polls: PollItem[] = pollRows.map((p) => {
    const options = (Array.isArray(p.options) ? p.options : []).filter((o): o is string => typeof o === "string");
    const mine = allResponses.filter((r) => r.poll_id === p.id);
    return {
      id: p.id,
      question: p.question,
      status: p.status,
      allow_free_text: p.allow_free_text,
      class_id: p.class_id,
      class_topic: topicOf(p.class_id),
      created_at: p.created_at,
      responses: mine.length,
      options: options.map((label, i) => ({ label, votes: mine.filter((r) => r.option_index === i).length })),
      free_texts: mine
        .map((r) => r.free_text)
        .filter((t): t is string => !!t && t.trim().length > 0),
    };
  });

  return { questions, polls, classes, enrolledCount: enrollRes.count ?? 0 };
}
