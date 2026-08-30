"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui";
import { decidirConsentimiento } from "@/lib/consentimiento/actions";
import { CONTACTO, SECCIONES, TITULO } from "@/lib/consentimiento/texto";

/**
 * El cartel del consentimiento: se muestra una vez y no vuelve.
 *
 * Los dos botones pesan lo mismo a propósito. Si "Acepto" fuera el botón
 * grande y lleno de color y "No" un texto gris chiquito, la decisión dejaría
 * de ser libre — y acá quien pregunta es el docente que después evalúa.
 *
 * No se puede cerrar tocando afuera ni con Escape: no es un aviso que se
 * descarta sin querer, es una decisión que hay que tomar. Pero tampoco
 * bloquea: se puede seguir usando el campus igual con cualquiera de las dos.
 */
export function ConsentGate() {
  const [visible, setVisible] = React.useState(true);
  const [enviando, setEnviando] = React.useState<"si" | "no" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function decidir(acepta: boolean) {
    setEnviando(acepta ? "si" : "no");
    setError(null);
    const r = await decidirConsentimiento({ acepta });
    if (!r.ok) {
      setError(r.error ?? "No pudimos guardar tu respuesta.");
      setEnviando(null);
      return;
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-titulo"
    >
      <motion.div
        initial={{ y: 24, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="border-gradient flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-transparent bg-surface"
      >
        <header className="flex items-start gap-3 border-b border-border px-5 py-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-accent-2/30 bg-accent-2/10 text-accent-2">
            <ShieldCheck className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 id="consent-titulo" className="text-base font-semibold leading-snug">
              {TITULO}
            </h2>
            <p className="mt-0.5 text-xs text-muted">Se pregunta una sola vez. Podés cambiar tu respuesta cuando quieras.</p>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="flex flex-col gap-5">
            {SECCIONES.map((s) => (
              <section key={s.titulo}>
                <h3 className="eyebrow text-[10px] text-accent-2">{s.titulo}</h3>
                {s.parrafos?.map((p, i) => (
                  <p key={i} className="mt-1.5 text-[13px] leading-relaxed text-muted">
                    {p}
                  </p>
                ))}
                {s.items && (
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {s.items.map((it, i) => (
                      <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-muted">
                        <span className="mt-[7px] size-1 shrink-0 rounded-full bg-muted" aria-hidden />
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}

            <p className="border-t border-border pt-3 text-[11px] leading-relaxed text-muted">{CONTACTO}</p>
          </div>
        </div>

        {error && (
          <p role="alert" className="mx-5 mb-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </p>
        )}

        <footer className="flex flex-col gap-2 border-t border-border px-5 py-4 sm:flex-row">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => void decidir(false)}
            disabled={enviando !== null}
            leftIcon={enviando === "no" ? <Loader2 className="animate-spin" /> : undefined}
          >
            No participar
          </Button>
          <Button
            className="flex-1"
            onClick={() => void decidir(true)}
            disabled={enviando !== null}
            leftIcon={enviando === "si" ? <Loader2 className="animate-spin" /> : undefined}
          >
            Acepto participar
          </Button>
        </footer>
      </motion.div>
    </div>
  );
}
