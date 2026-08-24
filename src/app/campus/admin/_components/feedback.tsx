"use client";

import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Mensaje inline de error o éxito, animado, con rol apropiado para lectores de pantalla. */
export function Feedback({
  error,
  success,
  className,
}: {
  error?: string | null;
  success?: string | null;
  className?: string;
}) {
  const kind = error ? "error" : success ? "success" : null;
  const text = error ?? success ?? null;
  return (
    <AnimatePresence initial={false}>
      {kind && text && (
        <motion.p
          key={`${kind}-${text}`}
          role={kind === "error" ? "alert" : "status"}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "flex items-start gap-2 rounded-xl border px-3 py-2 text-xs",
            kind === "error"
              ? "border-danger/30 bg-danger/10 text-danger"
              : "border-success/30 bg-success/10 text-success",
            className,
          )}
        >
          {kind === "error" ? (
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          ) : (
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          )}
          <span>{text}</span>
        </motion.p>
      )}
    </AnimatePresence>
  );
}
