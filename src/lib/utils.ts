import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Sanitiza una ruta "next" para redirecciones: sólo rutas internas, sin protocolo ni `//`. */
export function safeInternalPath(path: string | null | undefined, fallback = "/campus"): string {
  if (!path) return fallback;
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://")) return fallback;
  if (/[\r\n\\]/.test(path)) return fallback;
  return path;
}

/** Mensaje legible a partir de un error desconocido (Error, string, objeto Supabase). */
export function errorMessage(err: unknown, fallback = "Ocurrió un error inesperado."): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return fallback;
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
