import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Isotipo de EnsenIA: una placa carmesí con líneas de texto —la trama del
 * retrato de Alberdi del logo de la Facultad, leída como una clase transcripta—
 * y un nodo verde petróleo al final de una línea: la IA que la procesa.
 */
export function BrandMark({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <rect x="1" y="1" width="30" height="30" rx="8" fill="var(--accent)" />
      <g stroke="#fff" strokeWidth="1.8" strokeLinecap="round">
        <path d="M8 9.5h16" />
        <path d="M8 14.5h10" />
        <path d="M8 19.5h16" />
        <path d="M8 24.5h12" />
      </g>
      <circle cx="22.5" cy="14.5" r="2.2" fill="var(--accent-2)" />
    </svg>
  );
}

/** Lockup EnsenIA: isotipo + nombre en Montserrat + línea institucional. */
export function Brand({
  href = "/",
  compact = false,
  className,
  tagline = "Derecho · UNT",
}: {
  href?: string;
  compact?: boolean;
  className?: string;
  tagline?: string;
}) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2.5", className)} aria-label="EnsenIA UNT">
      <BrandMark className="transition-transform duration-300 group-hover:-rotate-6" />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-[15px] font-extrabold tracking-tight">
            Ensen<span className="text-accent">IA</span>
          </span>
          <span className="eyebrow mt-1 text-[9px]">{tagline}</span>
        </span>
      )}
    </Link>
  );
}

/**
 * Isologo oficial de la Facultad de Derecho y Ciencias Sociales (UNT).
 * Archivo: public/brand/derecho-unt.png (2465×894, carmesí sobre transparente).
 * En tema oscuro pasa a blanco vía .brand-invert-dark.
 */
export function DerechoLogo({
  height = 40,
  className,
  invertOnDark = true,
}: {
  height?: number;
  className?: string;
  /** false para superficies siempre claras (p. ej. una tarjeta blanca). */
  invertOnDark?: boolean;
}) {
  const width = Math.round(height * (2465 / 894));
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/derecho-unt.png"
      alt="Facultad de Derecho y Ciencias Sociales · Universidad Nacional de Tucumán"
      width={width}
      height={height}
      style={{ height, width }}
      className={cn("shrink-0 select-none", invertOnDark && "brand-invert-dark", className)}
      decoding="async"
    />
  );
}

/**
 * Cabecera institucional: logo de la Facultad + separador + EnsenIA.
 * Para portada, login, salas en vivo y toda pantalla fuera del shell del campus.
 */
export function InstitutionalLockup({
  className,
  logoHeight = 34,
  brandHref = "/",
}: {
  className?: string;
  logoHeight?: number;
  brandHref?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3 sm:gap-4", className)}>
      <a
        href="https://derecho.unt.edu.ar/"
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-ring"
        aria-label="Sitio de la Facultad de Derecho y Ciencias Sociales (UNT), se abre en una pestaña nueva"
      >
        <DerechoLogo height={logoHeight} />
      </a>
      <span className="h-7 w-px shrink-0 bg-border" aria-hidden />
      <Brand href={brandHref} tagline="Campus IA" />
    </div>
  );
}
