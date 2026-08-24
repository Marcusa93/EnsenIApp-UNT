import type { DbClient } from "@/lib/courses";
import type { Enums, InteractiveCardItem } from "@/lib/types/helpers";
import { fetchAll } from "@/components/docente/fetch-all";

export interface StudentProfile {
  id: string;
  full_name: string;
  email: string;
  status: Enums<"profile_status">;
  dni: string | null;
  last_seen_at: string | null;
  created_at: string;
  enrolled_at: string;
  in_roster: boolean;
}

export interface ClassRow {
  id: string;
  topic: string;
  class_date: string;
  opened: boolean;
  opened_at: string | null;
  checkin: { difficulty: number; comment: string | null; created_at: string } | null;
  recordings: { id: string; title: string | null; cards_total: number; cards_known: number; cards_seen: number }[];
}

export interface SubmissionRow {
  id: string;
  activity_id: string;
  title: string;
  type: Enums<"activity_type">;
  status: Enums<"submission_status">;
  score: number | null;
  auto_score: number | null;
  max_score: number;
  submitted_at: string | null;
  time_spent_seconds: number;
  teacher_feedback_md: string | null;
}

export interface QuestionRow {
  id: string;
  question: string;
  status: Enums<"question_status">;
  is_anonymous: boolean;
  class_topic: string | null;
  created_at: string;
  teacher_answer_md: string | null;
  ai_answer_md: string | null;
}

export interface TimelineEvent {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string | null;
  created_at: string;
}

export interface AlertRow {
  id: string;
  kind: Enums<"alert_kind">;
  message: string;
  resolved: boolean;
  created_at: string;
}

export interface FeedbackRow {
  id: string;
  feedback_md: string;
  created_at: string;
  recording_title: string | null;
}

export interface StudentDetail {
  profile: StudentProfile;
  classes: ClassRow[];
  submissions: SubmissionRow[];
  questions: QuestionRow[];
  timeline: TimelineEvent[];
  timelineTruncated: boolean;
  alerts: AlertRow[];
  feedbacks: FeedbackRow[];
  stats: {
    events_30d: number;
    active_days_30d: number;
    classes_opened: number;
    avg_difficulty: number | null;
    submitted: number;
    avg_score_ratio: number | null;
    cards_known_ratio: number | null;
  };
}

interface Embed {
  id: string;
  full_name: string;
  email: string;
  status: Enums<"profile_status">;
  dni: string | null;
  last_seen_at: string | null;
  created_at: string;
}

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

