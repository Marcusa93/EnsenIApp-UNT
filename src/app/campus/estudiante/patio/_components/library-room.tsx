"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { BookOpenText, Loader2, Send, Users, WifiOff, X } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Badge, Button, Card, Input } from "@/components/ui";
import { OperatorAvatar, type AvatarConfig } from "@/components/avatar/operator-avatar";
import { AlberdiNpc } from "@/components/avatar/alberdi-npc";
import { EMOTES, EMOTE_BY_ID, isEmoteUnlocked, type EmoteProgress } from "@/lib/games/emotes";
import { cn } from "@/lib/utils";

/**
 * El Patio: un salón por el que se camina, con mesas por clase y el
 * mostrador de Alberdi.
 *
 * Presencia y posiciones van por Realtime. La posición se manda con freno y sólo
 * cuando cambia: si nadie se mueve, no se gasta un solo mensaje. El movimiento
 * en pantalla lo hace CSS interpolando entre la posición vieja y la nueva, así
 * no hace falta un bucle de animación corriendo todo el tiempo — que en un
 * celular es lo que funde la batería.
 *
 * Lo que cada uno publica de sí mismo sale de su navegador: es apariencia y nada
 * más, con eso no se decide ningún permiso ni puntaje.
 */

export interface LibraryTable {
  id: string;
  topic: string;
  date: string;
  challenges: number;
}

export interface LibraryMe {
  studentId: string;
  callsign: string;
  config: AvatarConfig;
  progress: EmoteProgress;
}

interface Hallazgo {
  kind: "clase" | "material" | "glosario";
  title: string;
  subtitle: string;
  href: string;
}

interface Persona {
  studentId: string;
  callsign: string;
  config: AvatarConfig;
  level: number;
  x: number;
  y: number;
}

/** Qué tan cerca hace falta estar de otro operador para que se giren a mirarse. */
const RADIO_SALUDO = 230;

/** El salón en unidades propias; la caja lo escala al ancho que haya. */
const SALON = { w: 1000, h: 620 };
const MOSTRADOR = { x: 500, y: 92 };
/** Hay que estar cerca del mostrador para que Alberdi atienda. */
const ALCANCE = 190;
const EMOTE_MS = 2600;
/** Freno de posición: 5 mensajes por segundo alcanzan y sobran. */
const ENVIO_MS = 200;
/**
 * Velocidad de caminata en unidades del salón por segundo. La duración de cada
 * trayecto sale de acá (distancia / velocidad), así caminar cerca es un pasito
 * y cruzar el salón toma su tiempo — con los 700ms fijos de antes, lo lejano
 * era un teletransporte y lo cercano un arrastre.
 */
const VELOCIDAD = 300;
const PASO_MIN_MS = 250;

/** Cuánto dura el trayecto entre dos puntos, a velocidad constante. */
function duracionPaso(d: number) {
  return Math.max(PASO_MIN_MS, Math.round((d / VELOCIDAD) * 1000));
}

/** Hacia dónde mira alguien que camina en esa dirección (ángulos del rig). */
function anguloDeMarcha(dx: number, dy: number) {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 90 : 270;
  return dy >= 0 ? 0 : 180;
}

/** Dónde va cada mesa. Se reparten en dos filas para que quede lugar de paso. */
function lugarDeMesa(i: number, total: number) {
  const porFila = Math.min(3, Math.max(2, Math.ceil(total / 2)));
  const fila = Math.floor(i / porFila);
  const col = i % porFila;
  const filas = Math.ceil(total / porFila);
  const anchoUtil = SALON.w - 200;
  const x = 100 + (anchoUtil / (porFila + 1)) * (col + 1);
  const y = 270 + (filas > 1 ? fila * 170 : 40);
  return { x, y };
}

