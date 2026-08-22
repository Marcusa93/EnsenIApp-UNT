import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type { InteractiveCardItem } from "@/lib/types/helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { isTeacherOfCourse } from "./access";
import { resolveRange, type ReportFilters, type ReportScope } from "./types";

type Admin = SupabaseClient<Database>;

/* ------------------------------------------------------------------------- */
/* Tipos del dataset (agregados; nunca tablas enteras)                        */
/* ------------------------------------------------------------------------- */

export interface DailyUsage {
  day: string;
  events: number;
  students: number;
}

export interface ClassDifficulty {
  class_id: string;
  topic: string;
  class_date: string;
  checkins: number;
  avg_difficulty: number | null;
  high_difficulty_ratio: number | null;
  comments: string[];
}

export interface TagKnownRate {
  recording_title: string;
  tag: string;
  cards: number;
  seen_by: number;
  known_rate: number | null;
}

export interface ActivityStats {
  activity_id: string;
  title: string;
  type: string;
  status: string;
  due_at: string | null;
  assigned: number;
  started: number;
  submitted: number;
  delivery_rate: number | null;
  avg_score: number | null;
  max_score: number;
  avg_time_minutes: number | null;
  low_score_count: number;
}

export interface QuestionSummary {
  total: number;
  by_status: Record<string, number>;
  anonymous_ratio: number | null;
  by_class: { topic: string; count: number }[];
  avg_hours_to_teacher_answer: number | null;
  sample: { question: string; status: string; class_topic: string | null; created_at: string }[];
}

export interface RiskStudent {
  name: string;
  open_alerts: number;
  kinds: string[];
  last_seen_at: string | null;
}

export interface CourseContext {
  course_id: string;
  course_name: string;
  term: string;
  subject: string | null;
  range: { from: string; to: string };
  enrolled: number;
  validated: number;
  pending: number;
}

export interface ReportDataset {
  scope: ReportScope;
  context: CourseContext;
  question: string | null;
  data: Record<string, unknown>;
}

/* ------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* ------------------------------------------------------------------------- */

function fail(where: string, error: unknown): never {
  console.error(`[reports/collect] ${where}`, error);
  throw new Error(`No se pudieron leer los datos (${where}).`);
}

function round(n: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return round(values.reduce((a, b) => a + b, 0) / values.length);
}

function ratio(part: number, total: number): number | null {
  return total === 0 ? null : round(part / total);
}

