import Link from "next/link";

const FEATURES = [
  {
    title: "Clases grabadas → IA",
    desc: "Cada clase se transcribe y procesa automáticamente: resumen, placas interactivas y versión en lenguaje simple.",
    accent: "text-accent",
  },
  {
    title: "Feedback personalizado",
    desc: "El campus genera devoluciones a partir del uso real de cada estudiante, no plantillas genéricas.",
    accent: "text-accent-2",
  },
  {
    title: "Consultas continuas",
    desc: "Check-ins rápidos por clase: qué costó, qué faltó — datos reales para ajustar la cursada.",
    accent: "text-accent-3",
  },
  {
    title: "Informes a demanda",
    desc: "El equipo docente pide un informe de uso y consultas cuando lo necesita, generado con IA sobre datos propios.",
    accent: "text-accent",
  },
];

export default function Home() {
  return (
    <main className="campus-grid flex-1">
      <div className="mx-auto max-w-5xl px-6 py-24">
        <div className="mb-6 flex items-center gap-2">
          <div className="h-2 w-2 animate-pulse rounded-full bg-accent-2" />
          <span className="font-mono text-xs tracking-widest text-muted uppercase">
            Facultad de Derecho · UNT
          </span>
        </div>

        <h1 className="mb-6 max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight">
          El campus de{" "}
          <span className="bg-gradient-to-r from-accent via-accent-2 to-accent-3 bg-clip-text text-transparent">
            Derecho de las Nuevas Tecnologías
          </span>{" "}
          y Bioderecho
        </h1>

        <p className="mb-10 max-w-xl text-lg text-muted">
          IA generativa, biotecnología, criptoactivos, ciberdelito. Una materia que vive en la
          frontera del derecho — con un campus que está a la altura.
        </p>

        <div className="flex gap-3">
          <Link
            href="/login"
            className="glow rounded-xl bg-accent px-6 py-3 text-sm font-medium text-white transition hover:opacity-90"
          >
            Entrar al campus
          </Link>
          <a
            href="#como-funciona"
            className="rounded-xl border border-border px-6 py-3 text-sm font-medium transition hover:border-accent"
          >
            Cómo funciona
          </a>
        </div>

        <div id="como-funciona" className="mt-28 grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border bg-surface p-6 transition hover:border-accent/60"
            >
              <p className={`mb-2 font-mono text-xs uppercase tracking-widest ${f.accent}`}>
                {f.title}
              </p>
              <p className="text-sm leading-relaxed text-muted">{f.desc}</p>
            </div>
          ))}
        </div>

        <footer className="mt-24 flex items-center justify-between border-t border-border pt-6 text-xs text-muted">
          <span>EnsenIA UNT — Facultad de Derecho</span>
          <span className="font-mono">Next.js · Supabase · OpenRouter</span>
        </footer>
      </div>
    </main>
  );
}
