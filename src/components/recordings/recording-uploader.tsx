"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ArrowDownToLine, AudioLines, CheckCircle2, FileAudio, RefreshCw, Sparkles, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input } from "@/components/ui";
import { Progress } from "@/components/ui/progress";
import { createClient } from "@/lib/supabase/client";
import { prepareAudioChunks, isLikelyMediaFile, AudioPrepareError, type PreparedAudio, type PrepareProgress } from "@/lib/audio/prepare-upload";
import { estimateMp3Bytes, MAX_CHUNK_SECONDS, TARGET_BITRATE_KBPS } from "@/lib/audio/chunking";
import { runPipeline, PipelineStepError, type StepResponse } from "@/lib/audio/pipeline";
import { formatBytes, formatDuration } from "@/lib/format";
import { errorMessage, cn } from "@/lib/utils";
import { useRecordingRealtime } from "./use-recording-realtime";
import { PipelineProgress } from "./pipeline-progress";

export interface RecordingUploaderProps {
  classId: string;
  /** id del docente autenticado (uploaded_by). */
  userId: string;
  /** Se invoca cuando el pipeline termina (ready) para que el padre refresque la lista. */
  onFinished?: () => void;
}

type Phase =
  | "idle"
  | "selected"
  | "decoding"
  | "resampling"
  | "compressing"
  | "creating"
  | "uploading"
  | "processing"
  | "done"
  | "error";

/** Fase en la que estaba cuando falló: define qué hace "Reintentar". */
type FailedAt = "prepare" | "upload" | "process";

const BUCKET = "class-recordings";
const ACCEPT = "audio/*,video/mp4,video/webm,.mp3,.m4a,.aac,.wav,.webm,.ogg,.opus,.mp4,.mov,.flac";
// 500 MB de archivo comprimido. El límite real de memoria lo pone el PCM decodificado
// (duración × canales × sample rate, validado en prepare-upload): este tope filtra los
// formatos sin comprimir (WAV de horas) que reventarían la pestaña.
const MAX_FILE_BYTES = 500 * 1024 * 1024;

function defaultTitle(file: File): string {
  return file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 160) || "Grabación de la clase";
}

function phaseLabel(phase: Phase, p: PrepareProgress | null, upload: { index: number; total: number } | null): string {
  switch (phase) {
    case "decoding":
      return "Decodificando el audio…";
    case "resampling":
      return "Convirtiendo a mono 16 kHz…";
    case "compressing":
      return `Comprimiendo ${p?.percent ?? 0} %${p?.chunksTotal && p.chunksTotal > 1 ? ` · parte ${(p.chunkIndex ?? 0) + 1}/${p.chunksTotal}` : ""}`;
    case "creating":
      return "Creando la grabación…";
    case "uploading":
      return upload ? `Subiendo parte ${upload.index + 1} de ${upload.total}…` : "Subiendo…";
    default:
      return "";
  }
}

/**
 * Subida de grabaciones: drag & drop → compresión en el navegador (Web Worker) →
 * subida por partes a Storage → pipeline de IA paso a paso con progreso en vivo.
 */
