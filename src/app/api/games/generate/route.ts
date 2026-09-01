import { NextResponse } from "next/server";
import { z } from "zod";
import { getOptionalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseSegments } from "@/components/class-content/parse";
import { GAMES, type GameKey } from "@/lib/games/config";
import { generateChallenges, findQuoteSeconds, mmss } from "@/lib/games/generate";
import { errorMessage } from "@/lib/utils";

export const maxDuration = 300;

/**
 * Genera el banco de desafíos de una clase (uno por juego habilitado).
 * Lo dispara el equipo docente desde el panel de juegos. Es idempotente por
 * juego: al regenerar, reemplaza los desafíos anteriores de esa misma fuente.
 *
 * Dos fuentes posibles:
 *   - `recordingId` → la grabación (transcripción minutada + resumen + glosario).
 *   - `classId`     → el apunte de la clase, para las que no se graban. Sin
 *     transcripción no hay minutos, así que «¿en qué minuto?» queda afuera.
 */

const schema = z
  .object({
    recordingId: z.guid().optional(),
    /** Genera desde el apunte de la clase (para clases sin grabación). */
    classId: z.guid().optional(),
    /** Si no viene, genera para todos los juegos habilitados en la comisión. */
    games: z.array(z.enum(["duelo", "momento", "glosario"])).optional(),
    /**
     * Con 6 por juego y rondas de 5, el estudiante veía casi siempre las mismas
     * preguntas: un banco chico hace que el repaso espaciado no tenga de dónde
     * elegir. 12 da margen para varias rondas distintas por clase.
     */
    countPerGame: z.number().int().min(3).max(30).default(12),
  })
  .refine((v) => Boolean(v.recordingId) !== Boolean(v.classId), {
    message: "Indicá una grabación o una clase, no las dos.",
  });

/** Transcripción agrupada en líneas "[mm:ss] texto", como la que ve Alberdi. */
function stamped(segments: { start?: number; text?: string }[], limit: number): string {
  const lines: string[] = [];
  let lineStart = -1;
  let buffer = "";
  for (const s of segments) {
    if (typeof s.start !== "number" || !s.text) continue;
    if (lineStart < 0 || s.start - lineStart >= 30) {
      if (buffer) lines.push(`[${mmss(lineStart)}] ${buffer.trim()}`);
      lineStart = s.start;
      buffer = "";
    }
    buffer += ` ${s.text.trim()}`;
  }
  if (buffer) lines.push(`[${mmss(lineStart)}] ${buffer.trim()}`);
  const joined = lines.join("\n");
  return joined.length <= limit ? joined : joined.slice(0, limit);
}

interface Fuente {
  classId: string;
  courseId: string;
  classTopic: string;
  /** null cuando el material es el apunte y no una grabación. */
  recordingId: string | null;
  segments: { start?: number; text?: string }[];
  /** Material para «duelo»: conceptos de la clase. */
  conceptual: string;
  /** Material para «glosario»: términos con su definición. */
  glossaryMaterial: string;
}

