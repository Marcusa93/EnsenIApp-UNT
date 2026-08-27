import type { DbClient } from "@/lib/courses";
import { GAMES, type GameKey } from "./config";

/**
 * El desafío de la semana.
 *
 * Una meta que se renueva todos los lunes. No hay tabla de desafíos: cuál toca
 * se deduce de la fecha, así que es la misma para toda la comisión y no hay nada
 * que administrar. El avance se cuenta desde las partidas de la semana.
 */

/** XP extra por cumplir la meta. Vale más que una partida perfecta, y menos que un nivel. */
export const WEEKLY_XP = 120;

/** Aciertos que hay que juntar en la semana. */
export const WEEKLY_TARGET = 20;

const TZ = "America/Argentina/Tucuman";

/** Lunes de la semana de `date`, en hora de Tucumán, como YYYY-MM-DD. */
export function weekStart(date = new Date()): string {
  // Se pasa a hora local de Tucumán antes de calcular el día de la semana:
  // si no, entre las 21 y las 24 el servidor (UTC) ya estaría en el día siguiente.
  const local = new Date(date.toLocaleString("en-US", { timeZone: TZ }));
  const day = local.getDay(); // 0 = domingo
  const backToMonday = day === 0 ? 6 : day - 1;
  local.setDate(local.getDate() - backToMonday);
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, "0");
  const d = String(local.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Domingo siguiente, para poder mostrar cuánto queda. */
export function weekEnd(start: string): Date {
  const [y, m, d] = start.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 7, 3)); // lunes 00:00 de Tucumán = 03:00 UTC
}

/**
 * Qué juego toca esta semana. Determinístico: la misma semana da el mismo juego
 * para toda la comisión, sin guardar nada.
 */
export function weeklyGame(start: string): GameKey {
  const seed = start.split("-").reduce((acc, p) => acc + Number(p), 0);
  return GAMES[seed % GAMES.length].key;
}

export interface WeeklyStatus {
  weekStart: string;
  /** Juego destacado de la semana; suma parejo aunque jueguen otros. */
  game: GameKey;
  gameName: string;
  target: number;
  correct: number;
  done: boolean;
  claimed: boolean;
  /** Semanas cumplidas en total: abre el equipo exclusivo. */
  weeksDone: number;
  endsAt: string;
}

export async function getWeeklyStatus(
  supabase: DbClient,
  studentId: string,
  courseId: string,
): Promise<WeeklyStatus> {
  const start = weekStart();
  const startIso = `${start}T00:00:00-03:00`;

  const [runsRes, claimRes, weeksRes] = await Promise.all([
    supabase
      .from("game_runs")
      .select("correct")
      .eq("student_id", studentId)
      .eq("course_id", courseId)
      .gte("created_at", startIso),
    supabase
      .from("weekly_claims")
      .select("week_start")
      .eq("student_id", studentId)
      .eq("course_id", courseId)
      .eq("week_start", start)
      .maybeSingle(),
    supabase.from("weekly_claims").select("week_start", { count: "exact", head: true }).eq("student_id", studentId),
  ]);

  const correct = (runsRes.data ?? []).reduce((acc, r) => acc + (r.correct ?? 0), 0);
  const game = weeklyGame(start);

  return {
    weekStart: start,
    game,
    gameName: GAMES.find((g) => g.key === game)?.name ?? "",
    target: WEEKLY_TARGET,
    correct,
    done: correct >= WEEKLY_TARGET,
    claimed: claimRes.data != null,
    weeksDone: weeksRes.count ?? 0,
    endsAt: weekEnd(start).toISOString(),
  };
}
