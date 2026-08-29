import { NextResponse } from "next/server";
import { z } from "zod";
import { getOptionalUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/** Sólo el retado puede rechazar, y sólo mientras no jugó todavía. */

const paramsSchema = z.object({ duelId: z.guid() });

export async function POST(_request: Request, ctx: { params: Promise<{ duelId: string }> }) {
  const authCtx = await getOptionalUser();
  if (!authCtx) return NextResponse.json({ error: "Tu sesión expiró. Volvé a ingresar." }, { status: 401 });

  const parsed = paramsSchema.safeParse(await ctx.params);
  if (!parsed.success) return NextResponse.json({ error: "Reto inválido." }, { status: 400 });

  const admin = createAdminClient();
  const { data: duel } = await admin
    .from("game_duels")
    .select("id, opponent_id, status, opponent_run_id")
    .eq("id", parsed.data.duelId)
    .maybeSingle();

  if (!duel) return NextResponse.json({ error: "Ese reto no existe." }, { status: 404 });
  if (duel.opponent_id !== authCtx.user.id) {
    return NextResponse.json({ error: "No podés rechazar un reto que no te mandaron a vos." }, { status: 403 });
  }
  if (duel.status !== "pendiente" || duel.opponent_run_id) {
    return NextResponse.json({ error: "Este reto ya no se puede rechazar." }, { status: 409 });
  }

  const { error } = await admin.from("game_duels").update({ status: "rechazado" }).eq("id", duel.id);
  if (error) {
    console.error("[retos] rechazar", error);
    return NextResponse.json({ error: "No pudimos rechazar el reto." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
