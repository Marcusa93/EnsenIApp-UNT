import Link from "next/link";
import { Compass } from "lucide-react";
import { Brand } from "@/components/shell/brand";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="relative flex min-h-dvh flex-col">
      <div className="campus-grid campus-grid-fade pointer-events-none absolute inset-0" aria-hidden />
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center px-5 py-5 sm:px-8">
        <Brand />
      </header>
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 pb-20 text-center">
        <p className="text-gradient font-mono text-7xl font-semibold tracking-tight sm:text-8xl">404</p>
        <div className="mt-6 flex items-center gap-2">
          <Compass className="size-4 text-accent-2" aria-hidden />
          <span className="eyebrow">Ruta no encontrada</span>
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Esta página no existe (o cambió de lugar)</h1>
        <p className="mt-2 max-w-md text-sm text-muted">
          Revisá el link o volvé al campus. Si llegaste acá desde un link de clase, avisale al equipo docente.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href="/campus">Ir al campus</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/">Portada</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
