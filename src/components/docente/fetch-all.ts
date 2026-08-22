import type { PostgrestError } from "@supabase/supabase-js";

const PAGE_SIZE = 1000;
const MAX_PAGES = 20;

/**
 * PostgREST devuelve como máximo 1000 filas por request. Para agregaciones
 * ligeras en JS (telemetría, check-ins), paginamos con `.range()` hasta un
 * tope de 20 000 filas. `run` recibe el rango [from, to] inclusivo.
 */
export async function fetchAll<T>(
  run: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const { data, error } = await run(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}
