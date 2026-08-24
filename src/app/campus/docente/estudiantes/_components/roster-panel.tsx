"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { CheckCircle2, Download, FileUp, Plus, Trash2, UserPlus } from "lucide-react";
import { Badge, Button, Card, CardDescription, CardHeader, CardTitle, Dialog, EmptyState, Field, Input } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { deleteRosterEntry, upsertRoster } from "../actions";
import { rosterEntrySchema, type RosterEntryInput } from "./roster-schema";
import type { RosterRow } from "./students-data";
import { downloadCsv } from "./csv";

export interface RosterPanelProps {
  courseId: string;
  courseName: string;
  roster: RosterRow[];
}

interface PreviewRow {
  line: number;
  raw: Record<string, string>;
  parsed: RosterEntryInput | null;
  error: string | null;
}

const HEADER_ALIASES: Record<string, "email" | "nombre" | "dni"> = {
  email: "email",
  "e-mail": "email",
  correo: "email",
  mail: "email",
  nombre: "nombre",
  "nombre completo": "nombre",
  apellido_y_nombre: "nombre",
  "apellido y nombre": "nombre",
  name: "nombre",
  full_name: "nombre",
  dni: "dni",
  documento: "dni",
};

function normalizeHeader(h: string): string {
  const key = h.trim().toLowerCase();
  return HEADER_ALIASES[key] ?? key;
}

function parseCsv(file: File): Promise<PreviewRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: normalizeHeader,
      complete: (res) => {
        if (res.errors.length > 0 && res.data.length === 0) {
          reject(new Error(res.errors[0]?.message ?? "No se pudo leer el archivo."));
          return;
        }
        const rows: PreviewRow[] = res.data.map((raw, i) => {
          const parsed = rosterEntrySchema.safeParse({
            email: raw.email ?? "",
            nombre: raw.nombre ?? "",
            dni: raw.dni ?? "",
          });
          return {
            line: i + 2,
            raw,
            parsed: parsed.success ? parsed.data : null,
            error: parsed.success ? null : (parsed.error.issues[0]?.message ?? "Fila inválida"),
          };
        });
        resolve(rows);
      },
      error: (err) => reject(err),
    });
  });
}