export function LibraryRoom({ tables, me, courseId }: { tables: LibraryTable[]; me: LibraryMe; courseId: string }) {
  const router = useRouter();
  const [otros, setOtros] = React.useState<Persona[]>([]);
  const [pos, setPos] = React.useState({ x: 500, y: 470 });
  const [estado, setEstado] = React.useState<"conectando" | "en-linea" | "sin-conexion">("conectando");
  const [emotes, setEmotes] = React.useState<Record<string, string>>({});
  const [mostrador, setMostrador] = React.useState(false);
  /** Con quién tocaste para ver quién es. */
  const [inspeccionando, setInspeccionando] = React.useState<Persona | null>(null);
  /** Quién está caminando ahora: duración del trayecto y hacia dónde mira. */
  const [andando, setAndando] = React.useState<Record<string, { durMs: number; angulo: number }>>({});

  const canal = React.useRef<RealtimeChannel | null>(null);
  const timers = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const timersPaso = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  /** Última posición conocida de cada uno, para calcular distancia y rumbo. */
  const ultimaPos = React.useRef<Record<string, { x: number; y: number }>>({});
  const ultimoEnvio = React.useRef(0);
  const envioPendiente = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const posRef = React.useRef(pos);
  posRef.current = pos;

  const mesas = React.useMemo(
    () => tables.map((t, i) => ({ ...t, ...lugarDeMesa(i, tables.length) })),
    [tables],
  );

  /** Marca a alguien como caminando hacia (x, y) y lo frena al llegar. */
  const marcarPaso = React.useCallback((studentId: string, x: number, y: number) => {
    const desde = ultimaPos.current[studentId];
    ultimaPos.current[studentId] = { x, y };
    if (!desde) return;
    const dx = x - desde.x;
    const dy = y - desde.y;
    const d = Math.hypot(dx, dy);
    if (d < 4) return;
    const durMs = duracionPaso(d);
    setAndando((prev) => ({ ...prev, [studentId]: { durMs, angulo: anguloDeMarcha(dx, dy) } }));
    clearTimeout(timersPaso.current[studentId]);
    timersPaso.current[studentId] = setTimeout(() => {
      setAndando((prev) => {
        const n = { ...prev };
        delete n[studentId];
        return n;
      });
    }, durMs);
  }, []);

  // ------------------------------------------------------------- conexión
  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`patio:${courseId}`, {
      config: { presence: { key: me.studentId } },
    });
    canal.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<Omit<Persona, "studentId">>();
        const lista: Persona[] = [];
        for (const key of Object.keys(state)) {
          if (key === me.studentId) continue;
          const e = state[key]?.[0];
          if (e?.callsign) lista.push({ ...e, studentId: key });
        }
        setOtros(lista);
      })
      .on("broadcast", { event: "mover" }, ({ payload }) => {
        const { studentId, x, y } = (payload ?? {}) as { studentId?: string; x?: number; y?: number };
        if (!studentId || studentId === me.studentId || typeof x !== "number" || typeof y !== "number") return;
        marcarPaso(studentId, x, y);
        setOtros((prev) => prev.map((p) => (p.studentId === studentId ? { ...p, x, y } : p)));
      })
      .on("broadcast", { event: "emote" }, ({ payload }) => {
        const { studentId, emoteId } = (payload ?? {}) as { studentId?: string; emoteId?: string };
        const emote = emoteId ? EMOTE_BY_ID.get(emoteId) : null;
        if (!studentId || !emote) return;
        setEmotes((prev) => ({ ...prev, [studentId]: emote.className }));
        clearTimeout(timers.current[studentId]);
        timers.current[studentId] = setTimeout(() => {
          setEmotes((prev) => {
            const n = { ...prev };
            delete n[studentId];
            return n;
          });
        }, EMOTE_MS);
      })
      .subscribe(async (s) => {
        if (s === "SUBSCRIBED") {
          setEstado("en-linea");
          await channel.track({ callsign: me.callsign, config: me.config, level: me.progress.level, ...posRef.current });
        } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") {
          setEstado("sin-conexion");
        }
      });

    const pendientes = timers.current;
    const pasos = timersPaso.current;
    return () => {
      Object.values(pendientes).forEach(clearTimeout);
      Object.values(pasos).forEach(clearTimeout);
      if (envioPendiente.current) clearTimeout(envioPendiente.current);
      void supabase.removeChannel(channel);
    };
  }, [courseId, me.studentId, me.callsign, me.config, me.progress.level, marcarPaso]);

  // ------------------------------------------------------------ movimiento
  const enviarPos = React.useCallback((x: number, y: number) => {
    const ahora = Date.now();
    const mandar = () => {
      ultimoEnvio.current = Date.now();
      void canal.current?.send({ type: "broadcast", event: "mover", payload: { studentId: me.studentId, x, y } });
      // La presencia guarda la última posición, para quien entre después.
      void canal.current?.track({ callsign: me.callsign, config: me.config, level: me.progress.level, x, y });
    };
    if (ahora - ultimoEnvio.current >= ENVIO_MS) {
      mandar();
    } else if (!envioPendiente.current) {
      envioPendiente.current = setTimeout(() => {
        envioPendiente.current = null;
        mandar();
      }, ENVIO_MS - (ahora - ultimoEnvio.current));
    }
  }, [me.studentId, me.callsign, me.config, me.progress.level]);

  function caminarA(e: React.MouseEvent<HTMLDivElement>) {
    const caja = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - caja.left) / caja.width) * SALON.w;
    const y = ((e.clientY - caja.top) / caja.height) * SALON.h;
    const destino = {
      x: Math.max(40, Math.min(SALON.w - 40, x)),
      y: Math.max(150, Math.min(SALON.h - 40, y)),
    };
    // La posición previa propia se registra acá y no en un efecto: marcarPaso
    // necesita el "desde" para calcular rumbo y duración del trayecto.
    ultimaPos.current[me.studentId] = ultimaPos.current[me.studentId] ?? { ...posRef.current };
    marcarPaso(me.studentId, destino.x, destino.y);
    setPos(destino);
    enviarPos(destino.x, destino.y);
  }

  function saludar(emoteId: string) {
    const emote = EMOTE_BY_ID.get(emoteId);
    if (!emote) return;
    setEmotes((prev) => ({ ...prev, [me.studentId]: emote.className }));
    clearTimeout(timers.current[me.studentId]);
    timers.current[me.studentId] = setTimeout(() => {
      setEmotes((prev) => {
        const n = { ...prev };
        delete n[me.studentId];
        return n;
      });
    }, EMOTE_MS);
    void canal.current?.send({ type: "broadcast", event: "emote", payload: { studentId: me.studentId, emoteId } });
  }

  // --------------------------------------------------------------- cercanía
  const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
  const cercaDelMostrador = dist(pos.x, pos.y, MOSTRADOR.x, MOSTRADOR.y) < ALCANCE;
  const mesaCerca = mesas.find((m) => dist(pos.x, pos.y, m.x, m.y) < 120) ?? null;

  const todos: Persona[] = [
    ...otros,
    { studentId: me.studentId, callsign: me.callsign, config: me.config, level: me.progress.level, x: pos.x, y: pos.y },
  ];

  /**
   * Hacia dónde mira cada uno: por defecto de frente, y se gira de perfil hacia
   * el vecino más cercano cuando hay alguien a menos de RADIO_SALUDO. Es un
   * cálculo puramente local — cada cliente lo hace mirando las posiciones que ya
   * conoce, así que no hace falta transmitir ningún ángulo por la red.
   */
  const angulos = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of todos) {
      // Caminando, se mira hacia donde se va: si no, el muñeco se desliza de
      // costado o de espaldas y la caminata deja de leerse como caminata.
      const paso = andando[p.studentId];
      if (paso) {
        map[p.studentId] = paso.angulo;
        continue;
      }
      let masCerca: Persona | null = null;
      let mejorDist = RADIO_SALUDO;
      for (const q of todos) {
        if (q.studentId === p.studentId) continue;
        const d = dist(p.x, p.y, q.x, q.y);
        if (d < mejorDist) {
          mejorDist = d;
          masCerca = q;
        }
      }
      map[p.studentId] = masCerca ? (masCerca.x >= p.x ? 90 : 270) : 0;
    }
    return map;
  }, [todos, andando]);

  return (
    <div className="flex flex-col gap-3">
      {/* Estado */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm text-muted">
          {estado === "conectando" && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {estado === "sin-conexion" && <WifiOff className="size-4 text-warning" aria-hidden />}
          {estado === "en-linea" && <Users className="size-4 text-accent-2" aria-hidden />}
          {estado === "en-linea"
            ? `${todos.length} ${todos.length === 1 ? "operador" : "operadores"} en el patio`
            : estado === "conectando"
              ? "Entrando…"
              : "Sin conexión con el patio"}
        </p>
        <p className="text-[11px] text-muted">Tocá el piso para caminar</p>
      </div>

      {/* Salón */}
      <div
        onClick={caminarA}
        className="relative w-full cursor-pointer touch-none overflow-hidden rounded-3xl border border-border bg-[#0d111c]"
        style={{ aspectRatio: `${SALON.w} / ${SALON.h}` }}
      >
        {/* Piso */}
        <svg viewBox={`0 0 ${SALON.w} ${SALON.h}`} className="absolute inset-0 size-full" aria-hidden>
          <defs>
            <linearGradient id="piso" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#141a28" />
              <stop offset="1" stopColor="#0b0f18" />
            </linearGradient>
          </defs>
          <rect width={SALON.w} height={SALON.h} fill="url(#piso)" />
          {/* Estanterías del fondo */}
          {Array.from({ length: 9 }, (_, i) => (
            <g key={i}>
              <rect x={40 + i * 108} y="20" width="86" height="120" rx="4" fill="#171d2b" />
              {Array.from({ length: 4 }, (_, j) => (
                <rect key={j} x={46 + i * 108} y={30 + j * 28} width="74" height="20" rx="2" fill="#1e2534" />
              ))}
            </g>
          ))}
          {/* Baldosas */}
          {Array.from({ length: 11 }, (_, i) => (
            <line key={`v${i}`} x1={i * 100} y1="160" x2={i * 100} y2={SALON.h} stroke="#1a2130" strokeWidth="1.5" />
          ))}
          {Array.from({ length: 5 }, (_, i) => (
            <line key={`h${i}`} x1="0" y1={180 + i * 110} x2={SALON.w} y2={180 + i * 110} stroke="#1a2130" strokeWidth="1.5" />
          ))}
        </svg>

        {/* Mesas */}
        {mesas.map((m) => {
          const gente = todos.filter((p) => dist(p.x, p.y, m.x, m.y) < 120).length;
          const activa = mesaCerca?.id === m.id;
          return (
            <div
              key={m.id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${(m.x / SALON.w) * 100}%`, top: `${(m.y / SALON.h) * 100}%`, width: "23%" }}
            >
              <div
                className={cn(
                  "rounded-2xl border px-2 py-1.5 text-center backdrop-blur-sm transition",
                  activa ? "border-accent bg-accent/15" : "border-border bg-surface/70",
                )}
              >
                <p className="truncate text-[10px] font-medium leading-tight sm:text-xs">{m.topic}</p>
                <p className="font-mono text-[8px] uppercase tracking-wider text-muted sm:text-[9px]">
                  {m.challenges} desafíos{gente > 0 && ` · ${gente}`}
                </p>
              </div>
            </div>
          );
        })}

        {/* Mostrador de Alberdi */}
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${(MOSTRADOR.x / SALON.w) * 100}%`, top: `${(MOSTRADOR.y / SALON.h) * 100}%`, width: "26%" }}
        >
          <div className="flex flex-col items-center">
            <AlberdiNpc
              mood={cercaDelMostrador ? "atento" : "idle"}
              size={78}
              showGlyphs
              className="-mb-3"
            />
            <div
              className={cn(
                "rounded-2xl border px-2 py-1 text-center backdrop-blur-sm transition",
                cercaDelMostrador ? "border-accent-2 bg-accent-2/15" : "border-border bg-surface/70",
              )}
            >
              <p className="text-[10px] font-medium leading-tight sm:text-xs">Alberdi</p>
              <p className="font-mono text-[8px] uppercase tracking-wider text-muted sm:text-[9px]">
                {cercaDelMostrador ? "Te atiende" : "Bibliotecario"}
              </p>
            </div>
          </div>
        </div>

        {/* Operadores: cuerpo entero, caminan mirando hacia donde van y parados
            se giran hacia quien tengan más cerca */}
        {todos.map((p) => {
          const soyYo = p.studentId === me.studentId;
          const paso = andando[p.studentId];
          return (
            <button
              key={p.studentId}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!soyYo) setInspeccionando(p);
              }}
              className={cn(
                "absolute z-10 flex -translate-x-1/2 -translate-y-full flex-col items-center transition-[left,top] ease-linear",
                paso && "av-walking",
              )}
              style={{
                left: `${(p.x / SALON.w) * 100}%`,
                top: `${(p.y / SALON.h) * 100}%`,
                width: "13%",
                transitionDuration: `${paso?.durMs ?? PASO_MIN_MS}ms`,
              }}
              aria-label={soyYo ? "Vos" : `Ver a ${p.callsign}`}
            >
              <OperatorAvatar
                config={p.config}
                size={96}
                bare
                angle={angulos[p.studentId] ?? 0}
                emoteClass={emotes[p.studentId] ?? null}
                emoteKey={emotes[p.studentId] ? 1 : 0}
                title={p.callsign}
                className="h-auto w-full"
              />
              <span
                className={cn(
                  "-mt-1 max-w-full truncate font-mono text-[8px] uppercase tracking-wider sm:text-[10px]",
                  soyYo ? "text-accent" : "text-muted",
                )}
              >
                {soyYo ? "Vos" : p.callsign}
              </span>
            </button>
          );
        })}
      </div>

      {/* Acciones según dónde estés parado */}
      <div className="flex flex-wrap gap-2">
        {cercaDelMostrador && (
          <Button size="sm" leftIcon={<BookOpenText />} onClick={() => setMostrador(true)}>
            Hablar con Alberdi
          </Button>
        )}
        {mesaCerca && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => router.push(`/campus/estudiante/juegos?clase=${mesaCerca.id}`)}
          >
            Jugar esta mesa
          </Button>
        )}
        {!cercaDelMostrador && !mesaCerca && (
          <p className="text-[11px] text-muted">
            Acercate al mostrador para pedirle algo a Alberdi, o a una mesa para jugar esa clase.
          </p>
        )}
      </div>

      {/* Emotes */}
      <Card padding="sm">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-medium">Saludar</p>
          <p className="text-[11px] text-muted">Lo ven todos los que están</p>
        </div>
        <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {EMOTES.filter((e) => isEmoteUnlocked(e, me.progress)).map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => saludar(e.id)}
              title={e.description}
              className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2/50 text-xl transition hover:border-accent/45"
            >
              <span aria-hidden>{e.emoji}</span>
              <span className="sr-only">{e.name}</span>
            </button>
          ))}
        </div>
      </Card>

      <AnimatePresence>
        {inspeccionando && (
          <InspectorCard
            persona={inspeccionando}
            onClose={() => setInspeccionando(null)}
            onSaludar={(emoteId) => {
              saludar(emoteId);
              setInspeccionando(null);
            }}
            progress={me.progress}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mostrador && <Mostrador onClose={() => setMostrador(false)} />}
      </AnimatePresence>
    </div>
  );
}

