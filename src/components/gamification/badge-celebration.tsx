"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui";

interface NewBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: "bronce" | "plata" | "oro";
}

const TIER_LABEL: Record<NewBadge["tier"], string> = { bronce: "Bronce", plata: "Plata", oro: "Oro" };

/** Cuánto vive el toast de una medalla menor antes de marcarse vista sola. */
const TOAST_MS = 6000;

/**
 * Al entrar al campus, celebra (de a una) las medallas nuevas y las marca vistas.
 *
 * La celebración es proporcional al logro: una medalla de oro interrumpe con el
 * modal a pantalla completa; bronce y plata pasan como toast que se va solo.
 * Antes TODO era modal: cada ingreso arrancaba cerrando ventanas — la fatiga de
 * celebración es real, y una medalla por entrar al campus no amerita frenarte.
 */
export function BadgeCelebration({ userId }: { userId: string }) {
  const [queue, setQueue] = React.useState<NewBadge[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("student_badges")
      .select("badge_id, badges(id, name, description, icon, tier)")
      .eq("student_id", userId)
      .eq("seen", false)
      .then(({ data, error }) => {
        if (error || cancelled || !data) return;
        const items = data
          .map((r) => r.badges as unknown as NewBadge | null)
          .filter((b): b is NewBadge => b != null);
        if (items.length > 0) setQueue(items);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const current = queue[0] ?? null;
  const esModal = current?.tier === "oro";

  const dismiss = React.useCallback(async () => {
    setQueue((q) => {
      const [primera, ...resto] = q;
      if (primera) {
        const supabase = createClient();
        void supabase
          .from("student_badges")
          .update({ seen: true })
          .eq("student_id", userId)
          .eq("badge_id", primera.id)
          .then(({ error }) => {
            if (error) console.error("[medallas] marcar vista", error);
          });
      }
      return resto;
    });
  }, [userId]);

  // Los toasts se van solos; el modal espera el clic.
  React.useEffect(() => {
    if (!current || esModal) return;
    const t = window.setTimeout(() => void dismiss(), TOAST_MS);
    return () => window.clearTimeout(t);
  }, [current, esModal, dismiss]);

  // Portal a document.body: vive dentro de la transición de página, cuyo
  // motion.div anima "y" (deja un transform aplicado) y así se convierte en el
  // marco de referencia de este overlay — quedaba encajado en el contenedor del
  // contenido en vez de posicionarse contra la pantalla.
  return createPortal(
    <AnimatePresence>
      {current && esModal && (
        // El fondo NO se anima: si la animación se interrumpe (cambiar de pestaña
        // justo al aparecer), quedaba un overlay casi invisible tapando toda la
        // pantalla y comiéndose los clics. Sólo anima la tarjeta de adentro.
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-5 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`Nueva medalla: ${current.name}`}
        >
          <motion.div
            initial={{ scale: 0.85, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 20 }}
            className="border-gradient glow w-full max-w-sm rounded-3xl border border-transparent bg-surface p-8 text-center"
          >
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.15, type: "spring", stiffness: 260, damping: 14 }}
              className="mx-auto flex size-20 items-center justify-center rounded-full border border-accent-2/40 bg-accent-2/10 text-5xl"
              aria-hidden
            >
              {current.icon}
            </motion.div>
            <p className="eyebrow mt-5 text-accent-2">¡Nueva medalla · {TIER_LABEL[current.tier]}!</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">{current.name}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{current.description}</p>
            <div className="mt-6 flex items-center justify-center gap-2">
              <Button onClick={() => void dismiss()}>
                {queue.length > 1 ? `Siguiente (${queue.length - 1} más)` : "¡Genial!"}
              </Button>
              <Button asChild variant="ghost" size="sm" onClick={() => void dismiss()}>
                <Link href="/campus/estudiante/progreso">Ver medallero</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {current && !esModal && (
        <motion.button
          key={current.id}
          type="button"
          onClick={() => void dismiss()}
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          className="border-gradient fixed bottom-20 right-4 z-[90] flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-2xl border border-transparent bg-surface px-4 py-3 text-left shadow-xl sm:bottom-6"
          aria-label={`Nueva medalla: ${current.name}. Tocar para cerrar.`}
        >
          <span
            className="flex size-11 shrink-0 items-center justify-center rounded-full border border-accent-2/40 bg-accent-2/10 text-2xl"
            aria-hidden
          >
            {current.icon}
          </span>
          <span className="min-w-0">
            <span className="eyebrow block text-[10px] text-accent-2">
              Medalla · {TIER_LABEL[current.tier]}
              {queue.length > 1 && ` · ${queue.length - 1} más`}
            </span>
            <span className="block truncate text-sm font-semibold">{current.name}</span>
            <span className="block truncate text-xs text-muted">{current.description}</span>
          </span>
        </motion.button>
      )}
    </AnimatePresence>,
    document.body,
  );
}
