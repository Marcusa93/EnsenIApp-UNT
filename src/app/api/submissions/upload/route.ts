import { NextResponse } from "next/server";
import { z } from "zod";
import { getOptionalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/types/database";
import { canStudentEdit, parseEssayAnswers, parseTextContent } from "@/components/activities/model";
import { getActivityById, getOwnSubmission } from "@/components/activities/queries";

export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.oasis.opendocument.text",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

/**
 * POST /api/submissions/upload (multipart: activityId, file)
 * Sube el adjunto de una entrega a class-materials/entregas/{activityId}/{studentId}/...
 * La policy de storage para estudiantes está pendiente (supabase/migrations/pending/actividades.sql),
 * por eso la subida usa el service role DESPUÉS de verificar a mano: sesión, visibilidad de la
 * actividad (RLS), tipo 'entrega' con allow_file_upload y entrega editable.
 */
export async function POST(req: Request) {
  const auth = await getOptionalUser();
  if (!auth) return NextResponse.json({ error: "Necesitás iniciar sesión." }, { status: 401 });
  if (auth.profile.status === "bloqueado") return NextResponse.json({ error: "Tu cuenta está bloqueada." }, { status: 403 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Formulario inválido." }, { status: 400 });
  const activityId = form.get("activityId");
  const file = form.get("file");
  if (!z.guid().safeParse(activityId).success || typeof activityId !== "string") {
    return NextResponse.json({ error: "Actividad inválida." }, { status: 400 });
  }
  if (!(file instanceof File)) return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: "El archivo está vacío." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "El archivo supera los 10 MB." }, { status: 413 });
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: "Formato no permitido. Subí PDF, Word, ODT, TXT o una imagen." }, { status: 415 });
  }

  const supabase = await createClient();
  const activity = await getActivityById(supabase, activityId).catch(() => null);
  if (!activity) return NextResponse.json({ error: "La actividad no existe o no tenés acceso." }, { status: 404 });
  if (activity.type !== "entrega" || !parseTextContent(activity.content).allow_file_upload) {
    return NextResponse.json({ error: "Esta actividad no admite adjuntos." }, { status: 422 });
  }
  const submission = await getOwnSubmission(supabase, activityId, auth.user.id).catch(() => null);
  if (!canStudentEdit(activity, submission)) {
    return NextResponse.json({ error: "La entrega ya no se puede modificar." }, { status: 409 });
  }

  const safeName = file.name.normalize("NFKD").replace(/[^\w.-]+/g, "_").slice(-80) || "archivo";
  const path = `entregas/${activityId}/${auth.user.id}/${Date.now()}-${safeName}`;

  const admin = createAdminClient();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: upErr } = await admin.storage
    .from("class-materials")
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (upErr) {
    console.error("[submissions/upload] storage", { path, upErr });
    return NextResponse.json({ error: "No se pudo subir el archivo. Probá de nuevo." }, { status: 500 });
  }

  // Borrar el adjunto anterior (si había) para no acumular basura.
  const previous = submission ? parseEssayAnswers(submission.answers).file_path : null;
  if (previous && previous.startsWith(`entregas/${activityId}/${auth.user.id}/`)) {
    const { error: rmErr } = await admin.storage.from("class-materials").remove([previous]);
    if (rmErr) console.warn("[submissions/upload] no se pudo borrar el adjunto anterior", { previous, rmErr });
  }

  // Registrar en la entrega (con RLS del estudiante).
  const current = submission ? parseEssayAnswers(submission.answers) : { text: "", file_path: null, file_name: null };
  const answers = { ...current, file_path: path, file_name: file.name } as unknown as Json;
  const { error: saveErr } = await supabase
    .from("activity_submissions")
    .upsert(
      { activity_id: activityId, student_id: auth.user.id, answers, status: submission?.status ?? "en_progreso" },
      { onConflict: "activity_id,student_id" },
    );
  if (saveErr) {
    console.error("[submissions/upload] no se pudo registrar el adjunto", { path, saveErr });
    await admin.storage.from("class-materials").remove([path]);
    return NextResponse.json({ error: "El archivo subió pero no se pudo registrar. Probá de nuevo." }, { status: 500 });
  }

  return NextResponse.json({ file_path: path, file_name: file.name, size: file.size });
}