/** Quién es: se abre al tocar a otro operador en el salón. */
function InspectorCard({
  persona,
  progress,
  onClose,
  onSaludar,
}: {
  persona: Persona;
  progress: EmoteProgress;
  onClose: () => void;
  onSaludar: (emoteId: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-3 backdrop-blur-[2px] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Perfil de ${persona.callsign}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 16, scale: 0.97 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 12, opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="w-full max-w-xs rounded-3xl border border-border bg-surface p-4"
      >
        <div className="flex items-center gap-3">
          <OperatorAvatar config={persona.config} size={56} bust title={persona.callsign} className="shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-sm uppercase tracking-wider">{persona.callsign}</p>
            <p className="text-xs text-muted">Nivel {persona.level}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2"
          >
            <X className="size-4" />
          </button>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-muted">Sólo se comparte el alias, nunca el nombre real.</p>

        <div className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {EMOTES.filter((e) => isEmoteUnlocked(e, progress)).slice(0, 6).map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => onSaludar(e.id)}
              title={e.name}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2/50 text-lg transition hover:border-accent/45"
            >
              <span aria-hidden>{e.emoji}</span>
              <span className="sr-only">{e.name}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

/** El mostrador: se le pide algo a Alberdi y trae lo que hay en el catálogo. */
function Mostrador({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [pedido, setPedido] = React.useState("");
  const [cargando, setCargando] = React.useState(false);
  const [respuesta, setRespuesta] = React.useState<string | null>(null);
  const [hallazgos, setHallazgos] = React.useState<Hallazgo[]>([]);
  const [intencion, setIntencion] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function pedir(texto: string) {
    const limpio = texto.trim();
    if (!limpio || cargando) return;
    setCargando(true);
    setError(null);
    setRespuesta(null);
    setHallazgos([]);
    try {
      const res = await fetch("/api/biblioteca/consulta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedido: limpio }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "No pude buscar eso.");
      setRespuesta(data.respuesta);
      setHallazgos(data.hallazgos ?? []);
      setIntencion(data.intencion ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pude buscar eso.");
    } finally {
      setCargando(false);
    }
  }

  const KIND: Record<Hallazgo["kind"], string> = {
    clase: "Clase",
    material: "Material",
    glosario: "Glosario",
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[85] flex items-end justify-center bg-black/55 p-3 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Mostrador de Alberdi"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 24, scale: 0.98 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 16, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="border-gradient flex max-h-[86vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-transparent bg-surface"
      >
        <header className="flex items-center gap-2.5 border-b border-border px-4 py-3">
          <AlberdiNpc
            mood={cargando ? "hablando" : respuesta ? "atento" : "idle"}
            size={34}
            showGlyphs={false}
            className="shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight">Alberdi</p>
            <p className="text-[11px] text-muted">Bibliotecario de la cátedra</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex size-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {!respuesta && !cargando && (
            <>
              <p className="text-sm leading-relaxed text-muted">
                Decime qué estás buscando y lo rastreo en las clases, los resúmenes y los materiales de la materia. O
                pedime jugar.
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {["Material sobre ciberdelito", "¿Qué hay de datos personales?", "Quiero jugar"].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setPedido(s);
                      void pedir(s);
                    }}
                    className="rounded-xl border border-border bg-surface-2/60 px-3 py-2 text-left text-[13px] transition hover:border-accent/50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </>
          )}

          {cargando && (
            <p className="flex items-center gap-2 py-4 text-sm text-muted">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Buscando en el catálogo…
            </p>
          )}

          {respuesta && (
            <>
              <p className="text-sm leading-relaxed">{respuesta}</p>

              {intencion === "jugar" && (
                <div className="mt-3">
                  <Button size="sm" onClick={() => router.push("/campus/estudiante/juegos")}>
                    Ir a los juegos
                  </Button>
                </div>
              )}

              {hallazgos.length > 0 && (
                <ul className="mt-3 flex flex-col gap-2">
                  {hallazgos.map((h, i) => (
                    <li key={`${h.href}-${i}`}>
                      <button
                        type="button"
                        onClick={() => router.push(h.href)}
                        className="w-full rounded-xl border border-border bg-surface-2/50 px-3 py-2 text-left transition hover:border-accent/50"
                      >
                        <div className="flex items-center gap-2">
                          <Badge size="sm" tone={h.kind === "clase" ? "accent" : h.kind === "material" ? "accent-2" : "muted"}>
                            {KIND[h.kind]}
                          </Badge>
                          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{h.title}</span>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-muted">{h.subtitle}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {error && (
            <p role="alert" className="mt-3 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              {error}
            </p>
          )}
        </div>

        <form
          className="flex items-center gap-2 border-t border-border px-4 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            void pedir(pedido);
          }}
        >
          <Input
            value={pedido}
            onChange={(e) => setPedido(e.target.value)}
            placeholder="¿Qué estás buscando?"
            maxLength={300}
            disabled={cargando}
          />
          <Button type="submit" size="icon" disabled={!pedido.trim() || cargando} aria-label="Preguntar">
            {cargando ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </form>
      </motion.div>
    </motion.div>
  );
}
