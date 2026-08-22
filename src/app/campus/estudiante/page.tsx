import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CheckinForm } from "./checkin-form";

export default async function StudentDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("course_id, courses(id, name, term)")
    .eq("student_id", user.id);

  const courseIds = (enrollments ?? []).map((e) => e.course_id);
  const today = new Date().toISOString().slice(0, 10);

  const { data: nextClass } = courseIds.length
    ? await supabase
        .from("classes")
        .select("*, profiles(full_name)")
        .in("course_id", courseIds)
        .gte("class_date", today)
        .order("class_date", { ascending: true })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const { data: announcements } = courseIds.length
    ? await supabase
        .from("announcements")
        .select("*")
        .in("course_id", courseIds)
        .order("created_at", { ascending: false })
        .limit(5)
    : { data: [] };

  let latestRecording = null;
  let summary = null;
  let cards = null;
  let simplified = null;

  if (nextClass) {
    const { data: recording } = await supabase
      .from("class_recordings")
      .select("*")
      .eq("class_id", nextClass.id)
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    latestRecording = recording;

    if (recording) {
      const [{ data: s }, { data: c }, { data: si }] = await Promise.all([
        supabase.from("class_summaries").select("*").eq("recording_id", recording.id).maybeSingle(),
        supabase.from("interactive_cards").select("*").eq("recording_id", recording.id).maybeSingle(),
        supabase.from("simplified_content").select("*").eq("recording_id", recording.id).eq("level", "facil").maybeSingle(),
      ]);
      summary = s;
      cards = c;
      simplified = si;
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">
          Próxima clase
        </p>
        {nextClass ? (
          <div className="glow rounded-2xl border border-border bg-surface p-6">
            <div className="mb-1 flex items-baseline justify-between">
              <h2 className="text-xl font-semibold">{nextClass.topic}</h2>
              <span className="font-mono text-xs text-muted">
                {new Date(nextClass.class_date).toLocaleDateString("es-AR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </span>
            </div>
            <p className="mb-4 text-sm text-muted">
              Dicta: {nextClass.profiles?.full_name ?? "A confirmar"}
            </p>
            {nextClass.summary && (
              <p className="mb-4 text-sm leading-relaxed">{nextClass.summary}</p>
            )}
            <CheckinForm classId={nextClass.id} studentId={user.id} />
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted">
            No hay clases próximas cargadas todavía.
          </div>
        )}
      </section>

      {latestRecording && (
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-surface p-5">
            <p className="mb-2 font-mono text-xs uppercase tracking-widest text-accent">
              Resumen IA
            </p>
            <p className="text-sm leading-relaxed text-muted">
              {summary?.summary_md ?? "Procesando..."}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-5">
            <p className="mb-2 font-mono text-xs uppercase tracking-widest text-accent-2">
              Placas interactivas
            </p>
            <p className="text-sm text-muted">
              {cards?.cards?.length ?? 0} tarjetas listas para repasar.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-5">
            <p className="mb-2 font-mono text-xs uppercase tracking-widest text-accent-3">
              Versión simplificada
            </p>
            <p className="text-sm leading-relaxed text-muted line-clamp-4">
              {simplified?.content_md ?? "Procesando..."}
            </p>
          </div>
        </section>
      )}

      <section>
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">
          Avisos
        </p>
        <div className="flex flex-col gap-3">
          {(announcements ?? []).length === 0 && (
            <p className="text-sm text-muted">Sin avisos por ahora.</p>
          )}
          {(announcements ?? []).map((a) => (
            <div key={a.id} className="rounded-xl border border-border bg-surface p-4">
              <p className="text-sm font-medium">{a.title}</p>
              <p className="text-sm text-muted">{a.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
