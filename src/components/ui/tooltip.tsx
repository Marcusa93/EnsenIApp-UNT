import * as React from "react";
import { cn } from "@/lib/utils";

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: "top" | "bottom";
  className?: string;
}

/**
 * Tooltip simple (CSS, hover + focus-within). Sin portal: usar para textos cortos.
 * El hijo debe ser focusable para que funcione con teclado.
 */
export function Tooltip({ content, children, side = "top", className }: TooltipProps) {
  const id = React.useId();
  return (
    <span className="group/tt relative inline-flex">
      {React.cloneElement(children, { "aria-describedby": id } as React.HTMLAttributes<HTMLElement>)}
      <span
        role="tooltip"
        id={id}
        className={cn(
          "pointer-events-none absolute left-1/2 z-50 w-max max-w-56 -translate-x-1/2 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground opacity-0 shadow-xl transition-[opacity,transform] duration-150",
          side === "top" ? "bottom-full mb-2 translate-y-1" : "top-full mt-2 -translate-y-1",
          "group-hover/tt:translate-y-0 group-hover/tt:opacity-100 group-focus-within/tt:translate-y-0 group-focus-within/tt:opacity-100",
          className,
        )}
      >
        {content}
      </span>
    </span>
  );
}
