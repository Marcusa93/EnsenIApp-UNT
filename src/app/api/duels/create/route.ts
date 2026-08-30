import { NextResponse } from "next/server";
import { z } from "zod";
import { getOptionalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROUND_SIZE, type GameKey } from "@/lib/games/config";
import { notifyUsers } from "@/lib/push/send";

/**
 * Manda un reto: arma la misma ronda que /api/games/play (Fisher-Yates sobre el
 * banco de la clase) pero la congela en challenge_ids, así el rival juega
 * exactamente las mismas preguntas aunque conteste días después. El desafiante
 * juega esta misma ronda de una — la devuelve /api/duels/create para eso.
 */

const schema = z.object({
  game: z.enum(["duelo", "momento", "glosario"]),
  classId: z.guid(),
  opponentId: z.guid(),
});

export async function POST(request: Request) {
  const ctx = await getOptionalUser();
  if (!ctx) return NextResponse.json({ error: "Tu sesión expiró. Volvé a ingresar." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  const { game, classId, opponentId } = parsed.data as { game: GameKey; classId: string; opponentId: string };

  if (opponentId === ctx.user.id) {
    return NextResponse.json({ error: "No podés retarte a vos mismo." }, { status: 400 });
  }

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

  const { data: clase } = await supabase.from("classes").select("id").eq("id", classId).eq("course_id", courseId).maybeSingle();
  if (!clase) return NextResponse.json({ error: "Esa clase no existe en tu comisión." }, { status: 404 });

  // v_classmates ya filtra por comisión activa: si aparece ahí, es un rival válido.
  const { data: rival } = await supabase
    .from("v_classmates")
    .select("student_id")
    .eq("course_id", courseId)
    .eq("student_id", opponentId)
    .maybeSingle();
  if (!rival) return NextResponse.json({ error: "Ese compañero no está en tu comisión." }, { status: 400 });

  const admin = createAdminClient();
  const { data: pool, error: poolError } = await admin
    .from("game_challenges")
    .select("id, prompt, options")
    .eq("course_id", courseId)
    .eq("class_id", classId)
    .eq("game", game)
    .limit(80);

  if (poolError) {
    console.error("[retos] armar ronda", poolError);
    return NextResponse.json({ error: "No pudimos armar el reto." }, { status: 500 });
  }
  if (!pool || pool.length === 0) {
    return NextResponse.json({ error: "Todavía no hay desafíos para esta clase y este juego." }, { status: 404 });
  }

  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const picked = shuffled.slice(0, ROUND_SIZE);

  const { data: duel, error: insertError } = await admin
    .from("game_duels")
    .insert({
      course_id: courseId,
      class_id: classId,
      game,
      challenger_id: ctx.user.id,
      opponent_id: opponentId,
      challenge_ids: picked.map((c) => c.id),
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json(
        { error: "Ya tenés un reto pendiente con ese compañero sobre esta clase." },
        { status: 409 },
      );
    }
    console.error("[retos] crear reto", insertError);
    return NextResponse.json({ error: "No pudimos crear el reto." }, { status: 500 });
  }

  // Avisarle al rival: sin esto el reto sólo aparece si entra a Juegos de
  // casualidad, y el reto asincrónico se muere ahí.
  const { data: yo } = await admin
    .from("student_avatars")
    .select("callsign")
    .eq("student_id", ctx.user.id)
    .maybeSingle();
  void notifyUsers([opponentId], {
    kind: "reto",
    title: `${yo?.callsign ?? "Alguien de tu comisión"} te retó`,
    body: "Cinco preguntas de la clase. Jugalas cuando puedas y se define quién gana.",
    url: "/campus/estudiante/juegos",
    courseId,
    createdBy: ctx.user.id,
  }).catch((err) => console.error("[retos] aviso al rival", err));

  const challenges = picked.map((c) => ({
    id: c.id,
    prompt: c.prompt,
    options: Array.isArray(c.options) ? (c.options as string[]) : [],
  }));

  return NextResponse.json({ duelId: duel.id, challenges });
}
