"use client";

import * as React from "react";
import { ShieldCheck } from "lucide-react";
import { Button, Dialog } from "@/components/ui";
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
    <Dialog
      open={visible}
      onOpenChange={() => {}}
      dismissable={false}
      size="lg"
      title={
        <span className="inline-flex items-center gap-2 font-extrabold">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-accent-2/30 bg-accent-2/10 text-accent-2">
            <ShieldCheck className="size-3.5" aria-hidden />
          </span>
          {TITULO}
        </span>
      }
      description="Se pregunta una sola vez. Podés cambiar tu respuesta cuando quieras."
      footer={
        <>
          <Button
            variant="secondary"
            className="flex-1 sm:flex-none"
            onClick={() => void decidir(false)}
            disabled={enviando !== null}
            loading={enviando === "no"}
          >
            No participar
          </Button>
          <Button
            className="flex-1 sm:flex-none"
            onClick={() => void decidir(true)}
            disabled={enviando !== null}
            loading={enviando === "si"}
          >
            Acepto participar
          </Button>
        </>
      }
    >
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

        <p className="pleca text-[11px] leading-relaxed text-muted">{CONTACTO}</p>

        {error && (
          <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
