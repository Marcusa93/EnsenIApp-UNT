"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Check, KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/utils";
import { Button, Card, Field, Input } from "@/components/ui";

export function PasswordForm() {
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("La contraseña necesita al menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      setPassword("");
      setConfirm("");
    } catch (err) {
      console.error("[cuenta] password", err);
      const msg = errorMessage(err, "");
      setError(
        /same password/i.test(msg)
          ? "Esa ya es tu contraseña actual: elegí una distinta."
          : msg || "No pudimos cambiar la contraseña. Probá de nuevo.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="max-w-md">
      {done ? (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col gap-2">
          <p className="flex items-center gap-2 text-sm font-medium text-success">
            <Check className="size-4" aria-hidden /> Contraseña actualizada
          </p>
          <p className="text-sm text-muted">A partir de ahora entrás con la nueva. Guardala en un lugar seguro.</p>
          <Button variant="secondary" size="sm" className="mt-2 self-start" onClick={() => setDone(false)}>
            Cambiarla de nuevo
          </Button>
        </motion.div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {error && (
            <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          <Field label="Nueva contraseña" htmlFor="new-password" description="Mínimo 6 caracteres.">
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<KeyRound />}
            />
          </Field>
          <Field label="Repetila" htmlFor="confirm-password">
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              leftIcon={<KeyRound />}
            />
          </Field>
          <Button type="submit" loading={loading} disabled={!password || !confirm} className="self-start">
            Guardar contraseña
          </Button>
        </form>
      )}
    </Card>
  );
}
