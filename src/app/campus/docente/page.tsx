import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UploadForm } from "./upload-form";

export default async function TeacherDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: assignments } = await supabase
    .from("teacher_assignments")
    .select("course_id, courses(id, name, term)")
    .eq("teacher_id", user.id);

  const courseIds = (assignments ?? []).map((a) => a.course_id);

  const { data: classes } = courseIds.length
    ? await supabase
        .from("classes")
        .select("*, class_recordings(id, status)")
        .in("course_id", courseIds)
        .order("class_date", { ascending: false })
        .limit(10)
    : { data: [] };

  const { data: checkins } = courseIds.length
    ? await supabase
        .from("student_checkins")
        .select("difficulty, class_id, classes!inner(course_id)")
        .in("classes.course_id", courseIds)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] };

  const avgDifficulty =
    checkins && checkins.length
      ? (checkins.reduce((sum, c) => sum + c.difficulty, 0) / checkins.length).toFixed(1)
      : null;

  return (
    <div className="flex flex-col gap-8">
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="mb-1 font-mono text-xs uppercase tracking-widest text-muted">Cursos</p>
          <p className="text-3xl font-semibold">{courseIds.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="mb-1 font-mono text-xs uppercase tracking-widest text-muted">
            Dificultad promedio reportada
          </p>
          <p className="text-3xl font-semibold">{avgDifficulty ?? "—"}<span className="text-base text-muted">/5</span></p>
        </div>
        <form action="/api/reports/generate" method="post" className="rounded-2xl border border-border bg-surface p-5">
          <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">
            Informe a demanda
          </p>
          <input type="hidden" name="courseId" value={courseIds[0] ?? ""} />
          <button
            type="submit"
            className="rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white transition hover:opacity-90"
          >
            Generar informe de uso
          </button>
        </form>
      </section>

      <section>
        <p className="mb-3 font-mono text-xs uppercase tracking-widest text-muted">
          Clases recientes
        </p>
        <div className="flex flex-col gap-3">
          {(classes ?? []).map((c) => (
            <div key={c.id} className="rounded-2xl border border-border bg-surface p-5">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="font-medium">{c.topic}</p>
                  <p className="text-xs text-muted">
                    {new Date(c.class_date).toLocaleDateString("es-AR")}
                  </p>
                </div>
                <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase text-muted">
                  {c.class_recordings?.[0]?.status ?? "sin grabación"}
                </span>
              </div>
              <UploadForm classId={c.id} uploadedBy={user.id} />
            </div>
          ))}
          {(classes ?? []).length === 0 && (
            <p className="text-sm text-muted">Todavía no hay clases cargadas en el cronograma.</p>
          )}
        </div>
      </section>
    </div>
  );
}