function truncate(text: string | null | undefined, max = 280): string {
  if (!text) return "";
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const k = key(item);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

async function loadContext(admin: Admin, courseId: string, filters: ReportFilters): Promise<CourseContext> {
  const { data: course, error } = await admin
    .from("courses")
    .select("id, name, term, subject:subjects(name)")
    .eq("id", courseId)
    .maybeSingle();
  if (error) fail("curso", error);
  if (!course) throw new Error("El curso del informe no existe.");

  const { data: enrollments, error: eErr } = await admin
    .from("enrollments")
    .select("student_id, student:profiles(status)")
    .eq("course_id", courseId)
    .eq("status", "active");
  if (eErr) fail("inscriptos", eErr);

  const rows = enrollments ?? [];
  const statusOf = (r: (typeof rows)[number]) => {
    const s = r.student as { status: string } | { status: string }[] | null;
    return Array.isArray(s) ? s[0]?.status : s?.status;
  };
  const subject = course.subject as { name: string } | { name: string }[] | null;

  return {
    course_id: course.id,
    course_name: course.name,
    term: course.term,
    subject: Array.isArray(subject) ? (subject[0]?.name ?? null) : (subject?.name ?? null),
    range: resolveRange(filters),
    enrolled: rows.length,
    validated: rows.filter((r) => statusOf(r) === "validado").length,
    pending: rows.filter((r) => statusOf(r) === "pendiente").length,
  };
}

async function enrolledIds(admin: Admin, courseId: string): Promise<string[]> {
  const { data, error } = await admin.from("enrollments").select("student_id").eq("course_id", courseId);
  if (error) fail("inscriptos", error);
  return (data ?? []).map((r) => r.student_id);
}

async function courseClasses(admin: Admin, courseId: string) {
  const { data, error } = await admin
    .from("classes")
    .select("id, topic, class_date, sort_order")
    .eq("course_id", courseId)
    .order("class_date", { ascending: true });
  if (error) fail("clases", error);
  return data ?? [];
}

async function studentNames(admin: Admin, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await admin.from("profiles").select("id, full_name, last_seen_at").in("id", ids);
  if (error) fail("perfiles", error);
  return new Map((data ?? []).map((p) => [p.id, p.full_name]));
}

/* ------------------------------------------------------------------------- */
/* Bloques reutilizables                                                      */
/* ------------------------------------------------------------------------- */

async function usageBlock(admin: Admin, studentIds: string[], range: { from: string; to: string }, entityId?: string) {
  if (studentIds.length === 0) {
    return { daily: [] as DailyUsage[], by_type: {}, active_students: 0, events_total: 0 };
  }
  let q = admin
    .from("usage_events")
    .select("student_id, event_type, entity_type, entity_id, created_at")
    .in("student_id", studentIds)
    .gte("created_at", range.from)
    .lte("created_at", range.to)
    .order("created_at", { ascending: false })
    .limit(20000);
  if (entityId) q = q.eq("entity_id", entityId);
  const { data, error } = await q;
  if (error) fail("telemetría", error);
  const events = data ?? [];

  const perDay = new Map<string, { events: number; students: Set<string> }>();
  for (const e of events) {
    const day = e.created_at.slice(0, 10);
    const entry = perDay.get(day) ?? { events: 0, students: new Set<string>() };
    entry.events += 1;
    entry.students.add(e.student_id);
    perDay.set(day, entry);
  }
  const daily: DailyUsage[] = [...perDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, v]) => ({ day, events: v.events, students: v.students.size }));

  const byHour = countBy(events, (e) => String(new Date(e.created_at).getUTCHours() - 3 + 24).padStart(2, "0"));

  return {
    daily,
    by_type: countBy(events, (e) => e.event_type),
    by_entity_type: countBy(events, (e) => e.entity_type),
    by_hour_tucuman: Object.fromEntries(
      Object.entries(byHour).map(([h, c]) => [`${(Number(h) % 24).toString().padStart(2, "0")}h`, c]),
    ),
    active_students: new Set(events.map((e) => e.student_id)).size,
    events_total: events.length,
    focus_lost: events.filter((e) => e.event_type === "focus_lost").length,
    offline_queued: events.filter((e) => e.event_type === "offline_queued").length,
    raw: events,
  };
}

async function difficultyBlock(
  admin: Admin,
  classes: { id: string; topic: string; class_date: string }[],
  range: { from: string; to: string },
  studentId?: string,
): Promise<ClassDifficulty[]> {
  if (classes.length === 0) return [];
  let q = admin
    .from("student_checkins")
    .select("class_id, student_id, difficulty, comment, created_at")
    .in(
      "class_id",
      classes.map((c) => c.id),
    )
    .gte("created_at", range.from)
    .lte("created_at", range.to);
  if (studentId) q = q.eq("student_id", studentId);
  const { data, error } = await q;
  if (error) fail("check-ins", error);
  const checkins = data ?? [];

  return classes
    .map((c) => {
      const rows = checkins.filter((r) => r.class_id === c.id);
      const diffs = rows.map((r) => r.difficulty);
      return {
        class_id: c.id,
        topic: c.topic,
        class_date: c.class_date,
        checkins: rows.length,
        avg_difficulty: avg(diffs),
        high_difficulty_ratio: ratio(diffs.filter((d) => d >= 4).length, diffs.length),
        comments: rows
          .filter((r) => r.comment && r.comment.trim().length > 0)
          .slice(0, 12)
          .map((r) => truncate(r.comment, 240)),
      };
    })
    .filter((c) => c.checkins > 0);
}

