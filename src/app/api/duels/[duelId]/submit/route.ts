import { NextResponse } from "next/server";
import { z } from "zod";
import { getOptionalUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROUND_SIZE, DUEL_WIN_BONUS, DUEL_DRAW_BONUS, xpForRun, type GameKey } from "@/lib/games/config";
import { notifyUsers } from "@/lib/push/send";
import { registrarRepaso } from "@/lib/games/repaso";

/**
 * Corrige la respuesta de UNO de los dos lados del reto (challenger u opponent,
 * según quién llame). Igual que /api/games/finish: la corrección es siempre del
 * lado del servidor, re-consultando game_challenges por id.
 *
 * Cada lado que juega genera una fila de game_runs normal — así el reto suma al
 * mismo XP/racha/tabla de posiciones que cualquier partida. Cuando el segundo
 * lado termina, se decide el ganador (más aciertos; empate en aciertos lo
 * desempata quien tardó menos) y se acredita un bonus de XP extra con el mismo
 * truco que el desafío semanal: una fila de game_runs sin preguntas.
 */

const paramsSchema = z.object({ duelId: z.guid() });

/** Trae las preguntas congeladas del reto (sin correct_index) para que el rival las juegue. */
export async function GET(_request: Request, ctx: { params: Promise<{ duelId: string }> }) {
  const authCtx = await getOptionalUser();
  if (!authCtx) return NextResponse.json({ error: "Tu sesión expiró. Volvé a ingresar." }, { status: 401 });

  const parsed = paramsSchema.safeParse(await ctx.params);
  if (!parsed.success) return NextResponse.json({ error: "Reto inválido." }, { status: 400 });

  const admin = createAdminClient();
  const { data: duel } = await admin
    .from("game_duels")
    .select("challenger_id, opponent_id, challenger_run_id, opponent_run_id, status, game, challenge_ids")
    .eq("id", parsed.data.duelId)
    .maybeSingle();

  if (!duel) return NextResponse.json({ error: "Ese reto no existe." }, { status: 404 });
  const isChallenger = duel.challenger_id === authCtx.user.id;
  const isOpponent = duel.opponent_id === authCtx.user.id;
  if (!isChallenger && !isOpponent) return NextResponse.json({ error: "No sos parte de este reto." }, { status: 403 });
  if (duel.status !== "pendiente") return NextResponse.json({ error: "Este reto ya no está disponible." }, { status: 409 });
  if ((isChallenger && duel.challenger_run_id) || (isOpponent && duel.opponent_run_id)) {
    return NextResponse.json({ error: "Ya jugaste este reto." }, { status: 409 });
  }

  const { data: rows, error } = await admin
    .from("game_challenges")
    .select("id, prompt, options")
    .in("id", duel.challenge_ids)
    .eq("game", duel.game);
  if (error || !rows) return NextResponse.json({ error: "No pudimos cargar el reto." }, { status: 500 });

  // Mismo orden congelado en challenge_ids, no el orden que devuelva la consulta.
  const byId = new Map(rows.map((r) => [r.id, r]));
  const challenges = duel.challenge_ids
    .map((id) => byId.get(id))
    .filter((c): c is NonNullable<typeof c> => c != null)
    .map((c) => ({ id: c.id, prompt: c.prompt, options: Array.isArray(c.options) ? (c.options as string[]) : [] }));

  return NextResponse.json({ game: duel.game, challenges });
}

const schema = z.object({
  durationSeconds: z.number().int().min(0).max(3600).optional(),
  answers: z
    .array(z.object({ id: z.guid(), chosen: z.number().int().min(-1).max(3) }))
    .min(1)
    .max(ROUND_SIZE),
});

