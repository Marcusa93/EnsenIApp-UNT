import { NextResponse } from "next/server";
import { z } from "zod";
import { getOptionalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROUND_SIZE, xpForRun, type GameKey } from "@/lib/games/config";
import { BOTUDIANTE_BY_ID } from "@/lib/games/botudiantes";
import { registrarRepaso } from "@/lib/games/repaso";

/**
 * Corrige la práctica contra un Botudiante. El lado del estudiante se corrige
 * igual que siempre (server-side, re-consultando game_challenges por id) y el
 * lado del bot se simula acá: acierta cada pregunta con la probabilidad de su
 * nivel. No hay fila en game_duels — la práctica es efímera: lo único que
 * persiste es la partida real del estudiante en game_runs (mismo XP, racha y
 * tabla de posiciones que cualquier partida) más el bonus chico si le ganó.
 */

const schema = z.object({
  game: z.enum(["duelo", "momento", "glosario"]),
  classId: z.guid().nullable().optional(),
  botId: z.string().max(40),
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
  if (!parsed.success) return NextResponse.json({ error: "Práctica inválida." }, { status: 400 });
  const game = parsed.data.game as GameKey;

  const bot = BOTUDIANTE_BY_ID.get(parsed.data.botId);
  if (!bot) return NextResponse.json({ error: "Ese Botudiante no existe." }, { status: 404 });

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

  const byId = new Map(parsed.data.answers.map((a) => [a.id, a.chosen]));
  const ids = [...byId.keys()];

  const admin = createAdminClient();
  const { data: challenges, error } = await admin
    .from("game_challenges")
    .select("id, correct_index, explanation, source_quote, source_seconds, class_id")
    .in("id", ids)
    .eq("course_id", courseId)
    .eq("game", game);

  if (error || !challenges || challenges.length === 0) {
    console.error("[botudiantes] corregir", error);
    return NextResponse.json({ error: "No pudimos corregir la práctica." }, { status: 500 });
  }

  await registrarRepaso(
    admin,
    ctx.user.id,
    challenges.map((c) => ({ challengeId: c.id, acerto: byId.get(c.id) === c.correct_index })),
  );

  const detalle = challenges.map((c) => {
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

  const correct = challenges.filter((c) => byId.get(c.id) === c.correct_index).length;
  const total = challenges.length;
  const xp = xpForRun(correct, total);

  // El bot juega su lado acá mismo: cada pregunta sale con la moneda cargada
  // de su nivel.
  let botCorrect = 0;
  for (let i = 0; i < total; i++) if (Math.random() < bot.prob) botCorrect++;

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
    console.error("[botudiantes] guardar partida", runError);
    return NextResponse.json({ error: "No pudimos guardar tu práctica." }, { status: 500 });
  }

  const won = correct > botCorrect;
  const draw = correct === botCorrect;
  let bonusXp = 0;
  if (won) {
    bonusXp = bot.winBonus;
    const { error: bonusError } = await admin.from("game_runs").insert({
      student_id: ctx.user.id,
      course_id: courseId,
      class_id: classId,
      game,
      correct: 0,
      total: 0,
      xp: bonusXp,
    });
    if (bonusError) console.error("[botudiantes] bonus", bonusError);
  }

  return NextResponse.json({ correct, total, xp, results: detalle, bonusXp, bot: { correct: botCorrect, total }, won, draw });
}
