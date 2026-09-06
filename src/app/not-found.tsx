import Link from "next/link";
import { Compass } from "lucide-react";
import { InstitutionalLockup } from "@/components/shell/brand";
import { DevelopedBy } from "@/components/shell/developed-by";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="contenido" tabIndex={-1} className="relative flex min-h-dvh flex-col overflow-hidden outline-none">
      <div className="brand-rule" aria-hidden />
      {/* Fondo: la trama del retrato de Alberdi, desvanecida hacia abajo. */}
      <div className="trama campus-grid-fade pointer-events-none absolute inset-0 opacity-70" aria-hidden />
      <div
        className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full opacity-[0.12] blur-3xl"
        style={{ background: "radial-gradient(closest-side, var(--accent), transparent 70%)" }}
        aria-hidden
      />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-5 py-4 sm:px-8 sm:py-5">
        <InstitutionalLockup logoHeight={30} />
        <ThemeToggle className="hidden sm:flex" />
      </header>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 pb-16 pt-6 text-center sm:px-8">
        {/* La cifra es un dato: Montserrat 800 tabular, en carmesí. */}
        <p className="display-num text-accent text-[5.5rem] leading-none sm:text-[7.5rem]" aria-hidden>
          404
        </p>
        <div className="mt-6 flex items-center gap-2">
          <Compass className="size-4 text-accent" aria-hidden />
          <span className="eyebrow">Ruta no encontrada</span>
        </div>
        <h1 className="mt-3 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
          Esta página no existe (o cambió de lugar)
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted sm:text-base">
          Revisá el link o volvé al campus. Si llegaste acá desde un link de clase, avisale al equipo docente.
        </p>
        <div className="mt-8 flex w-full flex-col justify-center gap-2 sm:w-auto sm:flex-row">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/campus">Ir al campus</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
            <Link href="/">Portada</Link>
          </Button>
        </div>
      </div>

      <footer className="relative z-10 flex flex-col items-center gap-3 px-5 pb-8 text-center text-xs text-muted">
        <span>Derecho de las Nuevas Tecnologías y Bioderecho · Facultad de Derecho y Ciencias Sociales · UNT</span>
        <DevelopedBy variant="line" className="justify-center" />
      </footer>
    </main>
  );
}
