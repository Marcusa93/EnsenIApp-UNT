import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

/**
 * Repaso espaciado: qué preguntas mostrar y cuándo volver a mostrarlas.
 *
 * La ronda deja de ser un azar sobre todo el banco y pasa a armarse por
 * prioridad:
 *
 *   1. Lo vencido — lo que ya tocaba repasar, empezando por lo más atrasado.
 *      Acá viven las que fallaste: vuelven al día siguiente.
 *   2. Lo nunca visto — material nuevo, para no quedar girando sobre lo mismo.
 *   3. Lo que falte para completar, agarrando lo que esté más cerca de vencer.
 *
 * Dentro de cada grupo se desempata al azar, así dos partidas seguidas no
 * salen idénticas aunque el banco sea chico.
 */

type Admin = SupabaseClient<Database>;

/** Días hasta el próximo repaso según cuántas veces seguidas se acertó. */
const INTERVALOS = [1, 3, 7, 16, 35];

export function proximoIntervalo(correctStreak: number): number {
  return INTERVALOS[Math.min(correctStreak, INTERVALOS.length - 1)];
}

interface ConId {
  id: string;
}

/**
 * Ordena el banco por prioridad de repaso para un estudiante.
 * Devuelve los primeros `cuantos`.
 */
export async function elegirPorRepaso<T extends ConId>(
  admin: Admin,
  studentId: string,
  pool: T[],
  cuantos: number,
): Promise<T[]> {
  if (pool.length <= cuantos) return barajar(pool);

  const { data: reviews, error } = await admin
    .from("challenge_reviews")
    .select("challenge_id, due_at")
    .eq("student_id", studentId)
    .in(
      "challenge_id",
      pool.map((c) => c.id),
    );

  // Si el historial no se puede leer, se cae al azar de siempre: preferimos una
  // ronda peor ordenada antes que no poder jugar.
  if (error) {
    console.error("[repaso] leer historial", error);
    return barajar(pool).slice(0, cuantos);
  }

  const vencimiento = new Map((reviews ?? []).map((r) => [r.challenge_id, Date.parse(r.due_at)]));
  const ahora = Date.now();

  const vencidas: T[] = [];
  const nuevas: T[] = [];
  const resto: T[] = [];
  for (const c of pool) {
    const due = vencimiento.get(c.id);
    if (due === undefined) nuevas.push(c);
    else if (due <= ahora) vencidas.push(c);
    else resto.push(c);
  }

  // Lo más atrasado primero; lo que todavía no vence, lo que vence antes.
  vencidas.sort((a, b) => (vencimiento.get(a.id) ?? 0) - (vencimiento.get(b.id) ?? 0));
  resto.sort((a, b) => (vencimiento.get(a.id) ?? 0) - (vencimiento.get(b.id) ?? 0));

  return [...vencidas, ...barajar(nuevas), ...resto].slice(0, cuantos);
}

/**
 * Registra cómo le fue y reprograma cada pregunta.
 *
 * Acertar espacia la próxima aparición; fallar la trae de vuelta al día
 * siguiente y reinicia la cuenta. Se hace con el cliente admin porque escribir
 * el historial es del servidor, igual que corregir.
 */
export async function registrarRepaso(
  admin: Admin,
  studentId: string,
  resultados: { challengeId: string; acerto: boolean }[],
): Promise<void> {
  if (resultados.length === 0) return;

  const { data: previos, error } = await admin
    .from("challenge_reviews")
    .select("challenge_id, seen, correct_streak")
    .eq("student_id", studentId)
    .in(
      "challenge_id",
      resultados.map((r) => r.challengeId),
    );
  if (error) console.error("[repaso] leer previos", error);

  const previo = new Map((previos ?? []).map((p) => [p.challenge_id, p]));
  const ahora = new Date();

  const filas = resultados.map((r) => {
    const p = previo.get(r.challengeId);
    const streak = r.acerto ? (p?.correct_streak ?? 0) + 1 : 0;
    const dias = r.acerto ? proximoIntervalo(streak - 1) : 1;
    const due = new Date(ahora.getTime() + dias * 24 * 60 * 60 * 1000);
    return {
      student_id: studentId,
      challenge_id: r.challengeId,
      seen: (p?.seen ?? 0) + 1,
      correct_streak: streak,
      last_seen_at: ahora.toISOString(),
      due_at: due.toISOString(),
    };
  });

  const { error: upsertError } = await admin
    .from("challenge_reviews")
    .upsert(filas, { onConflict: "student_id,challenge_id" });
  // No corta la partida: el puntaje ya se guardó, esto es la programación del repaso.
  if (upsertError) console.error("[repaso] guardar", upsertError);
}

function barajar<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
