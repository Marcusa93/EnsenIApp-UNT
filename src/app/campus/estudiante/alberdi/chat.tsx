"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Check, Feather, Info, Loader2, Send, Share, Sparkles } from "lucide-react";
import { Button, Textarea } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { cn } from "@/lib/utils";
import { track } from "@/lib/telemetry/track";
import { escalateToTeacher } from "./actions";

export interface AlberdiChatProps {
  courseId: string;
  studentFirstName: string;
  /** Clase sobre la que se abre la consulta (viene por ?classId=). */
  focus: { id: string; topic: string } | null;
  /** Sugerencias armadas con las clases reales de la comisión. */
  suggestions: string[];
  /** false cuando la cátedra todavía no cargó nada. */
  hasContent: boolean;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Alberdi declinó por estar fuera del alcance de la materia. */
  refused?: boolean;
}

let idCounter = 0;
const nextId = () => `m${++idCounter}`;

export function AlberdiChat({ courseId, studentFirstName, focus, suggestions, hasContent }: AlberdiChatProps) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [streaming, setStreaming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [escalating, setEscalating] = React.useState(false);
  const [escalated, setEscalated] = React.useState(false);
  const conversationId = React.useRef<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  async function escalate() {
    if (!conversationId.current || escalating || escalated) return;
    setEscalating(true);
    setError(null);
    const res = await escalateToTeacher({ conversationId: conversationId.current });
    setEscalating(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setEscalated(true);
    track("question_asked", { entity_type: "consulta_escalada", entity_id: res.data.questionId });
  }

  // Autoscroll al final mientras llega la respuesta.
  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || streaming) return;

    setError(null);
    setInput("");
    const userMsg: ChatMessage = { id: nextId(), role: "user", content: clean };
    const assistantId = nextId();
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: "assistant", content: "" }]);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/alberdi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          conversationId: conversationId.current,
          courseId,
          classId: focus?.id ?? null,
          message: clean,
        }),
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

      setEscalated(false);
      track("question_asked", { entity_type: "alberdi", entity_id: focus?.id, metadata: { chars: clean.length } });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      console.error("[alberdi] chat", err);
      const msg = err instanceof Error ? err.message : "No pudimos conectar con Alberdi.";
      setError(msg);
      // Sacamos la burbuja vacía: el error se muestra aparte.
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto pb-4">
        {isEmpty ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto flex max-w-2xl flex-col items-center px-1 pt-6 text-center sm:pt-12"
          >
            <span className="glow-2 flex size-14 items-center justify-center rounded-2xl border border-accent-2/30 bg-accent-2/10 text-accent-2">
              <Feather className="size-7" aria-hidden />
            </span>
            <h2 className="mt-4 text-xl font-semibold tracking-tight sm:text-2xl">
              Hola {studentFirstName}, soy Alberdi
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
              {focus
                ? `Preguntame lo que quieras sobre "${focus.topic}" o cualquier tema de la materia.`
                : "Preguntame sobre cualquier tema de la materia: los temas de las clases, los conceptos que vimos, la bibliografía."}
            </p>

            {!hasContent && (
              <p className="mt-4 flex max-w-md items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-left text-xs text-warning">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                Todavía no hay clases cargadas en el campus, así que por ahora casi no tengo material para responderte.
              </p>
            )}

            {suggestions.length > 0 && (
              <div className="mt-6 flex w-full flex-col gap-2">
                <span className="eyebrow">Para arrancar</span>
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-xl border border-border bg-surface-2/60 px-4 py-3 text-left text-sm transition hover:border-accent/50 hover:bg-surface-2"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <ul className="mx-auto flex max-w-2xl flex-col gap-4 px-1 py-4">
            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <motion.li
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn("flex gap-3", m.role === "user" ? "justify-end" : "justify-start")}
                >
                  {m.role === "assistant" && (
                    <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-xl border border-accent-2/30 bg-accent-2/10 text-accent-2">
                      <Feather className="size-4" aria-hidden />
                    </span>
                  )}
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                      m.role === "user"
                        ? "bg-accent text-white"
                        : "border border-border bg-surface",
                    )}
                  >
                    {m.role === "user" ? (
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    ) : m.content ? (
                      <Markdown size="sm">{m.content}</Markdown>
                    ) : (
                      <span className="flex items-center gap-2 text-muted">
                        <Loader2 className="size-3.5 animate-spin" aria-hidden />
                        <span className="text-xs">Pensando…</span>
                      </span>
                    )}
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}

        {!streaming && messages.some((m) => m.role === "assistant" && m.content) && (
          <div className="mx-auto max-w-2xl px-1 pb-2">
            {escalated ? (
              <p className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
                <Check className="size-4 shrink-0" aria-hidden />
                <span>
                  Enviado al equipo docente. Cuando te respondan lo vas a ver en{" "}
                  <Link href="/campus/estudiante/consultas" className="underline underline-offset-4">
                    tus consultas
                  </Link>
                  .
                </span>
              </p>
            ) : (
              <button
                type="button"
                onClick={escalate}
                disabled={escalating}
                className="inline-flex items-center gap-1.5 text-xs text-muted underline underline-offset-4 transition hover:text-foreground disabled:opacity-60"
              >
                {escalating ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Share className="size-3.5" aria-hidden />}
                ¿No te alcanzó? Enviar esta consulta al equipo docente
              </button>
            )}
          </div>
        )}
      </div>

      <div className="sticky bottom-0 border-t border-border bg-background/90 pt-3 backdrop-blur">
        {error && (
          <p role="alert" className="mx-auto mb-2 max-w-2xl rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <form
          className="mx-auto flex max-w-2xl items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={focus ? `Preguntá sobre "${focus.topic}"…` : "Escribí tu consulta sobre la materia…"}
            rows={1}
            maxLength={2000}
            disabled={streaming}
            className="max-h-40 min-h-11 resize-none py-3"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
          />
          <Button type="submit" size="lg" disabled={!input.trim() || streaming} aria-label="Enviar consulta">
            {streaming ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </form>
        <p className="mx-auto mt-2 max-w-2xl pb-3 text-center text-[11px] leading-relaxed text-muted">
          <Sparkles className="mr-1 inline size-3" aria-hidden />
          Alberdi responde sólo sobre el material de la materia y puede equivocarse: verificá lo importante con el equipo
          docente. Tus consultas ayudan a la cátedra a ver qué reforzar.
        </p>
      </div>
    </div>
  );
}
