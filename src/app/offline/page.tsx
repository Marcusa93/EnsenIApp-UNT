import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, CloudOff, Layers, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/shell/brand";
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
    <main
      id="contenido"
      tabIndex={-1}
      className="campus-grid campus-grid-fade relative flex min-h-dvh flex-col items-center justify-center px-6 py-16 outline-none"
    >
      <div className="glow-2 pointer-events-none absolute left-1/2 top-1/3 size-72 -translate-x-1/2 rounded-full bg-accent-2/15 blur-3xl" aria-hidden />
      <div className="relative w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl border border-warning/30 bg-warning/10 text-warning">
          <CloudOff className="size-7" aria-hidden />
        </div>
        <p className="eyebrow mb-3">Modo sin datos</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Estás sin conexión</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
          Esta pantalla todavía no está guardada en tu dispositivo. Lo que ya abriste con conexión (resúmenes, placas,
          transcripciones) sigue disponible, y los cambios que hagas se envían solos cuando vuelva la red.
        </p>

        <ul className="mt-8 grid gap-2 text-left text-sm">
          <li className="flex items-start gap-3 rounded-2xl border border-border bg-surface/70 p-3.5">
            <BookOpen className="mt-0.5 size-4 shrink-0 text-accent-2" aria-hidden />
            <span>
              <span className="font-medium">Lectura offline.</span>{" "}
              <span className="text-muted">Resúmenes, versión simple y transcripciones que ya viste.</span>
            </span>
          </li>
          <li className="flex items-start gap-3 rounded-2xl border border-border bg-surface/70 p-3.5">
            <Layers className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
            <span>
              <span className="font-medium">Placas interactivas.</span>{" "}
              <span className="text-muted">Tu progreso se guarda acá y se sincroniza después.</span>
            </span>
          </li>
        </ul>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          <OfflineRetry />
          <Button asChild variant="secondary" leftIcon={<RefreshCw />}>
            <Link href="/campus">Ir al campus</Link>
          </Button>
        </div>

        <div className="mt-12 flex items-center justify-center gap-2 text-muted">
          <BrandMark size={18} />
          <span className="eyebrow text-[10px]">EnsenIA · Derecho · UNT</span>
        </div>
      </div>
    </main>
  );
}
