import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, CloudOff, Layers, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InstitutionalLockup } from "@/components/shell/brand";
import { DevelopedBy } from "@/components/shell/developed-by";
import { OfflineRetry } from "./retry";

export const metadata: Metadata = {
  title: "Sin conexión",
  description: "No hay conexión a internet. Lo que ya leíste sigue disponible en el dispositivo.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-static";

/** Fallback de navegación del service worker cuando no hay red ni copia cacheada. */
export default function OfflinePage() {
  return (
    <main id="contenido" tabIndex={-1} className="relative flex min-h-dvh flex-col overflow-hidden outline-none">
      <div className="brand-rule" aria-hidden />
      {/* Fondo: trama del logo, desvanecida. */}
      <div className="trama campus-grid-fade pointer-events-none absolute inset-0 opacity-70" aria-hidden />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center px-5 py-4 sm:px-8 sm:py-5">
        <InstitutionalLockup logoHeight={30} />
      </header>

      <div className="relative z-10 flex flex-1 items-center justify-center px-5 pb-12 pt-4 sm:px-8">
        <div className="w-full max-w-md">
          {/* Tarjeta protagonista: pleca de advertencia arriba y esquinas de expediente. */}
          <div className="corners paper relative overflow-hidden rounded-2xl border border-border border-t-[3px] border-t-warning bg-surface p-6 text-center sm:p-8">
            <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl border border-warning/30 bg-warning/10 text-warning">
              <CloudOff className="size-6" aria-hidden />
            </div>
            <p className="eyebrow mb-2">Modo sin datos</p>
            <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Estás sin conexión</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted sm:text-[15px]">
              Esta pantalla todavía no está guardada en tu dispositivo. Lo que ya abriste con conexión (resúmenes,
              placas, transcripciones) sigue disponible, y los cambios que hagas se envían solos cuando vuelva la red.
            </p>

            <ul className="mt-6 grid gap-2 text-left text-sm">
              <li className="flex items-start gap-3 rounded-xl border border-border bg-surface-2/60 p-3.5">
                <BookOpen className="mt-0.5 size-4 shrink-0 text-accent-2" aria-hidden />
                <span className="min-w-0">
                  <span className="font-display font-bold">Lectura offline.</span>{" "}
                  <span className="text-muted">Resúmenes, versión simple y transcripciones que ya viste.</span>
                </span>
              </li>
              <li className="flex items-start gap-3 rounded-xl border border-border bg-surface-2/60 p-3.5">
                <Layers className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                <span className="min-w-0">
                  <span className="font-display font-bold">Placas interactivas.</span>{" "}
                  <span className="text-muted">Tu progreso se guarda acá y se sincroniza después.</span>
                </span>
              </li>
            </ul>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <OfflineRetry />
              <Button asChild variant="outline" leftIcon={<RefreshCw />} className="w-full sm:w-auto">
                <Link href="/campus">Ir al campus</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <footer className="relative z-10 flex flex-col items-center gap-3 px-5 pb-8 text-center text-xs text-muted">
        <span>Derecho de las Nuevas Tecnologías y Bioderecho · Facultad de Derecho y Ciencias Sociales · UNT</span>
        <DevelopedBy variant="line" className="justify-center" />
      </footer>
    </main>
  );
}