export async function POST(request: Request, ctx: { params: Promise<{ duelId: string }> }) {
  const authCtx = await getOptionalUser();
  if (!authCtx) return NextResponse.json({ error: "Tu sesión expiró. Volvé a ingresar." }, { status: 401 });

  const paramsParsed = paramsSchema.safeParse(await ctx.params);
  if (!paramsParsed.success) return NextResponse.json({ error: "Reto inválido." }, { status: 400 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Respuesta inválida." }, { status: 400 });

  const admin = createAdminClient();
  const { data: duel, error: duelError } = await admin
    .from("game_duels")
    .select("*")
    .eq("id", paramsParsed.data.duelId)
    .maybeSingle();

  if (duelError || !duel) return NextResponse.json({ error: "Ese reto no existe." }, { status: 404 });

  const isChallenger = duel.challenger_id === authCtx.user.id;
  const isOpponent = duel.opponent_id === authCtx.user.id;
  if (!isChallenger && !isOpponent) {
    return NextResponse.json({ error: "No sos parte de este reto." }, { status: 403 });
  }
  if (duel.status === "rechazado") {
    return NextResponse.json({ error: "Este reto fue rechazado." }, { status: 409 });
  }
  if ((isChallenger && duel.challenger_run_id) || (isOpponent && duel.opponent_run_id)) {
    return NextResponse.json({ error: "Ya jugaste este reto." }, { status: 409 });
  }

  const byId = new Map(parsed.data.answers.map((a) => [a.id, a.chosen]));
  const { data: challenges, error: chError } = await admin
    .from("game_challenges")
    .select("id, correct_index, explanation, source_quote, source_seconds, class_id")
    .in("id", duel.challenge_ids)
    .eq("game", duel.game)
    .eq("course_id", duel.course_id);

  if (chError || !challenges || challenges.length === 0) {
    console.error("[retos] corregir", chError);
    return NextResponse.json({ error: "No pudimos corregir el reto." }, { status: 500 });
  }

  await registrarRepaso(
    admin,
    authCtx.user.id,
    challenges.map((c) => ({ challengeId: c.id, acerto: byId.get(c.id) === c.correct_index })),
  );

  // El repaso por pregunta: qué se falló, por qué, y de dónde sale en la clase.
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
  const duration = parsed.data.durationSeconds ?? null;
  const xp = xpForRun(correct, total);

  const { data: run, error: runError } = await admin
    .from("game_runs")
    .insert({
      student_id: authCtx.user.id,
      course_id: duel.course_id,
      class_id: duel.class_id,
      game: duel.game as GameKey,
      correct,
      total,
      xp,
      duration_seconds: duration,
    })
    .select("id")
    .single();

  if (runError || !run) {
    console.error("[retos] guardar partida", runError);
    return NextResponse.json({ error: "No pudimos guardar tu partida." }, { status: 500 });
  }

  const sideUpdate = isChallenger
    ? {
        challenger_run_id: run.id,
        challenger_correct: correct,
        challenger_total: total,
        challenger_duration_seconds: duration,
      }
    : {
        opponent_run_id: run.id,
        opponent_correct: correct,
        opponent_total: total,
        opponent_duration_seconds: duration,
        responded_at: new Date().toISOString(),
      };

  const bothDone = isChallenger
    ? duel.opponent_run_id != null
    : duel.challenger_run_id != null;

  let winnerId: string | null = null;
  let bonusForMe = 0;
  if (bothDone) {
    const myCorrect = correct;
    const myDuration = duration ?? Number.MAX_SAFE_INTEGER;
    const otherCorrect = isChallenger ? (duel.opponent_correct ?? 0) : (duel.challenger_correct ?? 0);
    const otherDuration = (isChallenger ? duel.opponent_duration_seconds : duel.challenger_duration_seconds) ?? Number.MAX_SAFE_INTEGER;
    const otherId = isChallenger ? duel.opponent_id : duel.challenger_id;

    if (myCorrect > otherCorrect || (myCorrect === otherCorrect && myDuration < otherDuration)) {
      winnerId = authCtx.user.id;
    } else if (otherCorrect > myCorrect || (otherCorrect === myCorrect && otherDuration < myDuration)) {
      winnerId = otherId;
    } else {
      winnerId = null; // empate de verdad (mismos aciertos y misma duración, o ambas null)
    }

    const bonusRows: { student_id: string; xp: number }[] =
      winnerId === null
        ? [
            { student_id: authCtx.user.id, xp: DUEL_DRAW_BONUS },
            { student_id: otherId, xp: DUEL_DRAW_BONUS },
          ]
        : [{ student_id: winnerId, xp: DUEL_WIN_BONUS }];

    for (const b of bonusRows) {
      const { error: bonusError } = await admin.from("game_runs").insert({
        student_id: b.student_id,
        course_id: duel.course_id,
        class_id: duel.class_id,
        game: duel.game as GameKey,
        correct: 0,
        total: 0,
        xp: b.xp,
      });
      if (bonusError) console.error("[retos] bonus xp", bonusError);
      if (b.student_id === authCtx.user.id) bonusForMe = b.xp;
    }
  }

  const { error: updateError } = await admin
    .from("game_duels")
    .update({
      ...sideUpdate,
      ...(bothDone ? { status: "completado", winner_id: winnerId, completed_at: new Date().toISOString() } : {}),
    })
    .eq("id", duel.id);

  if (updateError) console.error("[retos] cerrar reto", updateError);

  // Cuando se cierra, el otro se enteró del resultado sin haber estado presente.
  if (bothDone) {
    const otroId = isChallenger ? duel.opponent_id : duel.challenger_id;
    const { data: yo } = await admin
      .from("student_avatars")
      .select("callsign")
      .eq("student_id", authCtx.user.id)
      .maybeSingle();
    const alias = yo?.callsign ?? "Tu rival";
    const gano = winnerId === otroId;
    void notifyUsers([otroId], {
      kind: "reto",
      title: winnerId === null ? `Empataste con ${alias}` : gano ? `Le ganaste a ${alias}` : `${alias} te ganó el reto`,
      body: `Terminó ${correct} a ${isChallenger ? (duel.opponent_correct ?? 0) : (duel.challenger_correct ?? 0)}.`,
      url: "/campus/estudiante/juegos",
      courseId: duel.course_id,
      createdBy: authCtx.user.id,
    }).catch((err) => console.error("[retos] aviso de resultado", err));
  }

  return NextResponse.json({
    correct,
    total,
    xp,
    results: detalle,
    bonusXp: bonusForMe,
    done: bothDone,
    ...(bothDone
      ? {
          opponentCorrect: isChallenger ? duel.opponent_correct : duel.challenger_correct,
          opponentTotal: isChallenger ? duel.opponent_total : duel.challenger_total,
          won: winnerId === authCtx.user.id,
          draw: winnerId === null,
        }
      : {}),
  });
}
