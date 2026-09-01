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

  // El banco se arma por CLASE, no por grabación: no todas las clases se graban
  // y una clase con apunte tiene material igual de válido para generar.
  const [configRes, classesRes, challengesRes, statsRes] = await Promise.all([
    supabase.from("course_games").select("game, enabled").eq("course_id", course.id),
    supabase
      .from("classes")
      .select(
        "id, topic, class_date, recordings:class_recordings(id, status, published, created_at), note:class_notes(published)",
      )
      .eq("course_id", course.id)
      .order("class_date", { ascending: false }),
    supabase.from("game_challenges").select("class_id, game").eq("course_id", course.id),
    supabase.from("game_runs").select("student_id, correct, total, game").eq("course_id", course.id),
  ]);

  const config = new Map((configRes.data ?? []).map((r) => [r.game, r.enabled]));
  const enabled = GAMES.map((g) => ({ ...g, enabled: config.get(g.key) ?? true }));

  const byClass = new Map<string, Record<string, number>>();
  for (const c of challengesRes.data ?? []) {
    if (!c.class_id) continue;
    const entry = byClass.get(c.class_id) ?? {};
    entry[c.game] = (entry[c.game] ?? 0) + 1;
    byClass.set(c.class_id, entry);
  }

  // Sólo las clases que tienen de dónde generar: grabación procesada o apunte.
  const fuentes = (classesRes.data ?? [])
    .map((c) => {
      const recs = (c.recordings ?? []) as { id: string; status: string; published: boolean; created_at: string }[];
      const lista = [...recs].sort((a, b) => b.created_at.localeCompare(a.created_at));
      const rec = lista.find((r) => r.status === "ready") ?? null;
      const note = c.note as { published: boolean } | { published: boolean }[] | null;
      const tieneApunte = Array.isArray(note) ? note.length > 0 : note != null;
      if (!rec && !tieneApunte) return null;
      return {
        classId: c.id,
        topic: c.topic,
        classDate: c.class_date,
        recordingId: rec?.id ?? null,
        recordingPublished: rec?.published ?? false,
        tieneApunte,
        counts: byClass.get(c.id) ?? {},
      };
    })
    .filter((c): c is NonNullable<typeof c> => c != null);

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
        description="Los desafíos se generan con IA desde el material real de cada clase: la grabación (transcripción, resumen y glosario) o, si no se grabó, el apunte que escribiste. Podés prender y apagar cada juego para la comisión."
        actions={<CourseSwitcher courses={courses} activeCourseId={course.id} />}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Partidas jugadas" value={String(runs.length)} />
        <Stat label="Estudiantes jugando" value={String(players)} />
        <Stat label="Aciertos" value={accuracy != null ? `${accuracy}%` : "—"} />
      </div>

      <div className="mt-4">
        <GamesPanel courseId={course.id} games={enabled} fuentes={fuentes} />
      </div>

      <Card className="mt-4">
        <CardTitle eyebrow="Cómo funciona" as="h2">
          De la clase al desafío
        </CardTitle>
        <ol className="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-muted">
          <li>
            <strong className="text-foreground">1.</strong> Subís y procesás la grabación como siempre — o, si esa
            clase no se grabó, escribís el apunte desde la ficha de la clase.
          </li>
          <li>
            <strong className="text-foreground">2.</strong> Tocás <em>Generar</em> y la IA arma los desafíos con lo que
            dice ese material. Cada uno queda con la cita textual que lo respalda.
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
