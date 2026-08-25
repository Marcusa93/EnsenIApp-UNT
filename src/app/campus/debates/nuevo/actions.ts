"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getOptionalUser, isTeacherRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { chatJSON } from "@/lib/ai/llm";
import { MODELS } from "@/lib/openrouter";
import { errorMessage } from "@/lib/utils";
import { canModerateCourse } from "../_lib/data";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const uuid = z.string().guid("Identificador inválido.");

const createSchema = z.object({
  courseId: uuid,
  classId: uuid.nullable(),
  recordingId: uuid.nullable(),
  title: z.string().trim().min(5, "El título debe tener al menos 5 caracteres.").max(200, "El título es demasiado largo."),
  contextMd: z.string().trim().max(12000, "El contexto es demasiado largo.").optional(),
  closesAt: z.string().datetime({ offset: true, message: "Fecha de cierre inválida." }).nullable(),
});

export type CreateDebateInput = z.input<typeof createSchema>;

async function requireTeacher() {
  const ctx = await getOptionalUser();
  if (!ctx) throw new Error("Tu sesión expiró. Volvé a ingresar.");
  if (ctx.profile.status === "bloqueado") throw new Error("Tu cuenta está bloqueada.");
  if (!isTeacherRole(ctx.profile.role)) throw new Error("Sólo el equipo docente puede crear debates.");
  return ctx;
}