/** Ficha completa de un estudiante del curso. Devuelve null si no está inscripto (o RLS lo oculta). */
export async function getStudentDetail(supabase: DbClient, courseId: string, studentId: string): Promise<StudentDetail | null> {
  const { data: enrollment, error: eErr } = await supabase
    .from("enrollments")
    .select("created_at, student:profiles!enrollments_student_id_fkey(id, full_name, email, status, dni, last_seen_at, created_at)")
    .eq("course_id", courseId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (eErr) {
    console.error("[estudiante] enrollment", { courseId, studentId, eErr });
    throw new Error("No se pudo cargar la inscripción del estudiante.");
  }
  const p = enrollment ? one(enrollment.student as Embed | Embed[] | null) : null;
  if (!enrollment || !p) return null;

  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [classesRes, rosterRes, checkinsRes, subsRes, questionsRes, alertsRes, feedbackRes, usage] = await Promise.all([
    supabase.from("classes").select("id, topic, class_date").eq("course_id", courseId).order("class_date", { ascending: true }),
    supabase.from("roster").select("id").eq("course_id", courseId).or(`matched_profile_id.eq.${studentId},email.ilike.${p.email}`),
    supabase.from("student_checkins").select("class_id, difficulty, comment, created_at").eq("student_id", studentId).order("created_at", { ascending: false }),
    supabase
      .from("activity_submissions")
      .select("id, activity_id, status, score, auto_score, submitted_at, time_spent_seconds, teacher_feedback_md, activity:activities!inner(id, title, type, max_score, course_id)")
      .eq("student_id", studentId)
      .eq("activity.course_id", courseId)
      .order("started_at", { ascending: false }),
    supabase
      .from("student_questions")
      .select("id, question, status, is_anonymous, class_id, created_at, teacher_answer_md, ai_answer_md")
      .eq("student_id", studentId)
      .eq("course_id", courseId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("teacher_alerts").select("id, kind, message, resolved, created_at").eq("course_id", courseId).eq("student_id", studentId).order("created_at", { ascending: false }),
    supabase
      .from("ai_feedback")
      .select("id, feedback_md, created_at, recording:class_recordings(title)")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(10),
    fetchAll<TimelineEvent>((from, to) =>
      supabase
        .from("usage_events")
        .select("id, event_type, entity_type, entity_id, created_at")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .range(from, to),
    ),
  ]);

  const firstError =
    classesRes.error ?? rosterRes.error ?? checkinsRes.error ?? subsRes.error ?? questionsRes.error ?? alertsRes.error ?? feedbackRes.error;
  if (firstError) {
    console.error("[estudiante] detalle", { courseId, studentId, error: firstError });
    throw new Error("No se pudo cargar la ficha del estudiante.");
  }

  const classes = classesRes.data ?? [];
  const classIds = classes.map((c) => c.id);

  // Grabaciones publicadas del curso + placas + progreso del estudiante.
  const { data: recordings, error: rErr } = classIds.length
    ? await supabase.from("class_recordings").select("id, title, class_id").in("class_id", classIds).eq("published", true)
    : { data: [], error: null };
  if (rErr) {
    console.error("[estudiante] grabaciones", { studentId, rErr });
    throw new Error("No se pudieron cargar las grabaciones.");
  }
  const recIds = (recordings ?? []).map((r) => r.id);
  const [cardsRes, progressRes] = recIds.length
    ? await Promise.all([
        supabase.from("interactive_cards").select("recording_id, cards").in("recording_id", recIds),
        supabase.from("card_progress").select("recording_id, card_index, known").eq("student_id", studentId).in("recording_id", recIds),
      ])
    : [
        { data: [] as { recording_id: string; cards: unknown }[], error: null },
        { data: [] as { recording_id: string; card_index: number; known: boolean }[], error: null },
      ];
  if (cardsRes.error || progressRes.error) {
    console.error("[estudiante] placas", { studentId, error: cardsRes.error ?? progressRes.error });
    throw new Error("No se pudo cargar el progreso de placas.");
  }

  const timeline = usage.rows;
  const openedAt = new Map<string, string>();
  for (const e of timeline) {
    if (e.event_type === "class_opened" && e.entity_id && !openedAt.has(e.entity_id)) openedAt.set(e.entity_id, e.created_at);
  }
  const checkinByClass = new Map<string, { difficulty: number; comment: string | null; created_at: string }>();
  for (const c of checkinsRes.data ?? []) if (!checkinByClass.has(c.class_id)) checkinByClass.set(c.class_id, c);

  const classRows: ClassRow[] = classes.map((c) => ({
    id: c.id,
    topic: c.topic,
    class_date: c.class_date,
    opened: openedAt.has(c.id),
    opened_at: openedAt.get(c.id) ?? null,
    checkin: checkinByClass.get(c.id) ?? null,
    recordings: (recordings ?? [])
      .filter((r) => r.class_id === c.id)
      .map((r) => {
        const set = (cardsRes.data ?? []).find((x) => x.recording_id === r.id);
        const cards = (Array.isArray(set?.cards) ? set.cards : []) as InteractiveCardItem[];
        const prog = (progressRes.data ?? []).filter((x) => x.recording_id === r.id);
        return {
          id: r.id,
          title: r.title,
          cards_total: cards.length,
          cards_seen: prog.length,
          cards_known: prog.filter((x) => x.known).length,
        };
      }),
  }));

  const submissions: SubmissionRow[] = (subsRes.data ?? []).map((s) => {
    const a = one(s.activity as { id: string; title: string; type: Enums<"activity_type">; max_score: number | null } | null);
    return {
      id: s.id,
      activity_id: s.activity_id,
      title: a?.title ?? "Actividad",
      type: a?.type ?? "lectura",
      status: s.status,
      score: s.score,
      auto_score: s.auto_score,
      max_score: Number(a?.max_score ?? 10),
      submitted_at: s.submitted_at,
      time_spent_seconds: s.time_spent_seconds,
      teacher_feedback_md: s.teacher_feedback_md,
    };
  });

  const questions: QuestionRow[] = (questionsRes.data ?? []).map((q) => ({
    id: q.id,
    question: q.question,
    status: q.status,
    is_anonymous: q.is_anonymous,
    class_topic: classes.find((c) => c.id === q.class_id)?.topic ?? null,
    created_at: q.created_at,
    teacher_answer_md: q.teacher_answer_md,
    ai_answer_md: q.ai_answer_md,
  }));

  const feedbacks: FeedbackRow[] = (feedbackRes.data ?? []).map((f) => ({
    id: f.id,
    feedback_md: f.feedback_md,
    created_at: f.created_at,
    recording_title: one(f.recording as { title: string | null } | { title: string | null }[] | null)?.title ?? null,
  }));

  const events30 = timeline.filter((e) => e.created_at >= since30);
  const diffs = classRows.map((c) => c.checkin?.difficulty).filter((d): d is number => d != null);
  const scored = submissions
    .map((s) => ({ v: s.score ?? s.auto_score, max: s.max_score }))
    .filter((s): s is { v: number; max: number } => s.v != null && s.max > 0);
  const cardsSeen = classRows.flatMap((c) => c.recordings).reduce((t, r) => t + r.cards_seen, 0);
  const cardsKnown = classRows.flatMap((c) => c.recordings).reduce((t, r) => t + r.cards_known, 0);

  return {
    profile: {
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      status: p.status,
      dni: p.dni,
      last_seen_at: p.last_seen_at,
      created_at: p.created_at,
      enrolled_at: enrollment.created_at,
      in_roster: (rosterRes.data ?? []).length > 0,
    },
    classes: classRows,
    submissions,
    questions,
    timeline: timeline.slice(0, 150),
    timelineTruncated: usage.truncated || timeline.length > 150,
    alerts: alertsRes.data ?? [],
    feedbacks,
    stats: {
      events_30d: events30.length,
      active_days_30d: new Set(events30.map((e) => e.created_at.slice(0, 10))).size,
      classes_opened: classRows.filter((c) => c.opened).length,
      avg_difficulty: diffs.length ? Math.round((diffs.reduce((a, b) => a + b, 0) / diffs.length) * 10) / 10 : null,
      submitted: submissions.filter((s) => s.status === "entregada" || s.status === "corregida").length,
      avg_score_ratio: scored.length ? scored.reduce((t, s) => t + s.v / s.max, 0) / scored.length : null,
      cards_known_ratio: cardsSeen > 0 ? cardsKnown / cardsSeen : null,
    },
  };
}
