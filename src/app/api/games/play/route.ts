import { NextResponse } from "next/server";
import { z } from "zod";
import { getOptionalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROUND_SIZE, type GameKey } from "@/lib/games/config";

/**
 * Arma una partida. Devuelve los desafíos SIN la respuesta correcta: el estudiante
 * no puede leer `game_challenges` (RLS lo bloquea) y la corrección pasa por
 * /api/games/finish, así el juego no se gana mirando el network tab.
 */

const schema = z.object({
  game: z.enum(["duelo", "momento", "glosario"]),
  /** Opcional: jugar sólo con el material de una clase. */
  classId: z.guid().nullable().optional(),
});

export async function POST(request: Request) {
  const ctx = await getOptionalUser();
  if (!ctx) return NextResponse.json({ error: "Tu sesión expiró. Volvé a ingresar." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  const game = parsed.data.game as GameKey;
  const classId = parsed.data.classId ?? null;

  const supabase = await createClient();

  // La comisión del estudiante (RLS ya limita enrollments a lo propio).
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("course_id")
    .eq("student_id", ctx.user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!enrollment) return NextResponse.json({ error: "Todavía no estás en ninguna comisión." }, { status: 403 });
  const courseId = enrollment.course_id;

  const { data: config } = await supabase
    .from("course_games")
    .select("enabled")
    .eq("course_id", courseId)
    .eq("game", game)
    .maybeSingle();

  if (config && !config.enabled) {
    return NextResponse.json({ error: "El equipo docente desactivó este juego." }, { status: 403 });
  }

  const admin = createAdminClient();
  let query = admin
    .from("game_challenges")
    .select("id, prompt, options, class_id")
    .eq("course_id", courseId)
    .eq("game", game)
    .limit(80);
  if (classId) query = query.eq("class_id", classId);

  const { data: pool, error } = await query;
  if (error) {
    console.error("[juegos] armar partida", error);
    return NextResponse.json({ error: "No pudimos armar la partida." }, { status: 500 });
  }
  if (!pool || pool.length === 0) {
    return NextResponse.json(
      { error: "Todavía no hay desafíos para este juego. El equipo docente los genera desde el panel." },
      { status: 404 },
    );
  }

  // Barajado Fisher-Yates y recorte a la ronda.
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const challenges = shuffled.slice(0, ROUND_SIZE).map((c) => ({
    id: c.id,
    prompt: c.prompt,
    options: Array.isArray(c.options) ? (c.options as string[]) : [],
    classId: c.class_id,
  }));

  return NextResponse.json({ game, courseId, challenges });
}
