"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Expand, Feather, Loader2, Send, X } from "lucide-react";
import { Button, Textarea } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { cn } from "@/lib/utils";
import { track } from "@/lib/telemetry/track";

export interface FloatingAlberdiProps {
  courseId: string;
}

/** Si estamos mirando una clase puntual, Alberdi se enfoca en ella (transcripción minutada incluida). */
const CLASS_ROUTE = /\/campus\/estudiante\/clases\/([0-9a-f-]{36})/i;

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
}

let idc = 0;
const nid = () => `f${++idc}`;

const POS_KEY = "ensenia.alberdi-fab";
const FAB = 56;

function loadPos(): { x: number; y: number } | null {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { x: number; y: number };
    if (typeof p.x !== "number" || typeof p.y !== "number") return null;
    return p;
  } catch {
    return null;
  }
}

function clampPos(p: { x: number; y: number }) {
  return {
    x: Math.min(Math.max(8, p.x), window.innerWidth - FAB - 8),
    y: Math.min(Math.max(8, p.y), window.innerHeight - FAB - 8),
  };
}

/**
 * Alberdi flotante: un botón arrastrable (la pluma), disponible en cualquier
 * pantalla del campus del estudiante, para consultar en cualquier momento sobre
 * cualquier cosa cargada (cronograma, resúmenes, materiales). Si en ese momento
 * se está mirando una clase puntual, se enfoca en ella — transcripción minutada
 * incluida, para poder responder "¿en qué momento se dijo tal cosa?".
 */