/** Crea el debate y redirige a su página. */
export async function createDebate(input: unknown): Promise<ActionResult<{ id: string }>> {
  let createdId: string;
  try {
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
    const { courseId, classId, recordingId, title, contextMd, closesAt } = parsed.data;

    const { user, profile } = await requireTeacher();
    const supabase = await createClient();

    const allowed = await canModerateCourse(supabase, user.id, profile.role, courseId);
    if (!allowed) return { ok: false, error: "No estás asignado a ese curso." };

    if (closesAt && new Date(closesAt).getTime() <= Date.now()) {
      return { ok: false, error: "La fecha de cierre tiene que ser futura." };
    }

    // Coherencia clase/grabación ↔ curso (RLS ya restringe, pero evitamos enlaces cruzados).
    if (classId) {
      const { data: cls } = await supabase.from("classes").select("id, course_id").eq("id", classId).maybeSingle();
      if (!cls || cls.course_id !== courseId) return { ok: false, error: "La clase no pertenece al curso elegido." };
    }
    if (recordingId) {
      const { data: rec } = await supabase
        .from("class_recordings")
        .select("id, class_id, class:classes(course_id)")
        .eq("id", recordingId)
        .maybeSingle();
      const recCourse = Array.isArray(rec?.class) ? rec?.class[0]?.course_id : rec?.class?.course_id;
      if (!rec || recCourse !== courseId) return { ok: false, error: "La grabación no pertenece al curso elegido." };
      if (classId && rec.class_id !== classId) return { ok: false, error: "La grabación no corresponde a la clase elegida." };
    }

    const { data, error } = await supabase
      .from("debates")
      .insert({
        course_id: courseId,
        class_id: classId,
        recording_id: recordingId,
        created_by: user.id,
        title,
        context_md: contextMd || null,
        closes_at: closesAt,
        status: "open",
      })
      .select("id")
      .single();
    if (error) {
      console.error("[debates] createDebate", { courseId, userId: user.id, error });
      return { ok: false, error: "No se pudo crear el debate. Intentá de nuevo." };
    }
    createdId = data.id;
    revalidatePath("/campus/debates");
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
  redirect(`/campus/debates/${createdId}`);
}

/* ---------------------------------------------------------------------------
 * Proponer con IA a partir de una grabación
 * ------------------------------------------------------------------------- */

const proposalSchema = z.object({
  title: z.string().min(5).max(200).describe("Título del debate, en forma de pregunta o tesis polémica"),
  context_md: z
    .string()
    .min(50)
    .describe("Contexto en Markdown (2-4 párrafos): el problema, por qué es controvertido, conceptos de la clase en juego"),
  stances: z.object({
    a_favor: z.string().min(20).describe("Postura inicial sugerida a favor (1-2 oraciones)"),
    en_contra: z.string().min(20).describe("Postura inicial sugerida en contra (1-2 oraciones)"),
  }),
});

export type DebateProposal = z.output<typeof proposalSchema>;

const TRANSCRIPT_LIMIT = 40_000;

/** Genera título, contexto y dos posturas a partir del resumen/transcripción de una grabación. */
export async function proposeDebate(input: unknown): Promise<ActionResult<DebateProposal>> {
  try {
    const parsed = z.object({ recordingId: uuid }).safeParse(input);
    if (!parsed.success) return { ok: false, error: "Elegí una grabación para proponer con IA." };
    const { recordingId } = parsed.data;

    const { user, profile } = await requireTeacher();
    const supabase = await createClient();

    const { data: rec, error: recError } = await supabase
      .from("class_recordings")
      .select("id, title, class:classes(id, topic, course_id, summary)")
      .eq("id", recordingId)
      .maybeSingle();
    if (recError) {
      console.error("[debates] proposeDebate recording", { recordingId, error: recError });
      return { ok: false, error: "No se pudo leer la grabación." };
    }
    const cls = Array.isArray(rec?.class) ? rec?.class[0] : rec?.class;
    if (!rec || !cls) return { ok: false, error: "La grabación no existe o no tenés acceso." };

    const allowed = await canModerateCourse(supabase, user.id, profile.role, cls.course_id);
    if (!allowed) return { ok: false, error: "No estás asignado al curso de esa grabación." };

    const [{ data: summary }, { data: transcript }] = await Promise.all([
      supabase.from("class_summaries").select("summary_md, key_points").eq("recording_id", recordingId).maybeSingle(),
      supabase.from("transcripts").select("full_text").eq("recording_id", recordingId).maybeSingle(),
    ]);

    if (!summary && !transcript) {
      return {
        ok: false,
        error: "La grabación todavía no tiene resumen ni transcripción. Esperá a que termine el procesamiento.",
      };
    }

    const keyPoints = Array.isArray(summary?.key_points)
      ? summary.key_points.filter((k): k is string => typeof k === "string")
      : [];

    const material = [
      `Clase: ${cls.topic}`,
      cls.summary ? `Descripción de la clase: ${cls.summary}` : null,
      summary?.summary_md ? `## Resumen\n${summary.summary_md}` : null,
      keyPoints.length ? `## Puntos clave\n${keyPoints.map((k) => `- ${k}`).join("\n")}` : null,
      transcript?.full_text
        ? `## Transcripción (puede estar recortada)\n${transcript.full_text.slice(0, TRANSCRIPT_LIMIT)}`
        : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    const result = await chatJSON({
      schema: proposalSchema,
      model: MODELS.reasoning,
      temperature: 0.5,
      maxTokens: 1800,
      system: `Sos docente de "Derecho de las Nuevas Tecnologías y Bioderecho en el Siglo XXI" (Abogacía, Universidad Nacional de Tucumán).
A partir del material de una clase grabada, proponé UN debate para estudiantes de grado.
Requisitos:
- Español rioplatense (voseo), registro académico pero cercano.
- El título debe ser una pregunta o tesis genuinamente controvertida, anclada en un problema jurídico concreto visto en la clase (no una pregunta de repaso).
- El contexto (Markdown, 2-4 párrafos) presenta el problema, por qué hay tensión entre principios/derechos/normas, y qué conceptos de la clase deben usar para argumentar. Puede incluir una pregunta guía final. No tomes partido.
- Las dos posturas iniciales deben ser defendibles con el contenido de la clase y razonablemente simétricas en fuerza.`,
      user: material,
    });

    return { ok: true, data: result.data };
  } catch (err) {
    console.error("[debates] proposeDebate", err);
    return { ok: false, error: errorMessage(err, "No se pudo generar la propuesta con IA.") };
  }
}
