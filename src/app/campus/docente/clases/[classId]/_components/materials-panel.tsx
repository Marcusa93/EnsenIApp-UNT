"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ExternalLink, FileText, FileWarning, Link2, Paperclip, Trash2, Upload, Video } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  Input,
  Progress,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui";
import { MATERIAL_BUCKET, type MaterialKind, type TeacherMaterial } from "@/components/docente/class-data";
import { createClient } from "@/lib/supabase/client";
import { formatBytes } from "@/lib/format";
import { errorMessage } from "@/lib/utils";
import { addMaterialLink, deleteMaterial, registerMaterialFile } from "../actions";

export interface MaterialsPanelProps {
  classId: string;
  materials: TeacherMaterial[];
}

const MAX_FILE_BYTES = 50 * 1024 * 1024;

const KIND: Record<MaterialKind, { label: string; icon: LucideIcon }> = {
  pdf: { label: "PDF", icon: FileText },
  doc: { label: "Documento", icon: FileText },
  video: { label: "Video", icon: Video },
  link: { label: "Enlace", icon: Link2 },
  otro: { label: "Archivo", icon: Paperclip },
};

function kindFromFile(file: File): MaterialKind {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf" || file.type === "application/pdf") return "pdf";
  if (["doc", "docx", "ppt", "pptx", "xls", "xlsx", "odt", "txt", "md"].includes(ext)) return "doc";
  if (file.type.startsWith("video/") || file.type.startsWith("audio/")) return "video";
  return "otro";
}

function kindFromUrl(url: string): MaterialKind {
  if (/youtube\.com|youtu\.be|vimeo\.com/i.test(url)) return "video";
  if (/\.pdf(\?|$)/i.test(url)) return "pdf";
  return "link";
}

function safeFileName(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-120);
  return base || "archivo";
}

