"use client";

import * as React from "react";
import { Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AudioChunk } from "@/app/campus/estudiante/clases/_lib/data";
import { formatTimestamp } from "./parse";

export interface AudioPlayerHandle {
  /** Salta a un segundo global de la clase y reproduce. */
  seek: (seconds: number) => void;
}

export interface AudioPlayerProps {
  chunks: AudioChunk[];
  totalSeconds: number | null;
  onPlay?: () => void;
  className?: string;
}

const RATES = [1, 1.25, 1.5, 2] as const;

/**
 * Reproductor de la clase completa sobre los chunks de audio (uno por tramo de
 * ~10 min): un solo <audio> que va cambiando de fuente al avanzar o al buscar.
 * El tiempo que se muestra y se busca es SIEMPRE global a la clase.
 */
export const AudioPlayer = React.forwardRef<AudioPlayerHandle, AudioPlayerProps>(function AudioPlayer(
  { chunks, totalSeconds, onPlay, className },
  ref,
) {
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const chunkIndexRef = React.useRef(0);
  const pendingSeekRef = React.useRef<number | null>(null);
  const playedOnceRef = React.useRef(false);

  const [playing, setPlaying] = React.useState(false);
  const [time, setTime] = React.useState(0);
  const [rate, setRate] = React.useState<(typeof RATES)[number]>(1);
  const [loading, setLoading] = React.useState(false);

  const total = totalSeconds ?? (chunks.length > 0 ? chunks[chunks.length - 1].start + chunks[chunks.length - 1].duration : 0);

  const chunkFor = React.useCallback(
    (t: number) => {
      let idx = chunks.length - 1;
      for (let i = 0; i < chunks.length; i++) {
        if (t < chunks[i].start + chunks[i].duration) {
          idx = i;
          break;
        }
      }
      return idx;
    },
    [chunks],
  );

  const loadChunk = React.useCallback(
    (idx: number, offset: number, autoplay: boolean) => {
      const audio = audioRef.current;
      const chunk = chunks[idx];
      if (!audio || !chunk) return;
      chunkIndexRef.current = idx;
      if (audio.src !== chunk.url) {
        setLoading(true);
        pendingSeekRef.current = offset;
        audio.src = chunk.url;
        audio.load();
        if (autoplay) void audio.play().catch(() => setPlaying(false));
      } else {
        audio.currentTime = offset;
        if (autoplay) void audio.play().catch(() => setPlaying(false));
      }
    },
    [chunks],
  );

  const seek = React.useCallback(
    (t: number) => {
      const clamped = Math.max(0, Math.min(t, Math.max(0, total - 0.5)));
      const idx = chunkFor(clamped);
      loadChunk(idx, clamped - chunks[idx].start, true);
      setTime(clamped);
    },
    [chunkFor, chunks, loadChunk, total],
  );

  React.useImperativeHandle(ref, () => ({ seek }), [seek]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else if (!audio.src) {
      loadChunk(0, 0, true);
    } else {
      void audio.play().catch(() => setPlaying(false));
    }
  };

  const skip = (delta: number) => seek(time + delta);

  const cycleRate = () => {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
    setRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  if (chunks.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-2 rounded-2xl border border-border bg-surface-2/60 px-3.5 py-3", className)}>
      <audio
        ref={audioRef}
        preload="none"
        onLoadedMetadata={(e) => {
          const audio = e.currentTarget;
          audio.playbackRate = rate;
          if (pendingSeekRef.current != null) {
            audio.currentTime = pendingSeekRef.current;
            pendingSeekRef.current = null;
          }
          setLoading(false);
        }}
        onPlay={() => {
          setPlaying(true);
          if (!playedOnceRef.current) {
            playedOnceRef.current = true;
            onPlay?.();
          }
        }}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          const chunk = chunks[chunkIndexRef.current];
          if (chunk) setTime(chunk.start + e.currentTarget.currentTime);
        }}
        onEnded={() => {
          const next = chunkIndexRef.current + 1;
          if (next < chunks.length) loadChunk(next, 0, true);
          else setPlaying(false);
        }}
        onError={() => {
          setLoading(false);
          setPlaying(false);
          console.error("[audio] error al cargar el tramo", chunkIndexRef.current);
        }}
      />

      {/* En mobile la barra baja a su propia fila para que no quede minúscula. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2.5">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pausar" : "Escuchar la clase"}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-white transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {playing ? <Pause className="size-4" /> : <Play className="ml-0.5 size-4" />}
        </button>

        <button
          type="button"
          onClick={() => skip(-15)}
          aria-label="Retroceder 15 segundos"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-surface hover:text-foreground"
        >
          <RotateCcw className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => skip(15)}
          aria-label="Adelantar 15 segundos"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-surface hover:text-foreground"
        >
          <RotateCw className="size-4" />
        </button>

        <input
          type="range"
          min={0}
          max={Math.max(1, Math.floor(total))}
          step={1}
          value={Math.floor(time)}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Posición en la clase"
          className="order-last h-1.5 min-w-0 basis-full cursor-pointer appearance-none rounded-full bg-border accent-[var(--accent)] sm:order-none sm:basis-auto sm:flex-1"
        />

        <span className="ml-auto shrink-0 font-mono text-[11px] tabular-nums text-muted sm:ml-0">
          {formatTimestamp(time)} / {formatTimestamp(total)}
        </span>

        <button
          type="button"
          onClick={cycleRate}
          aria-label={`Velocidad ${rate}x, tocá para cambiar`}
          className="shrink-0 rounded-lg border border-border bg-surface px-2 py-1 font-mono text-[11px] text-foreground transition hover:border-accent/50"
        >
          {rate}x
        </button>
      </div>

      {loading && <p className="font-mono text-[10px] uppercase tracking-widest text-muted">Cargando audio…</p>}
    </div>
  );
});
