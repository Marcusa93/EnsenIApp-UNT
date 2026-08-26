"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, KeyRound, Mail, MailCheck, Radio, ShieldCheck, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { errorMessage, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";

interface LoginFormProps {
  next: string;
  initialError: string | null;
  /** true cuando viene a sumarse a una clase en vivo (?next=/vivo/…): ahí el acceso por nombre sigue siendo el camino rápido. */
  liveJoin: boolean;
}

function humanizeAuthError(err: unknown): string {
  const msg = errorMessage(err, "");
  if (/rate limit|too many/i.test(msg)) return "Demasiados intentos. Esperá un minuto y probá de nuevo.";
  if (/invalid email|valid email/i.test(msg)) return "Ese email no parece válido. Revisalo.";
  if (/signups not allowed|not allowed/i.test(msg)) return "Este email no está habilitado para ingresar.";
  if (/anonymous sign-ins are disabled/i.test(msg)) return "El acceso rápido no está habilitado. Ingresá con tu cuenta.";
  if (/invalid login credentials/i.test(msg)) return "Email o contraseña incorrectos. Si todavía no tenés cuenta, pedísela al equipo docente.";
  if (/fetch|network/i.test(msg)) return "Sin conexión. Revisá tu red e intentá de nuevo.";
  return msg || "No pudimos ingresar. Intentá de nuevo.";
}

/** Dominio interno para cuentas docente/admin con usuario+contraseña (sin email real). */
const INTERNAL_EMAIL_DOMAIN = "ensenia-unt.local";

function resolveLoginEmail(usernameOrEmail: string): string {
  const value = usernameOrEmail.trim().toLowerCase();
  return value.includes("@") ? value : `${value}@${INTERNAL_EMAIL_DOMAIN}`;
}

/** "maría lópez" → "María López"; colapsa espacios, exige nombre y apellido. */
function normalizeFullName(raw: string): string | null {
  const value = raw.trim().replace(/\s+/g, " ");
  if (value.split(" ").filter(Boolean).length < 2) return null;
  return value
    .split(" ")
    .map((w) => (w.length > 1 ? w[0]!.toUpperCase() + w.slice(1).toLowerCase() : w.toUpperCase()))
    .join(" ");
}

export function LoginForm({ next, initialError, liveJoin }: LoginFormProps) {
  const router = useRouter();

  // Cuenta del campus (camino principal)
  const [identifier, setIdentifier] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loadingPassword, setLoadingPassword] = React.useState(false);
  const [error, setError] = React.useState<string | null>(initialError);

  // Link por email (secundario, para quien no tiene o no recuerda la contraseña)
  const [showMagic, setShowMagic] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const [magicError, setMagicError] = React.useState<string | null>(null);
  const [loadingEmail, setLoadingEmail] = React.useState(false);

  // Clase en vivo (sólo cuando liveJoin)
  const [fullName, setFullName] = React.useState("");
  const [loadingName, setLoadingName] = React.useState(false);
  const [nameError, setNameError] = React.useState<string | null>(null);

  const callbackUrl = React.useCallback(() => {
    const url = new URL("/auth/callback", window.location.origin);
    if (next && next !== "/campus") url.searchParams.set("next", next);
    return url.toString();
  }, [next]);

  async function signInWithPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!identifier.trim() || !password) return;
    setError(null);
    setLoadingPassword(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: resolveLoginEmail(identifier),
        password,
      });
      if (error) throw error;
      router.push(next);
      router.refresh();
    } catch (err) {
      console.error("[login] cuenta", err);
      setError(humanizeAuthError(err));
      setLoadingPassword(false);
    }
  }

  async function signInWithEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!value) return;
    setMagicError(null);
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
      setMagicError(humanizeAuthError(err));
    } finally {
      setLoadingEmail(false);
    }
  }

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

  const accountForm = (
    <form onSubmit={signInWithPassword} className="flex flex-col gap-4" noValidate>
      <Field
        label="Email o usuario"
        htmlFor="identifier"
        description="Con el email que le diste al equipo docente."
      >
        <Input
          id="identifier"
          name="identifier"
          type="text"
          inputMode="email"
          autoComplete="username"
          required
          autoFocus={!liveJoin}
          placeholder="nombre@email.com"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          leftIcon={<Mail />}
        />
      </Field>
      <Field label="Contraseña" htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          leftIcon={<KeyRound />}
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={loadingPassword} disabled={!identifier.trim() || !password}>
        Ingresar al campus
      </Button>
    </form>
  );

  const magicSection = (
    <div className="border-t border-border pt-4">
      <button
        type="button"
        onClick={() => setShowMagic((v) => !v)}
        className="flex w-full items-center justify-between text-sm text-muted transition hover:text-foreground"
        aria-expanded={showMagic}
      >
        <span>¿No tenés o no recordás tu contraseña?</span>
        <ChevronDown className={cn("size-4 transition-transform", showMagic && "rotate-180")} aria-hidden />
      </button>

      <AnimatePresence initial={false}>
        {showMagic && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-3 pt-4">
              {magicError && (
                <div role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {magicError}
                </div>
              )}
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
                        spam). Una vez adentro podés cambiar tu contraseña desde tu cuenta.
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
                <form onSubmit={signInWithEmail} className="flex flex-col gap-3" noValidate>
                  <Field
                    label="Email"
                    htmlFor="magic-email"
                    description="Te mandamos un link para entrar sin contraseña (tiene que ser un email habilitado por la cátedra)."
                  >
                    <Input
                      id="magic-email"
                      name="magic-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      required
                      placeholder="nombre@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      leftIcon={<Mail />}
                    />
                  </Field>
                  <Button type="submit" variant="secondary" size="lg" className="w-full" loading={loadingEmail} disabled={!email.trim()}>
                    Enviar link de acceso
                  </Button>
                </form>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="border-gradient glow w-full max-w-md rounded-3xl border border-transparent bg-surface p-7 sm:p-9"
    >
      {liveJoin ? (
        <>
          <span className="eyebrow inline-flex items-center gap-1.5">
            <Radio className="size-3.5 text-accent-2" aria-hidden /> Clase en vivo
          </span>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Sumate a la clase</h1>
          <p className="mt-2 text-sm text-muted">Con tu nombre y apellido alcanza para participar ahora.</p>

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
              Entrar a la clase
            </Button>
          </form>

          <div className="mt-6 border-t border-border pt-4">
            <p className="mb-3 text-sm text-muted">¿Ya tenés cuenta del campus? Ingresá con ella y tu participación queda en tu historial.</p>
            {error && (
              <div role="alert" className="mb-3 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                {error}
              </div>
            )}
            {accountForm}
          </div>
        </>
      ) : (
        <>
          <span className="eyebrow">Acceso al campus</span>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Ingresá a EnsenIA</h1>
          <p className="mt-2 text-sm text-muted">Con la cuenta que te dio el equipo docente.</p>

          {error && (
            <div role="alert" className="mt-5 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-5">
            {accountForm}

            <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-accent-2" aria-hidden />
              ¿Todavía no tenés cuenta? Pasale tu email al equipo docente y te la creamos con una contraseña inicial, que
              después cambiás desde tu perfil.
            </p>

            {magicSection}
          </div>
        </>
      )}
    </motion.div>
  );
}
