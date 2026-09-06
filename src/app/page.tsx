import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Brain,
  Cpu,
  Dna,
  FileText,
  Layers,
  MessageCircleQuestionMark,
  Mic,
  Scale,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type { Tables } from "@/lib/types/helpers";
import { BrandMark, DerechoLogo, InstitutionalLockup } from "@/components/shell/brand";
import { DevelopedBy } from "@/components/shell/developed-by";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Reveal, RevealGroup, RevealItem } from "@/components/shell/reveal";
import { LabBadge } from "@/components/live/lab-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export const revalidate = 3600;

/** Texto oficial de la materia (subjects.description, supabase/seed.sql). Fallback si la DB no responde. */
const SUBJECT_NAME = "Derecho de las Nuevas Tecnologías y Bioderecho en el Siglo XXI";
const SUBJECT_DESCRIPTION =
  "Materia optativa que explora, desde una mirada jurídica y prospectiva, los grandes desafíos que la tecnología y las ciencias de la vida le plantean al derecho actual. Un primer eje recorre el derecho de las nuevas tecnologías: derechos intelectuales, economía virtual y criptomonedas, ciberdelincuencia, protección de datos personales, derecho al olvido, firma digital, contratos informáticos e inteligencia artificial generativa. El segundo eje es el bioderecho: biotecnología humana, animal y vegetal, bioética, medicina de la longevidad y derechos humanos de cuarta generación frente al avance de la genética.";

const AXES = [
  {
    icon: Cpu,
    eyebrow: "Eje 1",
    title: "Derecho de las nuevas tecnologías",
    items: [
      "Derechos intelectuales",
      "Economía virtual y criptomonedas",
      "Ciberdelincuencia",
      "Protección de datos personales",
      "Derecho al olvido",
      "Firma digital y contratos informáticos",
      "Inteligencia artificial generativa",
    ],
    tone: "accent" as const,
  },
  {
    icon: Dna,
    eyebrow: "Eje 2",
    title: "Bioderecho",
    items: [
      "Biotecnología humana, animal y vegetal",
      "Bioética",
      "Medicina de la longevidad",
      "Derechos humanos de cuarta generación",
      "El avance de la genética",
    ],
    tone: "accent-2" as const,
  },
];

const FEATURES: { icon: LucideIcon; title: string; desc: string; tone: "accent" | "accent-2" | "accent-3" }[] = [
  {
    icon: Mic,
    title: "Clases grabadas → IA",
    desc: "Cada clase se transcribe y procesa automáticamente: resumen, placas interactivas (flashcards y quiz) y versión en lenguaje simple.",
    tone: "accent",
  },
  {
    icon: Sparkles,
    title: "Feedback personalizado",
    desc: "El campus genera devoluciones a partir del uso real de cada estudiante, no plantillas genéricas.",
    tone: "accent-3",
  },
  {
    icon: MessageCircleQuestionMark,
    title: "Consultas y check-ins",
    desc: "Preguntá cuando lo necesites (respuesta IA inmediata, luego docente) y contá qué te costó de cada clase.",
    tone: "accent-2",
  },
  {
    icon: FileText,
    title: "Informes a demanda",
    desc: "El equipo docente pide informes de uso, dificultades y consultas cuando los necesita, generados con IA sobre datos propios.",
    tone: "accent",
  },
];

const PIPELINE = [
  { label: "Grabación", icon: Mic, tone: "accent" },
  { label: "Transcripción", icon: FileText, tone: "accent" },
  { label: "Resumen", icon: Brain, tone: "accent-2" },
  { label: "Placas", icon: Layers, tone: "accent-3" },
] as const;

type Faculty = Tables<"faculty">;