export function RecordingUploader({ classId, userId, onFinished }: RecordingUploaderProps) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const preparedRef = React.useRef<PreparedAudio | null>(null);
  const uploadedRef = React.useRef<Set<number>>(new Set());

  const [phase, setPhase] = React.useState<Phase>("idle");
  const [file, setFile] = React.useState<File | null>(null);
  const [title, setTitle] = React.useState("");
  const [dragging, setDragging] = React.useState(false);
  const [prep, setPrep] = React.useState<PrepareProgress | null>(null);
  const [upload, setUpload] = React.useState<{ index: number; total: number } | null>(null);
  const [savings, setSavings] = React.useState<{ from: number; to: number; seconds: number; chunks: number } | null>(null);
  const [recordingId, setRecordingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [failedAt, setFailedAt] = React.useState<FailedAt | null>(null);
  const [startedAt, setStartedAt] = React.useState<{ at: number; progress: number } | null>(null);
  const [live, mergeLive] = useRecordingRealtime(recordingId, null);

  const busy = phase !== "idle" && phase !== "selected" && phase !== "done" && phase !== "error";

  React.useEffect(() => () => abortRef.current?.abort(), []);

  const reset = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    preparedRef.current = null;
    uploadedRef.current = new Set();
    setPhase("idle");
    setFile(null);
    setTitle("");
    setPrep(null);
    setUpload(null);
    setSavings(null);
    setRecordingId(null);
    setError(null);
    setFailedAt(null);
    setStartedAt(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const pick = (f: File | null) => {
    if (!f) return;
    setError(null);
    if (!isLikelyMediaFile(f)) {
      setError("Ese archivo no parece un audio o video. Formatos admitidos: MP3, M4A, WAV, WebM, OGG, MP4.");
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      setError(
        `El archivo pesa ${formatBytes(f.size)}. El máximo es ${formatBytes(MAX_FILE_BYTES)}: convertilo a MP3 o M4A (por ejemplo con VLC) y volvé a intentar.`,
      );
      return;
    }
    setFile(f);
    setTitle(defaultTitle(f));
    setPhase("selected");
  };

  const fail = (at: FailedAt, err: unknown) => {
    const msg = err instanceof AudioPrepareError || err instanceof PipelineStepError ? err.message : errorMessage(err);
    console.error("[uploader] falló en", at, err);
    setError(msg);
    setFailedAt(at);
    setPhase("error");
  };

  // ---- 1) Preparar (decodificar + comprimir + partir) ----
  const prepare = async (signal: AbortSignal): Promise<PreparedAudio> => {
    if (!file) throw new Error("Elegí un archivo primero.");
    setPhase("decoding");
    const prepared = await prepareAudioChunks(file, {
      signal,
      onProgress: (p) => {
        setPrep(p);
        setPhase(p.phase);
      },
    });
    preparedRef.current = prepared;
    setSavings({
      from: prepared.originalBytes,
      to: prepared.compressedBytes,
      seconds: prepared.totalDurationSeconds,
      chunks: prepared.chunks.length,
    });
    return prepared;
  };

  // ---- 2) Crear fila + subir chunks ----
  const uploadAll = async (prepared: PreparedAudio, signal: AbortSignal): Promise<string> => {
    const supabase = createClient();
    let id = recordingId;

    if (!id) {
      setPhase("creating");
      const newId = crypto.randomUUID();
      const { error: insErr } = await supabase.from("class_recordings").insert({
        id: newId,
        class_id: classId,
        uploaded_by: userId,
        title: title.trim() || defaultTitle(file as File),
        storage_path: `${newId}/`,
        mime_type: "audio/mpeg",
        size_bytes: prepared.compressedBytes,
        duration_seconds: Math.round(prepared.totalDurationSeconds),
        chunks_total: prepared.chunks.length,
        chunks_done: 0,
        status: "uploaded",
        progress: 0,
        processing_log: [
          {
            at: new Date().toISOString(),
            step: "upload",
            message: `Original ${formatBytes(prepared.originalBytes)} (${file?.type || "tipo desconocido"}) → ${formatBytes(prepared.compressedBytes)} en ${prepared.chunks.length} parte(s) de ≤ ${MAX_CHUNK_SECONDS / 60} min, MP3 ${TARGET_BITRATE_KBPS} kbps mono 16 kHz.${prepared.usedWorker ? "" : " (compresión en hilo principal)"}`,
          },
        ],
      });
      if (insErr) throw new Error(`No se pudo crear la grabación: ${insErr.message}`);
      id = newId;
      setRecordingId(newId);
      mergeLive({ status: "uploaded", progress: 0, chunks_total: prepared.chunks.length, chunks_done: 0, title: title.trim() || null });
    }

    setPhase("uploading");
    for (const chunk of prepared.chunks) {
      if (signal.aborted) throw new Error("Subida cancelada.");
      if (uploadedRef.current.has(chunk.index)) continue;
      setUpload({ index: chunk.index, total: prepared.chunks.length });
      const path = `${id}/chunk-${chunk.index}.mp3`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, chunk.blob, { contentType: "audio/mpeg", upsert: true });
      if (upErr) throw new Error(`No se pudo subir la parte ${chunk.index + 1}: ${upErr.message}`);

      const { error: rowErr } = await supabase.from("recording_chunks").upsert(
        {
          recording_id: id,
          chunk_index: chunk.index,
          storage_path: path,
          start_seconds: chunk.startSeconds,
          duration_seconds: chunk.durationSeconds,
          size_bytes: chunk.blob.size,
          transcribed: false,
        },
        { onConflict: "recording_id,chunk_index" },
      );
      if (rowErr) throw new Error(`No se pudo registrar la parte ${chunk.index + 1}: ${rowErr.message}`);
      uploadedRef.current.add(chunk.index);
    }
    setUpload(null);
    return id;
  };

  // ---- 3) Pipeline de IA ----
  const process = async (id: string, signal: AbortSignal) => {
    setPhase("processing");
    setStartedAt({ at: Date.now(), progress: live?.progress ?? 0 });
    const onStep = (res: StepResponse) =>
      mergeLive({
        status: res.status,
        progress: res.progress,
        current_step: res.current_step,
        chunks_done: res.chunks_done,
        chunks_total: res.chunks_total,
        error_message: res.error ?? null,
      });
    const final = await runPipeline(id, { signal, onStep });
    if (final.status === "ready") {
      setPhase("done");
      onFinished?.();
      router.refresh();
    } else {
      throw new Error(final.error ?? "El procesamiento terminó en un estado inesperado.");
    }
  };

  const start = async () => {
    if (!file) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setFailedAt(null);
    let prepared: PreparedAudio;
    try {
      prepared = preparedRef.current ?? (await prepare(controller.signal));
    } catch (err) {
      if (controller.signal.aborted) return;
      fail("prepare", err);
      return;
    }
    let id: string;
    try {
      id = await uploadAll(prepared, controller.signal);
    } catch (err) {
      if (controller.signal.aborted) return;
      fail("upload", err);
      return;
    }
    // Las partes ya están en el servidor: liberamos memoria.
    preparedRef.current = null;
    try {
      await process(id, controller.signal);
    } catch (err) {
      if (controller.signal.aborted) return;
      fail("process", err);
    }
  };

  const retry = async () => {
    if (failedAt === "process" && recordingId) {
      const controller = new AbortController();
      abortRef.current = controller;
      setError(null);
      try {
        await process(recordingId, controller.signal);
      } catch (err) {
        if (!controller.signal.aborted) fail("process", err);
      }
      return;
    }
    if (failedAt === "upload" && preparedRef.current) {
      void start();
      return;
    }
    // Falló la preparación o perdimos los datos en memoria: volver a elegir.
    preparedRef.current = null;
    uploadedRef.current = new Set();
    setRecordingId(null);
    setPhase(file ? "selected" : "idle");
    setError(null);
    setFailedAt(null);
  };

  const cancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (phase === "processing" && recordingId) {
      // El estado queda guardado en la DB; se puede reanudar desde la lista.
      setPhase("error");
      setFailedAt("process");
      setError("Procesamiento pausado. Podés reanudarlo cuando quieras: el avance quedó guardado.");
      router.refresh();
      return;
    }
    reset();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (busy) return;
    pick(e.dataTransfer.files?.[0] ?? null);
  };

  return (
    <section aria-label="Subir grabación" className="flex flex-col gap-4">
      <AnimatePresence mode="wait" initial={false}>
        {phase === "idle" && (
          <motion.div
            key="drop"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                "campus-grid campus-grid-fade group relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-10 text-center transition-colors",
                dragging ? "border-accent bg-accent/10" : "border-border hover:border-accent/60 hover:bg-surface-2/60",
              )}
            >
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                className="sr-only"
                onChange={(e) => pick(e.target.files?.[0] ?? null)}
                aria-label="Elegir archivo de audio o video"
              />
              <span className="flex size-12 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10 text-accent transition-transform group-hover:scale-105">
                <Upload className="size-5" aria-hidden />
              </span>
              <span className="text-sm font-semibold">Arrastrá la grabación de la clase o tocá para elegirla</span>
              <span className="max-w-md text-xs leading-relaxed text-muted">
                MP3, M4A, WAV, WebM, OGG o video MP4. Se comprime en tu navegador antes de subir (≈ 90 % menos datos) y la
                IA genera resumen, placas, versión simple y transcripción.
              </span>
              <span className="eyebrow">Hasta {formatBytes(MAX_FILE_BYTES)}</span>
            </label>
          </motion.div>
        )}

        {phase === "selected" && file && (
          <motion.div
            key="selected"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-2/50 p-4 sm:p-5"
          >
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-accent-2/30 bg-accent-2/10 text-accent-2">
                <FileAudio className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="font-mono text-[11px] uppercase tracking-widest text-muted">
                  {formatBytes(file.size)} · {file.type || "tipo desconocido"}
                </p>
              </div>
              <Button variant="ghost" size="icon" aria-label="Quitar archivo" onClick={reset}>
                <X className="size-4" />
              </Button>
            </div>
            <Field label="Título de la grabación" htmlFor="recording-title" hint="Lo ven los estudiantes">
              <Input
                id="recording-title"
                value={title}
                maxLength={160}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Por ejemplo: Clase 4 — Consentimiento informado"
              />
            </Field>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted">
                Se comprime a MP3 {TARGET_BITRATE_KBPS} kbps mono (≈ {formatBytes(estimateMp3Bytes(3600))} por hora de clase).
                Mantené esta pestaña abierta hasta que termine de subir.
              </p>
              <Button onClick={() => void start()} leftIcon={<Sparkles />} disabled={!title.trim()}>
                Subir y procesar
              </Button>
            </div>
          </motion.div>
        )}

        {(busy || phase === "done" || phase === "error") && (
          <motion.div
            key="progress"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "flex flex-col gap-4 rounded-2xl border p-4 sm:p-5",
              phase === "done" ? "border-success/40 bg-success/5" : phase === "error" ? "border-danger/40 bg-danger/5" : "border-accent/40 bg-accent/5",
            )}
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl border",
                  phase === "done"
                    ? "border-success/30 bg-success/10 text-success"
                    : phase === "error"
                      ? "border-danger/30 bg-danger/10 text-danger"
                      : "border-accent/30 bg-accent/10 text-accent",
                )}
              >
                {phase === "done" ? (
                  <CheckCircle2 className="size-5" aria-hidden />
                ) : (
                  <AudioLines className={cn("size-5", busy && "animate-pulse")} aria-hidden />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{title || file?.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {savings && (
                    <Badge tone="accent-2" size="sm">
                      <ArrowDownToLine className="size-3" aria-hidden />
                      de {formatBytes(savings.from)} a {formatBytes(savings.to)}
                    </Badge>
                  )}
                  {savings && (
                    <Badge tone="muted" size="sm">
                      {formatDuration(savings.seconds)} · {savings.chunks} {savings.chunks === 1 ? "parte" : "partes"}
                    </Badge>
                  )}
                </div>
              </div>
              {busy && (
                <Button variant="ghost" size="sm" onClick={cancel}>
                  {phase === "processing" ? "Pausar" : "Cancelar"}
                </Button>
              )}
            </div>

            {/* Fases locales (antes de que exista progreso en la DB) */}
            {(phase === "decoding" || phase === "resampling" || phase === "compressing" || phase === "creating" || phase === "uploading") && (
              <div className="flex flex-col gap-2" aria-live="polite">
                <Progress
                  value={
                    phase === "compressing"
                      ? prep?.percent ?? 0
                      : phase === "uploading" && upload
                        ? Math.round(((upload.index + 0.5) / upload.total) * 100)
                        : 0
                  }
                  indeterminate={phase === "decoding" || phase === "resampling" || phase === "creating"}
                  tone="accent-2"
                  showValue={phase === "compressing" || phase === "uploading"}
                  label={phase === "uploading" ? "Subida" : "Preparación local"}
                />
                <p className="text-xs font-medium text-foreground">{phaseLabel(phase, prep, upload)}</p>
              </div>
            )}

            {(phase === "processing" || phase === "done" || (phase === "error" && failedAt === "process")) && live && (
              <PipelineProgress
                status={phase === "done" ? "ready" : live.status}
                progress={live.progress}
                currentStep={live.current_step}
                chunksDone={live.chunks_done}
                chunksTotal={live.chunks_total}
                running={phase === "processing"}
                errorMessage={phase === "error" ? null : live.error_message}
                startedAt={startedAt}
              />
            )}

            {phase === "error" && error && (
              <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm leading-relaxed text-danger">
                {error}
              </p>
            )}

            {phase === "done" && (
              <p className="text-sm text-muted">
                Material generado. Revisalo en la lista de abajo y, cuando esté bien, publicalo para los estudiantes.
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              {phase === "error" && (
                <Button variant="secondary" size="sm" leftIcon={<RefreshCw />} onClick={() => void retry()}>
                  {failedAt === "process" ? "Reanudar procesamiento" : "Reintentar"}
                </Button>
              )}
              {(phase === "done" || phase === "error") && (
                <Button variant="ghost" size="sm" onClick={reset}>
                  Subir otra grabación
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {phase === "idle" && error && (
        <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
