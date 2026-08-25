"use client";

import * as React from "react";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/**
 * Botón "Reintentar" de la página /offline. Cuando el navegador recupera conexión,
 * vuelve solo a la ruta que el usuario quería abrir (o al campus).
 */
export function OfflineRetry() {
  const online = React.useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  const [busy, setBusy] = React.useState(false);

  const retry = React.useCallback(() => {
    setBusy(true);
    // Si hay historial, volvemos a la página que falló; si no, al campus.
    if (window.history.length > 1) window.history.back();
    else window.location.assign(new URL("/campus", window.location.origin).toString());
    // Si history.back() no navegó (p. ej. la entrada anterior es externa), recargamos.
    window.setTimeout(() => window.location.reload(), 800);
  }, []);

  React.useEffect(() => {
    if (!online) return;
    const t = window.setTimeout(retry, 600);
    return () => window.clearTimeout(t);
  }, [online, retry]);

  return (
    <Button onClick={retry} loading={busy} leftIcon={<RotateCw />}>
      {online ? "Reintentar ahora" : "Reintentar"}
    </Button>
  );
}
