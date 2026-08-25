"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import type { WordCount } from "@/lib/live/types";

interface Props {
  question: string;
  words: WordCount[];
}

/**
 * Vista de proyector para pantalla grande: la respuesta más repetida como
 * "hero" gigante, el resto como chips que crecen con la frecuencia. Todo con
 * unidades `vw`/`vh`/`clamp()` para que nunca se corte en un proyector real.
 */
const MAX_CHIPS = 44;

export function ProjectorWordCloud({ question, words }: Props) {
  const total = words.reduce((n, w) => n + w.frequency, 0);
  const maxFreq = Math.max(1, ...words.map((w) => w.frequency));

  const hero = words[0] ?? null;
  const rest = useMemo(() => words.slice(1, MAX_CHIPS + 1), [words]);
  const overflowCount = Math.max(0, words.length - 1 - rest.length);

  const prevTotalRef = useRef(0);
  const [pulseId, setPulseId] = useState<string | null>(null);
  useEffect(() => {
    if (total > prevTotalRef.current && words[0]) {
      setPulseId(words[0].normalized_word);
      const t = setTimeout(() => setPulseId(null), 1400);
      prevTotalRef.current = total;
      return () => clearTimeout(t);
    }
    prevTotalRef.current = total;
  }, [total, words]);

  function chipSize(freq: number): string {
    const r = freq / maxFreq;
    return `clamp(1.05rem, ${(0.9 + r * 1.9).toFixed(2)}vw, 2.6rem)`;
  }
  function chipTone(freq: number): string {
    const r = freq / maxFreq;
    if (r > 0.6) return "bg-accent-2 text-[#04241f] font-bold shadow-[0_0_30px_-6px] shadow-accent-2/70";
    if (r > 0.33) return "bg-accent-3/15 text-accent-3 ring-1 ring-accent-3/45";
    return "bg-white/[0.06] text-white/90 ring-1 ring-white/12";
  }

  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-[3vw] pb-[2vh] pt-[1.5vh] text-[#eef2fb]">
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-[6vh] right-[2vw] select-none font-black leading-none text-white/[0.05]"
        style={{ fontSize: "38vh" }}
      >
        {total}
      </div>

      <div className="relative shrink-0 text-center">
        <p className="mb-1 text-[clamp(0.7rem,1.1vw,1rem)] font-semibold uppercase tracking-[0.35em] text-accent-2">
          Nube en vivo
        </p>
        <h2 className="mx-auto max-w-[85%] font-semibold leading-[1.02]" style={{ fontSize: "clamp(1.5rem, 3.2vw, 3rem)" }}>
          {question}
        </h2>
      </div>

      <div className="relative mt-[2vh] flex min-h-0 flex-1 flex-col items-center justify-center gap-[2vh]">
        {words.length === 0 ? (
          <motion.p
            animate={{ opacity: [0.35, 1, 0.35] }}
            transition={{ duration: 2.2, repeat: Infinity }}
            className="font-medium opacity-60"
            style={{ fontSize: "clamp(1.4rem, 2.6vw, 2.4rem)" }}
          >
            Esperando las primeras respuestas…
          </motion.p>
        ) : (
          <>
            {hero && (
              <motion.div
                key={hero.normalized_word}
                layout
                initial={{ opacity: 0, y: 18, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 140, damping: 16 }}
                className="relative flex max-w-[92%] shrink-0 flex-col items-center"
              >
                <span className="mb-1 inline-flex items-center gap-2 rounded-full bg-accent-2/15 px-3 py-1 text-[clamp(0.6rem,0.9vw,0.85rem)] font-bold uppercase tracking-[0.25em] text-accent-2 ring-1 ring-accent-2/30">
                  Lo más repetido · {hero.frequency} {hero.frequency === 1 ? "voto" : "votos"}
                </span>
                <p
                  className="bg-gradient-to-br from-white via-accent-2 to-accent bg-clip-text text-center font-black leading-[0.98] text-transparent drop-shadow-[0_0_40px_rgba(45,226,196,0.25)]"
                  style={{ fontSize: "clamp(2.4rem, 7vw, 7.5rem)" }}
                >
                  {hero.display_word}
                </p>
              </motion.div>
            )}

            {rest.length > 0 && (
              <div className="flex min-h-0 flex-1 flex-wrap content-center items-center justify-center gap-[0.9vw] overflow-hidden">
                <AnimatePresence initial={false}>
                  {rest.map((w) => {
                    const isPulsing = pulseId === w.normalized_word;
                    return (
                      <motion.span
                        key={w.normalized_word}
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: isPulsing ? [1, 1.06, 1] : 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.35 }}
                        className={cn(
                          "inline-flex max-w-full items-baseline gap-1.5 whitespace-normal break-words rounded-full px-[1.1vw] py-[0.5vh] text-center font-semibold leading-tight",
                          chipTone(w.frequency),
                        )}
                        style={{ fontSize: chipSize(w.frequency) }}
                      >
                        {w.display_word}
                        <span className="text-[0.55em] font-mono opacity-60">{w.frequency}</span>
                      </motion.span>
                    );
                  })}
                </AnimatePresence>
                {overflowCount > 0 && (
                  <span className="inline-flex items-center rounded-full bg-white/[0.06] px-[1.1vw] py-[0.5vh] font-mono text-[clamp(0.9rem,1.3vw,1.4rem)] font-semibold text-white/55 ring-1 ring-white/10">
                    +{overflowCount} más
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="relative z-10 mt-[1.5vh] flex shrink-0 items-center justify-between gap-6">
        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-[1.4vw] py-[0.8vh] backdrop-blur">
          <span className="relative inline-flex size-3">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent-2 opacity-75" />
            <span className="relative inline-flex size-3 rounded-full bg-accent-2" />
          </span>
          <span className="font-semibold uppercase tracking-widest text-white/70" style={{ fontSize: "clamp(0.75rem,1vw,1.05rem)" }}>
            {words.length} {words.length === 1 ? "respuesta única" : "respuestas únicas"}
          </span>
        </div>
        <div className="flex items-baseline gap-3">
          <p className="font-black leading-none text-accent-2" style={{ fontSize: "clamp(2.4rem,5vw,4.5rem)" }}>
            {total}
          </p>
          <p className="uppercase tracking-widest opacity-60" style={{ fontSize: "clamp(0.7rem,0.95vw,1rem)" }}>
            {total === 1 ? "respuesta" : "respuestas"}
          </p>
        </div>
      </div>
    </section>
  );
}
