"use client";

import * as React from "react";
import type { ActionResult } from "../actions";

/**
 * Envuelve una Server Action devolviendo estado de carga/error y un mensaje de éxito efímero.
 * `run` resuelve con el resultado para que el caller pueda cerrar diálogos o limpiar formularios.
 */
export function useAction() {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const timer = React.useRef<number | undefined>(undefined);

  React.useEffect(() => () => window.clearTimeout(timer.current), []);

  const run = React.useCallback(
    async <T,>(action: () => Promise<ActionResult<T>>, successMessage?: string): Promise<ActionResult<T>> => {
      setPending(true);
      setError(null);
      setSuccess(null);
      try {
        const result = await action();
        if (!result.ok) {
          setError(result.error);
        } else if (successMessage) {
          setSuccess(successMessage);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => setSuccess(null), 2500);
        }
        return result;
      } catch (err) {
        console.error("[admin] acción falló", err);
        const message = "No se pudo completar la acción. Revisá tu conexión e intentá de nuevo.";
        setError(message);
        return { ok: false, error: message };
      } finally {
        setPending(false);
      }
    },
    [],
  );

  const reset = React.useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []);

  return { pending, error, success, run, reset, setError };
}
