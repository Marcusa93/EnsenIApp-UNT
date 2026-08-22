import { TIME_ZONE } from "@/lib/format";

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "YYYY-MM-DD" del instante dado en zona Tucumán (sirve para comparar con `classes.class_date`). */
export function dayKey(input: Date | string | number = new Date()): string {
  const d = input instanceof Date ? input : new Date(input);
  return dayKeyFmt.format(d);
}

/** Hoy en Tucumán como "YYYY-MM-DD". */
export function todayKey(): string {
  return dayKey(new Date());
}

/** Desplaza un "YYYY-MM-DD" en N días (aritmética de calendario, sin zona). */
export function shiftDayKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

/** Lunes de la semana (ISO) del "YYYY-MM-DD" dado. */
export function weekStartKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = (date.getUTCDay() + 6) % 7; // 0 = lunes
  return shiftDayKey(key, -dow);
}

const WEEKDAY_SHORT = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"] as const;

/** "lun", "mar"... del "YYYY-MM-DD" dado. */
export function weekdayShort(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  return WEEKDAY_SHORT[dow];
}

export interface DayActivity {
  key: string;
  label: string;
  count: number;
  isToday: boolean;
}

/**
 * Actividad por día de los últimos `days` días (incluido hoy) a partir de timestamps de eventos.
 * También calcula la racha: días consecutivos con actividad terminando hoy (o ayer, si hoy todavía no hubo).
 */
export function summarizeActivity(timestamps: string[], days = 7): { days: DayActivity[]; streak: number; total: number } {
  const today = todayKey();
  const counts = new Map<string, number>();
  for (const ts of timestamps) {
    const k = dayKey(ts);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const list: DayActivity[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const k = shiftDayKey(today, -i);
    list.push({ key: k, label: weekdayShort(k), count: counts.get(k) ?? 0, isToday: k === today });
  }
  let streak = 0;
  let cursor = counts.has(today) ? today : shiftDayKey(today, -1);
  while (counts.has(cursor)) {
    streak++;
    cursor = shiftDayKey(cursor, -1);
  }
  const total = list.reduce((acc, d) => acc + d.count, 0);
  return { days: list, streak, total };
}

export const QUESTION_STATUS_LABEL = {
  abierta: "Abierta",
  respondida_ia: "Respondida por IA",
  respondida_docente: "Respondida por docente",
  cerrada: "Cerrada",
} as const;

export const QUESTION_STATUS_TONE = {
  abierta: "warning",
  respondida_ia: "accent-2",
  respondida_docente: "success",
  cerrada: "muted",
} as const;

export const ACTIVITY_TYPE_LABEL = {
  lectura: "Lectura",
  cuestionario: "Cuestionario",
  placas: "Placas",
  entrega: "Entrega",
  debate: "Debate",
  encuesta: "Encuesta",
} as const;