/** Materiales de la clase: subir archivo al bucket privado, agregar enlace, listar con URL firmada y eliminar. */
export function MaterialsPanel({ classId, materials }: MaterialsPanelProps) {
  const router = useRouter();
  const formId = React.useId();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [linkTitle, setLinkTitle] = React.useState("");
  const [linkUrl, setLinkUrl] = React.useState("");
  const [linkErrors, setLinkErrors] = React.useState<Record<string, string>>({});

  const [file, setFile] = React.useState<File | null>(null);
  const [fileTitle, setFileTitle] = React.useState("");
  const [uploading, setUploading] = React.useState(false);

  const [error, setError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const submitLink = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLinkErrors({});
    startTransition(async () => {
      const res = await addMaterialLink({ class_id: classId, title: linkTitle, url: linkUrl, kind: kindFromUrl(linkUrl) });
      if (!res.ok) {
        setError(res.error);
        setLinkErrors(res.fieldErrors ?? {});
        return;
      }
      setLinkTitle("");
      setLinkUrl("");
      router.refresh();
    });
  };

  const submitFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setError(null);
    if (file.size > MAX_FILE_BYTES) {
      setError(`El archivo supera el máximo de ${formatBytes(MAX_FILE_BYTES)}.`);
      return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const path = `${classId}/${Date.now()}-${safeFileName(file.name)}`;
      const { error: upErr } = await supabase.storage.from(MATERIAL_BUCKET).upload(path, file, {
        contentType: file.type || undefined,
        upsert: false,
      });
      if (upErr) throw upErr;
      const res = await registerMaterialFile({
        class_id: classId,
        title: fileTitle.trim() || file.name,
        storage_path: path,
        kind: kindFromFile(file),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setFile(null);
      setFileTitle("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } catch (err) {
      console.error("[materiales] upload", err);
      setError(errorMessage(err, "No se pudo subir el archivo. Revisá tu conexión y probá de nuevo."));
    } finally {
      setUploading(false);
    }
  };

  const remove = (id: string) => {
    setError(null);
    setDeleting(id);
    startTransition(async () => {
      const res = await deleteMaterial(classId, id);
      setDeleting(null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle eyebrow="Bibliografía y recursos">Materiales</CardTitle>
        <CardDescription>Archivos en el bucket privado del campus o enlaces externos. Los estudiantes los descargan desde la clase.</CardDescription>
      </CardHeader>

      {error && (
        <p className="mb-3 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <Tabs defaultValue="archivo" variant="pills" className="mb-4">
        <TabsList aria-label="Tipo de material">
          <TabsTrigger value="archivo" icon={<Upload />}>
            Subir archivo
          </TabsTrigger>
          <TabsTrigger value="enlace" icon={<Link2 />}>
            Agregar enlace
          </TabsTrigger>
        </TabsList>
        <TabsContent value="archivo">
          <form onSubmit={submitFile} className="flex flex-col gap-3" noValidate>
            <Field
              label="Archivo"
              htmlFor={`${formId}-file`}
              required
              description={file ? `${file.name} · ${formatBytes(file.size)}` : `PDF, documentos, presentaciones o video. Máximo ${formatBytes(MAX_FILE_BYTES)}.`}
            >
              <Input
                id={`${formId}-file`}
                ref={fileInputRef}
                type="file"
                className="py-2 file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-1 file:text-xs file:font-medium file:text-foreground"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                disabled={uploading}
              />
            </Field>
            <Field label="Título" htmlFor={`${formId}-file-title`} hint="opcional">
              <Input
                id={`${formId}-file-title`}
                value={fileTitle}
                onChange={(e) => setFileTitle(e.target.value)}
                placeholder={file?.name ?? "Ej.: Ley 25.326 (texto completo)"}
                maxLength={160}
                disabled={uploading}
              />
            </Field>
            {uploading && <Progress value={0} indeterminate size="sm" label="Subiendo al campus" tone="accent-2" />}
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={!file} loading={uploading} leftIcon={<Upload />}>
                Subir material
              </Button>
            </div>
          </form>
        </TabsContent>
        <TabsContent value="enlace">
          <form onSubmit={submitLink} className="flex flex-col gap-3" noValidate>
            <Field label="Título" htmlFor={`${formId}-link-title`} required error={linkErrors.title}>
              <Input
                id={`${formId}-link-title`}
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
                placeholder="Ej.: Fallo CSJN sobre datos personales"
                maxLength={160}
                invalid={Boolean(linkErrors.title)}
              />
            </Field>
            <Field label="URL" htmlFor={`${formId}-link-url`} required error={linkErrors.url}>
              <Input
                id={`${formId}-link-url`}
                type="url"
                inputMode="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://…"
                invalid={Boolean(linkErrors.url)}
              />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" size="sm" loading={pending && deleting === null} leftIcon={<Link2 />}>
                Agregar enlace
              </Button>
            </div>
          </form>
        </TabsContent>
      </Tabs>

      {materials.length === 0 ? (
        <EmptyState
          compact
          tone="muted"
          icon={Paperclip}
          title="Todavía no hay materiales"
          description="Subí la bibliografía o pegá enlaces para que los estudiantes lleguen preparados."
        />
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Materiales de la clase">
          <AnimatePresence initial={false}>
            {materials.map((m) => {
              const meta = KIND[m.kind];
              const Icon = m.href ? meta.icon : FileWarning;
              return (
                <motion.li
                  key={m.id}
                  layout
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  className="flex items-center gap-3 rounded-xl border border-border bg-surface-2/60 p-3"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-accent-2 [&>svg]:size-4">
                    <Icon aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    {m.href ? (
                      <a
                        href={m.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex max-w-full items-center gap-1.5 truncate text-sm font-medium hover:text-accent"
                      >
                        <span className="truncate">{m.title}</span>
                        <ExternalLink className="size-3.5 shrink-0 text-muted" aria-hidden />
                      </a>
                    ) : (
                      <span className="block truncate text-sm font-medium">{m.title}</span>
                    )}
                    <span className="mt-0.5 flex items-center gap-2">
                      <Badge size="sm" tone={m.href ? "muted" : "warning"}>
                        {m.href ? meta.label : "No disponible"}
                      </Badge>
                      {m.storage_path && <span className="truncate font-mono text-[11px] text-muted">{m.storage_path.split("/").pop()}</span>}
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 hover:text-danger"
                    aria-label={`Eliminar ${m.title}`}
                    loading={deleting === m.id}
                    onClick={() => remove(m.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </Card>
  );
}
