import { z } from "zod";

export const uuidSchema = z.string().guid();

/** Acepta YYYY-MM-DD o DD/MM/YYYY y normaliza a YYYY-MM-DD. */
export const dateSchema = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    const latam = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
    let y: number, m: number, d: number;
    if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
    else if (latam) [d, m, y] = [Number(latam[1]), Number(latam[2]), Number(latam[3])];
    else {
      ctx.addIssue({ code: "custom", message: "Fecha inválida (usá AAAA-MM-DD o DD/MM/AAAA)." });
      return z.NEVER;
    }
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
      ctx.addIssue({ code: "custom", message: "Esa fecha no existe." });
      return z.NEVER;
    }
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  });

export const classSchema = z.object({
  course_id: uuidSchema,
  class_date: dateSchema,
  topic: z.string().trim().min(3, "El tema necesita al menos 3 caracteres.").max(200, "Máximo 200 caracteres."),
  teacher_id: z.union([uuidSchema, z.literal(""), z.null()]).transform((v) => (v ? v : null)),
  summary: z
    .string()
    .trim()
    .max(4000, "Máximo 4000 caracteres.")
    .transform((v) => (v ? v : null)),
  sort_order: z.coerce.number().int().min(0).max(999).default(0),
});

export type ClassInput = z.input<typeof classSchema>;

export const importRowSchema = z.object({
  fecha: dateSchema,
  tema: z.string().trim().min(3, "Tema muy corto.").max(200, "Tema muy largo."),
  docente_email: z
    .string()
    .trim()
    .toLowerCase()
    .transform((v) => (v ? v : null))
    .pipe(z.union([z.string().email("Email inválido."), z.null()])),
  resumen: z
    .string()
    .trim()
    .max(4000)
    .transform((v) => (v ? v : null)),
});

export type ImportRowInput = z.input<typeof importRowSchema>;

export const importSchema = z.object({
  course_id: uuidSchema,
  rows: z.array(importRowSchema).min(1, "No hay filas para importar.").max(300, "Máximo 300 clases por importación."),
});

export type ImportInput = z.input<typeof importSchema>;

/** Primer mensaje de error por campo (clave = primer segmento del path). */
export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
