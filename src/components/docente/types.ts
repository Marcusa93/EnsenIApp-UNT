/** Resultado estándar de las Server Actions del módulo docente. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function fail(error: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

export function succeed<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}
