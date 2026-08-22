import Link from "next/link";
import {
  ArrowRight,
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
import { Brand, BrandMark } from "@/components/shell/brand";
import { Reveal, RevealGroup, RevealItem } from "@/components/shell/reveal";
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
    tone: "accent-2",
  },
  {
    icon: MessageCircleQuestionMark,
    title: "Consultas y check-ins",
    desc: "Preguntá cuando lo necesites (respuesta IA inmediata, luego docente) y contá qué te costó de cada clase.",
    tone: "accent-3",
  },
  {
    icon: FileText,
    title: "Informes a demanda",
    desc: "El equipo docente pide informes de uso, dificultades y consultas cuando los necesita, generados con IA sobre datos propios.",
    tone: "accent",
  },
];

const PIPELINE = [
  { label: "Grabación", icon: Mic },
  { label: "Transcripción", icon: FileText },
  { label: "Resumen", icon: Brain },
  { label: "Placas", icon: Layers },
];

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

function groupFaculty(faculty: Faculty[]) {
  const groups = new Map<string, Faculty[]>();
  for (const f of faculty) {
    const key = f.position.replace(/a$/i, "").replace(/Profesora/i, "Profesor");
    const list = groups.get(key) ?? [];
    list.push(f);
    groups.set(key, list);
  }
  return Array.from(groups.entries());
}

