import { NextResponse } from "next/server";
import { z } from "zod";
import { getOptionalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Alta/baja de la suscripción push del dispositivo actual.
 *
 * El endpoint que devuelve el navegador es la identidad del dispositivo: se hace
 * upsert sobre él, así reinstalar la PWA o renovar la suscripción no duplica filas.
 * Encender el push también levanta `notification_preferences.push_enabled`, que es
 * el interruptor global del usuario (un solo switch en la UI controla las dos cosas).
 */

const subscribeSchema = z.object({
  endpoint: z.url().max(2000),
  keys: z.object({
    p256dh: z.string().min(1).max(400),
    auth: z.string().min(1).max(400),
  }),
});

export async function POST(request: Request) {
  const ctx = await getOptionalUser();
  if (!ctx) return NextResponse.json({ error: "Tu sesión expiró. Volvé a ingresar." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Suscripción inválida." }, { status: 400 });

  const { endpoint, keys } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: ctx.user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
      last_used_at: new Date().toISOString(),
      failed_count: 0,
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    console.error("[push] alta de suscripción", error);
    return NextResponse.json({ error: "No pudimos activar las notificaciones." }, { status: 500 });
  }

  const { error: prefError } = await supabase
    .from("notification_preferences")
    .upsert({ user_id: ctx.user.id, push_enabled: true }, { onConflict: "user_id" });
  if (prefError) console.error("[push] no se pudo encender la preferencia", prefError);

  return NextResponse.json({ ok: true });
}

const unsubscribeSchema = z.object({ endpoint: z.url().max(2000) });

export async function DELETE(request: Request) {
  const ctx = await getOptionalUser();
  if (!ctx) return NextResponse.json({ error: "Tu sesión expiró. Volvé a ingresar." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = unsubscribeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Suscripción inválida." }, { status: 400 });

  const supabase = await createClient();

  // RLS ya acota a las filas propias; el filtro por user_id lo deja explícito.
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", parsed.data.endpoint)
    .eq("user_id", ctx.user.id);

  if (error) {
    console.error("[push] baja de suscripción", error);
    return NextResponse.json({ error: "No pudimos desactivar las notificaciones." }, { status: 500 });
  }

  // Si no le queda ningún dispositivo, apagamos también el interruptor global.
  const { count } = await supabase
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ctx.user.id);

  if ((count ?? 0) === 0) {
    const { error: prefError } = await supabase
      .from("notification_preferences")
      .upsert({ user_id: ctx.user.id, push_enabled: false }, { onConflict: "user_id" });
    if (prefError) console.error("[push] no se pudo apagar la preferencia", prefError);
  }

  return NextResponse.json({ ok: true });
}
