import * as React from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Etiqueta mono arriba del título (p. ej. "Docente · Clases") */
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** Breadcrumb u otro contenido arriba de la cabecera */
  top?: React.ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions, top, className, ...props }: PageHeaderProps) {
  return (
    <div className={cn("mb-6 animate-fade-up sm:mb-8", className)} {...props}>
      {top && <div className="mb-3">{top}</div>}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-block size-1.5 rounded-full bg-accent-2" aria-hidden />
              <span className="eyebrow">{eyebrow}</span>
            </div>
          )}
          <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{title}</h1>
          {description && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
