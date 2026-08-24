"use client";

import { useTrackPageView } from "@/lib/telemetry";

/** Registra page_view de una pantalla del estudiante y arranca el auto-flush de la cola offline. */
export function PageViewTracker({ entityType, entityId }: { entityType: string; entityId?: string }) {
  useTrackPageView(entityType, entityId);
  return null;
}
