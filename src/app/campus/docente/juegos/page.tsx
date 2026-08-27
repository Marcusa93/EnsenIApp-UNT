import type { Metadata } from "next";
import { Gamepad2 } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getActiveCourse } from "@/components/docente/active-course";
import { CourseSwitcher } from "@/components/docente/course-switcher";
import { Card, CardTitle, EmptyState, PageHeader, Stat } from "@/components/ui";
import { GAMES } from "@/lib/games/config";
import { GamesPanel } from "./_components/games-panel";

export const metadata: Metadata = { title: "Juegos · EnsenIA UNT" };

export default async function DocenteJuegosPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string }>;
}) {
  const { user, profile } = await requireRole("docente", "admin");
  const supabase = await createClient();
  const { course, courses } = await getActiveCourse(supabase, user.id, profile.role, (await searchParams).course);

  if (!course) {
    return (
      <>
        <PageHeader eyebrow="El Expediente" title="Juegos de la materia" />
        <EmptyState icon={Gamepad2} title="No tenés comisiones asignadas" description="Pedile a la cátedra que te asigne una." />
      </>
    );
  }

  const [configRes, recordingsRes, challengesRes, statsRes] = await Promise.all([
    supabase.from("course_games").select("game, enabled").eq("course_id", course.id),
    supabase
      .from("class_recordings")
      .select("id, title, status, published, class_id, classes(id, topic, class_date, course_id)")
      .eq("status", "ready")
      .order("created_at", { ascending: false }),
    supabase.from("game_challenges").select("recording_id, game").eq("course_id", course.id),
    supabase.from("game_runs").select("student_id, correct, total, game").eq("course_id", course.id),
  ]);

  const config = new Map((configRes.data ?? []).map((r) => [r.game, r.enabled]));
  const enabled = GAMES.map((g) => ({ ...g, enabled: config.get(g.key) ?? true }));

  // Sólo las grabaciones de ESTA comisión (el filtro por curso va sobre la clase).
  const recordings = (recordingsRes.data ?? [])
    .map((r) => {
      const cls = r.classes as { id: string; topic: string; class_date: string; course_id: string } | null;
      return cls && cls.course_id === course.id
        ? { id: r.id, title: r.title, published: r.published, classTopic: cls.topic, classDate: cls.class_date }
        : null;
    })
    .filter((r): r is NonNullable<typeof r> => r != null);

  const byRecording = new Map<string, Record<string, number>>();
  for (const c of challengesRes.data ?? []) {
    if (!c.recording_id) continue;
    const entry = byRecording.get(c.recording_id) ?? {};
    entry[c.game] = (entry[c.game] ?? 0) + 1;
    byRecording.set(c.recording_id, entry);
  }

  const runs = statsRes.data ?? [];
  const players = new Set(runs.map((r) => r.student_id)).size;
  const answered = runs.reduce((acc, r) => acc + r.total, 0);
  const correct = runs.reduce((acc, r) => acc + r.correct, 0);
  const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : null;

  return (
    <>
      <PageHeader
        eyebrow="El Expediente"
        title="Juegos de la materia"
        description="Los desafíos se generan con IA desde el material real de cada grabación: transcripción, resumen y glosario. Podés prender y apagar cada juego para la comisión."
        actions={<CourseSwitcher courses={courses} activeCourseId={course.id} />}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Partidas jugadas" value={String(runs.length)} />
        <Stat label="Estudiantes jugando" value={String(players)} />
        <Stat label="Aciertos" value={accuracy != null ? `${accuracy}%` : "—"} />
      </div>

      <div className="mt-4">
        <GamesPanel courseId={course.id} games={enabled} recordings={recordings} challengeCounts={Object.fromEntries(byRecording)} />
      </div>

      <Card className="mt-4">
        <CardTitle eyebrow="Cómo funciona" as="h2">
          De la clase al desafío
        </CardTitle>
        <ol className="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-muted">
          <li>
            <strong className="text-foreground">1.</strong> Subís y procesás la grabación como siempre.
          </li>
          <li>
            <strong className="text-foreground">2.</strong> Tocás <em>Generar</em> y la IA arma los desafíos con lo que
            se dijo en esa clase. Cada uno queda con la cita textual que lo respalda.
          </li>
          <li>
            <strong className="text-foreground">3.</strong> Los estudiantes juegan partidas de cinco preguntas, suman
            experiencia y suben de nivel en la carrera judicial.
          </li>
        </ol>
      </Card>
    </>
  );
}
