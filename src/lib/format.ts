import { formatDistanceToNowStrict, isValid, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export const TIME_ZONE = "America/Argentina/Tucuman";

type DateInput = Date | string | number | null | undefined;

function toDate(input: DateInput): Date | null {
  if (input == null || input === "") return null;
  if (input instanceof Date) return isValid(input) ? input : null;
  if (typeof input === "number") {
    const d = new Date(input);
    return isValid(d) ? d : null;
  }
  // Fechas `date` de Postgres (YYYY-MM-DD) se interpretan como día local, no UTC.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(input) ? parseISO(input) : new Date(input);
  return isValid(d) ? d : null;
}

const dateFmt = new Intl.DateTimeFormat("es-AR", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

const dateLongFmt = new Intl.DateTimeFormat("es-AR", {
  timeZone: TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});

const dateTimeFmt = new Intl.DateTimeFormat("es-AR", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const timeFmt = new Intl.DateTimeFormat("es-AR", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});

/** "12 mar 2026" (zona Tucumán). Devuelve "" si la fecha es inválida. */
export function formatDate(input: DateInput): string {
  const d = toDate(input);
  return d ? dateFmt.format(d).replace(/\./g, "") : "";
}

/** "jueves, 12 de marzo" */
export function formatDateLong(input: DateInput): string {
  const d = toDate(input);
  return d ? dateLongFmt.format(d) : "";
}

/** "12 mar, 18:30" */
export function formatDateTime(input: DateInput): string {
  const d = toDate(input);
  return d ? dateTimeFmt.format(d).replace(/\./g, "") : "";
}

/** "18:30" */
export function formatTime(input: DateInput): string {
  const d = toDate(input);
  return d ? timeFmt.format(d) : "";
}

/** "hace 3 horas" / "en 2 días" (date-fns, locale es). */
export function formatRelative(input: DateInput): string {
  const d = toDate(input);
  if (!d) return "";
  return formatDistanceToNowStrict(d, { addSuffix: true, locale: es });
}

/** 4320 → "1 h 12 min"; 45 → "45 s"; 125 → "2 min". */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "—";
  const s = Math.round(seconds);
  if (s < 60) return `${s} s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** "María Falú" → "MF". Máximo 2 letras. */
export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((p) => p && !/^(dr|dra|lic|ing|prof)\.?$/i.test(p));
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** 1234567 → "1,2 MB" */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes)) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toLocaleString("es-AR", { maximumFractionDigits: i === 0 ? 0 : 1 })} ${units[i]}`;
}

/** 0.456 → "46 %" */
export function formatPercent(ratio: number | null | undefined, digits = 0): string {
  if (ratio == null || !Number.isFinite(ratio)) return "—";
  return `${(ratio * 100).toLocaleString("es-AR", { maximumFractionDigits: digits })} %`;
}