async function cardsBlock(
  admin: Admin,
  classes: { id: string; topic: string }[],
  studentId?: string,
): Promise<TagKnownRate[]> {
  if (classes.length === 0) return [];
  const { data: recordings, error: rErr } = await admin
    .from("class_recordings")
    .select("id, title, class_id")
    .in(
      "class_id",
      classes.map((c) => c.id),
    )
    .eq("published", true);
  if (rErr) fail("grabaciones", rErr);
  const recs = recordings ?? [];
  if (recs.length === 0) return [];
  const recIds = recs.map((r) => r.id);

  const [{ data: cardSets, error: cErr }, progressRes] = await Promise.all([
    admin.from("interactive_cards").select("recording_id, cards").in("recording_id", recIds),
    (() => {
      let q = admin
        .from("card_progress")
        .select("recording_id, card_index, known, attempts, correct, student_id")
        .in("recording_id", recIds);
      if (studentId) q = q.eq("student_id", studentId);
      return q;
    })(),
  ]);
  if (cErr) fail("placas", cErr);
  if (progressRes.error) fail("progreso de placas", progressRes.error);
  const progress = progressRes.data ?? [];

  const out: TagKnownRate[] = [];
  for (const set of cardSets ?? []) {
    const rec = recs.find((r) => r.id === set.recording_id);
    const topic = classes.find((c) => c.id === rec?.class_id)?.topic;
    const title = rec?.title ?? topic ?? "Grabación";
    const cards = (Array.isArray(set.cards) ? set.cards : []) as InteractiveCardItem[];
    const byTag = new Map<string, number[]>();
    cards.forEach((card, idx) => {
      const tag = card.tag?.trim() || "general";
      byTag.set(tag, [...(byTag.get(tag) ?? []), idx]);
    });
    for (const [tag, indexes] of byTag) {
      const rows = progress.filter((p) => p.recording_id === set.recording_id && indexes.includes(p.card_index));
      out.push({
        recording_title: title,
        tag,
        cards: indexes.length,
        seen_by: new Set(rows.map((r) => r.student_id)).size,
        known_rate: ratio(rows.filter((r) => r.known).length, rows.length),
      });
    }
  }
  return out.sort((a, b) => (a.known_rate ?? 1) - (b.known_rate ?? 1));
}

async function activitiesBlock(
  admin: Admin,
  courseId: string,
  enrolledCount: number,
  opts: { activityId?: string; classId?: string; studentId?: string } = {},
): Promise<ActivityStats[]> {
  let q = admin
    .from("activities")
    .select("id, title, type, status, target, due_at, max_score, class_id")
    .eq("course_id", courseId)
    .neq("status", "draft")
    .order("created_at", { ascending: false });
  if (opts.activityId) q = q.eq("id", opts.activityId);
  if (opts.classId) q = q.eq("class_id", opts.classId);
  const { data: activities, error } = await q;
  if (error) fail("actividades", error);
  const acts = activities ?? [];
  if (acts.length === 0) return [];
  const ids = acts.map((a) => a.id);

  const [assignRes, subRes] = await Promise.all([
    admin.from("activity_assignments").select("activity_id, student_id").in("activity_id", ids),
    (() => {
      let s = admin
        .from("activity_submissions")
        .select("activity_id, student_id, status, score, auto_score, time_spent_seconds")
        .in("activity_id", ids);
      if (opts.studentId) s = s.eq("student_id", opts.studentId);
      return s;
    })(),
  ]);
  if (assignRes.error) fail("asignaciones", assignRes.error);
  if (subRes.error) fail("entregas", subRes.error);
  const assignments = assignRes.data ?? [];
  const subs = subRes.data ?? [];

  return acts.map((a) => {
    const assigned = opts.studentId
      ? 1
      : a.target === "todos"
        ? enrolledCount
        : assignments.filter((x) => x.activity_id === a.id).length;
    const mine = subs.filter((s) => s.activity_id === a.id);
    const delivered = mine.filter((s) => s.status === "entregada" || s.status === "corregida");
    const max = Number(a.max_score ?? 10);
    const scores = mine
      .map((s) => (s.score ?? s.auto_score) as number | null)
      .filter((s): s is number => s != null)
      .map(Number);
    return {
      activity_id: a.id,
      title: a.title,
      type: a.type,
      status: a.status,
      due_at: a.due_at,
      assigned,
      started: mine.length,
      submitted: delivered.length,
      delivery_rate: ratio(delivered.length, assigned),
      avg_score: avg(scores),
      max_score: max,
      avg_time_minutes: mine.length ? round(mine.reduce((t, s) => t + s.time_spent_seconds, 0) / mine.length / 60, 1) : null,
      low_score_count: scores.filter((s) => s <= max * 0.4).length,
    };
  });
}

