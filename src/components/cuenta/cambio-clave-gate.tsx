"use client";

import * as React from "react";
import { motion } from "motion/react";
import { KeyRound, Loader2 } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/utils";

/**
 * Puerta de contraseña: la primera vez que entrás con la clave provisoria que
 * te dio la cátedra, tenés que elegir una propia antes de seguir.
 *
 * A diferencia del consentimiento —que se puede rechazar y seguir igual—, esta
 * sí bloquea: mientras la contraseña la sepa quien te la mandó, la cuenta no es
 * del todo tuya, y por esa cuenta pasan tus notas y tus consultas.
 *
 * No se cierra con Escape ni tocando afuera. La marca en el perfil la apaga un
 * trigger de la base cuando el cambio se concreta, así que acá alcanza con
 * refrescar: si algo fallara del lado del servidor, la puerta vuelve a aparecer
 * en vez de dejar pasar por error.
 */
export function CambioClaveGate({ onListo }: { onListo?: () => void }) {
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [guardando, setGuardando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("La contraseña necesita al menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las dos contraseñas tienen que ser iguales.");
      return;
    }
    if (password === "123456") {
      setError("Esa es la contraseña provisoria: elegí una distinta.");
      return;
    }

    setGuardando(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      onListo?.();
      // Recarga desde el servidor: el trigger ya apagó la marca, así que la
      // puerta no vuelve a aparecer.
      window.location.reload();
    } catch (err) {
      const msg = errorMessage(err, "");
      setError(
        /same password/i.test(msg)
          ? "Esa ya es tu contraseña actual: elegí una distinta."
          : msg || "No pudimos cambiar la contraseña. Probá de nuevo.",
      );
      setGuardando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[95] flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="clave-titulo"
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="border-gradient w-full max-w-md rounded-3xl border border-transparent bg-surface p-6"
      >
        <div className="flex items-center gap-3">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-accent/35 bg-accent/10 text-accent"
            aria-hidden
          >
            <KeyRound className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 id="clave-titulo" className="text-lg font-semibold leading-tight">
              Elegí tu contraseña
            </h2>
            <p className="text-sm text-muted">Entraste con la provisoria de la cátedra.</p>
          </div>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-muted">
          Esa contraseña la sabe quien te la pasó. Poné una tuya: por esta cuenta pasan tus entregas, tus notas y tus
          consultas.
        </p>

        <form onSubmit={guardar} className="mt-4 flex flex-col gap-3">
          <Field label="Nueva contraseña" htmlFor="cg-pass" hint="Al menos 6 caracteres">
            <Input
              id="cg-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              autoFocus
              required
              disabled={guardando}
            />
          </Field>
          <Field label="Repetila" htmlFor="cg-confirm">
            <Input
              id="cg-confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
              disabled={guardando}
            />
          </Field>

          {error && (
            <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={guardando}
            leftIcon={guardando ? <Loader2 className="animate-spin" /> : <KeyRound />}
            className="mt-1"
          >
            {guardando ? "Guardando…" : "Guardar y entrar"}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