export function RosterPanel({ courseId, courseName, roster }: RosterPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [preview, setPreview] = React.useState<PreviewRow[] | null>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [addForm, setAddForm] = React.useState<RosterEntryInput>({ email: "", nombre: "", dni: "" });
  const [addError, setAddError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const matched = roster.filter((r) => r.matched_profile_id).length;

  const onFile = async (file: File | null) => {
    setError(null);
    setNotice(null);
    if (!file) return;
    try {
      const rows = await parseCsv(file);
      if (rows.length === 0) throw new Error("El archivo no tiene filas. Necesita una cabecera con la columna email.");
      setPreview(rows);
      setFileName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo leer el archivo CSV.");
      setPreview(null);
    }
  };

  const confirmImport = () => {
    if (!preview) return;
    const entries = preview.map((r) => r.parsed).filter((p): p is RosterEntryInput => p != null);
    if (entries.length === 0) {
      setError("Ninguna fila es válida. Revisá la columna email.");
      return;
    }
    startTransition(async () => {
      const res = await upsertRoster({ course_id: courseId, entries });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setPreview(null);
      setFileName(null);
      if (fileRef.current) fileRef.current.value = "";
      setNotice(`Se cargaron ${res.data.upserted} filas; ${res.data.matched} ya tienen cuenta en el campus.`);
      router.refresh();
    });
  };

  const submitAdd = () => {
    const parsed = rosterEntrySchema.safeParse(addForm);
    if (!parsed.success) {
      setAddError(parsed.error.issues[0]?.message ?? "Datos inválidos.");
      return;
    }
    setAddError(null);
    startTransition(async () => {
      const res = await upsertRoster({ course_id: courseId, entries: [parsed.data] });
      if (!res.ok) {
        setAddError(res.error);
        return;
      }
      setAddOpen(false);
      setAddForm({ email: "", nombre: "", dni: "" });
      setNotice(
        res.data.matched > 0 ? "Agregado al padrón: el estudiante ya tenía cuenta y quedó validado." : "Agregado al padrón.",
      );
      router.refresh();
    });
  };

  const remove = (row: RosterRow) => {
    if (!window.confirm(`¿Eliminar a ${row.email} del padrón? No borra su cuenta ni su inscripción.`)) return;
    setDeleting(row.id);
    setError(null);
    startTransition(async () => {
      const res = await deleteRosterEntry({ course_id: courseId, roster_id: row.id });
      setDeleting(null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  const exportCsv = () =>
    downloadCsv(
      `padron-${courseName.replace(/\s+/g, "-").toLowerCase()}.csv`,
      ["email", "nombre", "dni", "registrado"],
      roster.map((r) => [r.email, r.full_name ?? "", r.dni ?? "", r.matched_profile_id ? "si" : "no"]),
    );

  const validCount = preview?.filter((r) => r.parsed).length ?? 0;
  const invalidCount = (preview?.length ?? 0) - validCount;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <Card highlight className="self-start">
        <CardHeader>
          <CardTitle as="h3" eyebrow="Carga masiva">
            Importar CSV
          </CardTitle>
          <CardDescription>
            Columnas: <code className="font-mono text-xs">email</code> (obligatoria),{" "}
            <code className="font-mono text-xs">nombre</code>, <code className="font-mono text-xs">dni</code>. Las filas
            repetidas se actualizan por email.
          </CardDescription>
        </CardHeader>

        <label
          htmlFor="roster-file"
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface-2/40 px-4 py-8 text-center transition-colors hover:border-accent/60 hover:bg-accent/5",
          )}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void onFile(e.dataTransfer.files[0] ?? null);
          }}
        >
          <FileUp className="size-6 text-accent-2" aria-hidden />
          <span className="text-sm font-medium">{fileName ?? "Arrastrá el CSV o tocá para elegirlo"}</span>
          <span className="text-xs text-muted">Hasta 2000 filas por carga</span>
          <input
            ref={fileRef}
            id="roster-file"
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
          />
        </label>

        {preview && (
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="success" dot>
                {validCount} válidas
              </Badge>
              {invalidCount > 0 && (
                <Badge tone="danger" dot>
                  {invalidCount} con error
                </Badge>
              )}
            </div>
            <div className="max-h-64 overflow-auto rounded-xl border border-border">
              <table className="w-full min-w-[420px] text-xs">
                <thead className="sticky top-0 bg-surface-2 text-left font-mono text-[10px] uppercase tracking-widest text-muted">
                  <tr>
                    <th className="px-2 py-1.5 font-medium">#</th>
                    <th className="px-2 py-1.5 font-medium">Email</th>
                    <th className="px-2 py-1.5 font-medium">Nombre</th>
                    <th className="px-2 py-1.5 font-medium">DNI</th>
                    <th className="px-2 py-1.5 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {preview.slice(0, 200).map((r) => (
                    <tr key={r.line} className={cn(r.error && "bg-danger/5")}>
                      <td className="px-2 py-1.5 font-mono text-muted">{r.line}</td>
                      <td className="px-2 py-1.5">{r.parsed?.email ?? r.raw.email ?? ""}</td>
                      <td className="px-2 py-1.5">{r.parsed?.nombre ?? r.raw.nombre ?? ""}</td>
                      <td className="px-2 py-1.5 font-mono">{r.parsed?.dni ?? r.raw.dni ?? ""}</td>
                      <td className="px-2 py-1.5">
                        {r.error ? <span className="text-danger">{r.error}</span> : <span className="text-success">OK</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length > 200 && (
                <p className="px-2 py-1.5 text-[11px] text-muted">Se previsualizan las primeras 200 filas.</p>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setPreview(null);
                  setFileName(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                disabled={pending}
              >
                Cancelar
              </Button>
              <Button onClick={confirmImport} loading={pending} leftIcon={<CheckCircle2 />} disabled={validCount === 0}>
                Cargar {validCount} {validCount === 1 ? "fila" : "filas"}
              </Button>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-3 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="mt-3 rounded-xl border border-success/30 bg-success/10 px-3.5 py-2.5 text-sm text-success">
            {notice}
          </p>
        )}
      </Card>

      <Card padding="sm" className="self-start">
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 px-2 pt-2">
          <div>
            <CardTitle as="h3" eyebrow="Padrón">
              {roster.length} {roster.length === 1 ? "estudiante" : "estudiantes"}
            </CardTitle>
            <CardDescription>
              {matched} ya se {matched === 1 ? "registró" : "registraron"} en el campus.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" leftIcon={<Download />} onClick={exportCsv} disabled={roster.length === 0}>
              Exportar
            </Button>
            <Button size="sm" leftIcon={<Plus />} onClick={() => setAddOpen(true)}>
              Agregar
            </Button>
          </div>
        </CardHeader>

        {roster.length === 0 ? (
          <EmptyState
            compact
            icon={UserPlus}
            tone="accent-2"
            title="El padrón está vacío"
            description="Importá un CSV o agregá estudiantes de a uno. Al entrar con ese email quedan validados e inscriptos."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-left font-mono text-[10px] uppercase tracking-widest text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Nombre</th>
                  <th className="px-3 py-2 font-medium">DNI</th>
                  <th className="px-3 py-2 font-medium">Registro</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {roster.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-surface-2/60">
                    <td className="px-3 py-2 font-medium">{r.email}</td>
                    <td className="px-3 py-2 text-muted">{r.full_name ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-muted">{r.dni ?? "—"}</td>
                    <td className="px-3 py-2">
                      {r.matched_profile_id ? (
                        <Badge tone="success" dot size="sm">
                          Registrado
                        </Badge>
                      ) : (
                        <span className="font-mono text-[10px] uppercase tracking-widest text-muted" title={`Cargado ${formatDate(r.created_at)}`}>
                          Sin cuenta
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Eliminar ${r.email} del padrón`}
                        loading={pending && deleting === r.id}
                        disabled={pending}
                        onClick={() => remove(r)}
                        className="text-muted hover:text-danger"
                      >
                        <Trash2 />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Agregar al padrón"
        description="Si el estudiante ya tiene cuenta con este email, queda validado e inscripto al instante."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={submitAdd} loading={pending} leftIcon={<UserPlus />}>
              Agregar
            </Button>
          </>
        }
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submitAdd();
          }}
        >
          <Field label="Email" htmlFor="roster-email" required error={addError}>
            <Input
              id="roster-email"
              type="email"
              autoComplete="off"
              value={addForm.email}
              onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="nombre@alumnos.unt.edu.ar"
              required
            />
          </Field>
          <Field label="Nombre" htmlFor="roster-name" hint="Opcional">
            <Input
              id="roster-name"
              value={addForm.nombre ?? ""}
              onChange={(e) => setAddForm((f) => ({ ...f, nombre: e.target.value }))}
            />
          </Field>
          <Field label="DNI" htmlFor="roster-dni" hint="Opcional">
            <Input
              id="roster-dni"
              inputMode="numeric"
              value={addForm.dni ?? ""}
              onChange={(e) => setAddForm((f) => ({ ...f, dni: e.target.value }))}
            />
          </Field>
          <button type="submit" className="sr-only">
            Agregar
          </button>
        </form>
      </Dialog>
    </div>
  );
}
