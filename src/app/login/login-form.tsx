"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Mail, MailCheck, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";

interface LoginFormProps {
  next: string;
  initialError: string | null;
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.4c-.2 1.3-1.6 3.9-5.4 3.9-3.3 0-5.9-2.7-5.9-6s2.6-6 5.9-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z"
      />
    </svg>
  );
}

function humanizeAuthError(err: unknown): string {
  const msg = errorMessage(err, "");
  if (/rate limit|too many/i.test(msg)) return "Demasiados intentos. Esperá un minuto y probá de nuevo.";
  if (/invalid email|valid email/i.test(msg)) return "Ese email no parece válido. Revisalo.";
  if (/signups not allowed|not allowed/i.test(msg)) return "Este email no está habilitado para ingresar.";
  if (/fetch|network/i.test(msg)) return "Sin conexión. Revisá tu red e intentá de nuevo.";
  return msg || "No pudimos enviar el link. Intentá de nuevo.";
}

export function LoginForm({ next, initialError }: LoginFormProps) {
  const [email, setEmail] = React.useState("");
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(initialError);
  const [loadingEmail, setLoadingEmail] = React.useState(false);
  const [loadingGoogle, setLoadingGoogle] = React.useState(false);

  const callbackUrl = React.useCallback(() => {
    const url = new URL("/auth/callback", window.location.origin);
    if (next && next !== "/campus") url.searchParams.set("next", next);
    return url.toString();
  }, [next]);

  async function signInWithGoogle() {
    setError(null);
    setLoadingGoogle(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callbackUrl(), queryParams: { prompt: "select_account" } },
      });
      if (error) throw error;
      // El navegador redirige a Google; si no lo hace, liberamos el botón.
      window.setTimeout(() => setLoadingGoogle(false), 6000);
    } catch (err) {
      console.error("[login] google", err);
      setError(humanizeAuthError(err));
      setLoadingGoogle(false);
    }
  }

  async function signInWithEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!value) return;
    setError(null);
    setLoadingEmail(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: value,
        options: { emailRedirectTo: callbackUrl() },
      });
      if (error) throw error;
      setSentTo(value);
    } catch (err) {
      console.error("[login] magic link", err);
      setError(humanizeAuthError(err));
    } finally {
      setLoadingEmail(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="border-gradient glow w-full max-w-md rounded-3xl border border-transparent bg-surface p-7 sm:p-9"
    >
      <span className="eyebrow">Acceso al campus</span>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Ingresá a EnsenIA</h1>
      <p className="mt-2 text-sm text-muted">Usá tu cuenta de Google o tu email institucional. Sin contraseñas.</p>

      {error && (
        <div role="alert" className="mt-5 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3">
        <Button
          type="button"
          variant="secondary"
          size="lg"
          className="w-full"
          onClick={signInWithGoogle}
          loading={loadingGoogle}
          leftIcon={<GoogleIcon />}
        >
          Continuar con Google
        </Button>

        <div className="my-2 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="eyebrow">o con tu email</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {sentTo ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-accent-2/30 bg-accent-2/10 p-4"
            role="status"
          >
            <div className="flex items-start gap-3">
              <MailCheck className="mt-0.5 size-5 shrink-0 text-accent-2" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-medium">Te enviamos un link de acceso</p>
                <p className="mt-1 text-sm text-muted">
                  Revisá la casilla de <span className="font-mono text-foreground">{sentTo}</span> (y la carpeta de spam). El link
                  vence en unos minutos.
                </p>
                <button
                  type="button"
                  onClick={() => setSentTo(null)}
                  className="mt-3 text-xs text-accent-2 underline underline-offset-4 hover:opacity-80"
                >
                  Usar otro email
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <form onSubmit={signInWithEmail} className="flex flex-col gap-4" noValidate>
            <Field
              label="Email"
              htmlFor="email"
              description="Preferentemente tu email institucional: es el que figura en el padrón de la materia."
            >
              <Input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                placeholder="nombre@derecho.unt.edu.ar"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail />}
              />
            </Field>
            <Button type="submit" size="lg" className="w-full" loading={loadingEmail} disabled={!email.trim()}>
              Enviar link de acceso
            </Button>
          </form>
        )}
      </div>

      <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-muted">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-accent-2" aria-hidden />
        Si tu email está en el padrón, entrás validado e inscripto. Si no, igual podés usar el campus mientras el equipo docente
        revisa tu alta.
      </p>
    </motion.div>
  );
}
