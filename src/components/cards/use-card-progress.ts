"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { enqueue, ensureAutoFlush, isOnline } from "@/lib/telemetry/offline-queue";
import type { TablesInsert } from "@/lib/types/helpers";
import type { CardProgressState, ProgressMap } from "./types";

const ON_CONFLICT = "student_id,recording_id,card_index";

function looksLikeNetworkError(err: unknown): boolean {
  const msg =
    err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : String(err);
  return /fetch|network|load failed|timeout|ECONN|abort/i.test(msg);
}

/**
 * Escritura resiliente de card_progress: upsert directo si hay red; si no (o si el
 * upsert falla por red) se encola en la cola offline, compactando por placa.
 */
export async function persistCardProgress(
  row: TablesInsert<"card_progress">,
): Promise<"sent" | "queued" | "rejected"> {
  const key = `cp:${row.recording_id}:${row.card_index}`;
  const queueIt = () => {
    enqueue({ table: "card_progress", op: "upsert", payload: row, key, onConflict: ON_CONFLICT });
    return "queued" as const;
  };
  if (!isOnline()) return queueIt();
  try {
    const supabase = createClient();
    const { error } = await supabase.from("card_progress").upsert(row, { onConflict: ON_CONFLICT });
    if (!error) return "sent";
    if (looksLikeNetworkError(error) || !error.code) return queueIt();
    console.error("[card_progress] upsert rechazado", { row, error });
    return "rejected";
  } catch (err) {
    console.warn("[card_progress] fallo inesperado; se encola", err);
    return queueIt();
  }
}

export interface UseCardProgressOptions {
  studentId: string;
  recordingId: string;
  initial: { card_index: number; known: boolean; attempts: number; correct: number }[];
}

export interface RecordOutcome {
  known: boolean;
  /** Sólo quiz: si la respuesta fue correcta. */
  correct?: boolean;
}

export function useCardProgress({ studentId, recordingId, initial }: UseCardProgressOptions) {
  const [progress, setProgress] = React.useState<ProgressMap>(() =>
    Object.fromEntries(initial.map((p) => [p.card_index, { known: p.known, attempts: p.attempts, correct: p.correct }])),
  );
  // Espejo síncrono del estado para acumular attempts/correct sin efectos dentro del updater.
  const progressRef = React.useRef(progress);
  const [pendingWrites, setPendingWrites] = React.useState(0);
  const [lastWrite, setLastWrite] = React.useState<"sent" | "queued" | "rejected" | null>(null);

  React.useEffect(() => {
    ensureAutoFlush();
  }, []);

  /** Registra un intento: actualiza estado local y persiste (acumulando attempts/correct). */
  const record = React.useCallback(
    (index: number, outcome: RecordOutcome): CardProgressState => {
      const cur: CardProgressState = progressRef.current[index] ?? { known: false, attempts: 0, correct: 0 };
      const hit = outcome.correct ?? outcome.known;
      const next: CardProgressState = {
        known: outcome.known,
        attempts: cur.attempts + 1,
        correct: cur.correct + (hit ? 1 : 0),
      };
      progressRef.current = { ...progressRef.current, [index]: next };
      setProgress(progressRef.current);

      const row: TablesInsert<"card_progress"> = {
        student_id: studentId,
        recording_id: recordingId,
        card_index: index,
        known: next.known,
        attempts: next.attempts,
        correct: next.correct,
        last_seen_at: new Date().toISOString(),
      };
      setPendingWrites((n) => n + 1);
      void persistCardProgress(row)
        .then((r) => setLastWrite(r))
        .finally(() => setPendingWrites((n) => Math.max(0, n - 1)));
      return next;
    },
    [studentId, recordingId],
  );

  return { progress, record, pendingWrites, lastWrite };
}
