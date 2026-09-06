import * as React from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Etiqueta arriba del título (p. ej. "Docente · Clases") */
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** Breadcrumb u otro contenido arriba de la cabecera */
  top?: React.ReactNode;
}

/**
 * Cabecera de página con pleca carmesí: el gesto editorial que abre cada sección.
 * Título en Montserrat extrabold; descripción en Lato.
 */
export function PageHeader({ eyebrow, title, description, actions, top, className, ...props }: PageHeaderProps) {
  return (
    <div className={cn("mb-6 animate-fade-up sm:mb-8", className)} {...props}>
      {top && <div className="mb-3">{top}</div>}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="pleca min-w-0">
          {eyebrow && <div className="eyebrow mb-1.5 text-accent">{eyebrow}</div>}
          <h1 className="font-display text-[1.65rem] font-extrabold leading-[1.08] tracking-tight sm:text-[2.1rem]">
            {title}
          </h1>
          {description && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted sm:text-[15px]">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pb-1">{actions}</div>}
      </div>
    </div>
  );
}
