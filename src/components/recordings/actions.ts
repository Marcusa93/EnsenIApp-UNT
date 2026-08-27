"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getOptionalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseCards, parseGlossary, parseKeyPoints, parseSections, parseSegments, type IndexedCard } from "@/components/class-content/parse";
import type { Json } from "@/lib/types/database";
import type { GlossaryTerm, SummarySection, TranscriptSegment } from "@/lib/types/helpers";
import type { ProcessingLogEntry } from "@/lib/audio/pipeline";
import { notifyCourse } from "@/lib/push/send";
import { errorMessage } from "@/lib/utils";

const BUCKET = "class-recordings";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const idSchema = z.guid();

interface OwnedRecording {
  id: string;
  class_id: string;
  course_id: string;
}

/**
 * Verifica que el usuario actual sea docente del curso de la grabación (o admin).
 * Lee con RLS (createClient) y además chequea teacher_assignments a mano.
 */
async function assertTeacherOfRecording(recordingId: string): Promise<OwnedRecording> {
  const parsed = idSchema.safeParse(recordingId);
  if (!parsed.success) throw new Error("Identificador de grabación inválido.");

  const auth = await getOptionalUser();
  if (!auth) throw new Error("Necesitás iniciar sesión.");
  if (auth.profile.role === "estudiante") throw new Error("Sólo el equipo docente puede gestionar grabaciones.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("class_recordings")
    .select("id, class_id, class:classes!inner(course_id)")
    .eq("id", parsed.data)
    .maybeSingle();
  if (error) {
    console.error("[recordings/actions] lectura", { recordingId, error });
    throw new Error("No se pudo leer la grabación.");
  }
  if (!data) throw new Error("La grabación no existe o no tenés acceso.");

  if (auth.profile.role !== "admin") {
    const { data: assignment } = await supabase
      .from("teacher_assignments")
      .select("course_id")
      .eq("teacher_id", auth.user.id)
      .eq("course_id", data.class.course_id)
      .maybeSingle();
    if (!assignment) throw new Error("No sos docente de este curso.");
  }
  return { id: data.id, class_id: data.class_id, course_id: data.class.course_id };
}

function revalidateClass(classId: string) {
  revalidatePath(`/campus/docente/clases/${classId}`);
  revalidatePath(`/campus/estudiante/clases/${classId}`);
  revalidatePath("/campus/docente");
}

/** Publica o despublica la grabación (los estudiantes sólo ven las publicadas). */
export async function setRecordingPublished(recordingId: string, published: boolean): Promise<ActionResult> {
  try {
    const rec = await assertTeacherOfRecording(recordingId);
    const supabase = await createClient();
    if (published) {
      const { data } = await supabase.from("class_recordings").select("status").eq("id", rec.id).single();
      if (data?.status !== "ready") throw new Error("Sólo se puede publicar una grabación cuyo procesamiento terminó.");
    }
    const { error } = await supabase.from("class_recordings").update({ published }).eq("id", rec.id);
    if (error) throw new Error(`No se pudo ${published ? "publicar" : "despublicar"}: ${error.message}`);
    revalidateClass(rec.class_id);

    if (published) {
      // Avisar es accesorio: si falla, la grabación ya quedó publicada igual.
      const { data: cls } = await supabase.from("classes").select("topic").eq("id", rec.class_id).maybeSingle();
      await notifyCourse(rec.course_id, {
        kind: "grabacion_publicada",
        title: "Ya está la grabación de la clase",
        body: cls?.topic ?? "Tenés el resumen, las placas y la transcripción disponibles.",
        url: `/campus/estudiante/clases/${rec.class_id}`,
      }).catch((err) => console.error("[recordings] aviso de publicación", err));
    }

    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

const titleSchema = z.string().trim().min(1, "El título no puede estar vacío.").max(160, "Máximo 160 caracteres.");

export async function updateRecordingTitle(recordingId: string, title: string): Promise<ActionResult> {
  try {
    const parsed = titleSchema.safeParse(title);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Título inválido.");
    const rec = await assertTeacherOfRecording(recordingId);
    const supabase = await createClient();
    const { error } = await supabase.from("class_recordings").update({ title: parsed.data }).eq("id", rec.id);
    if (error) throw new Error(`No se pudo renombrar: ${error.message}`);
    revalidateClass(rec.class_id);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export type ReprocessMode = "full" | "content";

/**
 * Reprocesa la grabación.
 * - `full`: vuelve a transcribir todo (resetea chunks) y regenera el material.
 * - `content`: conserva la transcripción y sólo regenera resumen, placas y versiones simples.
 * Luego el cliente vuelve a correr los pasos con POST /api/recordings/{id}/step.
 */
export async function reprocessRecording(recordingId: string, mode: ReprocessMode = "full"): Promise<ActionResult> {
  try {
    const rec = await assertTeacherOfRecording(recordingId);
    const admin = createAdminClient();

    const cleanups = await Promise.all([
      admin.from("class_summaries").delete().eq("recording_id", rec.id),
      admin.from("interactive_cards").delete().eq("recording_id", rec.id),
      admin.from("simplified_content").delete().eq("recording_id", rec.id),
    ]);
    for (const c of cleanups) if (c.error) throw new Error(`No se pudo limpiar el material anterior: ${c.error.message}`);

    if (mode === "full") {
      const { error: tErr } = await admin.from("transcripts").delete().eq("recording_id", rec.id);
      if (tErr) throw new Error(`No se pudo borrar la transcripción anterior: ${tErr.message}`);
      const { error: cErr } = await admin
        .from("recording_chunks")
        .update({ transcribed: false, text: null, segments: [], error_message: null })
        .eq("recording_id", rec.id);
      if (cErr) throw new Error(`No se pudieron resetear las partes: ${cErr.message}`);
    }

    const log: ProcessingLogEntry = {
      at: new Date().toISOString(),
      step: "reprocess",
      message: mode === "full" ? "Reproceso completo solicitado por el docente." : "Regeneración del material solicitada por el docente.",
    };
    const { error } = await admin
      .from("class_recordings")
      .update({
        status: mode === "full" ? "uploaded" : "processing",
        progress: mode === "full" ? 0 : 72,
        current_step: mode === "full" ? null : "compile",
        chunks_done: mode === "full" ? 0 : undefined,
        error_message: null,
        published: false,
        generation_model: null,
        ...(mode === "full" ? { transcription_model: null } : {}),
        processing_log: [log] as unknown as Json,
      })
      .eq("id", rec.id);
    if (error) throw new Error(`No se pudo reiniciar la grabación: ${error.message}`);

    revalidateClass(rec.class_id);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** Elimina la grabación: archivos de Storage + fila (cascade borra chunks y material). */
export async function deleteRecording(recordingId: string): Promise<ActionResult> {
  try {
    const rec = await assertTeacherOfRecording(recordingId);
    const admin = createAdminClient();

    const { data: files, error: listErr } = await admin.storage.from(BUCKET).list(rec.id, { limit: 1000 });
    if (listErr) throw new Error(`No se pudieron listar los archivos: ${listErr.message}`);
    if (files && files.length > 0) {
      const paths = files.map((f) => `${rec.id}/${f.name}`);
      const { error: rmErr } = await admin.storage.from(BUCKET).remove(paths);
      if (rmErr) throw new Error(`No se pudieron borrar los archivos de audio: ${rmErr.message}`);
    }

    const { error } = await admin.from("class_recordings").delete().eq("id", rec.id);
    if (error) throw new Error(`No se pudo eliminar la grabación: ${error.message}`);

    revalidateClass(rec.class_id);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export interface RecordingPreviewData {
  id: string;
  title: string | null;
  status: string;
  duration_seconds: number | null;
  transcription_model: string | null;
  generation_model: string | null;
  log: ProcessingLogEntry[];
  summary: { summary_md: string; key_points: string[]; sections: SummarySection[]; glossary: GlossaryTerm[] } | null;
  cards: IndexedCard[];
  simplified: { facil: string | null; intermedio: string | null };
  transcript: { full_text: string; segments: TranscriptSegment[] } | null;
}

/** Carga todo el material generado de una grabación para la vista previa docente (RLS). */
export async function getRecordingPreview(recordingId: string): Promise<ActionResult<RecordingPreviewData>> {
  try {
    const rec = await assertTeacherOfRecording(recordingId);
    const supabase = await createClient();

    const [base, summary, cards, simplified, transcript] = await Promise.all([
      supabase
        .from("class_recordings")
        .select("id, title, status, duration_seconds, transcription_model, generation_model, processing_log")
        .eq("id", rec.id)
        .single(),
      supabase.from("class_summaries").select("summary_md, key_points, sections, glossary").eq("recording_id", rec.id).limit(1).maybeSingle(),
      supabase.from("interactive_cards").select("cards").eq("recording_id", rec.id).limit(1).maybeSingle(),
      supabase.from("simplified_content").select("level, content_md").eq("recording_id", rec.id),
      supabase.from("transcripts").select("full_text, segments").eq("recording_id", rec.id).maybeSingle(),
    ]);
    for (const r of [base, summary, cards, simplified, transcript]) {
      if (r.error) throw new Error(`No se pudo cargar el material: ${r.error.message}`);
    }
    if (!base.data) throw new Error("La grabación no existe.");

    const logRaw = base.data.processing_log;
    const log: ProcessingLogEntry[] = Array.isArray(logRaw)
      ? logRaw.flatMap((e) => {
          if (!e || typeof e !== "object" || Array.isArray(e)) return [];
          const o = e as Record<string, unknown>;
          return typeof o.message === "string" ? [{ at: String(o.at ?? ""), step: String(o.step ?? ""), message: o.message }] : [];
        })
      : [];

    return {
      ok: true,
      data: {
        id: base.data.id,
        title: base.data.title,
        status: base.data.status,
        duration_seconds: base.data.duration_seconds,
        transcription_model: base.data.transcription_model,
        generation_model: base.data.generation_model,
        log,
        summary: summary.data
          ? {
              summary_md: summary.data.summary_md,
              key_points: parseKeyPoints(summary.data.key_points),
              sections: parseSections(summary.data.sections),
              glossary: parseGlossary(summary.data.glossary),
            }
          : null,
        cards: cards.data ? parseCards(cards.data.cards) : [],
        simplified: {
          facil: simplified.data?.find((s) => s.level === "facil")?.content_md ?? null,
          intermedio: simplified.data?.find((s) => s.level === "intermedio")?.content_md ?? null,
        },
        transcript: transcript.data
          ? { full_text: transcript.data.full_text, segments: parseSegments(transcript.data.segments) }
          : null,
      },
    };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
