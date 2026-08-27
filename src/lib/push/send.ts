import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Enums } from "@/lib/types/helpers";

/**
 * Envío de notificaciones push (Web Push / VAPID).
 *
 * Sólo servidor: la clave privada VAPID nunca sale de acá. Las suscripciones son
 * por dispositivo (`push_subscriptions.endpoint` es la identidad de cada uno), y
 * el interruptor del usuario vive en `notification_preferences.push_enabled`.
 * Cuando el push service contesta 404/410 la suscripción murió (app desinstalada,
 * permiso revocado) y la borramos sola para no acumular endpoints fantasma.
 */

export interface PushPayload {
  title: string;
  body: string;
  /** A dónde lleva el tap. Ruta relativa del campus. */
  url?: string;
  /** Notificaciones con el mismo tag se reemplazan en vez de apilarse. */
  tag?: string;
  renotify?: boolean;
}

/** Tras 5 fallos transitorios seguidos damos la suscripción por perdida. */
const MAX_FAILURES = 5;

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export function isPushConfigured(): boolean {
  return ensureConfigured();
}

export interface SendResult {
  sent: number;
  failed: number;
  removed: number;
}

const EMPTY: SendResult = { sent: 0, failed: 0, removed: 0 };

/**
 * Manda una notificación a los dispositivos de los usuarios indicados, salteando
 * a quienes tienen el push apagado y a quienes silenciaron ese tipo de aviso.
 * Nunca lanza: notificar es accesorio y no puede tumbar la acción que lo disparó.
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
  kind?: Enums<"notification_kind">,
): Promise<SendResult> {
  if (userIds.length === 0) return EMPTY;
  if (!ensureConfigured()) {
    console.warn("[push] falta configuración VAPID; no se envía nada");
    return EMPTY;
  }

  const admin = createAdminClient();

  // Preferencias: sin fila guardada se asume que el push está permitido — igual
  // hace falta una suscripción activa, que sólo existe si el usuario la aceptó.
  const { data: prefs, error: prefsError } = await admin
    .from("notification_preferences")
    .select("user_id, push_enabled, muted_kinds")
    .in("user_id", userIds);

  if (prefsError) {
    console.error("[push] no se pudieron leer las preferencias", prefsError);
    return EMPTY;
  }

  const blocked = new Set(
    (prefs ?? [])
      .filter((p) => !p.push_enabled || (kind != null && (p.muted_kinds ?? []).includes(kind)))
      .map((p) => p.user_id),
  );
  const targets = userIds.filter((id) => !blocked.has(id));
  if (targets.length === 0) return EMPTY;

  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, failed_count")
    .in("user_id", targets);

  if (error) {
    console.error("[push] no se pudieron leer las suscripciones", error);
    return EMPTY;
  }
  if (!subs || subs.length === 0) return EMPTY;

  const body = JSON.stringify(payload);
  const dead: string[] = [];
  const ok: string[] = [];
  const transient: { id: string; failed_count: number }[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
        );
        ok.push(sub.id);
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          dead.push(sub.id);
        } else {
          const next = (sub.failed_count ?? 0) + 1;
          if (next >= MAX_FAILURES) dead.push(sub.id);
          else transient.push({ id: sub.id, failed_count: next });
          console.error("[push] envío falló", { status, endpoint: sub.endpoint.slice(0, 40) });
        }
      }
    }),
  );

  // Housekeeping: no bloquea el resultado, pero conviene esperarlo dentro del request.
  await Promise.all([
    ok.length > 0
      ? admin
          .from("push_subscriptions")
          .update({ last_used_at: new Date().toISOString(), failed_count: 0 })
          .in("id", ok)
      : Promise.resolve(),
    dead.length > 0 ? admin.from("push_subscriptions").delete().in("id", dead) : Promise.resolve(),
    ...transient.map((t) =>
      admin.from("push_subscriptions").update({ failed_count: t.failed_count }).eq("id", t.id),
    ),
  ]);

  return { sent: ok.length, failed: subs.length - ok.length, removed: dead.length };
}

/** Manda a todos los estudiantes activos de un curso. */
export async function sendPushToCourse(
  courseId: string,
  payload: PushPayload,
  options: { exclude?: string[]; kind?: Enums<"notification_kind"> } = {},
): Promise<SendResult> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("enrollments")
    .select("student_id")
    .eq("course_id", courseId)
    .eq("status", "active");

  if (error) {
    console.error("[push] no se pudo listar la comisión", error);
    return EMPTY;
  }

  const exclude = new Set(options.exclude ?? []);
  const ids = (data ?? []).map((r) => r.student_id).filter((id) => !exclude.has(id));
  return sendPushToUsers(ids, payload, options.kind);
}

/**
 * Registra el aviso en la campana del campus Y lo manda por push. La fila en
 * `notifications` es la que persiste: el push es sólo el golpecito en el hombro.
 */
export async function notifyUsers(
  userIds: string[],
  input: { kind: Enums<"notification_kind">; title: string; body?: string; url?: string; courseId?: string; createdBy?: string },
): Promise<SendResult> {
  if (userIds.length === 0) return EMPTY;
  const admin = createAdminClient();

  const { error } = await admin.from("notifications").insert(
    userIds.map((user_id) => ({
      user_id,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      url: input.url ?? null,
      course_id: input.courseId ?? null,
      created_by: input.createdBy ?? null,
    })),
  );
  if (error) console.error("[push] no se pudo guardar la notificación in-app", error);

  return sendPushToUsers(
    userIds,
    { title: input.title, body: input.body ?? "", url: input.url, tag: input.kind },
    input.kind,
  );
}

/** Igual que notifyUsers, pero para toda la comisión (los estudiantes activos). */
export async function notifyCourse(
  courseId: string,
  input: { kind: Enums<"notification_kind">; title: string; body?: string; url?: string; createdBy?: string },
): Promise<SendResult> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("enrollments")
    .select("student_id")
    .eq("course_id", courseId)
    .eq("status", "active");

  if (error) {
    console.error("[push] no se pudo listar la comisión", error);
    return EMPTY;
  }

  const ids = (data ?? []).map((r) => r.student_id);
  return notifyUsers(ids, { ...input, courseId });
}