async function questionsBlock(
  admin: Admin,
  courseId: string,
  classes: { id: string; topic: string }[],
  range: { from: string; to: string },
  opts: { classId?: string; studentId?: string } = {},
): Promise<QuestionSummary> {
  let q = admin
    .from("student_questions")
    .select("id, question, status, is_anonymous, class_id, created_at, answered_at, teacher_answer_md")
    .eq("course_id", courseId)
    .gte("created_at", range.from)
    .lte("created_at", range.to)
    .order("created_at", { ascending: false })
    .limit(400);
  if (opts.classId) q = q.eq("class_id", opts.classId);
  if (opts.studentId) q = q.eq("student_id", opts.studentId);
  const { data, error } = await q;
  if (error) fail("consultas", error);
  const rows = data ?? [];
  const topicOf = (classId: string | null) => classes.find((c) => c.id === classId)?.topic ?? null;

  const byClass = countBy(rows, (r) => topicOf(r.class_id) ?? "Sin clase asociada");
  const answerHours = rows
    .filter((r) => r.teacher_answer_md && r.answered_at)
    .map((r) => (new Date(r.answered_at as string).getTime() - new Date(r.created_at).getTime()) / 36e5);

  return {
    total: rows.length,
    by_status: countBy(rows, (r) => r.status),
    anonymous_ratio: ratio(rows.filter((r) => r.is_anonymous).length, rows.length),
    by_class: Object.entries(byClass)
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count),
    avg_hours_to_teacher_answer: answerHours.length ? round(avg(answerHours) ?? 0, 1) : null,
    sample: rows.slice(0, 60).map((r) => ({
      question: truncate(r.question, 300),
      status: r.status,
      class_topic: topicOf(r.class_id),
      created_at: r.created_at.slice(0, 10),
    })),
  };
}

async function riskBlock(admin: Admin, courseId: string, studentId?: string): Promise<RiskStudent[]> {
  let q = admin
    .from("teacher_alerts")
    .select("student_id, kind, created_at, resolved")
    .eq("course_id", courseId)
    .eq("resolved", false)
    .order("created_at", { ascending: false })
    .limit(500);
  if (studentId) q = q.eq("student_id", studentId);
  const { data, error } = await q;
  if (error) fail("alertas", error);
  const alerts = (data ?? []).filter((a): a is typeof a & { student_id: string } => a.student_id != null);
  const ids = [...new Set(alerts.map((a) => a.student_id))];
  if (ids.length === 0) return [];
  const { data: profiles, error: pErr } = await admin.from("profiles").select("id, full_name, last_seen_at").in("id", ids);
  if (pErr) fail("perfiles", pErr);

  return ids
    .map((id) => {
      const mine = alerts.filter((a) => a.student_id === id);
      const p = (profiles ?? []).find((x) => x.id === id);
      return {
        name: p?.full_name ?? "Estudiante",
        open_alerts: mine.length,
        kinds: [...new Set(mine.map((a) => a.kind))],
        last_seen_at: p?.last_seen_at ?? null,
      };
    })
    .sort((a, b) => b.open_alerts - a.open_alerts)
    .slice(0, 25);
}

