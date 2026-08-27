import type { DbClient } from "@/lib/courses";

/**
 * Contexto de Alberdi: TODO lo que el asistente puede saber sale de acá, y sale
 * de lo que el equipo docente cargó en el campus. Es la mitad del guardrail —
 * la otra mitad es el system prompt. Si algo no está en este contexto, Alberdi
 * no lo tiene que responder.
 */

/** Recorte por fuente para que el prompt no se dispare con clases largas. */
const LIMITS = {
  summaryMd: 2500,
  simplified: 2000,
  /**
   * Sólo cuando la consulta está anclada a una clase concreta. Alto a propósito:
   * una clase de 80 min ronda los 45k caracteres y "¿en qué minuto se dijo X?"
   * necesita la clase entera (≈13k tokens de Haiku por consulta: barato).
   */
  transcript: 48_000,
  totalChars: 90_000,
} as const;

export interface ContextSource {
  kind: "clase" | "resumen" | "material" | "transcripcion";
  class_id: string | null;
  label: string;
}

export interface AlberdiContext {
  /** Bloque de texto que se inyecta en el prompt. */
  text: string;
  /** Qué se usó, para auditar la respuesta después. */
  sources: ContextSource[];
  /** false cuando la materia todavía no tiene nada cargado. */
  hasContent: boolean;
}

