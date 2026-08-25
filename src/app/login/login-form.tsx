"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, Mail, MailCheck, ShieldCheck, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { errorMessage, cn } from "@/lib/utils";
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
        fill="#4285F4"
        d="M23.06 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h6.2a5.3 5.3 0 0 1-2.3 3.48v2.88h3.72c2.18-2 3.44-4.96 3.44-8.37z"
      />
      <path
        fill="#34A853"
        d="M12 23c3.11 0 5.72-1.03 7.62-2.79l-3.72-2.88c-1.03.69-2.35 1.1-3.9 1.1-3 0-5.54-2.02-6.44-4.74H1.71v2.97A11.5 11.5 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.56 13.69a6.9 6.9 0 0 1 0-4.38V6.34H1.71a11.5 11.5 0 0 0 0 10.32l3.85-2.97z"
      />
      <path
        fill="#EA4335"
        d="M12 5.57c1.69 0 3.2.58 4.4 1.72l3.3-3.3A11.05 11.05 0 0 0 12 1 11.5 11.5 0 0 0 1.71 7.34l3.85 2.97C6.46 7.6 9 5.57 12 5.57z"
      />
    </svg>
  );
}

function humanizeAuthError(err: unknown): string {
  const msg = errorMessage(err, "");
  if (/rate limit|too many/i.test(msg)) return "Demasiados intentos. Esperá un minuto y probá de nuevo.";
  if (/invalid email|valid email/i.test(msg)) return "Ese email no parece válido. Revisalo.";
  if (/signups not allowed|not allowed/i.test(msg)) return "Este email no está habilitado para ingresar.";
  if (/anonymous sign-ins are disabled/i.test(msg)) return "El acceso rápido no está habilitado. Probá con Google o tu email.";
  if (/fetch|network/i.test(msg)) return "Sin conexión. Revisá tu red e intentá de nuevo.";
  return msg || "No pudimos ingresar. Intentá de nuevo.";
}

/** "María López" → "María López"; colapsa espacios, exige nombre y apellido. */
function normalizeFullName(raw: string): string | null {
  const value = raw.trim().replace(/\s+/g, " ");
  if (value.split(" ").filter(Boolean).length < 2) return null;
  return value
    .split(" ")
    .map((w) => (w.length > 1 ? w[0]!.toUpperCase() + w.slice(1).toLowerCase() : w.toUpperCase()))
    .join(" ");
}

export function LoginForm({ next, initialError }: LoginFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = React.useState("");
  const [loadingName, setLoadingName] = React.useState(false);
  const [nameError, setNameError] = React.useState<string | null>(null);

  const [showAccountAccess, setShowAccountAccess] = React.useState(false);
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

  async function enterWithName(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = normalizeFullName(fullName);
    if (!name) {
      setNameError("Escribí nombre y apellido.");
      return;
    }
    setNameError(null);
    setLoadingName(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInAnonymously({ options: { data: { full_name: name } } });
      if (error) throw error;
      router.push(next);
      router.refresh();
    } catch (err) {
      console.error("[login] acceso por nombre", err);
      setNameError(humanizeAuthError(err));
      setLoadingName(false);
    }
  }

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
      <p className="mt-2 text-sm text-muted">Entrá con tu nombre y apellido. Sin contraseñas, sin trámite.</p>

      {nameError && (
        <div role="alert" className="mt-5 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {nameError}
        </div>
      )}

      <form onSubmit={enterWithName} className="mt-6 flex flex-col gap-4" noValidate>
        <Field label="Nombre y apellido" htmlFor="full-name">
          <Input
            id="full-name"
            name="full-name"
            type="text"
            autoComplete="name"
            required
            autoFocus
            placeholder="Ana Gómez"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            leftIcon={<User />}
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={loadingName} disabled={!fullName.trim()}>
          Ingresar al campus
        </Button>
      </form>

      <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-accent-2" aria-hidden />
        Por ahora el acceso es libre con tu nombre. Más adelante vas a poder vincular tu cuenta institucional sin perder nada
        de lo que hiciste.
      </p>

      <div className="mt-6 border-t border-border pt-4">
        <button
          type="button"
          onClick={() => setShowAccountAccess((v) => !v)}
          className="flex w-full items-center justify-between text-sm text-muted transition hover:text-foreground"
          aria-expanded={showAccountAccess}
        >
          <span>¿Ya tenés una cuenta del equipo docente?</span>
          <ChevronDown className={cn("size-4 transition-transform", showAccountAccess && "rotate-180")} aria-hidden />
        </button>

        <AnimatePresence initial={false}>
          {showAccountAccess && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-4 flex flex-col gap-3">
                {error && (
                  <div role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                    {error}
                  </div>
                )}

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

                <div className="my-1 flex items-center gap-3">
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
                          Revisá la casilla de <span className="font-mono text-foreground">{sentTo}</span> (y la carpeta de
                          spam). El link vence en unos minutos.
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
                      description="Tu email institucional: es el que figura en el padrón de la materia."
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