export default async function Home() {
  const { description, faculty } = await loadData();
  const groups = groupFaculty(faculty);

  return (
    <main className="relative flex-1 overflow-hidden">
      {/* Fondo: grilla + auroras */}
      <div className="campus-grid campus-grid-fade pointer-events-none absolute inset-x-0 top-0 h-[900px]" aria-hidden />
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in srgb, var(--accent) 55%, transparent), transparent 70%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute right-[-10%] top-[420px] h-[420px] w-[520px] rounded-full opacity-30 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in srgb, var(--accent-2) 50%, transparent), transparent 70%)",
        }}
        aria-hidden
      />

      {/* Header */}
      <header className="relative z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
          <Brand />
          <nav className="flex items-center gap-2" aria-label="Portada">
            <a
              href="#campus"
              className="hidden rounded-xl px-3 py-2 text-sm text-muted transition hover:text-foreground sm:inline-flex"
            >
              El campus
            </a>
            <a
              href="#catedra"
              className="hidden rounded-xl px-3 py-2 text-sm text-muted transition hover:text-foreground sm:inline-flex"
            >
              Cátedra
            </a>
            <Button asChild variant="secondary" size="sm">
              <Link href="/login">Ingresar</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-20 pt-12 sm:px-8 sm:pt-20 lg:pb-28">
        <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <Reveal inView={false}>
              <div className="mb-6 flex flex-wrap items-center gap-2">
                <Badge tone="accent-2" dot live>
                  Ciclo 2026
                </Badge>
                <span className="eyebrow">Facultad de Derecho · Universidad Nacional de Tucumán</span>
              </div>
            </Reveal>
            <Reveal inView={false} delay={0.08}>
              <h1 className="max-w-3xl text-[2.6rem] font-semibold leading-[1.02] tracking-tight sm:text-6xl lg:text-[4.4rem]">
                Derecho de las <span className="text-gradient">Nuevas Tecnologías</span> y Bioderecho
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
                    <dd className="mt-1 text-xl font-semibold tracking-tight">{v}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>

          {/* Panel visual: pipeline de clase */}
          <Reveal inView={false} delay={0.2} y={28} className="relative">
            <div className="glass relative overflow-hidden rounded-3xl p-6 shadow-2xl sm:p-7">
              <div className="mb-5 flex items-center justify-between">
                <span className="eyebrow">Clase 03 · Datos personales</span>
                <Badge tone="success" dot live size="sm">
                  Publicada
                </Badge>
              </div>
              <ol className="relative flex flex-col gap-3">
                <span className="absolute left-[19px] top-4 bottom-4 w-px bg-gradient-to-b from-accent via-accent-2 to-accent-3 opacity-60" aria-hidden />
                {PIPELINE.map((step, i) => (
                  <li
                    key={step.label}
                    className="relative flex items-center gap-4 rounded-2xl border border-border bg-surface/70 px-3 py-3 animate-fade-up"
                    style={{ animationDelay: `${400 + i * 120}ms` }}
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-xl border",
                        i === 0 && "border-accent/40 bg-accent/15 text-accent",
                        i === 1 && "border-accent/40 bg-accent/15 text-accent",
                        i === 2 && "border-accent-2/40 bg-accent-2/15 text-accent-2",
                        i === 3 && "border-accent-3/40 bg-accent-3/15 text-accent-3",
                      )}
                    >
                      <step.icon className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{step.label}</p>
                      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-2">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            i < 3 ? "w-full bg-accent-2" : "w-2/3 skeleton-shimmer",
                          )}
                        />
                      </div>
                    </div>
                    <span className="font-mono text-[10px] tabular-nums text-muted">{i < 3 ? "100%" : "67%"}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-5 grid grid-cols-3 gap-2">
                {[
                  ["24", "placas"],
                  ["1 h 12", "de clase"],
                  ["2", "niveles simples"],
                ].map(([v, k]) => (
                  <div key={k} className="rounded-xl border border-border bg-surface/60 px-3 py-2">
                    <p className="font-mono text-sm font-semibold tabular-nums">{v}</p>
                    <p className="eyebrow text-[9px]">{k}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-widest text-muted">
                Vista ilustrativa del pipeline
              </p>
            </div>
            <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[2.5rem] bg-accent/20 blur-3xl" aria-hidden />
          </Reveal>
        </div>
      </section>

      {/* Ejes */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 py-16 sm:px-8" aria-labelledby="ejes">
        <Reveal>
          <span className="eyebrow">Programa</span>
          <h2 id="ejes" className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Dos ejes, una misma pregunta: <span className="text-gradient">¿qué hace el derecho frente a lo nuevo?</span>
          </h2>
        </Reveal>
        <RevealGroup className="mt-10 grid gap-5 md:grid-cols-2">
          {AXES.map((axis) => (
            <RevealItem key={axis.title}>
              <article
                className={cn(
                  "group relative h-full overflow-hidden rounded-3xl border border-border bg-surface p-7 transition-colors",
                  axis.tone === "accent" ? "hover:border-accent/50" : "hover:border-accent-2/50",
                )}
              >
                <div
                  className={cn(
                    "pointer-events-none absolute -right-16 -top-16 size-48 rounded-full opacity-[0.12] blur-3xl transition-opacity group-hover:opacity-30",
                    axis.tone === "accent" ? "bg-accent" : "bg-accent-2",
                  )}
                  aria-hidden
                />
                <div className="flex items-center justify-between">
                  <span className={cn("eyebrow", axis.tone === "accent" ? "text-accent" : "text-accent-2")}>{axis.eyebrow}</span>
                  <axis.icon className={cn("size-6", axis.tone === "accent" ? "text-accent" : "text-accent-2")} aria-hidden />
                </div>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight">{axis.title}</h3>
                <ul className="mt-5 flex flex-wrap gap-2">
                  {axis.items.map((it) => (
                    <li
                      key={it}
                      className="rounded-full border border-border bg-surface-2/60 px-3 py-1 text-xs text-muted transition group-hover:text-foreground"
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
          <span className="eyebrow">El campus</span>
          <h2 id="campus-h" className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Las clases se graban. La IA las convierte en material para estudiar.
          </h2>
          <p className="mt-4 max-w-2xl text-muted">
            Y mientras estudiás, el campus escucha: qué te costó, qué preguntaste, cómo avanzás. Con eso el equipo docente ajusta la cursada.
          </p>
        </Reveal>
        <RevealGroup className="mt-10 grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f, i) => (
            <RevealItem key={f.title}>
              <article className="group relative h-full rounded-2xl border border-border bg-surface p-6 transition-colors hover:border-accent/50">
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex size-10 items-center justify-center rounded-xl border",
                      f.tone === "accent" && "border-accent/30 bg-accent/10 text-accent",
                      f.tone === "accent-2" && "border-accent-2/30 bg-accent-2/10 text-accent-2",
                      f.tone === "accent-3" && "border-accent-3/30 bg-accent-3/10 text-accent-3",
                    )}
                  >
                    <f.icon className="size-5" aria-hidden />
                  </span>
                  <span className="font-mono text-xs text-muted">0{i + 1}</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold tracking-tight">{f.title}</h3>
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
              <span className="eyebrow">Cátedra</span>
              <h2 id="catedra-h" className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
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
            {groups.map(([position, people]) => (
              <Reveal key={position}>
                <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                  <h3 className="eyebrow pt-2">{position}</h3>
                  <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {people.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-2.5 transition-colors hover:border-accent/40"
                      >
                        <Avatar name={p.full_name} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{p.full_name}</p>
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

      {/* CTA */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <Reveal>
          <div className="border-gradient glow relative overflow-hidden rounded-3xl border border-transparent bg-surface p-8 text-center sm:p-14">
            <div className="campus-grid campus-grid-fade pointer-events-none absolute inset-0 opacity-60" aria-hidden />
            <BrandMark size={44} className="relative mx-auto" />
            <h2 className="relative mt-5 text-2xl font-semibold tracking-tight sm:text-4xl">
              Entrá con tu cuenta de Google o tu email institucional.
            </h2>
            <p className="relative mx-auto mt-3 max-w-md text-sm text-muted sm:text-base">
              Si estás en el padrón de la materia, quedás inscripto automáticamente. Si no, igual podés entrar y el equipo docente te valida.
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

      <footer className="relative z-10 border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-5 py-8 text-xs text-muted sm:flex-row sm:items-center sm:px-8">
          <span>EnsenIA UNT · Facultad de Derecho · Universidad Nacional de Tucumán</span>
          <span className="font-mono uppercase tracking-widest">Hecho con IA, para enseñar sobre IA</span>
        </div>
      </footer>
    </main>
  );
}
