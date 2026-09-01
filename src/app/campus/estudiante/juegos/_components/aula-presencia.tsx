"use client";

import * as React from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Cuántos operadores hay AHORA en el Aula Magna, visto desde Juegos.
 *
 * El aula sólo funciona si la gente coincide, y nadie coincide con lo que no
 * ve: este es el cartel de "hay gente en el patio" que cierra el loop social.
 * Se suscribe al mismo canal de presencia del aula en modo sólo-lectura (no
 * hace track de sí mismo: mirar el cartel no es estar en el aula).
 */
export function AulaPresencia({ courseId }: { courseId: string }) {
  const [cuantos, setCuantos] = React.useState(0);

  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`aula:${courseId}`);
    channel
      .on("presence", { event: "sync" }, () => {
        setCuantos(Object.keys(channel.presenceState()).length);
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [courseId]);

  if (cuantos === 0) return null;

  return (
    <Link
      href="/campus/estudiante/aula-magna"
      className="flex items-center gap-2.5 rounded-2xl border border-accent-2/35 bg-accent-2/10 px-3.5 py-2.5 transition hover:border-accent-2/60"
    >
      <span className="relative flex size-2.5 shrink-0">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent-2 opacity-60" />
        <span className="relative inline-flex size-2.5 rounded-full bg-accent-2" />
      </span>
      <Users className="size-4 text-accent-2" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-sm">
        {cuantos === 1 ? "Hay 1 operador en el Aula Magna ahora" : `Hay ${cuantos} operadores en el Aula Magna ahora`}
      </span>
      <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-accent-2">Entrar</span>
    </Link>
  );
}
