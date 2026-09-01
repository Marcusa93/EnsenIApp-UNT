"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Bell, Loader2 } from "lucide-react";
import { formatRelative } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { listarAvisos, marcarLeidos, type AvisoItem } from "@/lib/notifications/actions";
import { cn } from "@/lib/utils";

/**
 * La campana del campus: lo que pasó mientras no estabas.
 *
 * Los avisos ya se guardaban en `notifications` (notifyUsers los escribe junto
 * con el push), pero no había dónde verlos: si el push estaba apagado —o el
 * celular es un iPhone sin la app instalada— el aviso se perdía. Acá quedan
 * siempre.
 *
 * Se cargan al abrir, no al montar: es una lista que casi nunca se mira, y no
 * vale una consulta por pantalla cargada.
 */
export function AvisosBell({ userId }: { userId: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = React.useState(false);
  const [avisos, setAvisos] = React.useState<AvisoItem[]>([]);
  const [sinLeer, setSinLeer] = React.useState<number | null>(null);
  const [cargando, setCargando] = React.useState(false);
  const caja = React.useRef<HTMLDivElement>(null);

  const cargar = React.useCallback(async () => {
    setCargando(true);
    const r = await listarAvisos();
    setAvisos(r.avisos);
    setSinLeer(r.sinLeer);
    setCargando(false);
  }, []);

  // El contador se busca una vez al entrar, para que la campana avise sola.
  React.useEffect(() => {
    let vivo = true;
    void listarAvisos().then((r) => {
      if (vivo) setSinLeer(r.sinLeer);
    });
    return () => {
      vivo = false;
    };
  }, []);

  // Y de ahí en más, en vivo: si te retan o te responden mientras estás
  // adentro, el globito sube solo — sin esto había que recargar para enterarse.
  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`avisos:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const fila = payload.new as AvisoItem;
          setSinLeer((n) => (n ?? 0) + 1);
          setAvisos((prev) => (prev.some((a) => a.id === fila.id) ? prev : [fila, ...prev]));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  React.useEffect(() => {
    if (!abierto) return;
    function alTocarAfuera(e: MouseEvent) {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    }
    function alEscapar(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierto(false);
    }
    document.addEventListener("mousedown", alTocarAfuera);
    document.addEventListener("keydown", alEscapar);
    return () => {
      document.removeEventListener("mousedown", alTocarAfuera);
      document.removeEventListener("keydown", alEscapar);
    };
  }, [abierto]);

  async function alternar() {
    const proximo = !abierto;
    setAbierto(proximo);
    if (!proximo) return;
    await cargar();
  }

  async function abrirAviso(a: AvisoItem) {
    setAbierto(false);
    if (!a.read_at) {
      setSinLeer((n) => Math.max(0, (n ?? 1) - 1));
      void marcarLeidos({ ids: [a.id] });
    }
    if (a.url) router.push(a.url);
  }

  async function marcarTodos() {
    const pendientes = avisos.filter((a) => !a.read_at).map((a) => a.id);
    if (pendientes.length === 0) return;
    const ahora = new Date().toISOString();
    setAvisos((prev) => prev.map((a) => (a.read_at ? a : { ...a, read_at: ahora })));
    setSinLeer(0);
    await marcarLeidos({ ids: pendientes.slice(0, 50) });
  }

  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        onClick={() => void alternar()}
        aria-label={sinLeer ? `Avisos (${sinLeer} sin leer)` : "Avisos"}
        aria-expanded={abierto}
        className="relative flex size-9 items-center justify-center rounded-xl border border-border bg-surface-2/60 text-muted transition hover:border-accent/40 hover:text-foreground"
      >
        <Bell className="size-4" aria-hidden />
        {sinLeer != null && sinLeer > 0 && (
          <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-accent-3 px-1 font-mono text-[10px] font-semibold text-white">
            {sinLeer > 9 ? "9+" : sinLeer}
          </span>
        )}
      </button>

      <AnimatePresence>
        {abierto && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-surface shadow-xl"
            role="dialog"
            aria-label="Avisos"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-2.5">
              <p className="text-sm font-semibold">Avisos</p>
              {avisos.some((a) => !a.read_at) && (
                <button
                  type="button"
                  onClick={() => void marcarTodos()}
                  className="rounded-lg px-2 py-1 text-[11px] text-muted transition hover:bg-surface-2 hover:text-foreground"
                >
                  Marcar todo como leído
                </button>
              )}
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {cargando ? (
                <p className="flex items-center gap-2 px-3.5 py-6 text-sm text-muted">
                  <Loader2 className="size-4 animate-spin" aria-hidden /> Buscando avisos…
                </p>
              ) : avisos.length === 0 ? (
                <p className="px-3.5 py-6 text-sm text-muted">
                  No hay avisos todavía. Acá vas a ver cuando te reten, te respondan una consulta o publiquen una clase.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {avisos.map((a) => {
                    const contenido = (
                      <>
                        <div className="flex items-start gap-2">
                          {!a.read_at && (
                            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent-3" aria-hidden />
                          )}
                          <div className={cn("min-w-0 flex-1", a.read_at && "pl-3.5")}>
                            <p className={cn("text-[13px] leading-snug", a.read_at ? "text-muted" : "font-medium")}>
                              {a.title}
                            </p>
                            {a.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{a.body}</p>}
                            <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted">
                              {formatRelative(a.created_at)}
                            </p>
                          </div>
                        </div>
                      </>
                    );
                    return (
                      <li key={a.id}>
                        {a.url ? (
                          <Link
                            href={a.url}
                            onClick={(e) => {
                              e.preventDefault();
                              void abrirAviso(a);
                            }}
                            className="block px-3.5 py-3 transition hover:bg-surface-2/60"
                          >
                            {contenido}
                          </Link>
                        ) : (
                          <div className="px-3.5 py-3">{contenido}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