function clamp(text: string | null | undefined, max: number): string {
  if (!text) return "";
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max)}\n[…recortado]`;
}

function mmss(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Transcripción con marcas de tiempo: agrupa los micro-segmentos de Whisper en
 * líneas de ~30 s ("[mm:ss] texto…"). Si no hay segments, cae al texto plano.
 */
function buildStampedTranscript(segments: unknown, fullText: string | null): string {
  const list = Array.isArray(segments)
    ? (segments as { start?: number; text?: string }[]).filter((s) => typeof s?.start === "number" && s?.text)
    : [];
  if (list.length === 0) return clamp(fullText, LIMITS.transcript);

  const lines: string[] = [];
  let lineStart = -1;
  let buffer = "";
  for (const s of list) {
    const start = s.start as number;
    if (lineStart < 0 || start - lineStart >= 30) {
      if (buffer) lines.push(`[${mmss(lineStart)}] ${buffer.trim()}`);
      lineStart = start;
      buffer = "";
    }
    buffer += ` ${(s.text as string).trim()}`;
  }
  if (buffer) lines.push(`[${mmss(lineStart)}] ${buffer.trim()}`);
  return clamp(lines.join("\n"), LIMITS.transcript);
}

interface ClassRow {
  id: string;
  topic: string;
  summary: string | null;
  class_date: string;
}

/**
 * Arma el contexto de la materia. Si `classId` viene, esa clase se desarrolla en
 * profundidad (incluye transcripción) y el resto queda como panorama.
 */
export async function buildAlberdiContext(
  supabase: DbClient,
  courseId: string,
  classId?: string | null,
): Promise<AlberdiContext> {
  const sources: ContextSource[] = [];
  const parts: string[] = [];

  const { data: course } = await supabase
    .from("courses")
    .select("name, term, subject_id, subjects(name, description)")
    .eq("id", courseId)
    .maybeSingle();

  const subject = course?.subjects as { name: string; description: string | null } | null;
  if (subject) {
    parts.push(`## La materia\n${subject.name}\n\n${clamp(subject.description, 3000)}`);
  }

  const { data: classes, error: classesError } = await supabase
    .from("classes")
    .select("id, topic, summary, class_date")
    .eq("course_id", courseId)
    .order("class_date", { ascending: true });
  if (classesError) console.error("[alberdi] classes", classesError);

  const classList = (classes ?? []) as ClassRow[];
  if (classList.length > 0) {
    const cronograma = classList
      .map((c) => `- ${c.class_date} · ${c.topic}${c.summary ? `\n  ${clamp(c.summary, 600)}` : ""}`)
      .join("\n");
    parts.push(`## Cronograma de clases\n${cronograma}`);
    for (const c of classList) sources.push({ kind: "clase", class_id: c.id, label: c.topic });
  }

  // Grabaciones publicadas y procesadas: son el contenido real de cada clase.
  const classIds = classList.map((c) => c.id);
  if (classIds.length > 0) {
    const { data: recordings } = await supabase
      .from("class_recordings")
      .select("id, class_id, title")
      .in("class_id", classIds)
      .eq("published", true)
      .eq("status", "ready");

    const recs = recordings ?? [];
    const byClass = new Map(classList.map((c) => [c.id, c]));

    if (recs.length > 0) {
      const recIds = recs.map((r) => r.id);
      const [summariesRes, simplifiedRes] = await Promise.all([
        supabase.from("class_summaries").select("recording_id, summary_md, key_points, glossary").in("recording_id", recIds),
        supabase.from("simplified_content").select("recording_id, content_md, level").in("recording_id", recIds).eq("level", "facil"),
      ]);

      const summaryByRec = new Map((summariesRes.data ?? []).map((s) => [s.recording_id, s]));
      const simpleByRec = new Map((simplifiedRes.data ?? []).map((s) => [s.recording_id, s]));

      for (const rec of recs) {
        const cls = rec.class_id ? byClass.get(rec.class_id) : null;
        const heading = cls ? `${cls.class_date} · ${cls.topic}` : (rec.title ?? "Clase grabada");
        const summary = summaryByRec.get(rec.id);
        const simple = simpleByRec.get(rec.id);
        if (!summary && !simple) continue;

        const chunks: string[] = [`### ${heading}`];
        if (summary) {
          chunks.push(clamp(summary.summary_md, LIMITS.summaryMd));
          const keyPoints = Array.isArray(summary.key_points) ? (summary.key_points as unknown[]) : [];
          if (keyPoints.length > 0) {
            chunks.push(`Puntos clave:\n${keyPoints.map((k) => `- ${String(k)}`).join("\n")}`);
          }
          const glossary = Array.isArray(summary.glossary) ? (summary.glossary as { term?: string; definition?: string }[]) : [];
          if (glossary.length > 0) {
            chunks.push(
              `Glosario:\n${glossary
                .filter((g) => g?.term)
                .map((g) => `- ${g.term}: ${g.definition ?? ""}`)
                .join("\n")}`,
            );
          }
          sources.push({ kind: "resumen", class_id: rec.class_id, label: heading });
        }
        if (simple && !summary) {
          chunks.push(clamp(simple.content_md, LIMITS.simplified));
          sources.push({ kind: "resumen", class_id: rec.class_id, label: `${heading} (versión simple)` });
        }
        parts.push(chunks.join("\n\n"));
      }

      // Clase enfocada: sumamos su transcripción CON marcas de tiempo [mm:ss],
      // para que Alberdi pueda responder "en qué momento se dijo tal cosa".
      if (classId) {
        const focusRec = recs.find((r) => r.class_id === classId);
        if (focusRec) {
          const { data: transcript } = await supabase
            .from("transcripts")
            .select("full_text, segments")
            .eq("recording_id", focusRec.id)
            .maybeSingle();
          if (transcript) {
            const cls = byClass.get(classId);
            const stamped = buildStampedTranscript(transcript.segments, transcript.full_text);
            parts.push(
              `## Transcripción de la clase que se está consultando (con minutos [mm:ss])\n### ${cls?.topic ?? ""}\n${stamped}`,
            );
            sources.push({ kind: "transcripcion", class_id: classId, label: cls?.topic ?? "Clase" });
          }
        }
      }
    }

    const { data: materials } = await supabase
      .from("class_materials")
      .select("class_id, title, kind, url")
      .in("class_id", classIds);

    if (materials && materials.length > 0) {
      const list = materials
        .map((m) => {
          const cls = m.class_id ? byClass.get(m.class_id) : null;
          return `- ${m.title}${m.url ? ` (${m.url})` : ""}${cls ? ` — ${cls.topic}` : ""}`;
        })
        .join("\n");
      parts.push(`## Materiales y bibliografía cargados\n${list}`);
      for (const m of materials) {
        sources.push({ kind: "material", class_id: m.class_id, label: m.title });
      }
    }
  }

  let text = parts.join("\n\n---\n\n");
  if (text.length > LIMITS.totalChars) text = `${text.slice(0, LIMITS.totalChars)}\n[…contexto recortado]`;

  return {
    text,
    sources,
    // Sin clases cargadas no hay materia que consultar.
    hasContent: classList.length > 0,
  };
}
