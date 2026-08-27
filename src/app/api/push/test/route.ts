import { NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth";
import { sendPushToUsers, isPushConfigured } from "@/lib/push/send";

/** Se manda una notificación a uno mismo, para comprobar que el permiso quedó bien. */
export async function POST() {
  const ctx = await getOptionalUser();
  if (!ctx) return NextResponse.json({ error: "Tu sesión expiró. Volvé a ingresar." }, { status: 401 });

  if (!isPushConfigured()) {
    return NextResponse.json({ error: "Las notificaciones no están configuradas en el servidor." }, { status: 503 });
  }

  const result = await sendPushToUsers([ctx.user.id], {
    title: "EnsenIA UNT",
    body: "¡Listo! Las notificaciones de la cátedra están activadas en este dispositivo.",
    url: "/campus",
    tag: "prueba",
  });

  if (result.sent === 0) {
    return NextResponse.json(
      { error: "No encontramos un dispositivo activo. Probá desactivar y volver a activar." },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, ...result });
}