export function FloatingAlberdi({ courseId }: FloatingAlberdiProps) {
  const pathname = usePathname();
  const classId = pathname.match(CLASS_ROUTE)?.[1] ?? null;
  const [pos, setPos] = React.useState<{ x: number; y: number } | null>(null);
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState("");
  const [streaming, setStreaming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const conversationId = React.useRef<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<{ startX: number; startY: number; baseX: number; baseY: number; moved: boolean } | null>(null);

  // Posición inicial: guardada o abajo a la derecha (sobre la bottom-nav mobile).
  React.useEffect(() => {
    const saved = loadPos();
    const fallback = { x: window.innerWidth - FAB - 16, y: window.innerHeight - FAB - 96 };
    setPos(clampPos(saved ?? fallback));
    const onResize = () => setPos((p) => (p ? clampPos(p) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!pos) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: pos.x, baseY: pos.y, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < 6) return;
    d.moved = true;
    setPos(clampPos({ x: d.baseX + dx, y: d.baseY + dy }));
  };
  const onPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (d.moved) {
      setPos((p) => {
        if (p) {
          try {
            localStorage.setItem(POS_KEY, JSON.stringify(p));
          } catch {
            /* almacenamiento lleno o bloqueado: la posición no persiste */
          }
        }
        return p;
      });
    } else {
      setOpen((o) => !o);
    }
  };

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || streaming) return;
    setError(null);
    setInput("");
    const assistantId = nid();
    setMessages((prev) => [...prev, { id: nid(), role: "user", content: clean }, { id: assistantId, role: "assistant", content: "" }]);
    setStreaming(true);
    try {
      const res = await fetch("/api/alberdi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: conversationId.current, courseId, classId, message: clean }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "No pudimos conectar con Alberdi.");
      }
      const convId = res.headers.get("X-Conversation-Id");
      if (convId) conversationId.current = convId;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: acc } : m)));
      }
      track("question_asked", { entity_type: "alberdi_flotante", entity_id: classId ?? undefined, metadata: { chars: clean.length } });
    } catch (err) {
      console.error("[alberdi flotante]", err);
      setError(err instanceof Error ? err.message : "No pudimos conectar con Alberdi.");
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setStreaming(false);
    }
  }

  if (!pos) return null;

  // Clamp también en render: una posición guardada en una pantalla más grande
  // no puede dejar el botón fuera del viewport actual (rompía el ancho en mobile).
  const safe = clampPos(pos);

  // El panel se ancla al lado del botón, hacia adentro de la pantalla.
  const panelRight = safe.x > window.innerWidth / 2;
  const panelBottom = safe.y > window.innerHeight / 2;

  // Portal a document.body: la transición de página (motion.div con animate={{y}})
  // deja un transform aplicado, y eso convierte a ese contenedor angosto/con padding
  // en el marco de referencia de cualquier "fixed" anidado — el botón terminaba
  // corrido fuera de la pantalla en mobile. El portal lo saca de esa cadena.
  return createPortal(
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="border-gradient fixed z-[80] flex flex-col overflow-hidden rounded-3xl border border-transparent bg-surface shadow-2xl"
            style={{
              width: "min(92vw, 380px)",
              height: "min(72vh, 540px)",
              [panelRight ? "right" : "left"]: 12,
              [panelBottom ? "bottom" : "top"]: 12,
            }}
            role="dialog"
            aria-label={classId ? "Alberdi — consultas sobre esta clase" : "Alberdi — consultas sobre la materia"}
          >
            <header className="flex items-center gap-2.5 border-b border-border px-4 py-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-accent-2/30 bg-accent-2/10 text-accent-2">
                <Feather className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight">Alberdi</p>
                <p className="truncate text-[11px] text-muted">{classId ? "Sobre esta clase" : "Sobre toda la materia"}</p>
              </div>
              <Link
                href={classId ? `/campus/estudiante/alberdi?classId=${classId}` : "/campus/estudiante/alberdi"}
                aria-label="Abrir Alberdi en pantalla completa"
                className="flex size-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-foreground"
              >
                <Expand className="size-4" />
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="flex size-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </header>

            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3">
              {messages.length === 0 ? (
                <div className="flex flex-col gap-2 pt-2">
                  <p className="text-sm leading-relaxed text-muted">
                    {classId ? (
                      <>
                        Preguntame sobre esta clase: qué se dijo, qué significa algo, o <em>en qué momento</em> se habló de
                        un tema — te contesto con el minuto exacto.
                      </>
                    ) : (
                      "Preguntame lo que necesites de la materia: cronograma, resúmenes de clases, materiales — lo que el equipo docente haya cargado."
                    )}
                  </p>
                  {(classId
                    ? [
                        "¿En qué momento se habló de la promoción?",
                        "¿Cuáles son las 3 ideas más importantes de la clase?",
                        "Explicame lo más difícil en fácil",
                      ]
                    : ["¿Qué temas vamos a ver en la materia?", "¿De qué trató la última clase?", "¿Qué tengo pendiente para repasar?"]
                  ).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="rounded-xl border border-border bg-surface-2/60 px-3 py-2 text-left text-[13px] transition hover:border-accent/50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              ) : (
                <ul className="flex flex-col gap-3">
                  {messages.map((m) => (
                    <li key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[88%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed",
                          m.role === "user" ? "bg-accent text-white" : "border border-border bg-surface-2/60",
                        )}
                      >
                        {m.role === "user" ? (
                          <p className="whitespace-pre-wrap">{m.content}</p>
                        ) : m.content ? (
                          <Markdown size="sm">{m.content}</Markdown>
                        ) : (
                          <span className="flex items-center gap-2 text-muted">
                            <Loader2 className="size-3 animate-spin" aria-hidden />
                            <span className="text-xs">Pensando…</span>
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {error && (
              <p role="alert" className="mx-3.5 mb-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-1.5 text-xs text-danger">
                {error}
              </p>
            )}

            <form
              className="flex items-end gap-2 border-t border-border px-3.5 py-3"
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
            >
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Preguntá sobre esta clase…"
                rows={1}
                maxLength={2000}
                disabled={streaming}
                className="max-h-28 min-h-10 resize-none py-2.5 text-[13px]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
              />
              <Button type="submit" size="icon" disabled={!input.trim() || streaming} aria-label="Enviar">
                {streaming ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        aria-label={open ? "Cerrar Alberdi" : "Preguntarle a Alberdi"}
        title="Alberdi — arrastrame o tocá para consultar"
        className={cn(
          "glow-2 fixed z-[81] flex size-14 touch-none items-center justify-center rounded-full border border-accent-2/40 bg-surface text-accent-2 shadow-xl transition-colors hover:bg-accent-2/10",
          open && "border-accent-2 bg-accent-2/15",
        )}
        style={{ left: safe.x, top: safe.y }}
      >
        <Feather className="size-6" aria-hidden />
      </button>
    </>,
    document.body,
  );
}
