"use client";

import * as React from "react";
import { Lock } from "lucide-react";
import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";
import { EMOTES, emoteRequirement, isEmoteUnlocked, type EmoteProgress } from "@/lib/games/emotes";
import { LEVELS } from "@/lib/games/config";

/**
 * Barra de emotes: se tocan y el muñeco los hace. Los bloqueados también se
 * pueden ver — misma idea que el probador de equipo: saber qué te espera es lo
 * que da ganas de volver.
 */
export function EmoteBar({
  progress,
  playing,
  onPlay,
}: {
  progress: EmoteProgress;
  playing: string | null;
  onPlay: (emoteId: string) => void;
}) {
  return (
    <Card padding="sm">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium">Emotes</p>
        <p className="text-[11px] text-muted">Tocá para verlo</p>
      </div>

      <div className="-mx-1 mt-2.5 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {EMOTES.map((e) => {
          const unlocked = isEmoteUnlocked(e, progress);
          const isPlaying = playing === e.id;
          const levelName = LEVELS.find((l) => l.n === e.req.value)?.name;
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => onPlay(e.id)}
              title={unlocked ? e.description : emoteRequirement(e, levelName)}
              className={cn(
                "flex w-[74px] shrink-0 flex-col items-center gap-1 rounded-xl border px-2 py-2.5 transition",
                isPlaying
                  ? "border-accent bg-accent/10"
                  : unlocked
                    ? "border-border bg-surface-2/50 hover:border-accent/45"
                    : "border-border bg-surface-2/25 hover:border-accent-2/40",
              )}
            >
              <span className={cn("text-xl", !unlocked && "opacity-45 grayscale")} aria-hidden>
                {e.emoji}
              </span>
              <span className={cn("text-center text-[10px] font-medium leading-tight", !unlocked && "text-muted")}>
                {e.name}
              </span>
              {!unlocked && (
                <span className="flex items-center gap-0.5 text-[9px] text-accent-2">
                  <Lock className="size-2.5" aria-hidden />
                  probar
                </span>
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-muted">
        Son originales de la cátedra: no usamos bailes de otros juegos, que tienen dueño.
      </p>
    </Card>
  );
}
