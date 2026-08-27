"use client";

import * as React from "react";
import { Download, Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui";
import { OperatorAvatar, type AvatarConfig } from "./operator-avatar";
import { buildPalette } from "./palette";

/**
 * Comparte el operador en formato historia (1080×1920).
 *
 * Se arma un SVG completo de la historia, se rasteriza en un canvas y se ofrece
 * por Web Share (que en el celular abre directamente el menú donde está
 * Instagram) o, si el navegador no comparte archivos, se descarga la imagen.
 *
 * No se usa ninguna librería: SVG → data URI → canvas → blob. Cero peso extra.
 */

const W = 1080;
const H = 1920;

export interface ShareStoryProps {
  config: AvatarConfig;
  callsign: string;
  levelName: string;
  levelNumber: number;
  xp: number;
  itemsOwned: number;
  itemsTotal: number;
  streak: number;
}

/** Escapa texto para meterlo en el SVG sin romperlo. */
function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildStorySvg(props: ShareStoryProps, avatarSvg: string): string {
  const p = buildPalette(props.config.glow, props.config.tone);
  const { callsign, levelName, levelNumber, xp, itemsOwned, itemsTotal, streak } = props;

  // El avatar viene con viewBox 0 0 240 240: se escala y centra en la historia.
  const size = 760;
  const ax = (W - size) / 2;
  const ay = 470;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0b0e16"/>
      <stop offset="0.55" stop-color="#10131f"/>
      <stop offset="1" stop-color="#0b0e16"/>
    </linearGradient>
    <radialGradient id="halo" cx="0.5" cy="0.42" r="0.5">
      <stop offset="0" stop-color="${p.glow}" stop-opacity="0.28"/>
      <stop offset="1" stop-color="${p.glow}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#halo)"/>

  <!-- Grilla sutil de fondo -->
  ${Array.from({ length: 14 }, (_, i) => `<line x1="0" y1="${i * 140}" x2="${W}" y2="${i * 140}" stroke="${p.glow}" stroke-width="1" opacity="0.05"/>`).join("")}
  ${Array.from({ length: 8 }, (_, i) => `<line x1="${i * 140}" y1="0" x2="${i * 140}" y2="${H}" stroke="${p.glow}" stroke-width="1" opacity="0.05"/>`).join("")}

  <!-- Encabezado -->
  <text x="${W / 2}" y="210" text-anchor="middle" font-family="ui-monospace, 'SF Mono', Menlo, monospace"
        font-size="30" letter-spacing="10" fill="${p.glow}" opacity="0.9">EL EXPEDIENTE</text>
  <text x="${W / 2}" y="290" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif"
        font-size="62" font-weight="700" fill="#f2f4f8">${esc(callsign)}</text>
  <text x="${W / 2}" y="352" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, sans-serif"
        font-size="34" fill="#95a0b5">Nivel ${levelNumber} · ${esc(levelName)}</text>

  <!-- Avatar -->
  <g transform="translate(${ax} ${ay}) scale(${size / 240})">${avatarSvg}</g>

  <!-- Estadísticas -->
  <g font-family="ui-monospace, 'SF Mono', Menlo, monospace" text-anchor="middle">
    <text x="${W * 0.24}" y="1420" font-size="74" font-weight="700" fill="#f2f4f8">${xp}</text>
    <text x="${W * 0.24}" y="1470" font-size="26" letter-spacing="4" fill="#95a0b5">XP</text>

    <text x="${W * 0.5}" y="1420" font-size="74" font-weight="700" fill="#f2f4f8">${itemsOwned}<tspan font-size="40" fill="#95a0b5">/${itemsTotal}</tspan></text>
    <text x="${W * 0.5}" y="1470" font-size="26" letter-spacing="4" fill="#95a0b5">EQUIPOS</text>

    <text x="${W * 0.76}" y="1420" font-size="74" font-weight="700" fill="#f2f4f8">${streak}</text>
    <text x="${W * 0.76}" y="1470" font-size="26" letter-spacing="4" fill="#95a0b5">RACHA</text>
  </g>

  <line x1="${W * 0.16}" y1="1560" x2="${W * 0.84}" y2="1560" stroke="${p.glow}" stroke-width="2" opacity="0.35"/>

  <!-- Pie -->
  <text x="${W / 2}" y="1660" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, sans-serif"
        font-size="38" font-weight="600" fill="#f2f4f8">EnsenIA UNT</text>
  <text x="${W / 2}" y="1712" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, sans-serif"
        font-size="27" fill="#95a0b5">Derecho de las Nuevas Tecnologías y Bioderecho</text>
  <text x="${W / 2}" y="1762" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, sans-serif"
        font-size="25" fill="#6d788d">Facultad de Derecho · UNT</text>
</svg>`;
}

export function ShareStory(props: ShareStoryProps) {
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const hiddenRef = React.useRef<HTMLDivElement>(null);

  async function render(): Promise<Blob> {
    const svgEl = hiddenRef.current?.querySelector("svg");
    if (!svgEl) throw new Error("No pudimos preparar la imagen.");

    // Contenido interno del avatar, sin su propio <svg> contenedor.
    const inner = svgEl.innerHTML;
    const story = buildStorySvg(props, inner);

    const blob = new Blob([story], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    try {
      const img = new Image();
      img.decoding = "sync";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("No pudimos generar la imagen."));
        img.src = url;
      });

      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No pudimos generar la imagen.");
      ctx.drawImage(img, 0, 0, W, H);

      return await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No pudimos generar la imagen."))), "image/png", 0.95),
      );
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function share() {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const blob = await render();
      const file = new File([blob], `operador-${props.callsign.toLowerCase().replace(/\s+/g, "-")}.png`, {
        type: "image/png",
      });

      // En celular esto abre el menú del sistema, donde está Instagram.
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: `${props.callsign} · EnsenIA UNT` });
        setNote("¡Listo! Elegí Instagram para subirla a tu historia.");
        return;
      }

      // Sin Web Share: se descarga y se sube a mano.
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
      setNote("Te la descargamos. Subila como historia desde tu galería.");
    } catch (err) {
      // Cancelar el menú de compartir no es un error que valga la pena mostrar.
      if ((err as Error)?.name === "AbortError") return;
      console.error("[avatar] compartir", err);
      setError(err instanceof Error ? err.message : "No pudimos preparar la imagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Copia oculta del avatar, a resolución alta, para rasterizar */}
      <div ref={hiddenRef} aria-hidden className="pointer-events-none fixed -left-[9999px] top-0 size-[240px]">
        <OperatorAvatar config={props.config} size={240} />
      </div>

      <Button
        variant="secondary"
        size="sm"
        onClick={share}
        disabled={busy}
        leftIcon={busy ? <Loader2 className="animate-spin" /> : <Share2 />}
      >
        Compartir como historia
      </Button>

      {note && <p className="mt-2 text-xs text-success">{note}</p>}
      {error && (
        <p role="alert" className="mt-2 flex items-center gap-1.5 text-xs text-danger">
          <Download className="size-3.5" aria-hidden />
          {error}
        </p>
      )}
    </>
  );
}
