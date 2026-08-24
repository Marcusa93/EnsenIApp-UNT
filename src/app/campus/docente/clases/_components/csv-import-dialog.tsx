"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { FileSpreadsheet, Upload } from "lucide-react";
import { Badge, Button, Dialog, Kbd } from "@/components/ui";
import type { ImportRowInput } from "@/components/docente/class-schema";
import { importClasses, type ImportRowError } from "../actions";

export interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
}

const REQUIRED = ["fecha", "tema"] as const;
const COLUMNS = ["fecha", "tema", "docente_email", "resumen"] as const;

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}

interface ParsedState {
  rows: ImportRowInput[];
  missing: string[];
  fileName: string;
}

/** Importación masiva del cronograma: CSV con columnas fecha,tema,docente_email,resumen. */
export function CsvImportDialog({ open, onOpenChange, courseId }: CsvImportDialogProps) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = React.useState<ParsedState | null>(null);
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [rowErrors, setRowErrors] = React.useState<ImportRowError[]>([]);
  const [result, setResult] = React.useState<{ inserted: number; unresolved: string[] } | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [dragging, setDragging] = React.useState(false);

  // Limpia el estado cada vez que se abre (patrón "ajustar estado durante el render").
  const [prevOpen, setPrevOpen] = React.useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setParsed(null);
      setParseError(null);
      setError(null);
      setRowErrors([]);
      setResult(null);
    }
  }

  const handleFile = (file: File) => {
    setParseError(null);
    setError(null);
    setRowErrors([]);
    setResult(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: normalizeHeader,
      complete: (res) => {
        const fields = res.meta.fields ?? [];
        const missing = REQUIRED.filter((c) => !fields.includes(c));
        const rows: ImportRowInput[] = res.data.map((r) => ({
          fecha: r.fecha ?? "",
          tema: r.tema ?? "",
          docente_email: r.docente_email ?? "",
          resumen: r.resumen ?? "",
        }));
        if (res.errors.length && rows.length === 0) {
          setParseError(`No pudimos leer el archivo: ${res.errors[0]?.message ?? "formato inválido"}.`);
          return;
        }
        setParsed({ rows, missing, fileName: file.name });
      },
      error: (err) => setParseError(`No pudimos leer el archivo: ${err.message}`),
    });
  };

  const onImport = () => {
    if (!parsed) return;
    setError(null);
    setRowErrors([]);
    startTransition(async () => {
      const res = await importClasses({ course_id: courseId, rows: parsed.rows });
      if (!res.ok) {
        setError(res.error);
        setRowErrors(res.rowErrors ?? []);
        return;
      }
      setResult({ inserted: res.data.inserted, unresolved: res.data.unresolvedEmails });
      router.refresh();
    });
  };

  const canImport = Boolean(parsed && parsed.missing.length === 0 && parsed.rows.length > 0 && !result);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !pending && onOpenChange(o)}
      title="Importar cronograma desde CSV"
      description="Subí un archivo con las columnas fecha, tema, docente_email y resumen. Las clases se agregan a las existentes."
      size="lg"
      dismissable={!pending}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            {result ? "Cerrar" : "Cancelar"}
          </Button>
          {!result && (
            <Button onClick={onImport} disabled={!canImport} loading={pending} leftIcon={<Upload />}>
              Importar {parsed ? `${parsed.rows.length} clases` : ""}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-border bg-surface-2/60 p-3 font-mono text-xs leading-relaxed text-muted">
          <p className="eyebrow mb-1 text-foreground/80">Formato esperado</p>
          <p>
            {COLUMNS.map((c, i) => (
              <React.Fragment key={c}>
                {i > 0 && ","}
                <Kbd>{c}</Kbd>
              </React.Fragment>
            ))}
          </p>
          <p className="mt-1">2026-03-12,Introducción al bioderecho,docente@unt.edu.ar,Presentación de la materia</p>
          <p className="mt-1">Fechas en AAAA-MM-DD o DD/MM/AAAA. docente_email y resumen son opcionales.</p>
        </div>

        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
          className={
            "campus-grid campus-grid-fade flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-8 text-center transition-colors " +
            (dragging ? "border-accent bg-accent/5" : "border-border hover:border-accent/60")
          }
        >
          <span className="flex size-10 items-center justify-center rounded-xl border border-accent/20 bg-accent/10 text-accent">
            <FileSpreadsheet className="size-5" aria-hidden />
          </span>
          <span className="text-sm font-medium">{parsed ? parsed.fileName : "Arrastrá el CSV o hacé clic para elegirlo"}</span>
          <span className="text-xs text-muted">Se procesa en tu navegador; nada se sube hasta que confirmes.</span>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
        </label>

        {parseError && (
          <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
            {parseError}
          </p>
        )}

        {parsed && parsed.missing.length > 0 && (
          <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
            Faltan columnas obligatorias: {parsed.missing.join(", ")}.
          </p>
        )}

        {parsed && parsed.missing.length === 0 && !result && (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="bg-surface-2/60 font-mono text-[11px] uppercase tracking-widest text-muted">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Tema</th>
                  <th className="px-3 py-2">Docente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {parsed.rows.slice(0, 8).map((r, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 font-mono text-xs text-muted">{i + 1}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.fecha}</td>
                    <td className="max-w-[16rem] truncate px-3 py-2">{r.tema}</td>
                    <td className="truncate px-3 py-2 text-muted">{r.docente_email || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsed.rows.length > 8 && (
              <p className="border-t border-border px-3 py-2 text-xs text-muted">
                … y {parsed.rows.length - 8} filas más.
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
            <p>{error}</p>
            {rowErrors.length > 0 && (
              <ul className="mt-1 list-disc pl-5 font-mono text-xs">
                {rowErrors.slice(0, 10).map((e, i) => (
                  <li key={i}>
                    Fila {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {result && (
          <div className="rounded-xl border border-success/30 bg-success/10 px-3 py-3 text-sm" role="status">
            <p className="flex items-center gap-2">
              <Badge tone="success" dot>
                Listo
              </Badge>
              Se importaron {result.inserted} clases.
            </p>
            {result.unresolved.length > 0 && (
              <p className="mt-2 text-xs text-muted">
                No encontramos un perfil docente para: {result.unresolved.join(", ")}. Esas clases quedaron sin docente
                asignado; podés editarlas una por una.
              </p>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
