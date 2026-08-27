import Link from "next/link";
import { BookOpenCheck, ClipboardCheck, Gauge, GraduationCap, Layers, MessageCircleQuestion, Sparkles, Trophy } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getPrimaryCourse } from "@/lib/courses";
import { createClient } from "@/lib/supabase/server";
import { Button, EmptyState, PageHeader, Stat } from "@/components/ui";
import { RevealGroup, RevealItem } from "@/components/shell";
import { formatPercent } from "@/lib/format";
import { EDITABLE_TYPES, effectiveScore } from "@/components/activities/model";
import { PageViewTracker } from "../_components/page-view-tracker";
import { dayKey, shiftDayKey, todayKey, weekStartKey } from "../_components/student-data";
import { CardsRadial, WeeklyActivityChart, type WeekBucket } from "./_components/progress-charts";
import { GenerateFeedbackButton } from "./_components/generate-feedback-button";
import { FeedbackList, type FeedbackRow } from "./_components/feedback-list";
import { Medallero } from "@/components/gamification/medallero";

export const metadata = { title: "Mi progreso · EnsenIA UNT" };

const WEEKS = 8;
const DIFFICULTY_LABEL = ["", "muy fácil", "fácil", "normal", "difícil", "muy difícil"] as const;

function weekLabel(key: string): string {
  const [, m, d] = key.split("-");
  return `${d}/${m}`;
}