async function loadData(): Promise<{ description: string; faculty: Faculty[] }> {
  try {
    // Cliente anónimo sin cookies: la portada es pública y se prerenderiza (ISR).
    // faculty tiene RLS de lectura pública; subjects no (anon no la ve → fallback al texto oficial).
    const supabase = createSupabaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const [subjectRes, facultyRes] = await Promise.all([
      supabase.from("subjects").select("description").eq("name", SUBJECT_NAME).maybeSingle(),
      supabase.from("faculty").select("*").order("rank", { ascending: true }).order("full_name", { ascending: true }),
    ]);
    if (facultyRes.error) console.error("[landing] faculty", facultyRes.error);
    return {
      description: subjectRes.data?.description ?? SUBJECT_DESCRIPTION,
      faculty: facultyRes.data ?? [],
    };
  } catch (err) {
    console.error("[landing] no se pudo cargar la landing desde Supabase", err);
    return { description: SUBJECT_DESCRIPTION, faculty: [] };
  }
}

/**
 * Cargos conocidos de `faculty.position` → clave canónica (unifica variantes de género)
 * y encabezado plural curado. Cargos no mapeados caen al texto original sin modificar.
 */
const POSITION_GROUPS: Record<string, { key: string; label: string }> = {
  "Profesor Titular": { key: "profesor-titular", label: "Profesores Titulares" },
  "Profesora Titular": { key: "profesor-titular", label: "Profesores Titulares" },
  "Profesor Asociado": { key: "profesor-asociado", label: "Profesores Asociados" },
  "Profesora Asociada": { key: "profesor-asociado", label: "Profesores Asociados" },
  "Profesor Adjunto": { key: "profesor-adjunto", label: "Profesores Adjuntos" },
  "Profesora Adjunta": { key: "profesor-adjunto", label: "Profesores Adjuntos" },
  "Jefe de Trabajos Prácticos": { key: "jtp", label: "Jefes de Trabajos Prácticos" },
  "Jefa de Trabajos Prácticos": { key: "jtp", label: "Jefes de Trabajos Prácticos" },
  "Docente Auxiliar": { key: "docente-auxiliar", label: "Docentes Auxiliares" },
  "Aspirante Graduado": { key: "aspirante-graduado", label: "Aspirantes Graduados/as" },
  "Aspirante Graduada": { key: "aspirante-graduado", label: "Aspirantes Graduados/as" },
  "Aspirante Estudiante": { key: "aspirante-estudiante", label: "Aspirantes Estudiantes" },
};

function groupFaculty(faculty: Faculty[]): { label: string; people: Faculty[] }[] {
  const groups = new Map<string, { label: string; people: Faculty[] }>();
  for (const f of faculty) {
    const known = POSITION_GROUPS[f.position];
    const key = known?.key ?? f.position;
    const entry = groups.get(key) ?? { label: known?.label ?? f.position, people: [] };
    entry.people.push(f);
    groups.set(key, entry);
  }
  // Map preserva el orden de inserción → se respeta el orden por rank de la consulta.
  return Array.from(groups.values());
}

const toneBox = {
  accent: "border-accent/30 bg-accent/10 text-accent",
  "accent-2": "border-accent-2/30 bg-accent-2/10 text-accent-2",
  "accent-3": "border-accent-3/30 bg-accent-3/10 text-accent-3",
} as const;

