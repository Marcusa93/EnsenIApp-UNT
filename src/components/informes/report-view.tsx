import * as React from "react";
import { Markdown } from "@/components/markdown";
import { Card, CardHeader, CardTitle } from "@/components/ui";
import { cn } from "@/lib/utils";

interface Section {
  title: string;
  body: string;
}

/** Separa el Markdown del informe en secciones por encabezado de nivel 2. */
export function splitSections(md: string): { intro: string; sections: Section[] } {
  const lines = md.split(/\r?\n/);
  const sections: Section[] = [];
  const intro: string[] = [];
  let current: Section | null = null;
  for (const line of lines) {
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (m) {
      if (current) sections.push(current);
      current = { title: m[1], body: "" };
      continue;
    }
    if (current) current.body += `${line}\n`;
    else intro.push(line);
  }
  if (current) sections.push(current);
  return { intro: intro.join("\n").trim(), sections };
}

/** Extrae cifras destacadas (**12 %**, **3,4**, **45 estudiantes**) de un texto Markdown. */
export function extractHighlights(md: string, max = 6): string[] {
  const out: string[] = [];
  const re = /\*\*([^*\n]{1,40})\*\*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) && out.length < max) {
    const t = m[1].trim();
    if (/\d/.test(t) && !out.includes(t)) out.push(t);
  }
  return out;
}

const SECTION_TONE: Record<string, string> = {
  "resumen ejecutivo": "border-l-accent",
  "hallazgos con evidencia": "border-l-accent-2",
  "qué les cuesta a los estudiantes": "border-l-accent-3",
  "recomendaciones para la próxima clase": "border-l-success",
  "recomendaciones para el campus": "border-l-success",
  "preguntas abiertas para el equipo docente": "border-l-warning",
};

export interface ReportViewProps {
  markdown: string;
}

/** Render de informe: métricas destacadas + secciones como tarjetas con acento lateral. */
export function ReportView({ markdown }: ReportViewProps) {
  const { intro, sections } = splitSections(markdown);
  const highlights = extractHighlights(markdown);

  if (sections.length === 0) {
    return (
      <Card>
        <Markdown>{markdown}</Markdown>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {highlights.length > 0 && (
        <section aria-label="Cifras destacadas" className="flex flex-wrap gap-2">
          {highlights.map((h) => (
            <span
              key={h}
              className="rounded-full border border-border bg-surface px-3 py-1 font-mono text-xs tracking-wide text-foreground"
            >
              {h}
            </span>
          ))}
        </section>
      )}

      {intro && (
        <Card>
          <Markdown size="md">{intro}</Markdown>
        </Card>
      )}

      <div className="stagger flex flex-col gap-4">
        {sections.map((s, i) => {
          const tone = SECTION_TONE[s.title.trim().toLowerCase()] ?? "border-l-border";
          return (
            <Card key={`${s.title}-${i}`} className={cn("border-l-4", tone)} padding="lg">
              <CardHeader>
                <CardTitle as="h2" eyebrow={`Sección ${String(i + 1).padStart(2, "0")}`}>
                  {s.title}
                </CardTitle>
              </CardHeader>
              <Markdown size="md">{s.body.trim()}</Markdown>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
