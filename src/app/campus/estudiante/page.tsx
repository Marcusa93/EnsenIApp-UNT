import Link from "next/link";
import { CalendarDays, GraduationCap } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getPrimaryCourse } from "@/lib/courses";
import { createClient } from "@/lib/supabase/server";
import { Button, EmptyState } from "@/components/ui";
import { CheckinCard } from "@/components/checkin/checkin-card";
import { Greeting } from "./_components/greeting";
import { PrimerosPasos, type PasoEstado } from "./_components/primeros-pasos";
import { RepasoSugerido } from "./_components/repaso-sugerido";
import { HoyTracker } from "./_components/hoy-tracker";
import { NextClassCard, type NextClassData } from "./_components/next-class-card";
import { LastClassCard, type LastClassData, type RecordingAccess } from "./_components/last-class-card";
import { AnnouncementsList } from "./_components/announcements-list";
import { PendingActivities, type PendingActivity } from "./_components/pending-activities";
import { PollCard, type OpenPoll } from "./_components/poll-card";
import { FeedbackPreview } from "./_components/feedback-preview";
import { WeekActivity } from "./_components/week-activity";
import { DashboardGrid, DashboardItem } from "./_components/dashboard-grid";
import { isInFuture, isoDaysAgo, summarizeActivity, todayKey } from "./_components/student-data";

export const metadata = { title: "Hoy · EnsenIA UNT" };

