"use client";

import * as React from "react";
import { track, useTrackPageView } from "@/lib/telemetry";

/** Emite page_view + class_opened al montar (una vez por clase). Sin UI. */
export function ClassOpenedTracker({ classId, recordingIds }: { classId: string; recordingIds: string[] }) {
  useTrackPageView("class", classId);
  const key = recordingIds.join(",");
  React.useEffect(() => {
    void track("class_opened", {
      entity_type: "class",
      entity_id: classId,
      metadata: { recordings: key ? key.split(",") : [] },
    });
  }, [classId, key]);
  return null;
}