export async function POST(request: Request) {
  const ctx = await getOptionalUser();
  if (!ctx) return NextResponse.json({ error: "Tu sesión expiró. Volvé a ingresar." }, { status: 401 });
  if (ctx.profile.role !== "docente" && ctx.profile.role !== "admin") {
    return NextResponse.json({ error: "Sólo el equipo docente puede generar desafíos." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  const { recordingId, classId, countPerGame } = parsed.data;

  const supabase = await createClient();

  let fuente: Fuente;
  try {
    fuente = recordingId
      ? await desdeGrabacion(supabase, recordingId)
      : await desdeApunte(supabase, classId as string);
  } catch (err) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json({ error: e.message ?? "No se pudo leer el material." }, { status: e.status ?? 500 });
  }

  if (ctx.profile.role !== "admin") {
    const { data: assignment } = await supabase
      .from("teacher_assignments")
      .select("course_id")
      .eq("teacher_id", ctx.user.id)
      .eq("course_id", fuente.courseId)
      .maybeSingle();
    if (!assignment) return NextResponse.json({ error: "No sos docente de este curso." }, { status: 403 });
  }

  // Qué juegos están prendidos en esta comisión.
  const { data: enabledRows } = await supabase
    .from("course_games")
    .select("game, enabled")
    .eq("course_id", fuente.courseId);
  const enabled = new Set((enabledRows ?? []).filter((r) => r.enabled).map((r) => r.game as GameKey));
  const wanted = (parsed.data.games as GameKey[] | undefined) ?? GAMES.map((g) => g.key);
  const targets = wanted.filter((g) => enabled.size === 0 || enabled.has(g));

  if (targets.length === 0) {
    return NextResponse.json({ error: "No hay juegos habilitados en esta comisión." }, { status: 409 });
  }

  const admin = createAdminClient();
  const results: Record<string, number> = {};
  const problems: string[] = [];

  for (const game of targets) {
    // "momento" necesita la transcripción minutada sí o sí; sin ella no tiene sentido.
    if (game === "momento" && fuente.segments.length === 0) {
      problems.push(
        fuente.recordingId
          ? "«¿En qué minuto?» necesita la transcripción con marcas de tiempo."
          : "«¿En qué minuto?» no se puede generar desde un apunte: necesita la grabación.",
      );
      continue;
    }
    if (game === "glosario" && !fuente.glossaryMaterial) {
      problems.push("«Glosario relámpago» necesita el glosario o el texto de la clase.");
      continue;
    }

    try {
      const material =
        game === "momento" ? stamped(fuente.segments, 45_000) : game === "glosario" ? fuente.glossaryMaterial : fuente.conceptual;
      const generated = await generateChallenges({
        game,
        material,
        classTopic: fuente.classTopic,
        count: countPerGame,
      });

      if (generated.length === 0) {
        problems.push(`No salieron desafíos para «${game}».`);
        continue;
      }

      // Regenerar reemplaza: si no, se acumulan versiones viejas del mismo
      // material. Se borra sólo lo de ESTA fuente — una clase puede tener
      // desafíos de su grabación y de su apunte a la vez.
      const previos = admin.from("game_challenges").delete().eq("game", game);
      await (fuente.recordingId
        ? previos.eq("recording_id", fuente.recordingId)
        : previos.eq("class_id", fuente.classId).is("recording_id", null));

      const rows = generated.map((c) => ({
        course_id: fuente.courseId,
        class_id: fuente.classId,
        recording_id: fuente.recordingId,
        game,
        prompt: c.prompt,
        options: c.options,
        correct_index: c.correct_index,
        explanation: c.explanation,
        source_quote: c.source_quote,
        source_seconds: findQuoteSeconds(c.source_quote, fuente.segments),
        difficulty: c.difficulty,
      }));

      const { error } = await admin.from("game_challenges").insert(rows);
      if (error) throw new Error(error.message);
      results[game] = rows.length;
    } catch (err) {
      console.error("[juegos] generación", game, err);
      problems.push(`«${game}»: ${errorMessage(err)}`);
    }
  }

  const total = Object.values(results).reduce((a, b) => a + b, 0);
  if (total === 0) {
    return NextResponse.json({ error: problems.join(" ") || "No se pudo generar ningún desafío." }, { status: 422 });
  }

  return NextResponse.json({ ok: true, generated: results, total, problems });
}

/* ------------------------------------------------------------------ */
/* Fuentes de material                                                  */
/* ------------------------------------------------------------------ */

type Client = Awaited<ReturnType<typeof createClient>>;

function boom(status: number, message: string): never {
  throw Object.assign(new Error(message), { status });
}

/** La grabación procesada: transcripción minutada + resumen + glosario. */
async function desdeGrabacion(supabase: Client, recordingId: string): Promise<Fuente> {
  const { data: rec } = await supabase
    .from("class_recordings")
    .select("id, class_id, status, classes(id, topic, course_id)")
    .eq("id", recordingId)
    .maybeSingle();

  const cls = rec?.classes as { id: string; topic: string; course_id: string } | null;
  if (!rec || !cls) boom(404, "No encontramos esa grabación.");
  if (rec.status !== "ready") boom(409, "La grabación todavía se está procesando.");

  const [transcriptRes, summaryRes] = await Promise.all([
    supabase.from("transcripts").select("full_text, segments").eq("recording_id", recordingId).maybeSingle(),
    supabase
      .from("class_summaries")
      .select("summary_md, key_points, glossary")
      .eq("recording_id", recordingId)
      .maybeSingle(),
  ]);

  const segments = parseSegments(transcriptRes.data?.segments);
  const transcriptText = segments.length > 0 ? stamped(segments, 45_000) : (transcriptRes.data?.full_text ?? "");
  const summary = summaryRes.data;
  if (!transcriptText && !summary) boom(409, "Esta grabación no tiene material para generar desafíos.");

  const keyPoints = Array.isArray(summary?.key_points) ? (summary.key_points as unknown[]) : [];
  const glossary = Array.isArray(summary?.glossary)
    ? (summary.glossary as { term?: string; definition?: string }[])
    : [];

  return {
    classId: cls.id,
    courseId: cls.course_id,
    classTopic: cls.topic,
    recordingId,
    segments,
    conceptual: [
      summary?.summary_md ?? "",
      keyPoints.length > 0 ? `Puntos clave:\n${keyPoints.map((k) => `- ${String(k)}`).join("\n")}` : "",
      transcriptText.slice(0, 25_000),
    ]
      .filter(Boolean)
      .join("\n\n"),
    glossaryMaterial: [
      glossary.length > 0
        ? `Glosario de la clase:\n${glossary
            .filter((g) => g?.term)
            .map((g) => `- ${g.term}: ${g.definition ?? ""}`)
            .join("\n")}`
        : "",
      summary?.summary_md ?? "",
      transcriptText.slice(0, 15_000),
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}

/**
 * El apunte de la clase, para las que no se graban. El material es lo que
 * escribió el docente más el resumen del cronograma: no hay transcripción, así
 * que tampoco hay minutos que citar.
 */
async function desdeApunte(supabase: Client, classId: string): Promise<Fuente> {
  const { data: cls } = await supabase
    .from("classes")
    .select("id, topic, summary, course_id")
    .eq("id", classId)
    .maybeSingle();
  if (!cls) boom(404, "No encontramos esa clase.");

  const { data: note } = await supabase
    .from("class_notes")
    .select("body_md, published")
    .eq("class_id", classId)
    .maybeSingle();
  const apunte = note?.body_md?.trim() ?? "";
  if (apunte.length < 80) {
    boom(409, "Esta clase no tiene apunte. Escribilo desde la clase y volvé a intentar.");
  }
  // Con el apunte en borrador, el estudiante no puede leerlo — pero al fallar una
  // pregunta el repaso le muestra la cita textual de donde salió. Sería filtrar
  // por la ventana lo que la puerta no deja pasar.
  if (!note?.published) {
    boom(409, "El apunte está en borrador. Publicalo y después generá: si no, el estudiante juega sobre algo que no puede leer.");
  }

  const material = [cls.summary ? `Resumen del cronograma:\n${cls.summary}` : "", apunte]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 45_000);

  return {
    classId: cls.id,
    courseId: cls.course_id,
    classTopic: cls.topic,
    recordingId: null,
    segments: [],
    conceptual: material,
    glossaryMaterial: material,
  };
}
