"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeacherOfClass } from "@/components/docente/teacher-guard";
import { fail, succeed, type ActionResult } from "@/components/docente/types";
import { fieldErrors, uuidSchema } from "@/components/docente/class-schema";
import { MATERIAL_BUCKET } from "@/components/docente/class-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/utils";
import { notifyCourse } from "@/lib/push/send";

function revalidateClass(classId: string) {
  revalidatePath("/campus/docente");
  revalidatePath(`/campus/docente/clases/${classId}`);
  revalidatePath("/campus/docente/clases");
  revalidatePath("/campus/estudiante");
  revalidatePath(`/campus/estudiante/clases/${classId}`);
}

/* ------------------------------------------------------------------ */
/* Avisos                                                               */
/* ------------------------------------------------------------------ */

const announcementSchema = z.object({
  class_id: uuidSchema,
  title: z.string().trim().min(3, "El título necesita al menos 3 caracteres.").max(160, "Máximo 160 caracteres."),
  body: z.string().trim().min(3, "Escribí el contenido del aviso.").max(4000, "Máximo 4000 caracteres."),
  /** 'clase' → vinculado a esta clase; 'curso' → general del curso (class_id null). */
  scope: z.enum(["clase", "curso"]).default("clase"),
});

export type AnnouncementInput = z.input<typeof announcementSchema>;

export async function createAnnouncement(input: AnnouncementInput): Promise<ActionResult<{ id: string }>> {
  const parsed = announcementSchema.safeParse(input);
  if (!parsed.success) return fail("Revisá el aviso.", fieldErrors(parsed.error));
  try {
    const { supabase, ctx, courseId } = await requireTeacherOfClass(parsed.data.class_id);
    const { data, error } = await supabase
      .from("announcements")
      .insert({
        course_id: courseId,
        class_id: parsed.data.scope === "clase" ? parsed.data.class_id : null,
        author_id: ctx.user.id,
        title: parsed.data.title,
        body: parsed.data.body,
      })
      .select("id")
      .single();
    if (error) throw error;
    revalidateClass(parsed.data.class_id);

    // Publicar sin avisar era publicar a la nada: el anuncio quedaba esperando
    // que alguien pasara por Hoy. Ahora toca la campana (y el push) del curso.
    void notifyCourse(courseId, {
      kind: "aviso",
      title: parsed.data.title,
      body: parsed.data.body.slice(0, 140),
      url:
        parsed.data.scope === "clase"
          ? `/campus/estudiante/clases/${parsed.data.class_id}`
          : "/campus/estudiante",
      createdBy: ctx.user.id,
    }).catch((e) => console.error("[docente/clase] aviso de anuncio", e));

    return succeed({ id: data.id });
  } catch (err) {
    console.error("[docente/clase] createAnnouncement", { err });
    return fail(errorMessage(err, "No se pudo publicar el aviso."));
  }
}

export async function deleteAnnouncement(classId: string, announcementId: string): Promise<ActionResult> {
  const ids = z.object({ classId: uuidSchema, announcementId: uuidSchema }).safeParse({ classId, announcementId });
  if (!ids.success) return fail("Aviso inválido.");
  try {
    const { supabase, courseId } = await requireTeacherOfClass(ids.data.classId);
    const { error, count } = await supabase
      .from("announcements")
      .delete({ count: "exact" })
      .eq("id", ids.data.announcementId)
      .eq("course_id", courseId);
    if (error) throw error;
    if (!count) return fail("El aviso no existe o no tenés acceso.");
    revalidateClass(ids.data.classId);
    return succeed(undefined);
  } catch (err) {
    console.error("[docente/clase] deleteAnnouncement", { announcementId, err });
    return fail(errorMessage(err, "No se pudo eliminar el aviso."));
  }
}

/* ------------------------------------------------------------------ */
/* Materiales                                                           */
/* ------------------------------------------------------------------ */

const materialKind = z.enum(["pdf", "link", "video", "doc", "otro"]);

