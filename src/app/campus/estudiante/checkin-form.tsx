"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function CheckinForm({ classId, studentId }: { classId: string; studentId: string }) {
  const [difficulty, setDifficulty] = useState(3);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);

  async function submit() {
    const supabase = createClient();
    await supabase.from("student_checkins").insert({
      class_id: classId,
      student_id: studentId,
      difficulty,
      comment: comment || null,
    });
    await supabase.from("usage_events").insert({
      student_id: studentId,
      entity_type: "class",
      entity_id: classId,
      event_type: "checkin_submitted",
      metadata: { difficulty },
    });
    setSent(true);
  }

  if (sent) {
    return (
      <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-accent-2">
        Gracias, tu consulta ayuda a mejorar el campus.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">¿Qué tan difícil te resultó esta clase?</p>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => setDifficulty(n)}
            className={`h-9 w-9 rounded-lg border font-mono text-sm transition ${
              difficulty === n
                ? "border-accent bg-accent text-white"
                : "border-border text-muted hover:border-accent"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="¿Qué fue lo que más te costó? (opcional)"
        rows={2}
        className="rounded-xl border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <button
        onClick={submit}
        className="self-start rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
      >
        Enviar
      </button>
    </div>
  );
}
