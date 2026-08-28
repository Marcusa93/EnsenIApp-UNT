"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Alberdi bibliotecario: el NPC del mostrador.
 *
 * Es una ilustración y no un muñeco del rig, a propósito — que se vea distinto
 * de los operadores comunica que es otra clase de entidad, una figura histórica
 * y no un estudiante aumentado.
 *
 * Como la imagen es fija, la vida se la dan capas alrededor y transformaciones
 * sobre el conjunto: flota siempre, se endereza y brilla cuando alguien se
 * acerca, y cabecea mientras responde. Todo por CSS, así que no hay bucle de
 * animación corriendo ni sprites que descargar.
 */

export type AlberdiMood = "idle" | "atento" | "hablando";

export function AlberdiNpc({
  mood = "idle",
  size = 120,
  className,
  showGlyphs = true,
}: {
  mood?: AlberdiMood;
  size?: number;
  className?: string;
  /** Los glifos orbitando: se apagan en tamaños chicos donde sólo ensucian. */
  showGlyphs?: boolean;
}) {
  return (
    <div
      className={cn("relative select-none", className)}
      style={{ width: size, height: size * 1.5 }}
      data-mood={mood}
    >
      {/* Halo detrás: late más fuerte cuando está atento */}
      <div
        className={cn(
          "pointer-events-none absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl transition-opacity duration-500",
          mood === "idle" ? "opacity-40" : "opacity-80",
        )}
        style={{
          width: size * 0.9,
          height: size * 0.9,
          background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)",
        }}
        aria-hidden
      />

      {/* Glifos que orbitan: es lo que lo hace parecer vivo aunque no se mueva */}
      {showGlyphs && (
        <svg
          viewBox="0 0 100 150"
          className="pointer-events-none absolute inset-0 size-full"
          aria-hidden
        >
          <g className="npc-orbit" style={{ transformOrigin: "50px 62px" }}>
            {[
              [50, 18, 2.2],
              [82, 62, 1.8],
              [50, 106, 2],
              [18, 62, 1.6],
            ].map(([cx, cy, r], i) => (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={r}
                fill="var(--accent-2)"
                opacity={mood === "idle" ? 0.45 : 0.85}
              />
            ))}
          </g>
        </svg>
      )}

      {/* La figura */}
      <div
        className={cn(
          "npc-float relative size-full",
          mood === "hablando" && "npc-talk",
          mood === "atento" && "npc-alert",
        )}
      >
        <Image
          src="/npc/alberdi.webp"
          alt="Alberdi, bibliotecario de la cátedra"
          width={size}
          height={size * 1.5}
          priority={false}
          className="size-full object-contain"
        />
      </div>

      {/* Destello sobre la pluma cuando habla */}
      {mood === "hablando" && (
        <span
          className="npc-spark pointer-events-none absolute rounded-full"
          style={{
            left: "70%",
            top: "40%",
            width: size * 0.1,
            height: size * 0.1,
            background: "radial-gradient(circle, #fff 0%, var(--accent-2) 45%, transparent 70%)",
          }}
          aria-hidden
        />
      )}
    </div>
  );
}
