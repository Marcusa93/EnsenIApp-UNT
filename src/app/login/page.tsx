import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/auth";
import { safeInternalPath } from "@/lib/utils";
import { homeForRole } from "@/lib/nav";
import { InstitutionalLockup } from "@/components/shell/brand";
import { DevelopedBy } from "@/components/shell/developed-by";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Ingresar" };

const ERROR_MESSAGES: Record<string, string> = {
  auth: "No pudimos validar tu acceso. El link puede haber vencido: pedí uno nuevo.",
  bloqueado: "Tu cuenta está bloqueada. Escribile al equipo docente para más información.",
  oauth: "No se completó el ingreso. Probá de nuevo con tu email y contraseña.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const nextParam = typeof params.next === "string" ? params.next : undefined;
  const errorParam = typeof params.error === "string" ? params.error : undefined;
  const next = safeInternalPath(nextParam, "/campus");

  // Si ya hay sesión válida, no tiene sentido mostrar el login.
  if (errorParam !== "bloqueado") {
    const ctx = await getOptionalUser();
    if (ctx && ctx.profile.status !== "bloqueado") {
      redirect(nextParam ? next : homeForRole(ctx.profile.role));
    }
  }

  return (
    <main id="contenido" tabIndex={-1} className="relative flex min-h-dvh flex-col overflow-hidden outline-none">
      <div className="brand-rule" aria-hidden />
      <div className="trama campus-grid-fade pointer-events-none absolute inset-0 opacity-70" aria-hidden />
      <div
        className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full opacity-[0.14] blur-3xl"
        style={{ background: "radial-gradient(closest-side, var(--accent), transparent 70%)" }}
        aria-hidden
      />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-5 py-4 sm:px-8 sm:py-5">
        <InstitutionalLockup logoHeight={30} />
        <div className="flex items-center gap-2">
          <ThemeToggle className="hidden sm:flex" />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 font-display text-sm font-semibold text-muted transition hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Volver
          </Link>
        </div>
      </header>

      <div className="relative z-10 flex flex-1 items-center justify-center px-5 pb-16 pt-6 sm:px-8">
        <LoginForm
          next={next}
          initialError={errorParam ? (ERROR_MESSAGES[errorParam] ?? ERROR_MESSAGES.auth) : null}
          liveJoin={next.startsWith("/vivo/")}
        />
      </div>

      <footer className="relative z-10 flex flex-col items-center gap-3 px-5 pb-8 text-center text-xs text-muted">
        <span>Derecho de las Nuevas Tecnologías y Bioderecho · Facultad de Derecho y Ciencias Sociales · UNT</span>
        <DevelopedBy variant="line" className="justify-center" />
      </footer>
    </main>
  );
}