async function pollsBlock(admin: Admin, courseId: string, classId?: string) {
  let q = admin
    .from("polls")
    .select("id, question, options, allow_free_text, status, created_at")
    .eq("course_id", courseId)
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(20);
  if (classId) q = q.eq("class_id", classId);
  const { data: polls, error } = await q;
  if (error) fail("encuestas", error);
  const list = polls ?? [];
  if (list.length === 0) return [];
  const { data: responses, error: rErr } = await admin
    .from("poll_responses")
    .select("poll_id, option_index, free_text")
    .in(
      "poll_id",
      list.map((p) => p.id),
    );
  if (rErr) fail("respuestas de encuestas", rErr);
  const res = responses ?? [];
  return list.map((p) => {
    const options = (Array.isArray(p.options) ? p.options : []) as string[];
    const mine = res.filter((r) => r.poll_id === p.id);
    return {
      question: p.question,
      status: p.status,
      responses: mine.length,
      options: options.map((label, i) => ({ label, votes: mine.filter((r) => r.option_index === i).length })),
      free_text: mine
        .map((r) => r.free_text)
        .filter((t): t is string => !!t && t.trim().length > 0)
        .slice(0, 15)
        .map((t) => truncate(t, 200)),
    };
  });
}

/* ------------------------------------------------------------------------- */
/* Dataset por scope                                                          */
/* ------------------------------------------------------------------------- */

async function collectUsoCurso(admin: Admin, ctx: CourseContext) {
  const ids = await enrolledIds(admin, ctx.course_id);
  const classes = await courseClasses(admin, ctx.course_id);
  const usage = await usageBlock(admin, ids, ctx.range);

  const classOpens = countBy(
    usage.raw.filter((e) => e.event_type === "class_opened" && e.entity_id),
    (e) => e.entity_id as string,
  );
  const topClasses = Object.entries(classOpens)
    .map(([id, count]) => ({ topic: classes.find((c) => c.id === id)?.topic ?? "Clase", opens: count }))
    .sort((a, b) => b.opens - a.opens)
    .slice(0, 8);

  const perStudent = countBy(usage.raw, (e) => e.student_id);
  const inactive = ids.filter((id) => !perStudent[id]).length;
  const [questions, alerts] = await Promise.all([
    questionsBlock(admin, ctx.course_id, classes, ctx.range),
    riskBlock(admin, ctx.course_id),
  ]);

  const { raw: _raw, ...usageNoRaw } = usage;
  void _raw;
  return {
    usage: usageNoRaw,
    inactive_students_in_range: inactive,
    engagement_distribution: {
      muy_activos_gt_50_eventos: Object.values(perStudent).filter((n) => n > 50).length,
      activos_10_a_50: Object.values(perStudent).filter((n) => n >= 10 && n <= 50).length,
      poco_activos_lt_10: Object.values(perStudent).filter((n) => n < 10).length,
      sin_actividad: inactive,
    },
    top_classes_opened: topClasses,
    questions: { total: questions.total, by_status: questions.by_status, by_class: questions.by_class.slice(0, 5) },
    students_at_risk: alerts,
  };
}

async function collectDificultades(admin: Admin, ctx: CourseContext) {
  const classes = await courseClasses(admin, ctx.course_id);
  const [difficulty, cards, risk, activities] = await Promise.all([
    difficultyBlock(admin, classes, ctx.range),
    cardsBlock(admin, classes),
    riskBlock(admin, ctx.course_id),
    activitiesBlock(admin, ctx.course_id, ctx.enrolled),
  ]);
  const { data: alerts, error } = await admin
    .from("teacher_alerts")
    .select("kind, resolved")
    .eq("course_id", ctx.course_id);
  if (error) fail("alertas", error);
  return {
    difficulty_by_class: difficulty,
    hardest_card_tags: cards.slice(0, 15),
    alerts_by_kind: countBy(alerts ?? [], (a) => `${a.kind}${a.resolved ? " (resuelta)" : ""}`),
    students_at_risk: risk,
    activities_with_low_scores: activities.filter((a) => a.low_score_count > 0 || (a.avg_score ?? 10) < a.max_score * 0.6),
  };
}

