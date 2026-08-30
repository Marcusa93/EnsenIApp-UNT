import { NextResponse } from "next/server";
import { z } from "zod";
import { getOptionalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROUND_SIZE, xpForRun, levelFor, type GameKey } from "@/lib/games/config";
import { registrarRepaso } from "@/lib/games/repaso";

/**
 * Corrige la partida y la registra. La corrección es SIEMPRE del lado del servidor
 * (el cliente nunca tuvo la respuesta), y el XP se acumula por trigger junto con
 * la racha, así la partida y la progresión no pueden quedar desfasadas.
 */

const schema = z.object({
  game: z.enum(["duelo", "momento", "glosario"]),
  classId: z.guid().nullable().optional(),
  durationSeconds: z.number().int().min(0).max(3600).optional(),
  answers: z
    .array(z.object({ id: z.guid(), chosen: z.number().int().min(-1).max(3) }))
    .min(1)
    .max(ROUND_SIZE),
});

export async function POST(request: Request) {
  const ctx = await getOptionalUser();
  if (!ctx) return NextResponse.json({ error: "Tu sesión expiró. Volvé a ingresar." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Partida inválida." }, { status: 400 });
  const game = parsed.data.game as GameKey;

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

  // Una respuesta por desafío, aunque el cliente mande repetidos.
  const byId = new Map(parsed.data.answers.map((a) => [a.id, a.chosen]));
  const ids = [...byId.keys()];

  const admin = createAdminClient();
  const { data: challenges, error } = await admin
    .from("game_challenges")
    .select("id, correct_index, explanation, source_quote, source_seconds, class_id, game, course_id")
    .in("id", ids)
    .eq("course_id", courseId)
    .eq("game", game);

  if (error) {
    console.error("[juegos] corregir", error);
    return NextResponse.json({ error: "No pudimos corregir la partida." }, { status: 500 });
  }
  if (!challenges || challenges.length === 0) {
    return NextResponse.json({ error: "Esos desafíos no existen." }, { status: 400 });
  }

  const results = challenges.map((c) => {
    const chosen = byId.get(c.id) ?? -1;
    return {
      id: c.id,
      chosen,
      correct: chosen === c.correct_index,
      correctIndex: c.correct_index,
      explanation: c.explanation,
      sourceQuote: c.source_quote,
      sourceSeconds: c.source_seconds,
      classId: c.class_id,
    };
  });

  // Reprograma cada pregunta: lo que acertó se espacia, lo que falló vuelve pronto.
  await registrarRepaso(
    admin,
    ctx.user.id,
    results.map((r) => ({ challengeId: r.id, acerto: r.correct })),
  );

  const correct = results.filter((r) => r.correct).length;
  const total = results.length;
  const xp = xpForRun(correct, total);

  // La clase de la partida: la que pidió el estudiante, o la del material jugado.
  const classId = parsed.data.classId ?? challenges[0]?.class_id ?? null;

  const { error: runError } = await admin.from("game_runs").insert({
    student_id: ctx.user.id,
    course_id: courseId,
    class_id: classId,
    game,
    correct,
    total,
    xp,
    duration_seconds: parsed.data.durationSeconds ?? null,
  });

  if (runError) {
    console.error("[juegos] no se pudo guardar la partida", runError);
    return NextResponse.json({ error: "No pudimos guardar la partida." }, { status: 500 });
  }

  // Estado después del trigger: XP acumulado, racha y nivel para la pantalla final.
  const { data: stats } = await admin
    .from("student_game_stats")
    .select("xp, streak_days, best_streak, runs")
    .eq("student_id", ctx.user.id)
    .eq("course_id", courseId)
    .maybeSingle();

  const totalXp = stats?.xp ?? xp;
  const progress = levelFor(totalXp);
  // Con el XP previo sabemos si esta partida lo hizo subir de nivel.
  const leveledUp = levelFor(Math.max(0, totalXp - xp)).level.n < progress.level.n;

  return NextResponse.json({
    correct,
    total,
    xp,
    results,
    stats: {
      totalXp,
      streakDays: stats?.streak_days ?? 1,
      bestStreak: stats?.best_streak ?? 1,
      runs: stats?.runs ?? 1,
      level: progress.level,
      next: progress.next,
      ratio: progress.ratio,
      xpForNext: progress.xpForNext,
      leveledUp,
    },
  });
}
