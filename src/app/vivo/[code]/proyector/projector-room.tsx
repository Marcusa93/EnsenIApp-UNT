"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { createClient } from "@/lib/supabase/client";
import { ProjectorWordCloud } from "@/components/live/projector-word-cloud";
import { LabBadge } from "@/components/live/lab-badge";
import type { LiveRoomState, WordCount } from "@/lib/live/types";

export interface ProjectorRoomProps {
  initial: LiveRoomState;
  initialWords: WordCount[];
}

type SessionStatus = LiveRoomState["session"]["status"];

export function ProjectorRoom({ initial, initialWords }: ProjectorRoomProps) {
  const [status, setStatus] = React.useState<SessionStatus>(initial.session.status);
  const [activePrompt, setActivePrompt] = React.useState(initial.activePrompt);
  const [words, setWords] = React.useState<WordCount[]>(initialWords);

  const refreshWords = React.useCallback(async (promptId: string | null) => {
    if (!promptId) {
      setWords([]);
      return;
    }
    const supabase = createClient();
    const { data } = await supabase
      .from("v_live_wordcloud")
      .select("normalized_word, display_word, frequency")
      .eq("prompt_id", promptId)
      .order("frequency", { ascending: false });
    setWords((data ?? []) as WordCount[]);
  }, []);

  // Igual que en la sala del estudiante: Realtime cuando la red lo permite +
  // polling cada 2.5 s como respaldo (el proyector no puede quedarse colgado
  // si el WiFi del aula bloquea WebSockets).
  const stateRef = React.useRef({ status: initial.session.status, activePromptId: initial.activePrompt?.id ?? null });
  const applyingRef = React.useRef(false);

  const applyState = React.useCallback(
    async (next: { status: SessionStatus; active_prompt_id: string | null }) => {
      if (applyingRef.current) return;
      if (next.status === stateRef.current.status && next.active_prompt_id === stateRef.current.activePromptId) return;
      applyingRef.current = true;
      try {
        stateRef.current = { status: next.status, activePromptId: next.active_prompt_id };
        setStatus(next.status);
        if (!next.active_prompt_id) {
          setActivePrompt(null);
          setWords([]);
          return;
        }
        const supabase = createClient();
        const { data } = await supabase
          .from("live_prompts")
          .select("id, question, type")
          .eq("id", next.active_prompt_id)
          .maybeSingle();
        setActivePrompt(data ?? null);
        refreshWords(next.active_prompt_id);
      } finally {
        applyingRef.current = false;
      }
    },
    [refreshWords],
  );

  React.useEffect(() => {
    const supabase = createClient();

    const sessionChannel = supabase
      .channel(`live-projector-session:${initial.session.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "live_sessions", filter: `id=eq.${initial.session.id}` },
        (payload) => {
          const next = payload.new as { status: SessionStatus; active_prompt_id: string | null };
          applyState(next);
        },
      )
      .subscribe();

    const responsesChannel = supabase
      .channel(`live-projector-responses:${initial.session.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_responses", filter: `session_id=eq.${initial.session.id}` },
        (payload) => {
          const row = payload.new as { prompt_id: string };
          if (row.prompt_id === stateRef.current.activePromptId) refreshWords(row.prompt_id);
        },
      )
      .subscribe();

    async function poll() {
      const { data } = await supabase
        .from("live_sessions")
        .select("status, active_prompt_id")
        .eq("id", initial.session.id)
        .maybeSingle();
      if (data) await applyState(data);
      // Aunque no haya cambiado la pregunta activa, refrescamos el conteo: el
      // INSERT de una nueva respuesta puede no llegar si Realtime está caído.
      if (stateRef.current.activePromptId) refreshWords(stateRef.current.activePromptId);
    }
    const interval = window.setInterval(poll, 2500);

    return () => {
      supabase.removeChannel(sessionChannel);
      supabase.removeChannel(responsesChannel);
      window.clearInterval(interval);
    };
  }, [initial.session.id, applyState, refreshWords]);

  return (
    <main className="relative flex min-h-dvh flex-col bg-[#06070f]">
      <LabBadge size={56} className="absolute left-[2vw] top-[2vh] z-20" />
      <AnimatePresence mode="wait" initial={false}>
        {status === "ended" ? (
          <motion.div
            key="ended"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-1 flex-col items-center justify-center gap-4 text-white/80"
          >
            <p className="text-sm uppercase tracking-[0.4em] text-accent-2">Sesión finalizada</p>
            <p className="text-3xl font-semibold">Gracias por participar</p>
          </motion.div>
        ) : activePrompt ? (
          <motion.div
            key={activePrompt.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <ProjectorWordCloud question={activePrompt.question} words={words} />
          </motion.div>
        ) : (
          <motion.div
            key="waiting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-1 flex-col items-center justify-center gap-3 text-white/60"
          >
            <motion.p animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2, repeat: Infinity }} className="text-2xl font-medium">
              Esperando la próxima disparadora…
            </motion.p>
            <p className="font-mono text-xs uppercase tracking-widest text-white/30">{initial.className}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
