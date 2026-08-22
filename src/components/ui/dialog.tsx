"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  /** Acciones al pie (botones). */
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  /** Si es false, no cierra con Esc ni click afuera (procesos en curso). */
  dismissable?: boolean;
  className?: string;
}

const sizes = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" } as const;

/** Modal accesible sobre <dialog> nativo: focus trap, Esc, backdrop y scroll-lock gratis. */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
  dismissable = true,
  className,
}: DialogProps) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();
  const descId = React.useId();

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const onCancel = (e: React.SyntheticEvent<HTMLDialogElement>) => {
    e.preventDefault();
    if (dismissable) onOpenChange(false);
  };

  const onBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (!dismissable) return;
    if (e.target === ref.current) onOpenChange(false);
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={onCancel}
      onClose={() => open && onOpenChange(false)}
      onClick={onBackdropClick}
      className={cn(
        "m-auto w-[calc(100%-2rem)] rounded-2xl border border-border bg-surface p-0 text-foreground shadow-2xl backdrop:bg-transparent",
        "max-h-[calc(100dvh-2rem)] overflow-hidden",
        sizes[size],
        className,
      )}
    >
      <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold leading-snug tracking-tight">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-sm text-muted">
                {description}
              </p>
            )}
          </div>
          {dismissable && (
            <Button
              variant="ghost"
              size="icon"
              className="-mr-2 -mt-1 size-9"
              aria-label="Cerrar"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-4" />
            </Button>
          )}
        </header>
        {children && <div className="overflow-y-auto px-5 py-4 sm:px-6">{children}</div>}
        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3 sm:px-6">
            {footer}
          </footer>
        )}
      </div>
    </dialog>
  );
}
