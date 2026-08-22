"use client";

import { useTrackPageView } from "@/lib/telemetry";

/** Registra page_view del panel Hoy y arranca el auto-flush de la cola offline. */
export function HoyTracker({ studentId }: { studentId: string }) {
  useTrackPageView("student_home", studentId);
  return null;
}
