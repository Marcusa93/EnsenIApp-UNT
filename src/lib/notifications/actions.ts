"use server";

import { z } from "zod";
import { getOptionalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * La campana del campus. Leer y marcar como leído es del dueño y de nadie más
 * (lo garantiza la policy de `notifications`); acá sólo se valida la forma.
 */

export interface AvisoItem {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  url: string | null;
  read_at: string | null;
  created_at: string;
}

export async function listarAvisos(): Promise<{ avisos: AvisoItem[]; sinLeer: number }> {
  const ctx = await getOptionalUser();
  if (!ctx) return { avisos: [], sinLeer: 0 };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, kind, title, body, url, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    console.error("[avisos] listar", error);
    return { avisos: [], sinLeer: 0 };
  }
  const avisos = (data ?? []) as AvisoItem[];
  return { avisos, sinLeer: avisos.filter((a) => !a.read_at).length };
}

const marcarSchema = z.object({ ids: z.array(z.guid()).min(1).max(50) });

export async function marcarLeidos(input: unknown): Promise<{ ok: boolean }> {
  const parsed = marcarSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  const ctx = await getOptionalUser();
  if (!ctx) return { ok: false };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .in("id", parsed.data.ids)
    .is("read_at", null);

  if (error) {
    console.error("[avisos] marcar leídos", error);
    return { ok: false };
  }
  return { ok: true };
}
