"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { LiveRoomState } from "@/lib/live/types";
import { submitWord } from "./actions";

export interface LiveRoomProps {
  initial: LiveRoomState;
  userId: string;
  fullName: string;
  initialSubmittedWord: string | null;
}

type SessionStatus = LiveRoomState["session"]["status"];

export function LiveRoom({ initial, userId, fullName, initialSubmittedWord }: LiveRoomProps) {
  const [status, setStatus] = React.useState<SessionStatus>(initial.session.status);
  const [activePrompt, setActivePrompt] = React.useState(initial.activePrompt);
  const [submittedWord, setSubmittedWord] = React.useState<string | null>(initialSubmittedWord);
  const [word, setWord] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const firstName = fullName.split(" ")[0] ?? fullName;

  // Toda transición de "disparadora activa" en el estudiante llega por Realtime
  // (nunca la dispara el propio estudiante): resolvemos ahí mismo la nueva
  // pregunta, reseteamos el formulario y chequeamos si ya la respondió.
  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`live-room:${initial.session.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "live_sessions", filter: `id=eq.${initial.session.id}` },
        async (payload) => {
          const next = payload.new as { status: SessionStatus; active_prompt_id: string | null };
          setStatus(next.status);
          setWord("");
          setError(null);

          if (!next.active_prompt_id) {
            setActivePrompt(null);
            setSubmittedWord(null);
            return;
          }
          const { data: prompt } = await supabase
            .from("live_prompts")
            .select("id, question, type")
            .eq("id", next.active_prompt_id)
            .maybeSingle();
          setActivePrompt(prompt ?? null);

          const { data: response } = await supabase
            .from("live_responses")
            .select("word")
            .eq("prompt_id", next.active_prompt_id)
            .eq("participant_id", userId)
            .maybeSingle();
          setSubmittedWord(response?.word ?? null);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [initial.session.id, userId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = word.trim();
    if (!clean || !activePrompt || loading) return;
    setLoading(true);
    setError(null);
    const res = await submitWord({ sessionId: initial.session.id, promptId: activePrompt.id, word: clean });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSubmittedWord(res.data.word);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="border-gradient glow w-full max-w-md rounded-3xl border border-transparent bg-surface p-7 sm:p-9"
    >
      <span className="eyebrow">Hola, {firstName}</span>
      <h1 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">{initial.className}</h1>

      <AnimatePresence mode="wait">
        {status === "ended" ? (
          <motion.div key="ended" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6">
            <p className="rounded-2xl border border-border bg-surface-2 p-5 text-sm text-muted">
              La sesión terminó. Gracias por participar 🎉
            </p>
          </motion.div>
        ) : !activePrompt ? (
          <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6">
            <motion.p
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted"
            >
              Esperando la próxima pregunta…
            </motion.p>
          </motion.div>
        ) : submittedWord ? (
          <motion.div
            key="submitted"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-6 rounded-2xl border border-accent-2/30 bg-accent-2/10 p-5"
          >
            <div className="flex items-center gap-2 text-accent-2">
              <Sparkles className="size-4" aria-hidden />
              <span className="eyebrow text-accent-2">Enviado</span>
            </div>
            <p className="mt-2 text-2xl font-semibold">«{submittedWord}»</p>
            <p className="mt-2 text-sm text-muted">Mirá la pantalla ✨</p>
          </motion.div>
        ) : (
          <motion.form key="form" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} onSubmit={submit} className="mt-6 flex flex-col gap-3">
            <p className="text-lg font-medium leading-snug">{activePrompt.question}</p>
            <div className="flex gap-2">
              <Input
                autoFocus
                value={word}
                onChange={(e) => setWord(e.target.value)}
                placeholder="Una palabra…"
                maxLength={60}
                disabled={loading}
              />
              <Button type="submit" disabled={!word.trim() || loading} aria-label="Enviar">
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted">Un solo envío por pregunta.</p>
            {error && <p className="text-xs text-danger">{error}</p>}
          </motion.form>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