async function collectConsultas(admin: Admin, ctx: CourseContext, filters: ReportFilters) {
  const classes = await courseClasses(admin, ctx.course_id);
  const questions = await questionsBlock(admin, ctx.course_id, classes, ctx.range, { classId: filters.class_id });
  return { questions };
}

async function collectActividad(admin: Admin, ctx: CourseContext, filters: ReportFilters) {
  const stats = await activitiesBlock(admin, ctx.course_id, ctx.enrolled, { activityId: filters.activity_id });
  let detail: Record<string, unknown> | null = null;
  if (filters.activity_id) {
    const { data: subs, error } = await admin
      .from("activity_submissions")
      .select("status, score, auto_score, time_spent_seconds, teacher_feedback_md, submitted_at")
      .eq("activity_id", filters.activity_id);
    if (error) fail("entregas", error);
    const rows = subs ?? [];
    const max = stats[0]?.max_score ?? 10;
    const scores = rows.map((s) => Number(s.score ?? s.auto_score)).filter((n) => Number.isFinite(n));
    const buckets = { "0-40%": 0, "40-60%": 0, "60-80%": 0, "80-100%": 0 };
    for (const s of scores) {
      const r = s / max;
      if (r <= 0.4) buckets["0-40%"]++;
      else if (r <= 0.6) buckets["40-60%"]++;
      else if (r <= 0.8) buckets["60-80%"]++;
      else buckets["80-100%"]++;
    }
    detail = {
      by_status: countBy(rows, (s) => s.status),
      score_distribution: buckets,
      late_or_missing: (stats[0]?.assigned ?? 0) - rows.filter((s) => s.submitted_at).length,
      teacher_feedback_sample: rows
        .map((s) => s.teacher_feedback_md)
        .filter((t): t is string => !!t)
        .slice(0, 8)
        .map((t) => truncate(t, 200)),
    };
  }
  return { activities: stats, activity_detail: detail };
}

