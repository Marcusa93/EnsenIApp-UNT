"use client";

import * as React from "react";
import { BellRing, Loader2, Send } from "lucide-react";
import { Button, Card, CardTitle, Switch } from "@/components/ui";

/**
 * Interruptor de notificaciones push.
 *
 * Un solo switch controla las dos cosas que hacen falta: la suscripción de ESTE
 * dispositivo y la preferencia global del usuario. Los estados que hay que
 * contemplar sí o sí en un campus que se usa mayormente desde el celular:
 *  - iOS sólo permite push si la PWA está instalada en la pantalla de inicio.
 *  - El permiso denegado no se puede volver a pedir por código: hay que mandar
 *    al usuario a los ajustes del navegador, así que se lo explicamos.
 */

/** La clave VAPID viaja en base64url y el navegador la quiere como bytes. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type Support = "checking" | "ok" | "necesita-instalar" | "no-soportado";

export function PushToggle() {
  const [support, setSupport] = React.useState<Support>("checking");
  const [enabled, setEnabled] = React.useState(false);
  const [permission, setPermission] = React.useState<NotificationPermission>("default");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      const hasApi = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!hasApi) {
        // En iOS la API aparece recién cuando la PWA corre instalada.
        const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent);
        const standalone =
          window.matchMedia("(display-mode: standalone)").matches ||
          (window.navigator as { standalone?: boolean }).standalone === true;
        if (!cancelled) setSupport(isIOS && !standalone ? "necesita-instalar" : "no-soportado");
        return;
      }

      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (cancelled) return;
        setEnabled(sub != null);
        setPermission(Notification.permission);
        setSupport("ok");
      } catch (err) {
        console.error("[push] no se pudo leer el estado", err);
        if (!cancelled) setSupport("no-soportado");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function activate() {
    if (!vapidKey) {
      setError("Las notificaciones no están configuradas todavía. Avisale al equipo docente.");
      return;
    }

    const result = await Notification.requestPermission();
    setPermission(result);
    if (result !== "granted") {
      setError(
        result === "denied"
          ? "Bloqueaste las notificaciones para el campus. Habilitalas desde los ajustes del navegador y volvé a intentar."
          : "Necesitamos tu permiso para poder avisarte.",
      );
      return;
    }

    const reg = await navigator.serviceWorker.ready;
    // Si ya había una suscripción (de otra clave VAPID, por ejemplo) la reemplazamos.
    const previous = await reg.pushManager.getSubscription();
    if (previous) await previous.unsubscribe().catch(() => {});

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
    });

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });
    if (!res.ok) {
      await sub.unsubscribe().catch(() => {});
      const data = await res.json().catch(() => null);
      throw new Error(data?.error ?? "No pudimos activar las notificaciones.");
    }

    setEnabled(true);
    setNote("Listo, te vamos a avisar cuando haya novedades de la materia.");
  }

  async function deactivate() {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => null);
      await sub.unsubscribe().catch(() => {});
    }
    setEnabled(false);
    setNote("Desactivaste las notificaciones en este dispositivo.");
  }

  async function toggle(next: boolean) {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      if (next) await activate();
      else await deactivate();
    } catch (err) {
      console.error("[push] toggle", err);
      setError(err instanceof Error ? err.message : "No pudimos cambiar las notificaciones.");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "No pudimos mandar la prueba.");
      setNote("Te mandamos una notificación de prueba. Debería aparecerte en un segundo.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos mandar la prueba.");
    } finally {
      setBusy(false);
    }
  }

  if (support === "checking") return null;

  return (
    <Card>
      <CardTitle eyebrow="Notificaciones" as="h2" className="flex items-center gap-2">
        <BellRing className="size-4 text-accent-2" aria-hidden />
        Avisos de la cátedra
      </CardTitle>

      {support === "no-soportado" ? (
        <p className="mt-3 text-sm text-muted">
          Este navegador no permite notificaciones. Probá desde Chrome en Android, o instalando el campus en tu
          pantalla de inicio.
        </p>
      ) : support === "necesita-instalar" ? (
        <p className="mt-3 text-sm leading-relaxed text-muted">
          En iPhone las notificaciones funcionan sólo con el campus instalado. Tocá{" "}
          <strong className="text-foreground">Compartir</strong> en Safari, después{" "}
          <strong className="text-foreground">Agregar a inicio</strong>, y abrí EnsenIA desde ahí para activarlas.
        </p>
      ) : (
        <>
          <div className="mt-4">
            <Switch
              checked={enabled}
              onCheckedChange={toggle}
              disabled={busy || permission === "denied"}
              label="Avisarme en este dispositivo"
              description="Grabaciones publicadas, avisos, sesiones en vivo y desafíos nuevos."
            />
          </div>

          {permission === "denied" && (
            <p className="mt-3 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              Las notificaciones están bloqueadas para el campus en este navegador. Habilitalas desde sus ajustes y
              volvé a esta pantalla.
            </p>
          )}

          {enabled && (
            <div className="mt-3">
              <Button variant="secondary" size="sm" onClick={test} disabled={busy} leftIcon={busy ? <Loader2 className="animate-spin" /> : <Send />}>
                Mandarme una de prueba
              </Button>
            </div>
          )}
        </>
      )}

      {note && <p className="mt-3 text-xs text-success">{note}</p>}
      {error && (
        <p role="alert" className="mt-3 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}
    </Card>
  );
}
