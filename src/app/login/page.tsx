"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signInWithGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
  }

  async function signInWithEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <main className="campus-grid flex min-h-screen items-center justify-center px-6">
      <div className="glow w-full max-w-sm rounded-2xl border border-border bg-surface p-8">
        <div className="mb-8 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-accent-2" />
          <span className="font-mono text-xs tracking-widest text-muted uppercase">
            EnsenIA · UNT
          </span>
        </div>
        <h1 className="mb-1 text-2xl font-semibold">Ingresá al campus</h1>
        <p className="mb-6 text-sm text-muted">
          Derecho de las Nuevas Tecnologías y Bioderecho
        </p>

        <button
          onClick={signInWithGoogle}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm font-medium transition hover:border-accent"
        >
          Continuar con Google
        </button>

        <div className="my-4 flex items-center gap-3 text-xs text-muted">
          <div className="h-px flex-1 bg-border" />
          o con tu email institucional
          <div className="h-px flex-1 bg-border" />
        </div>

        {sent ? (
          <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-accent-2">
            Te enviamos un link mágico a {email}. Revisá tu correo.
          </p>
        ) : (
          <form onSubmit={signInWithEmail} className="flex flex-col gap-3">
            <input
              type="email"
              required
              placeholder="nombre@derecho.unt.edu.ar"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl border border-border bg-transparent px-4 py-3 text-sm outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-accent px-4 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Enviando..." : "Enviar link de acceso"}
            </button>
            {error && <p className="text-xs text-accent-3">{error}</p>}
          </form>
        )}
      </div>
    </main>
  );
}
