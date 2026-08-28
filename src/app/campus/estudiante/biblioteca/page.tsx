import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenText, GraduationCap } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPrimaryCourse } from "@/lib/courses";
import { Button, EmptyState, PageHeader } from "@/components/ui";
import { getAvatarData } from "@/lib/games/avatar-data";
import { levelFor } from "@/lib/games/config";
import { LibraryRoom, type LibraryTable } from "./_components/library-room";

export const metadata: Metadata = { title: "La Biblioteca · EnsenIA UNT" };

export default async function BibliotecaPage() {
  const { user, profile } = await requireRole("estudiante");
  const supabase = await createClient();
  const course = await getPrimaryCourse(supabase, user.id, profile.role);

  if (!course) {
    return (
      <>
        <PageHeader eyebrow="El Expediente" title="La Biblioteca" />
        <EmptyState
          icon={GraduationCap}
          title="Todavía no estás en ninguna comisión"
          description="Cuando el equipo docente te agregue vas a poder entrar."
        />
      </>
    );
  }

  const { avatar } = await getAvatarData(supabase, user.id);

  // Sin operador no hay con qué entrar: se crea en Juegos.
  if (!avatar) {
    return (
      <>
        <PageHeader eyebrow="El Expediente" title="La Biblioteca" />
        <EmptyState
          icon={BookOpenText}
          title="Primero armá tu operador"
          description="A la biblioteca se entra con tu operador puesto. Se crea en un minuto desde Juegos."
          action={
            <Button asChild>
              <Link href="/campus/estudiante/juegos">Crear mi operador</Link>
            </Button>
          }
        />
      </>
    );
  }

  // Las mesas son las clases que YA tienen desafíos: sentarse tiene que servir
  // para algo, si no la sala es decorado. game_challenges no tiene policy de
  // lectura para estudiantes (tiene la respuesta correcta adentro), así que se
  // lee la vista agregada v_game_tables, que sólo expone clase y cantidad.
  const [tablesRes, statsRes] = await Promise.all([
    supabase.from("v_game_tables").select("class_id, topic, class_date, challenges").eq("course_id", course.id),
    supabase
      .from("student_game_stats")
      .select("xp, best_streak, correct, runs")
      .eq("student_id", user.id)
      .maybeSingle(),
  ]);

  const tables: LibraryTable[] = (tablesRes.data ?? [])
    .filter((r): r is typeof r & { class_id: string; challenges: number } => r.class_id != null && r.challenges != null)
    .map((r) => ({ id: r.class_id, topic: r.topic ?? "", date: r.class_date ?? "", challenges: r.challenges }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const stats = statsRes.data;

  return (
    <>
      <PageHeader
        eyebrow="El Expediente"
        title="La Biblioteca"
        description="Quiénes están estudiando ahora y en qué mesa. Sentate en una y jugá el desafío de esa clase; para saludar, usá los emotes."
      />

      {tables.length === 0 ? (
        <EmptyState
          icon={BookOpenText}
          title="Todavía no hay mesas abiertas"
          description="Las mesas se arman con las clases que ya tienen desafíos generados. Cuando el equipo docente prepare la primera, la biblioteca abre."
        />
      ) : (
        <LibraryRoom
          courseId={course.id}
          tables={tables}
          me={{
            studentId: user.id,
            callsign: avatar.callsign,
            config: avatar,
            progress: {
              level: levelFor(stats?.xp ?? 0).level.n,
              streak: stats?.best_streak ?? 0,
              correct: stats?.correct ?? 0,
              runs: stats?.runs ?? 0,
            },
          }}
        />
      )}
    </>
  );
}
