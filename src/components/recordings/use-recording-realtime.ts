"use client";

import * as React from "react";
import type { RealtimePostgresUpdatePayload } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { ClassRecording } from "@/lib/types/helpers";

export interface RecordingLiveState {
  status: ClassRecording["status"];
  progress: number;
  current_step: string | null;
  chunks_done: number;
  chunks_total: number;
  error_message: string | null;
  published: boolean;
  title: string | null;
}

export function toLiveState(r: Partial<ClassRecording> & { status: ClassRecording["status"] }): RecordingLiveState {
  return {
    status: r.status,
    progress: r.progress ?? 0,
    current_step: r.current_step ?? null,
    chunks_done: r.chunks_done ?? 0,
    chunks_total: r.chunks_total ?? 0,
    error_message: r.error_message ?? null,
    published: r.published ?? false,
    title: r.title ?? null,
  };
}

/**
 * Refleja por Realtime los cambios de una fila de class_recordings
 * (progreso/current_step), aunque el procesamiento lo dispare otra pestaña.
 * Devuelve el estado más reciente conocido; arranca con `initial`.
 */
export function useRecordingRealtime(recordingId: string | null, initial: RecordingLiveState | null) {
  const [state, setState] = React.useState<RecordingLiveState | null>(initial);

  // Sincroniza si el padre pasa un estado más nuevo (p. ej. tras router.refresh()).
  React.useEffect(() => {
    if (initial) setState((prev) => (prev && prev.progress > initial.progress && prev.status === initial.status ? prev : initial));
  }, [initial]);

  React.useEffect(() => {
    if (!recordingId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`recording:${recordingId}`)
      .on<ClassRecording>(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "class_recordings", filter: `id=eq.${recordingId}` },
        (payload: RealtimePostgresUpdatePayload<ClassRecording>) => {
          if (payload.new && typeof payload.new === "object" && "status" in payload.new) {
            setState(toLiveState(payload.new));
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [recordingId]);

  /** Permite que el bucle de pasos actualice el estado sin esperar al socket. */
  const merge = React.useCallback((partial: Partial<RecordingLiveState> & { status: ClassRecording["status"] }) => {
    setState((prev) => ({ ...(prev ?? toLiveState({ status: partial.status })), ...partial }));
  }, []);

  return [state, merge] as const;
}
