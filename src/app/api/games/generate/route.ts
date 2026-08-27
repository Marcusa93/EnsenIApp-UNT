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
 * Genera el banco de desafíos de una grabación (uno por juego habilitado).
 * Lo dispara el equipo docente desde el panel de juegos. Es idempotente por
 * juego: al regenerar, reemplaza los desafíos anteriores de esa grabación.
 */

const schema = z.object({
  recordingId: z.guid(),
  /** Si no viene, genera para todos los juegos habilitados en la comisión. */
  games: z.array(z.enum(["duelo", "momento", "glosario"])).optional(),
  countPerGame: z.number().int().min(3).max(10).default(6),
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

export async function POST(request: Request) {
  const ctx = await getOptionalUser();
  if (!ctx) return NextResponse.json({ error: "Tu sesión expiró. Volvé a ingresar." }, { status: 401 });
  if (ctx.profile.role !== "docente" && ctx.profile.role !== "admin") {
    return NextResponse.json({ error: "Sólo el equipo docente puede generar desafíos." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  const { recordingId, countPerGame } = parsed.data;

  const supabase = await createClient();

  // La grabación, su clase y su curso. RLS ya limita a lo que el docente ve.
  const { data: rec } = await supabase
    .from("class_recordings")
    .select("id, class_id, status, classes(id, topic, course_id)")
    .eq("id", recordingId)
    .maybeSingle();

  const cls = rec?.classes as { id: string; topic: string; course_id: string } | null;
  if (!rec || !cls) return NextResponse.json({ error: "No encontramos esa grabación." }, { status: 404 });
  if (rec.status !== "ready") {
    return NextResponse.json({ error: "La grabación todavía se está procesando." }, { status: 409 });
  }

  if (ctx.profile.role !== "admin") {
    const { data: assignment } = await supabase
      .from("teacher_assignments")
      .select("course_id")
      .eq("teacher_id", ctx.user.id)
      .eq("course_id", cls.course_id)
      .maybeSingle();
    if (!assignment) return NextResponse.json({ error: "No sos docente de este curso." }, { status: 403 });
  }

  // Qué juegos están prendidos en esta comisión.
  const { data: enabledRows } = await supabase
    .from("course_games")
    .select("game, enabled")
    .eq("course_id", cls.course_id);
  const enabled = new Set(
    (enabledRows ?? []).filter((r) => r.enabled).map((r) => r.game as GameKey),
  );
  const wanted = (parsed.data.games as GameKey[] | undefined) ?? GAMES.map((g) => g.key);
  const targets = wanted.filter((g) => enabled.size === 0 || enabled.has(g));

  if (targets.length === 0) {
    return NextResponse.json({ error: "No hay juegos habilitados en esta comisión." }, { status: 409 });
  }

  // Material: transcripción minutada + resumen + glosario.
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

  if (!transcriptText && !summary) {
    return NextResponse.json({ error: "Esta grabación no tiene material para generar desafíos." }, { status: 409 });
  }

  const keyPoints = Array.isArray(summary?.key_points) ? (summary.key_points as unknown[]) : [];
  const glossary = Array.isArray(summary?.glossary)
    ? (summary.glossary as { term?: string; definition?: string }[])
    : [];

  const conceptual = [
    summary?.summary_md ?? "",
    keyPoints.length > 0 ? `Puntos clave:\n${keyPoints.map((k) => `- ${String(k)}`).join("\n")}` : "",
    transcriptText.slice(0, 25_000),
  ]
    .filter(Boolean)
    .join("\n\n");

  const glossaryMaterial = [
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
    .join("\n\n");

  const admin = createAdminClient();
  const results: Record<string, number> = {};
  const problems: string[] = [];

  for (const game of targets) {
    // "momento" necesita la transcripción minutada sí o sí; sin ella no tiene sentido.
    if (game === "momento" && segments.length === 0) {
      problems.push("«¿En qué minuto?» necesita la transcripción con marcas de tiempo.");
      continue;
    }
    if (game === "glosario" && glossary.length === 0 && !summary) {
      problems.push("«Glosario relámpago» necesita el glosario de la clase.");
      continue;
    }

    try {
      const material = game === "momento" ? transcriptText : game === "glosario" ? glossaryMaterial : conceptual;
      const generated = await generateChallenges({
        game,
        material,
        classTopic: cls.topic,
        count: countPerGame,
      });

      if (generated.length === 0) {
        problems.push(`No salieron desafíos para «${game}».`);
        continue;
      }

      // Regenerar reemplaza: si no, se acumulan versiones viejas del mismo material.
      await admin.from("game_challenges").delete().eq("recording_id", recordingId).eq("game", game);

      const rows = generated.map((c) => ({
        course_id: cls.course_id,
        class_id: cls.id,
        recording_id: recordingId,
        game,
        prompt: c.prompt,
        options: c.options,
        correct_index: c.correct_index,
        explanation: c.explanation,
        source_quote: c.source_quote,
        source_seconds: findQuoteSeconds(c.source_quote, segments),
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
    return NextResponse.json(
      { error: problems.join(" ") || "No se pudo generar ningún desafío." },
      { status: 422 },
    );
  }

  return NextResponse.json({ ok: true, generated: results, total, problems });
}
