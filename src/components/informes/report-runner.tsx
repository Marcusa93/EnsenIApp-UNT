"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, RefreshCw, Sparkles } from "lucide-react";
import { Button, Progress } from "@/components/ui";
import { errorMessage } from "@/lib/utils";

type ReportStatus = "pending" | "processing" | "ready" | "error";

export interface ReportRunnerProps {
  reportId: string;
  status: ReportStatus;
  /** Dispara la generación al montar (llega desde el formulario con ?run=1). */
  autoRun?: boolean;
  /** Markdown listo para copiar (sólo cuando status = ready). */
  resultMd?: string | null;
}

const STEPS = [
  "Verificando permisos sobre el curso",
  "Reuniendo datos agregados del campus",
  "Analizando con el modelo",
  "Escribiendo hallazgos y recomendaciones",
];

/**
 * Controla el ciclo de vida del informe desde el cliente:
 * - llama a POST /api/reports/[id]/generate (auto o al regenerar),
 * - muestra progreso orientativo mientras dura,
 * - refresca la página al terminar para mostrar el Markdown,
 * - si el informe quedó en "processing" por otra pestaña, refresca cada 8 s.
 */
export function ReportRunner({ reportId, status, autoRun = false, resultMd }: ReportRunnerProps) {
  const router = useRouter();
  const [running, setRunning] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [step, setStep] = React.useState(0);
  const [copied, setCopied] = React.useState(false);
  const started = React.useRef(false);

  const run = React.useCallback(async () => {
    setRunning(true);
    setError(null);
    setStep(0);
    try {
      const res = await fetch(`/api/reports/${reportId}/generate`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { error?: string; status?: string };
      if (res.status === 409) {
        // Ya lo está generando otra pestaña: esperamos el refresco periódico.
        setRunning(false);
        router.refresh();
        return;
      }
      if (!res.ok) throw new Error(body.error ?? "No se pudo generar el informe.");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err, "No se pudo generar el informe."));
      router.refresh();
    } finally {
      setRunning(false);
    }
  }, [reportId, router]);

  // Auto-ejecución (una sola vez) si viene del formulario o quedó pendiente.
  // Se difiere con setTimeout para no disparar setState sincrónico dentro del efecto.
  React.useEffect(() => {
    if (started.current) return;
    if (!(autoRun || status === "pending")) return;
    started.current = true;
    const id = window.setTimeout(() => void run(), 0);
    return () => window.clearTimeout(id);
  }, [autoRun, status, run]);

  // Pasos orientativos mientras corre.
  React.useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 9000);
    return () => window.clearInterval(id);
  }, [running]);

  // Si quedó en processing (otra pestaña / recarga), refrescamos periódicamente.
  React.useEffect(() => {
    if (running || status !== "processing") return;
    const id = window.setInterval(() => router.refresh(), 8000);
    return () => window.clearInterval(id);
  }, [running, status, router]);

  const copy = async () => {
    if (!resultMd) return;
    try {
      await navigator.clipboard.writeText(resultMd);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("No se pudo copiar al portapapeles. Seleccioná el texto y copialo manualmente.");
    }
  };

  const busy = running || status === "processing";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {status === "ready" && resultMd && (
          <Button variant="secondary" onClick={copy} leftIcon={copied ? <Check /> : <Copy />} aria-live="polite">
            {copied ? "Copiado" : "Copiar Markdown"}
          </Button>
        )}
        <Button
          variant={status === "ready" ? "ghost" : "primary"}
          onClick={run}
          loading={busy}
          leftIcon={status === "ready" ? <RefreshCw /> : <Sparkles />}
        >
          {busy ? "Generando…" : status === "ready" ? "Regenerar" : "Generar informe"}
        </Button>
      </div>

      {busy && (
        <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4" role="status" aria-live="polite">
          <Progress value={0} indeterminate tone="accent-2" size="sm" label={STEPS[step]} />
          <p className="mt-2 text-xs text-muted">
            Suele tardar entre 30 segundos y 2 minutos. Podés seguir navegando; el informe queda guardado.
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