export default async function ProgresoPage() {
  const { user, profile } = await requireRole("estudiante");
  const supabase = await createClient();
  const course = await getPrimaryCourse(supabase, user.id, profile.role);

  if (!course) {
    return (
      <>
        <PageViewTracker entityType="student_progress" />
        <PageHeader eyebrow="Estudiante · Mi progreso" title="Mi progreso" />
        <EmptyState
          icon={GraduationCap}
          title="Todavía no hay nada para medir"
          description="Cuando estés inscripto en una comisión vas a ver acá tu avance en clases, placas, actividades y tu devolución personalizada."
        />
      </>
    );
  }

  const today = todayKey();
  const sinceWeeks = shiftDayKey(weekStartKey(today), -7 * (WEEKS - 1));
  const sinceIso = `${sinceWeeks}T00:00:00-03:00`;

  const [classesRes, eventsRes, recordingsRes, progressRes, activitiesRes, submissionsRes, checkinsRes, questionsRes, feedbackRes] =
    await Promise.all([
      supabase.from("classes").select("id, class_date").eq("course_id", course.id),
      supabase
        .from("usage_events")
        .select("event_type, entity_id, created_at")
        .eq("student_id", user.id)
        .gte("created_at", sinceIso)
        .limit(5000),
      supabase
        .from("v_recording_status")
        .select("id, class_id, has_cards")
        .eq("published", true)
        .eq("status", "ready"),
      supabase.from("card_progress").select("recording_id, card_index, known, attempts, correct").eq("student_id", user.id),
      supabase
        .from("activities")
        .select("id")
        .eq("course_id", course.id)
        .in("status", ["published", "closed"])
        .in("type", [...EDITABLE_TYPES]),
      supabase.from("activity_submissions").select("activity_id, status, score, auto_score").eq("student_id", user.id),
      supabase.from("student_checkins").select("difficulty").eq("student_id", user.id),
      supabase.from("student_questions").select("id, status").eq("student_id", user.id),
      supabase
        .from("ai_feedback")
        .select("id, feedback_md, model, created_at")
        .eq("student_id", user.id)
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

  for (const [name, res] of [
    ["classes", classesRes],
    ["usage_events", eventsRes],
    ["v_recording_status", recordingsRes],
    ["card_progress", progressRes],
    ["activities", activitiesRes],
    ["activity_submissions", submissionsRes],
    ["student_checkins", checkinsRes],
    ["student_questions", questionsRes],
    ["ai_feedback", feedbackRes],
  ] as const) {
    if (res.error) {
      console.error(`[progreso] ${name}`, res.error);
      throw new Error("No pudimos calcular tu progreso. Reintentá en unos segundos.");
    }
  }

  // --- Clases abiertas vs dictadas ---
  const classes = classesRes.data ?? [];
  const classIds = new Set(classes.map((c) => c.id));
  const pastClasses = classes.filter((c) => c.class_date <= today);
  const events = eventsRes.data ?? [];
  const openedClasses = new Set(
    events.filter((e) => e.event_type === "class_opened" && e.entity_id && classIds.has(e.entity_id)).map((e) => e.entity_id as string),
  );

  // --- Placas: total publicadas en el curso vs conocidas ---
  const courseRecordings = (recordingsRes.data ?? []).filter((r) => r.id && r.class_id && classIds.has(r.class_id));
  const recordingIds = courseRecordings.map((r) => r.id as string);
  let totalCards = 0;
  if (recordingIds.length > 0) {
    const { data: cardSets, error: cardsErr } = await supabase
      .from("interactive_cards")
      .select("recording_id, cards, created_at")
      .in("recording_id", recordingIds)
      .order("created_at", { ascending: false });
    if (cardsErr) console.error("[progreso] interactive_cards", cardsErr);
    const seen = new Set<string>();
    for (const set of cardSets ?? []) {
      if (seen.has(set.recording_id)) continue;
      seen.add(set.recording_id);
      totalCards += Array.isArray(set.cards) ? set.cards.length : 0;
    }
  }
  const progress = (progressRes.data ?? []).filter((p) => recordingIds.includes(p.recording_id));
  const knownCards = Math.min(totalCards, progress.filter((p) => p.known).length);
  const quizAttempts = progress.reduce((a, p) => a + p.attempts, 0);
  const quizCorrect = progress.reduce((a, p) => a + p.correct, 0);

  // --- Actividades ---
  const activityIds = new Set((activitiesRes.data ?? []).map((a) => a.id));
  const submissions = (submissionsRes.data ?? []).filter((s) => activityIds.has(s.activity_id));
  const delivered = submissions.filter((s) => s.status === "entregada" || s.status === "corregida");
  const graded = submissions.filter((s) => effectiveScore(s) != null);
  const avgScore = graded.length ? graded.reduce((a, s) => a + Number(effectiveScore(s)), 0) / graded.length : null;

  // --- Dificultad y consultas ---
  const checkins = checkinsRes.data ?? [];
  const avgDifficulty = checkins.length ? checkins.reduce((a, c) => a + c.difficulty, 0) / checkins.length : null;
  const questions = questionsRes.data ?? [];
  const answeredByTeacher = questions.filter((q) => q.status === "respondida_docente").length;

  // --- Eventos por semana ---
  const buckets = new Map<string, { events: number; days: Set<string> }>();
  for (let i = WEEKS - 1; i >= 0; i--) {
    const wk = shiftDayKey(weekStartKey(today), -7 * i);
    buckets.set(wk, { events: 0, days: new Set() });
  }
  for (const e of events) {
    const day = dayKey(e.created_at);
    const wk = weekStartKey(day);
    const b = buckets.get(wk);
    if (!b) continue;
    b.events++;
    b.days.add(day);
  }
  const weekly: WeekBucket[] = Array.from(buckets.entries()).map(([week_start, b]) => ({
    week_start,
    label: weekLabel(week_start),
    events: b.events,
    active_days: b.days.size,
  }));

  const feedbacks: FeedbackRow[] = feedbackRes.data ?? [];
  const hasData = events.length > 0 || checkins.length > 0 || progress.length > 0 || submissions.length > 0 || questions.length > 0;

  return (
    <>
      <PageViewTracker entityType="student_progress" entityId={course.id} />
      <PageHeader
        eyebrow={`Estudiante · ${course.name}`}
        title="Mi progreso"
        description="Lo que hiciste en el campus, lo que te costó y una devolución de la IA con un plan concreto para seguir."
        actions={
          <Button asChild variant="secondary" size="sm" leftIcon={<Layers />}>
            <Link href="/campus/estudiante/clases">Ir a las clases</Link>
          </Button>
        }
      />

      <RevealGroup className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" stagger={0.06}>
        <RevealItem>
          <Stat
            label="Clases abiertas"
            value={
              <>
                {openedClasses.size}
                <span className="text-lg text-muted"> / {pastClasses.length}</span>
              </>
            }
            hint={pastClasses.length ? `${formatPercent(openedClasses.size / pastClasses.length)} de las clases dictadas` : "Todavía no hubo clases"}
            icon={<BookOpenCheck />}
          />
        </RevealItem>
        <RevealItem>
          <Stat
            label="Placas conocidas"
            value={
              <>
                {knownCards}
                <span className="text-lg text-muted"> / {totalCards}</span>
              </>
            }
            hint={quizAttempts > 0 ? `${quizCorrect}/${quizAttempts} respuestas correctas en quiz` : "Sin intentos de quiz todavía"}
            icon={<Layers />}
            tone="accent-2"
          />
        </RevealItem>
        <RevealItem>
          <Stat
            label="Actividades entregadas"
            value={
              <>
                {delivered.length}
                <span className="text-lg text-muted"> / {activityIds.size}</span>
              </>
            }
            hint={avgScore != null ? `Promedio de nota: ${avgScore.toLocaleString("es-AR", { maximumFractionDigits: 1 })}` : "Sin notas todavía"}
            icon={<ClipboardCheck />}
            tone="accent-3"
          />
        </RevealItem>
        <RevealItem>
          <Stat
            label="Dificultad reportada"
            value={avgDifficulty != null ? avgDifficulty.toLocaleString("es-AR", { maximumFractionDigits: 1 }) : "—"}
            hint={
              avgDifficulty != null
                ? `${DIFFICULTY_LABEL[Math.round(avgDifficulty)]} · ${checkins.length} check-ins`
                : "Hacé el check-in después de cada clase"
            }
            icon={<Gauge />}
            tone="muted"
          />
        </RevealItem>
        <RevealItem>
          <Stat
            label="Consultas"
            value={questions.length}
            hint={answeredByTeacher > 0 ? `${answeredByTeacher} con respuesta del docente` : "Preguntá lo que no te cerró"}
            icon={<MessageCircleQuestion />}
          />
        </RevealItem>
      </RevealGroup>

      <div className="mt-6 grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <WeeklyActivityChart data={weekly} />
        </div>
        <div className="lg:col-span-4">
          <CardsRadial known={knownCards} total={totalCards} />
        </div>
      </div>

      <section aria-labelledby="medallero" className="mt-10">
        <div className="mb-4 flex items-center gap-2">
          <Trophy className="size-4 text-accent-3" aria-hidden />
          <h2 id="medallero" className="eyebrow">
            Medallero
          </h2>
        </div>
        <Medallero userId={user.id} />
      </section>

      <section aria-labelledby="devolucion" className="mt-10">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="size-4 text-accent" aria-hidden />
          <h2 id="devolucion" className="eyebrow">
            Devolución personalizada
          </h2>
        </div>
        <div className="flex flex-col gap-6">
          <GenerateFeedbackButton lastCreatedAt={feedbacks[0]?.created_at ?? null} hasData={hasData} />
          {feedbacks.length === 0 ? (
            <EmptyState
              compact
              icon={Sparkles}
              title="Todavía no generaste tu devolución"
              description="La IA lee tus check-ins, placas, entregas y consultas, y te dice qué va bien, qué reforzar y un plan de 3 pasos."
            />
          ) : (
            <FeedbackList items={feedbacks} />
          )}
        </div>
      </section>
    </>
  );
}
