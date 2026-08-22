import * as React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Borde degradado + leve glow: para la tarjeta protagonista de la pantalla. */
  highlight?: boolean;
  /** Hover interactivo (para tarjetas clickeables envueltas en <Link>). */
  interactive?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

const paddings = { none: "", sm: "p-4", md: "p-5 sm:p-6", lg: "p-6 sm:p-8" } as const;

export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, highlight, interactive, padding = "md", ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl border border-border bg-surface text-foreground",
        paddings[padding],
        highlight && "border-gradient border-transparent glow",
        interactive &&
          "transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-[0_12px_40px_-20px_var(--accent)]",
        className,
      )}
      {...props}
    />
  );
});

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardHeader({ className, ...props }, ref) {
    return <div ref={ref} className={cn("mb-4 flex flex-col gap-1", className)} {...props} />;
  },
);

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: "h2" | "h3" | "h4";
  /** Etiqueta mono encima del título */
  eyebrow?: React.ReactNode;
}

export const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(function CardTitle(
  { className, as: Tag = "h3", eyebrow, children, ...props },
  ref,
) {
  return (
    <>
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <Tag ref={ref} className={cn("text-base font-semibold leading-snug tracking-tight", className)} {...props}>
        {children}
      </Tag>
    </>
  );
});

export const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  function CardDescription({ className, ...props }, ref) {
    return <p ref={ref} className={cn("text-sm leading-relaxed text-muted", className)} {...props} />;
  },
);

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardContent({ className, ...props }, ref) {
    return <div ref={ref} className={cn("text-sm", className)} {...props} />;
  },
);

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardFooter({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn("mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4", className)}
        {...props}
      />
    );
  },
);
