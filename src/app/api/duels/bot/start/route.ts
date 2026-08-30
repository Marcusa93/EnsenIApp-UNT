import { NextResponse } from "next/server";
import { z } from "zod";
import { getOptionalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROUND_SIZE, type GameKey } from "@/lib/games/config";
import { BOTUDIANTE_BY_ID } from "@/lib/games/botudiantes";

/**
 * Arma una ronda de práctica contra un Botudiante. Igual que /api/games/play,
 * con una diferencia: el banco se filtra por la dificultad máxima del bot, así
 * la práctica es gradual — contra el novato entran sólo las preguntas fáciles,
 * contra el jurista entra todo. Si el filtro deja el banco corto, se abre a
 * todas las dificultades antes que devolver una ronda pobre.
 */

const schema = z.object({
  game: z.enum(["duelo", "momento", "glosario"]),
  classId: z.guid().nullable().optional(),
  botId: z.string().max(40),
});

export async function POST(request: Request) {
  const ctx = await getOptionalUser();
  if (!ctx) return NextResponse.json({ error: "Tu sesión expiró. Volvé a ingresar." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  const game = parsed.data.game as GameKey;
  const classId = parsed.data.classId ?? null;

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

  const admin = createAdminClient();
  const buscar = (conFiltro: boolean) => {
    let q = admin
      .from("game_challenges")
      .select("id, prompt, options")
      .eq("course_id", courseId)
      .eq("game", game)
      .limit(80);
    if (classId) q = q.eq("class_id", classId);
    if (conFiltro) q = q.lte("difficulty", bot.maxDifficulty);
    return q;
  };

  let { data: pool, error } = await buscar(true);
  if (!error && (pool?.length ?? 0) < ROUND_SIZE && bot.maxDifficulty < 3) {
    ({ data: pool, error } = await buscar(false));
  }
  if (error) {
    console.error("[botudiantes] armar ronda", error);
    return NextResponse.json({ error: "No pudimos armar la práctica." }, { status: 500 });
  }
  if (!pool || pool.length === 0) {
    return NextResponse.json({ error: "Todavía no hay desafíos para practicar acá." }, { status: 404 });
  }

  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const challenges = shuffled.slice(0, ROUND_SIZE).map((c) => ({
    id: c.id,
    prompt: c.prompt,
    options: Array.isArray(c.options) ? (c.options as string[]) : [],
  }));

  return NextResponse.json({ botId: bot.id, challenges });
}