export default async function Home() {
  const { description, faculty } = await loadData();
  const groups = groupFaculty(faculty);

  return (
    <main id="contenido" tabIndex={-1} className="relative flex-1 overflow-hidden outline-none">
      {/* Fondo: trama del logo + un velo carmesí arriba a la izquierda */}
      <div className="trama campus-grid-fade pointer-events-none absolute inset-x-0 top-0 h-[820px] opacity-70" aria-hidden />
      <div
        className="pointer-events-none absolute -left-40 -top-48 h-[560px] w-[760px] rounded-full opacity-[0.16] blur-3xl"
        style={{ background: "radial-gradient(closest-side, var(--accent), transparent 70%)" }}
        aria-hidden
      />

      {/* Header */}
      <header className="relative z-10">
        <div className="brand-rule" aria-hidden />
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8 sm:py-5">
          <InstitutionalLockup logoHeight={32} />
          <nav className="flex items-center gap-1.5 sm:gap-2" aria-label="Portada">
            <a
              href="#campus"
              className="hidden rounded-xl px-3 py-2 font-display text-sm font-semibold text-muted transition hover:text-foreground md:inline-flex"
            >
              El campus
            </a>
            <a
              href="#catedra"
              className="hidden rounded-xl px-3 py-2 font-display text-sm font-semibold text-muted transition hover:text-foreground md:inline-flex"
            >
              Cátedra
            </a>
            <a
              href="#laboratorio"
              className="hidden rounded-xl px-3 py-2 font-display text-sm font-semibold text-muted transition hover:text-foreground md:inline-flex"
            >
              DYNTEC
            </a>
            <ThemeToggle className="hidden sm:flex" />
            <Button asChild size="sm">
              <Link href="/login">Ingresar</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-16 pt-10 sm:px-8 sm:pt-16 lg:pb-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <Reveal inView={false}>
              <div className="mb-6 flex flex-wrap items-center gap-2">
                <Badge tone="accent" dot live>
                  Ciclo 2026
                </Badge>
                <Badge tone="muted">Materia optativa</Badge>
                <span className="eyebrow hidden sm:inline">Facultad de Derecho y Ciencias Sociales · UNT</span>
              </div>
            </Reveal>
            <Reveal inView={false} delay={0.08}>
              <h1 className="pleca max-w-3xl font-display text-[2.5rem] font-extrabold leading-[1.02] tracking-[-0.03em] sm:text-6xl lg:text-[4.5rem]">
                Derecho de las <span className="text-accent">Nuevas Tecnologías</span> y Bioderecho
                <span className="text-muted"> en el siglo XXI.</span>
              </h1>
            </Reveal>
            <Reveal inView={false} delay={0.16}>
              <p className="mt-7 max-w-xl text-base leading-relaxed text-muted sm:text-lg">{description}</p>
            </Reveal>
            <Reveal inView={false} delay={0.24}>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Button asChild size="lg">
                  <Link href="/login">
                    Entrar al campus
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="ghost">
                  <a href="#campus">Cómo funciona</a>
                </Button>
              </div>
            </Reveal>
            <Reveal inView={false} delay={0.32}>
              <dl className="mt-12 grid max-w-lg grid-cols-3 gap-4 border-t border-border pt-6">
                {[
                  ["Optativa", "Carácter"],
                  ["2 ejes", "Programa"],
                  ["IA", "Soporte de estudio"],
                ].map(([v, k]) => (
                  <div key={k}>
                    <dt className="eyebrow">{k}</dt>
                    <dd className="display-num mt-1 text-xl sm:text-2xl">{v}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>

          {/* Panel visual: el expediente de una clase */}
          <Reveal inView={false} delay={0.2} y={28} className="relative">
            <div className="paper corners trama-scan relative overflow-hidden rounded-3xl border border-border border-t-[3px] border-t-accent bg-surface p-6 sm:p-7">
              <div className="trama pointer-events-none absolute inset-x-0 bottom-0 h-24 opacity-70 campus-grid-fade" aria-hidden />
              <div className="relative mb-5 flex items-center justify-between gap-3">
                <span className="eyebrow">Expediente · Clase 03 · Datos personales</span>
                <Badge tone="success" dot live size="sm">
                  Publicada
                </Badge>
              </div>
              <ol className="relative flex flex-col gap-3">
                <span className="absolute left-[19px] top-4 bottom-4 w-px bg-gradient-to-b from-accent via-accent-2 to-accent-3 opacity-50" aria-hidden />
                {PIPELINE.map((step, i) => (
                  <li
                    key={step.label}
                    className="relative flex items-center gap-4 rounded-2xl border border-border bg-surface/80 px-3 py-3 animate-fade-up"
                    style={{ animationDelay: `${400 + i * 120}ms` }}
                  >
                    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-xl border", toneBox[step.tone])}>
                      <step.icon className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-sm font-semibold">{step.label}</p>
                      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-2">
                        <div className={cn("h-full rounded-full", i < 3 ? "w-full bg-accent" : "w-2/3 skeleton-shimmer")} />
                      </div>
                    </div>
                    <span className="font-mono text-[10px] tabular-nums text-muted">{i < 3 ? "100%" : "67%"}</span>
                  </li>
                ))}
              </ol>
              <div className="relative mt-5 grid grid-cols-3 gap-2">
                {[
                  ["24", "placas"],
                  ["1 h 12", "de clase"],
                  ["2", "niveles simples"],
                ].map(([v, k]) => (
                  <div key={k} className="rounded-xl border border-border bg-surface/80 px-3 py-2">
                    <p className="display-num text-base">{v}</p>
                    <p className="eyebrow text-[9px]">{k}</p>
                  </div>
                ))}
              </div>
              <p className="relative mt-4 text-center font-mono text-[10px] uppercase tracking-widest text-muted">
                Vista ilustrativa del pipeline
              </p>
            </div>
            <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[2.5rem] bg-accent/10 blur-3xl" aria-hidden />
          </Reveal>
        </div>
      </section>

      {/* Ejes */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 py-16 sm:px-8" aria-labelledby="ejes">
        <Reveal>
          <span className="eyebrow text-accent">Programa</span>
          <h2 id="ejes" className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            Dos ejes, una misma pregunta: <span className="text-gradient">¿qué hace el derecho frente a lo nuevo?</span>
          </h2>
        </Reveal>
        <RevealGroup className="mt-10 grid gap-5 md:grid-cols-2">
          {AXES.map((axis) => (
            <RevealItem key={axis.title}>
              <article
                className={cn(
                  "paper group relative h-full overflow-hidden rounded-3xl border border-border border-t-[3px] bg-surface p-7 transition-colors",
                  axis.tone === "accent" ? "border-t-accent hover:border-accent/50" : "border-t-accent-2 hover:border-accent-2/50",
                )}
              >
                <div
                  className={cn(
                    "trama trama-fade-r pointer-events-none absolute inset-x-0 bottom-0 h-16 opacity-0 transition-opacity group-hover:opacity-100",
                  )}
                  aria-hidden
                />
                <div className="flex items-center justify-between">
                  <span className={cn("eyebrow", axis.tone === "accent" ? "text-accent" : "text-accent-2")}>{axis.eyebrow}</span>
                  <axis.icon className={cn("size-6", axis.tone === "accent" ? "text-accent" : "text-accent-2")} aria-hidden />
                </div>
                <h3 className="mt-3 font-display text-2xl font-extrabold tracking-tight">{axis.title}</h3>
                <ul className="mt-5 flex flex-wrap gap-2">
                  {axis.items.map((it) => (
                    <li
                      key={it}
                      className="rounded-md border border-border bg-surface-2/70 px-2.5 py-1 text-xs text-muted transition group-hover:text-foreground"
                    >
                      {it}
                    </li>
                  ))}
                </ul>
              </article>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      {/* El campus */}
      <section id="campus" className="relative z-10 mx-auto max-w-6xl scroll-mt-20 px-5 py-16 sm:px-8" aria-labelledby="campus-h">
        <Reveal>
          <span className="eyebrow text-accent">El campus</span>
          <h2 id="campus-h" className="mt-2 max-w-2xl font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            Las clases se graban. La IA las convierte en material para estudiar.
          </h2>
          <p className="mt-4 max-w-2xl text-muted">
            Y mientras estudiás, el campus escucha: qué te costó, qué preguntaste, cómo avanzás. Con eso el equipo docente ajusta la cursada.
          </p>
        </Reveal>
        <RevealGroup className="mt-10 grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f, i) => (
            <RevealItem key={f.title}>
              <article className="paper group relative h-full rounded-2xl border border-border bg-surface p-6 transition-colors hover:border-accent/50">
                <div className="flex items-center justify-between gap-3">
                  <span className={cn("flex size-10 items-center justify-center rounded-xl border", toneBox[f.tone])}>
                    <f.icon className="size-5" aria-hidden />
                  </span>
                  <span className="display-num text-2xl text-border transition-colors group-hover:text-accent/40">0{i + 1}</span>
                </div>
                <h3 className="mt-4 font-display text-lg font-bold tracking-tight">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.desc}</p>
              </article>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      {/* Cátedra */}
      <section id="catedra" className="relative z-10 mx-auto max-w-6xl scroll-mt-20 px-5 py-16 sm:px-8" aria-labelledby="catedra-h">
        <Reveal>
          <div className="flex items-end justify-between gap-4">
            <div>
              <span className="eyebrow text-accent">Cátedra</span>
              <h2 id="catedra-h" className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
                Cuerpo docente
              </h2>
            </div>
            <Scale className="hidden size-8 text-muted sm:block" aria-hidden />
          </div>
        </Reveal>
        {groups.length === 0 ? (
          <p className="mt-8 text-sm text-muted">El listado del equipo docente no está disponible en este momento.</p>
        ) : (
          <div className="mt-10 flex flex-col gap-8">
            {groups.map(({ label, people }) => (
              <Reveal key={label}>
                <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                  <h3 className="eyebrow pleca pt-2">{label}</h3>
                  <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {people.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-2.5 transition-colors hover:border-accent/40"
                      >
                        <Avatar name={p.full_name} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-display text-sm font-semibold">{p.full_name}</p>
                          <p className="truncate text-xs text-muted">{p.position}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        )}
      </section>

      {/* Laboratorio DYNTEC */}
      <section id="laboratorio" className="relative z-10 mx-auto max-w-6xl scroll-mt-20 px-5 py-16 sm:px-8" aria-labelledby="lab-h">
        <Reveal>
          <div className="paper relative overflow-hidden rounded-3xl border border-border border-t-[3px] border-t-accent-3 bg-surface p-7 sm:p-10">
            <div className="trama trama-fade-r pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-60" aria-hidden />
            <div className="relative grid items-center gap-8 md:grid-cols-[auto_1fr]">
              <LabBadge size={112} className="sello mx-auto md:mx-0" />
              <div>
                <span className="eyebrow text-accent-3">Desarrollado por</span>
                <h2 id="lab-h" className="mt-2 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
                  Laboratorio de IA, Innovación y Transformación Digital <span className="text-accent-3">DYNTEC</span>
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
                  El laboratorio de la Facultad de Derecho y Ciencias Sociales de la UNT diseña y construye EnsenIA: un
                  campus que aprende de cómo se estudia para enseñar mejor. Hecho con IA, para enseñar sobre IA.
                </p>
                <a
                  href="https://derecho.unt.edu.ar/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-editorial mt-4 inline-flex items-center gap-1.5 font-display text-sm font-semibold text-accent"
                >
                  derecho.unt.edu.ar <ArrowUpRight className="size-4" aria-hidden />
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* CTA */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <Reveal>
          <div className="corners paper relative overflow-hidden rounded-3xl border border-border bg-surface p-8 text-center sm:p-14">
            <div className="brand-rule absolute inset-x-0 top-0" aria-hidden />
            <div className="trama campus-grid-fade pointer-events-none absolute inset-0 opacity-60" aria-hidden />
            <BrandMark size={48} className="relative mx-auto" />
            <h2 className="relative mt-5 font-display text-2xl font-extrabold tracking-tight sm:text-4xl">
              Tu cuenta te la da la cátedra.
            </h2>
            <p className="relative mx-auto mt-3 max-w-md text-sm text-muted sm:text-base">
              Pasale tu email al equipo docente, entrá con la contraseña inicial y cambiala desde tu perfil. Para las clases en
              vivo alcanza con tu nombre.
            </p>
            <div className="relative mt-8">
              <Button asChild size="lg">
                <Link href="/login">
                  Ingresar al campus <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="relative z-10 border-t border-border bg-surface/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:px-8">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <a href="https://derecho.unt.edu.ar/" target="_blank" rel="noopener noreferrer" className="rounded-md focus-visible:outline-2 focus-visible:outline-ring">
              <DerechoLogo height={40} />
            </a>
            <DevelopedBy variant="card" />
          </div>
          <div className="flex flex-col items-start justify-between gap-3 border-t border-border pt-5 text-xs text-muted sm:flex-row sm:items-center">
            <span>EnsenIA UNT · Derecho de las Nuevas Tecnologías y Bioderecho · Universidad Nacional de Tucumán</span>
            <span className="eyebrow text-[10px]">Hecho con IA, para enseñar sobre IA</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
