"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, MoreHorizontal, Pencil, Play, RefreshCw, Trash2, ScanSearch, Wand2 } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui";
import { runPipeline, isInProgressStatus, type RecordingStatus } from "@/lib/audio/pipeline";
import { formatDuration, formatRelative, formatDateTime } from "@/lib/format";
import { errorMessage, cn } from "@/lib/utils";
import { deleteRecording, reprocessRecording, setRecordingPublished, updateRecordingTitle, type ReprocessMode } from "./actions";
import { useRecordingRealtime, type RecordingLiveState } from "./use-recording-realtime";
import { PipelineProgress } from "./pipeline-progress";
import { RecordingPreview } from "./recording-preview";

export interface RecordingRowData {
  id: string;
  title: string | null;
  status: RecordingStatus;
  progress: number;
  current_step: string | null;
  chunks_total: number;
  chunks_done: number;
  published: boolean;
  duration_seconds: number | null;
  created_at: string;
  error_message: string | null;
  has_transcript: boolean;
  has_summary: boolean;
  has_cards: boolean;
  has_simplified: boolean;
}

const STATUS_META: Record<RecordingStatus, { label: string; tone: BadgeTone }> = {
  uploaded: { label: "Subida", tone: "muted" },
  transcribing: { label: "Transcribiendo", tone: "accent-2" },
  processing: { label: "Procesando", tone: "accent-2" },
  generating: { label: "Generando", tone: "accent" },
  ready: { label: "Lista", tone: "success" },
  error: { label: "Error", tone: "danger" },
};

type Confirm = { kind: "delete" } | { kind: "reprocess"; mode: ReprocessMode } | null;

