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

/**
 * Al entrar al campus, muestra (de a una) las medallas nuevas y las marca vistas.
 * Vive en el layout del campus para que la celebración aparezca en cualquier página.
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

  async function dismiss() {
    if (!current) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("student_badges")
      .update({ seen: true })
      .eq("student_id", userId)
      .eq("badge_id", current.id);
    if (error) console.error("[medallas] marcar vista", error);
    setQueue((q) => q.slice(1));
  }

  // Portal a document.body: vive dentro de la transición de página, cuyo
  // motion.div anima "y" (deja un transform aplicado) y así se convierte en el
  // marco de referencia de este overlay "fixed inset-0" — quedaba encajado en
  // el contenedor angosto/con padding del contenido en vez de cubrir la pantalla.
  return createPortal(
    <AnimatePresence>
      {current && (
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
              <Button onClick={dismiss}>{queue.length > 1 ? `Siguiente (${queue.length - 1} más)` : "¡Genial!"}</Button>
              <Button asChild variant="ghost" size="sm" onClick={dismiss}>
                <Link href="/campus/estudiante/progreso">Ver medallero</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