const linkSchema = z.object({
  class_id: uuidSchema,
  title: z.string().trim().min(2, "Poné un título.").max(160, "Máximo 160 caracteres."),
  url: z
    .string()
    .trim()
    .url("Ingresá una URL válida (con https://).")
    .refine((u) => /^https?:\/\//i.test(u), "Sólo se admiten enlaces http(s)."),
  kind: materialKind.default("link"),
});

export type MaterialLinkInput = z.input<typeof linkSchema>;

export async function addMaterialLink(input: MaterialLinkInput): Promise<ActionResult<{ id: string }>> {
  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) return fail("Revisá el enlace.", fieldErrors(parsed.error));
  try {
    const { supabase, ctx } = await requireTeacherOfClass(parsed.data.class_id);
    const { data, error } = await supabase
      .from("class_materials")
      .insert({
        class_id: parsed.data.class_id,
        title: parsed.data.title,
        url: parsed.data.url,
        kind: parsed.data.kind,
        uploaded_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (error) throw error;
    revalidateClass(parsed.data.class_id);
    return succeed({ id: data.id });
  } catch (err) {
    console.error("[docente/clase] addMaterialLink", { err });
    return fail(errorMessage(err, "No se pudo agregar el enlace."));
  }
}

const fileSchema = z.object({
  class_id: uuidSchema,
  title: z.string().trim().min(2, "Poné un título.").max(160, "Máximo 160 caracteres."),
  storage_path: z.string().trim().min(3).max(512),
  kind: materialKind.default("otro"),
});

export type MaterialFileInput = z.input<typeof fileSchema>;

/**
 * Registra un archivo ya subido por el navegador a `class-materials/{classId}/…`.
 * Verifica que la ruta pertenezca a la clase y que el objeto exista.
 */
export async function registerMaterialFile(input: MaterialFileInput): Promise<ActionResult<{ id: string }>> {
  const parsed = fileSchema.safeParse(input);
  if (!parsed.success) return fail("Revisá el archivo.", fieldErrors(parsed.error));
  const { class_id, storage_path } = parsed.data;
  if (!storage_path.startsWith(`${class_id}/`) || storage_path.includes("..")) {
    return fail("La ruta del archivo no corresponde a esta clase.");
  }
  try {
    const { supabase, ctx } = await requireTeacherOfClass(class_id);
    const fileName = storage_path.slice(class_id.length + 1);
    const { data: objects, error: listErr } = await supabase.storage
      .from(MATERIAL_BUCKET)
      .list(class_id, { search: fileName, limit: 5 });
    if (listErr) throw listErr;
    if (!objects?.some((o) => o.name === fileName)) return fail("El archivo todavía no está en el almacenamiento.");

    const { data, error } = await supabase
      .from("class_materials")
      .insert({
        class_id,
        title: parsed.data.title,
        storage_path,
        kind: parsed.data.kind,
        uploaded_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (error) throw error;
    revalidateClass(class_id);
    return succeed({ id: data.id });
  } catch (err) {
    console.error("[docente/clase] registerMaterialFile", { err });
    return fail(errorMessage(err, "No se pudo registrar el archivo."));
  }
}

export async function deleteMaterial(classId: string, materialId: string): Promise<ActionResult> {
  const ids = z.object({ classId: uuidSchema, materialId: uuidSchema }).safeParse({ classId, materialId });
  if (!ids.success) return fail("Material inválido.");
  try {
    const { supabase } = await requireTeacherOfClass(ids.data.classId);
    const { data: material, error: readErr } = await supabase
      .from("class_materials")
      .select("id, storage_path")
      .eq("id", ids.data.materialId)
      .eq("class_id", ids.data.classId)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!material) return fail("El material no existe o no tenés acceso.");

    const { error } = await supabase.from("class_materials").delete().eq("id", material.id);
    if (error) throw error;

    if (material.storage_path) {
      // El bucket no tiene policy de delete para docentes: se borra con service role
      // después de haber verificado (arriba) que el usuario es docente del curso.
      const admin = createAdminClient();
      const { error: rmErr } = await admin.storage.from(MATERIAL_BUCKET).remove([material.storage_path]);
      if (rmErr) console.error("[docente/clase] no se pudo borrar el archivo del bucket", { path: material.storage_path, rmErr });
    }
    revalidateClass(ids.data.classId);
    return succeed(undefined);
  } catch (err) {
    console.error("[docente/clase] deleteMaterial", { materialId, err });
    return fail(errorMessage(err, "No se pudo eliminar el material."));
  }
}
