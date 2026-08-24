import { z } from "zod";

/** Fila del padrón (CSV o alta manual). Se valida en cliente (preview) y en el Server Action. */
export const rosterEntrySchema = z.object({
  email: z.email("Email inválido").trim().toLowerCase(),
  nombre: z.string().trim().max(120).optional().or(z.literal("")),
  dni: z
    .string()
    .trim()
    .max(20)
    .regex(/^[0-9.\-\s]*$/, "DNI inválido")
    .optional()
    .or(z.literal("")),
});
export type RosterEntryInput = z.infer<typeof rosterEntrySchema>;