export default async function StudentHomePage() {
  const { user, profile } = await requireRole("estudiante");
  const supabase = await createClient();
  const course = await getPrimaryCourse(supabase, user.id, profile.role);

  if (!course) {
    return (
      <>
        <Greeting profile={profile} courseName={null} />
        <EmptyState
          icon={GraduationCap}
          title="Todavía no estás inscripto en ninguna comisión"
          description={
            profile.status === "pendiente"
              ? "Tu cuenta está pendiente de validación: cuando el equipo docente te agregue al padrón vas a ver acá tus clases, actividades y avisos."
              : "Si ya cursás la materia, avisale al equipo docente para que te agregue al padrón de la comisión."
          }
          action={
            <Button asChild variant="secondary">
              <Link href="/campus/estudiante/consultas">Escribir al equipo docente</Link>
            </Button>
          }
        />
      </>
    );
  }

  const today = todayKey();
  const since7d = isoDaysAgo(7);

  const [
    nextClassRes,
    lastClassRes,
    facultyRes,
    announcementsRes,
    activitiesRes,
    pollsRes,
    feedbackRes,
    eventsRes,
  ] = await Promise.all([
    supabase
      .from("classes")
      .select("id, topic, summary, class_date, teacher_id, sort_order")
      .eq("course_id", course.id)
      .gte("class_date", today)
      .order("class_date", { ascending: true })
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("classes")
      .select("id, topic, summary, class_date, teacher_id, sort_order")
      .eq("course_id", course.id)
      .lt("class_date", today)
      .order("class_date", { ascending: false })
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("faculty").select("profile_id, full_name, position").eq("subject_id", course.subject_id),
    supabase
      .from("announcements")
      .select("id, title, body, created_at, class_id")
      .eq("course_id", course.id)
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("activities")
      .select("id, title, type, due_at, published_at")
      .eq("course_id", course.id)
      .eq("status", "published")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(20),
    supabase
      .from("polls")
      .select("id, question, options, allow_free_text, closes_at, created_at")
      .eq("course_id", course.id)
      .eq("status", "open")
      .order("created_at", { ascending: false }),
    supabase
      .from("ai_feedback")
      .select("id, feedback_md, created_at")
      .eq("student_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("usage_events")
      .select("created_at")
      .eq("student_id", user.id)
      .gte("created_at", since7d)
      .order("created_at", { ascending: false })
      .limit(2000),
  ]);

  for (const [name, res] of [
    ["classes(next)", nextClassRes],
    ["classes(last)", lastClassRes],
    ["faculty", facultyRes],
    ["announcements", announcementsRes],
    ["activities", activitiesRes],
    ["polls", pollsRes],
    ["ai_feedback", feedbackRes],
    ["usage_events", eventsRes],
  ] as const) {
    if (res.error) {
      console.error(`[estudiante/hoy] ${name}`, res.error);
      throw new Error("No pudimos cargar tu panel de hoy. Reintentá en unos segundos.");
    }
  }

  const facultyByProfile = new Map<string, { full_name: string; position: string }>();
  for (const f of facultyRes.data ?? []) {
    if (f.profile_id) facultyByProfile.set(f.profile_id, { full_name: f.full_name, position: f.position });
  }
  const teacherFor = (teacherId: string | null) => (teacherId ? (facultyByProfile.get(teacherId) ?? null) : null);

  const nextClass: NextClassData | null = nextClassRes.data
    ? { ...nextClassRes.data, teacher: teacherFor(nextClassRes.data.teacher_id), isToday: nextClassRes.data.class_date === today }
    : null;

  // Última clase: grabaciones publicadas (RLS) + check-in propio
  let lastClass: LastClassData | null = null;
  let needsCheckin = false;
  if (lastClassRes.data) {
    const [recordingsRes, checkinRes, noteRes] = await Promise.all([
      supabase
        .from("v_recording_status")
        .select("id, title, status, published, has_summary, has_cards, has_simplified, has_transcript, duration_seconds")
        .eq("class_id", lastClassRes.data.id)
        .eq("published", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("student_checkins")
        .select("id")
        .eq("student_id", user.id)
        .eq("class_id", lastClassRes.data.id)
        .limit(1)
        .maybeSingle(),
      // Sin grabación la clase puede tener apunte: RLS ya filtra los borradores.
      supabase.from("class_notes").select("class_id").eq("class_id", lastClassRes.data.id).maybeSingle(),
    ]);
    if (recordingsRes.error) console.error("[estudiante/hoy] v_recording_status", recordingsRes.error);
    if (checkinRes.error) console.error("[estudiante/hoy] student_checkins", checkinRes.error);

    const recordings: RecordingAccess[] = (recordingsRes.data ?? [])
      .filter((r) => r.id && r.status === "ready")
      .map((r) => ({
        id: r.id as string,
        title: r.title ?? null,
        has_summary: Boolean(r.has_summary),
        has_cards: Boolean(r.has_cards),
        has_simplified: Boolean(r.has_simplified),
        has_transcript: Boolean(r.has_transcript),
        duration_seconds: r.duration_seconds ?? null,
      }));
    lastClass = {
      ...lastClassRes.data,
      teacher: teacherFor(lastClassRes.data.teacher_id),
      recordings,
      has_note: noteRes.data != null,
    };
    needsCheckin = !checkinRes.data;
  }

  // Actividades pendientes: publicadas sin entrega del estudiante
  const activityIds = (activitiesRes.data ?? []).map((a) => a.id);
  let pending: PendingActivity[] = [];
  if (activityIds.length > 0) {
    const { data: subs, error: subsError } = await supabase
      .from("activity_submissions")
      .select("activity_id, status")
      .eq("student_id", user.id)
      .in("activity_id", activityIds);
    if (subsError) console.error("[estudiante/hoy] activity_submissions", subsError);
    const delivered = new Set(
      (subs ?? []).filter((s) => s.status === "entregada" || s.status === "corregida").map((s) => s.activity_id),
    );
    const inProgress = new Set((subs ?? []).filter((s) => s.status === "en_progreso" || s.status === "reabierta").map((s) => s.activity_id));
    pending = (activitiesRes.data ?? [])
      .filter((a) => !delivered.has(a.id))
      .map((a) => ({ ...a, in_progress: inProgress.has(a.id) }));
  }

  // Encuestas abiertas sin respuesta
  const pollIds = (pollsRes.data ?? []).map((p) => p.id);
  let openPolls: OpenPoll[] = [];
  if (pollIds.length > 0) {
    const { data: responses, error: respError } = await supabase
      .from("poll_responses")
      .select("poll_id")
      .eq("student_id", user.id)
      .in("poll_id", pollIds);
    if (respError) console.error("[estudiante/hoy] poll_responses", respError);
    const answered = new Set((responses ?? []).map((r) => r.poll_id));
    openPolls = (pollsRes.data ?? [])
      .filter((p) => !answered.has(p.id))
      .filter((p) => isInFuture(p.closes_at))
      .map((p) => ({
        id: p.id,
        question: p.question,
        options: Array.isArray(p.options) ? p.options.filter((o): o is string => typeof o === "string") : [],
        allow_free_text: p.allow_free_text,
        closes_at: p.closes_at,
      }));
  }

  const activity = summarizeActivity((eventsRes.data ?? []).map((e) => e.created_at));

  // Primeros pasos: se marcan solos con lo que el estudiante ya hizo. Se
  // consultan sólo si la cuenta es nueva (poca actividad), para no pagar tres
  // consultas por cada visita de alguien que ya conoce el campus.
  const pocaActividad = (eventsRes.data ?? []).length < 25;
  let primerosPasos: PasoEstado | null = null;
  if (pocaActividad) {
    const [avatarRes, alberdiRes, runsRes, claseVistaRes] = await Promise.all([
      supabase.from("student_avatars").select("student_id").eq("student_id", user.id).maybeSingle(),
      supabase.from("alberdi_conversations").select("id").eq("student_id", user.id).limit(1),
      supabase.from("game_runs").select("id").eq("student_id", user.id).limit(1),
      supabase
        .from("usage_events")
        .select("id")
        .eq("student_id", user.id)
        .eq("event_type", "class_opened")
        .limit(1),
    ]);
    primerosPasos = {
      vioClase: (claseVistaRes.data ?? []).length > 0,
      usoAlberdi: (alberdiRes.data ?? []).length > 0,
      tieneOperador: Boolean(avatarRes.data),
      jugo: (runsRes.data ?? []).length > 0,
    };
  }

  // La clase más floja, para empujar el repaso desde Hoy. Umbral: menos del 60%
  // con al menos 4 respuestas — con dos preguntas sueltas el porcentaje es ruido.
  let repasoSugerido: { classId: string; topic: string; correct: number; answered: number } | null = null;
  {
    const { data: runs } = await supabase
      .from("game_runs")
      .select("class_id, correct, total")
      .eq("student_id", user.id)
      .eq("course_id", course.id)
      .not("class_id", "is", null)
      .gt("total", 0)
      .limit(2000);
    const acc = new Map<string, { correct: number; answered: number }>();
    for (const r of runs ?? []) {
      if (!r.class_id) continue;
      const a = acc.get(r.class_id) ?? { correct: 0, answered: 0 };
      a.correct += r.correct;
      a.answered += r.total;
      acc.set(r.class_id, a);
    }
    let peor: { classId: string; ratio: number; correct: number; answered: number } | null = null;
    for (const [classId, a] of acc) {
      if (a.answered < 4) continue;
      const ratio = a.correct / a.answered;
      if (ratio < 0.6 && (!peor || ratio < peor.ratio)) peor = { classId, ratio, ...a };
    }
    if (peor) {
      const { data: cls } = await supabase.from("classes").select("topic").eq("id", peor.classId).maybeSingle();
      if (cls) repasoSugerido = { classId: peor.classId, topic: cls.topic, correct: peor.correct, answered: peor.answered };
    }
  }

  return (
    <>
      <HoyTracker studentId={user.id} />
      <Greeting profile={profile} courseName={course.name} streak={activity.streak} />

      <DashboardGrid>
        {primerosPasos && (
          <DashboardItem className="lg:col-span-12">
            <PrimerosPasos estado={primerosPasos} nextClassId={nextClass?.id ?? null} />
          </DashboardItem>
        )}

        {repasoSugerido && (
          <DashboardItem className="lg:col-span-12">
            <RepasoSugerido {...repasoSugerido} />
          </DashboardItem>
        )}

        <DashboardItem className="lg:col-span-7">
          <NextClassCard data={nextClass} />
        </DashboardItem>

        <DashboardItem className="lg:col-span-5">
          <WeekActivity days={activity.days} streak={activity.streak} total={activity.total} />
        </DashboardItem>

        {openPolls.map((poll) => (
          <DashboardItem key={poll.id} className="lg:col-span-12">
            <PollCard poll={poll} studentId={user.id} />
          </DashboardItem>
        ))}

        {lastClass && (
          <DashboardItem className="lg:col-span-7">
            <LastClassCard data={lastClass} />
          </DashboardItem>
        )}

        {lastClass && needsCheckin && (
          <DashboardItem className="lg:col-span-5">
            <CheckinCard classId={lastClass.id} classTopic={lastClass.topic} studentId={user.id} className="h-full" />
          </DashboardItem>
        )}

        <DashboardItem className={lastClass && !needsCheckin ? "lg:col-span-5" : "lg:col-span-7"}>
          <PendingActivities items={pending} />
        </DashboardItem>

        <DashboardItem className={lastClass && !needsCheckin ? "lg:col-span-7" : "lg:col-span-5"}>
          <AnnouncementsList items={announcementsRes.data ?? []} />
        </DashboardItem>

        <DashboardItem className="lg:col-span-12">
          <FeedbackPreview feedback={feedbackRes.data ?? null} />
        </DashboardItem>
      </DashboardGrid>

      {!nextClass && !lastClass && (
        <div className="mt-6">
          <EmptyState
            compact
            icon={CalendarDays}
            tone="accent-2"
            title="El cronograma todavía está vacío"
            description="Cuando el equipo docente cargue las clases vas a ver acá la próxima y los accesos a las grabaciones."
          />
        </div>
      )}
    </>
  );
}
