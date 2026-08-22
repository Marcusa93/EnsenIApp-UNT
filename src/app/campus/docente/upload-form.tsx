"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function UploadForm({ classId, uploadedBy }: { classId: string; uploadedBy: string }) {
  const [status, setStatus] = useState<"idle" | "uploading" | "processing" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus("uploading");
    const supabase = createClient();
    const path = `${classId}/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("class-recordings")
      .upload(path, file);

    if (uploadError) {
      setStatus("error");
      setMessage(uploadError.message);
      return;
    }

    const { data: recording, error: insertError } = await supabase
      .from("class_recordings")
      .insert({ class_id: classId, storage_path: path, uploaded_by: uploadedBy })
      .select()
      .single();

    if (insertError || !recording) {
      setStatus("error");
      setMessage(insertError?.message ?? "No se pudo registrar la grabación");
      return;
    }

    setStatus("processing");
    const res = await fetch("/api/recordings/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recordingId: recording.id }),
    });

    if (res.ok) {
      setStatus("done");
      setMessage("Clase procesada: resumen, placas y feedback generados.");
    } else {
      setStatus("error");
      setMessage("Error al procesar la grabación con IA.");
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-border p-4">
      <label className="flex cursor-pointer flex-col items-start gap-2">
        <span className="font-mono text-xs uppercase tracking-widest text-accent">
          Subir grabación de clase
        </span>
        <input
          type="file"
          accept="audio/*,video/*"
          onChange={handleFile}
          disabled={status === "uploading" || status === "processing"}
          className="text-sm"
        />
      </label>
      {status === "uploading" && <p className="mt-2 text-xs text-muted">Subiendo archivo...</p>}
      {status === "processing" && (
        <p className="mt-2 text-xs text-muted">Transcribiendo y generando material con IA...</p>
      )}
      {status === "done" && <p className="mt-2 text-xs text-accent-2">{message}</p>}
      {status === "error" && <p className="mt-2 text-xs text-accent-3">{message}</p>}
    </div>
  );
}
