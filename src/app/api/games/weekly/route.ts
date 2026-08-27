import { NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWeeklyStatus, WEEKLY_XP } from "@/lib/games/weekly";

/**
 * Cobra la recompensa del desafío de la semana.
 *
 * La meta se verifica del lado del servidor contra las partidas reales, y el
 * cobro queda registrado por semana: si se pide dos veces, la segunda choca con
 * la clave primaria y no paga de nuevo.
 */
export async function POST() {
  const ctx = await getOptionalUser();
  if (!ctx) return NextResponse.json({ error: "Tu sesión expiró. Volvé a ingresar." }, { status: 401 });

  const supabase = await createClient();
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("course_id")
    .eq("student_id", ctx.user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!enrollment) return NextResponse.json({ error: "Todavía no estás en ninguna comisión." }, { status: 403 });
  const courseId = enrollment.course_id;

  const status = await getWeeklyStatus(supabase, ctx.user.id, courseId);
  if (!status.done) {
    return NextResponse.json(
      { error: `Te faltan ${status.target - status.correct} aciertos para cerrar la semana.` },
      { status: 409 },
    );
  }
  if (status.claimed) {
    return NextResponse.json({ error: "Ya cobraste la recompensa de esta semana." }, { status: 409 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("weekly_claims").insert({
    student_id: ctx.user.id,
    course_id: courseId,
    week_start: status.weekStart,
    correct: status.correct,
    xp_awarded: WEEKLY_XP,
  });

  if (error) {
    // 23505 = clave duplicada: alguien tocó dos veces muy rápido.
    if (error.code === "23505") {
      return NextResponse.json({ error: "Ya cobraste la recompensa de esta semana." }, { status: 409 });
    }
    console.error("[semanal] cobrar", error);
    return NextResponse.json({ error: "No pudimos acreditar la recompensa." }, { status: 500 });
  }

  // El XP va como una partida sin preguntas: así entra por el mismo camino que
  // el resto y la racha y los desbloqueos se recalculan solos por trigger.
  const { error: runError } = await admin.from("game_runs").insert({
    student_id: ctx.user.id,
    course_id: courseId,
    game: status.game,
    correct: 0,
    total: 0,
    xp: WEEKLY_XP,
  });
  if (runError) console.error("[semanal] acreditar xp", runError);

  const { data: nuevos } = await admin
    .from("student_avatar_items")
    .select("item_id, avatar_items(name)")
    .eq("student_id", ctx.user.id)
    .eq("seen", false);

  return NextResponse.json({
    ok: true,
    xp: WEEKLY_XP,
    weeksDone: status.weeksDone + 1,
    unlocked: (nuevos ?? []).map((n) => (n.avatar_items as { name: string } | null)?.name).filter(Boolean),
  });
}