async function collectEstudiante(admin: Admin, ctx: CourseContext, filters: ReportFilters) {
  const studentId = filters.student_id;
  if (!studentId) throw new Error("Falta el estudiante para este informe.");
  const { data: profile, error } = await admin
    .from("profiles")
    .select("id, full_name, status, last_seen_at, created_at")
    .eq("id", studentId)
    .maybeSingle();
  if (error) fail("perfil", error);
  if (!profile) throw new Error("El estudiante no existe.");

  const classes = await courseClasses(admin, ctx.course_id);
  const [usage, difficulty, cards, activities, questions, risk, feedbackRes] = await Promise.all([
    usageBlock(admin, [studentId], ctx.range),
    difficultyBlock(admin, classes, ctx.range, studentId),
    cardsBlock(admin, classes, studentId),
    activitiesBlock(admin, ctx.course_id, ctx.enrolled, { studentId }),
    questionsBlock(admin, ctx.course_id, classes, ctx.range, { studentId }),
    riskBlock(admin, ctx.course_id, studentId),
    admin
      .from("ai_feedback")
      .select("feedback_md, created_at")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);
  if (feedbackRes.error) fail("feedback IA", feedbackRes.error);

  const opened = new Set(usage.raw.filter((e) => e.event_type === "class_opened" && e.entity_id).map((e) => e.entity_id));
  const { raw: _raw, ...usageNoRaw } = usage;
  void _raw;
  return {
    student: {
      name: profile.full_name,
      status: profile.status,
      last_seen_at: profile.last_seen_at,
      member_since: profile.created_at.slice(0, 10),
    },
    usage: usageNoRaw,
    classes_opened: `${opened.size} de ${classes.length}`,
    difficulty_by_class: difficulty,
    cards_by_tag: cards,
    activities,
    questions,
    open_alerts: risk[0] ?? null,
    previous_ai_feedback: (feedbackRes.data ?? []).map((f) => ({
      date: f.created_at.slice(0, 10),
      excerpt: truncate(f.feedback_md, 500),
    })),
  };
}

async function collectClase(admin: Admin, ctx: CourseContext, filters: ReportFilters) {
  const classId = filters.class_id;
  if (!classId) throw new Error("Falta la clase para este informe.");
  const { data: cls, error } = await admin
    .from("classes")
    .select("id, topic, class_date, summary")
    .eq("id", classId)
    .eq("course_id", ctx.course_id)
    .maybeSingle();
  if (error) fail("clase", error);
  if (!cls) throw new Error("La clase no pertenece a este curso.");

  const ids = await enrolledIds(admin, ctx.course_id);
  const wideRange = { from: new Date(`${cls.class_date}T00:00:00`).toISOString(), to: new Date().toISOString() };
  const [usage, recordingsRes, difficulty, cards, activities, questions, polls] = await Promise.all([
    usageBlock(admin, ids, wideRange, classId),
    admin
      .from("class_recordings")
      .select("id, title, status, published, duration_seconds")
      .eq("class_id", classId),
    difficultyBlock(admin, [cls], wideRange),
    cardsBlock(admin, [cls]),
    activitiesBlock(admin, ctx.course_id, ctx.enrolled, { classId }),
    questionsBlock(admin, ctx.course_id, [cls], wideRange, { classId }),
    pollsBlock(admin, ctx.course_id, classId),
  ]);
  if (recordingsRes.error) fail("grabaciones", recordingsRes.error);

  const recIds = (recordingsRes.data ?? []).map((r) => r.id);
  const recUsage = recIds.length ? await usageBlock(admin, ids, wideRange) : null;
  const recEvents = recUsage ? recUsage.raw.filter((e) => e.entity_id && recIds.includes(e.entity_id)) : [];

  const { raw: _raw, ...usageNoRaw } = usage;
  void _raw;
  return {
    class: { topic: cls.topic, date: cls.class_date, summary: truncate(cls.summary, 400) || null },
    class_usage: { ...usageNoRaw, unique_students_opened: usageNoRaw.active_students },
    recordings: (recordingsRes.data ?? []).map((r) => ({
      title: r.title,
      status: r.status,
      published: r.published,
      duration_minutes: r.duration_seconds ? round(r.duration_seconds / 60, 0) : null,
    })),
    recording_interactions: {
      by_type: countBy(recEvents, (e) => e.event_type),
      unique_students: new Set(recEvents.map((e) => e.student_id)).size,
    },
    difficulty: difficulty[0] ?? null,
    cards_by_tag: cards,
    activities,
    questions,
    polls,
  };
}

/* ------------------------------------------------------------------------- */
/* Entrada pública                                                            */
/* ------------------------------------------------------------------------- */

export interface CollectParams {
  scope: ReportScope;
  courseId: string;
  filters: ReportFilters;
  requestedBy: { id: string; role: Database["public"]["Enums"]["user_role"] };
}

/**
 * Arma el dataset agregado para el informe. Usa el cliente admin SOLO después
 * de verificar que quien pidió el informe es docente del curso (o admin).
 */
export async function collectReportDataset(params: CollectParams): Promise<ReportDataset> {
  const allowed = await isTeacherOfCourse(params.requestedBy.id, params.requestedBy.role, params.courseId);
  if (!allowed) throw new Error("No tenés permiso para generar informes de este curso.");

  const admin = createAdminClient();
  const ctx = await loadContext(admin, params.courseId, params.filters);

  let data: Record<string, unknown>;
  switch (params.scope) {
    case "uso_curso":
      data = await collectUsoCurso(admin, ctx);
      break;
    case "dificultades":
      data = await collectDificultades(admin, ctx);
      break;
    case "consultas":
      data = await collectConsultas(admin, ctx, params.filters);
      break;
    case "actividad":
      data = await collectActividad(admin, ctx, params.filters);
      break;
    case "estudiante":
      data = await collectEstudiante(admin, ctx, params.filters);
      break;
    case "clase":
      data = await collectClase(admin, ctx, params.filters);
      break;
  }

  return { scope: params.scope, context: ctx, question: params.filters.question ?? null, data };
}