/** Fila de una grabación: estado en vivo, acciones docentes y vista previa. */
export function RecordingRow({ recording, ordinal }: { recording: RecordingRowData; ordinal: number }) {
  const router = useRouter();
  const initial = React.useMemo<RecordingLiveState>(
    () => ({
      status: recording.status,
      progress: recording.progress,
      current_step: recording.current_step,
      chunks_done: recording.chunks_done,
      chunks_total: recording.chunks_total,
      error_message: recording.error_message,
      published: recording.published,
      title: recording.title,
    }),
    [recording],
  );
  const [live, mergeLive] = useRecordingRealtime(recording.id, initial);
  const state = live ?? initial;

  const [running, setRunning] = React.useState(false);
  const [runError, setRunError] = React.useState<string | null>(null);
  const [startedAt, setStartedAt] = React.useState<{ at: number; progress: number } | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  const [pending, setPending] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState<Confirm>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [renaming, setRenaming] = React.useState(false);
  const [titleDraft, setTitleDraft] = React.useState(recording.title ?? "");
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  React.useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const resume = async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setRunError(null);
    setStartedAt({ at: Date.now(), progress: state.progress });
    try {
      const final = await runPipeline(recording.id, {
        signal: controller.signal,
        onStep: (res) =>
          mergeLive({
            status: res.status,
            progress: res.progress,
            current_step: res.current_step,
            chunks_done: res.chunks_done,
            chunks_total: res.chunks_total,
            error_message: res.error ?? null,
          }),
      });
      if (final.status !== "ready") setRunError(final.error ?? "El procesamiento no terminó.");
      router.refresh();
    } catch (err) {
      if (!controller.signal.aborted) {
        setRunError(errorMessage(err));
        router.refresh();
      }
    } finally {
      setRunning(false);
    }
  };

  const pause = () => {
    abortRef.current?.abort();
    setRunning(false);
  };

  const run = async (name: string, fn: () => Promise<{ ok: true } | { ok: false; error: string }>, after?: () => void) => {
    setPending(name);
    setActionError(null);
    setMenuOpen(false);
    try {
      const res = await fn();
      if (!res.ok) {
        setActionError(res.error);
        return;
      }
      after?.();
      router.refresh();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setPending(null);
    }
  };

  const togglePublish = () =>
    run("publish", () => setRecordingPublished(recording.id, !state.published), () => mergeLive({ status: state.status, published: !state.published }));

  const doReprocess = (mode: ReprocessMode) =>
    run(
      "reprocess",
      () => reprocessRecording(recording.id, mode),
      () => {
        setConfirm(null);
        mergeLive({
          status: mode === "full" ? "uploaded" : "processing",
          progress: mode === "full" ? 0 : 72,
          current_step: mode === "full" ? null : "compile",
          chunks_done: mode === "full" ? 0 : state.chunks_done,
          error_message: null,
          published: false,
        });
        void resume();
      },
    );

  const doDelete = () => run("delete", () => deleteRecording(recording.id), () => setConfirm(null));

  const saveTitle = () =>
    run("rename", () => updateRecordingTitle(recording.id, titleDraft), () => {
      setRenaming(false);
      mergeLive({ status: state.status, title: titleDraft.trim() });
    });

  const meta = STATUS_META[state.status];
  const inProgress = isInProgressStatus(state.status);
  const canResume = !running && (inProgress || state.status === "error");
  const title = state.title?.trim() || `Grabación ${ordinal}`;
  const hasAnything = recording.has_transcript || recording.has_summary || recording.has_cards || recording.has_simplified;

  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-surface p-4 transition-colors",
        state.published ? "border-success/30" : "border-border",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 font-mono text-[11px] text-muted">{String(ordinal).padStart(2, "0")}</span>
        <div className="min-w-0 flex-1">
          {renaming ? (
            <form
              className="flex flex-col gap-2 sm:flex-row sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                void saveTitle();
              }}
            >
              <Field label="Título" htmlFor={`title-${recording.id}`} className="flex-1">
                <Input id={`title-${recording.id}`} value={titleDraft} maxLength={160} onChange={(e) => setTitleDraft(e.target.value)} autoFocus />
              </Field>
              <div className="flex gap-2">
                <Button type="submit" size="sm" loading={pending === "rename"} disabled={!titleDraft.trim()}>
                  Guardar
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setRenaming(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="truncate text-sm font-semibold">{title}</h4>
              <Badge size="sm" tone={meta.tone} dot live={running || (inProgress && !running ? false : running)}>
                {meta.label}
              </Badge>
              {state.published && (
                <Badge size="sm" tone="success">
                  <Eye className="size-3" aria-hidden /> Publicada
                </Badge>
              )}
            </div>
          )}
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted">
            <time dateTime={recording.created_at} title={formatDateTime(recording.created_at)}>
              {formatRelative(recording.created_at)}
            </time>
            {recording.duration_seconds != null && <> · {formatDuration(recording.duration_seconds)}</>}
            {state.chunks_total > 0 && <> · {state.chunks_total} {state.chunks_total === 1 ? "parte" : "partes"}</>}
          </p>
        </div>

        <div ref={menuRef} className="relative shrink-0">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Más acciones"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            disabled={pending !== null}
          >
            <MoreHorizontal className="size-4" />
          </Button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 z-20 mt-1 flex w-60 flex-col gap-0.5 rounded-xl border border-border bg-surface p-1 shadow-2xl animate-fade-in"
            >
              <MenuItem icon={<Pencil />} onClick={() => { setMenuOpen(false); setTitleDraft(state.title ?? ""); setRenaming(true); }}>
                Renombrar
              </MenuItem>
              <MenuItem
                icon={<Wand2 />}
                disabled={running || !recording.has_transcript}
                onClick={() => { setMenuOpen(false); setConfirm({ kind: "reprocess", mode: "content" }); }}
              >
                Regenerar material (sin transcribir)
              </MenuItem>
              <MenuItem icon={<RefreshCw />} disabled={running} onClick={() => { setMenuOpen(false); setConfirm({ kind: "reprocess", mode: "full" }); }}>
                Reprocesar desde cero
              </MenuItem>
              <MenuItem icon={<Trash2 />} danger disabled={running} onClick={() => { setMenuOpen(false); setConfirm({ kind: "delete" }); }}>
                Eliminar grabación
              </MenuItem>
            </div>
          )}
        </div>
      </div>

      {(inProgress || state.status === "error" || running) && (
        <PipelineProgress
          status={state.status}
          progress={state.progress}
          currentStep={state.current_step}
          chunksDone={state.chunks_done}
          chunksTotal={state.chunks_total}
          running={running}
          errorMessage={runError ?? state.error_message}
          startedAt={startedAt}
          size="sm"
        />
      )}

      {actionError && (
        <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {actionError}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {canResume && (
          <Button size="sm" leftIcon={state.status === "error" ? <RefreshCw /> : <Play />} onClick={() => void resume()}>
            {state.status === "error" ? "Reintentar" : "Reanudar procesamiento"}
          </Button>
        )}
        {running && (
          <Button size="sm" variant="secondary" onClick={pause}>
            Pausar
          </Button>
        )}
        {hasAnything && (
          <Button size="sm" variant="secondary" leftIcon={<ScanSearch />} onClick={() => setPreviewOpen(true)}>
            Vista previa
          </Button>
        )}
        {state.status === "ready" && (
          <Button
            size="sm"
            variant={state.published ? "ghost" : "primary"}
            leftIcon={state.published ? <EyeOff /> : <Eye />}
            loading={pending === "publish"}
            onClick={() => void togglePublish()}
          >
            {state.published ? "Despublicar" : "Publicar para estudiantes"}
          </Button>
        )}
      </div>

      <RecordingPreview recordingId={recording.id} title={title} open={previewOpen} onOpenChange={setPreviewOpen} />

      <Dialog
        open={confirm?.kind === "delete"}
        onOpenChange={(o) => !o && setConfirm(null)}
        size="sm"
        title="¿Eliminar esta grabación?"
        description="Se borran el audio, la transcripción y todo el material generado. Esta acción no se puede deshacer."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancelar
            </Button>
            <Button variant="danger" loading={pending === "delete"} onClick={() => void doDelete()}>
              Eliminar
            </Button>
          </>
        }
      />

      <Dialog
        open={confirm?.kind === "reprocess"}
        onOpenChange={(o) => !o && setConfirm(null)}
        size="sm"
        title={confirm?.kind === "reprocess" && confirm.mode === "full" ? "¿Reprocesar desde cero?" : "¿Regenerar el material?"}
        description={
          confirm?.kind === "reprocess" && confirm.mode === "full"
            ? "Se vuelve a transcribir el audio completo y se regenera todo el material. La grabación se despublica hasta que termine."
            : "Se conserva la transcripción y se vuelven a generar resumen, placas y versiones simples. La grabación se despublica hasta que termine."
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancelar
            </Button>
            <Button
              loading={pending === "reprocess"}
              onClick={() => confirm?.kind === "reprocess" && void doReprocess(confirm.mode)}
            >
              Confirmar
            </Button>
          </>
        }
      />
    </li>
  );
}

function MenuItem({
  icon,
  danger,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: React.ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40 [&>svg]:size-4",
        danger ? "text-danger hover:bg-danger/10" : "text-foreground hover:bg-surface-2",
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
