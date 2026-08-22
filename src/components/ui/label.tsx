import * as React from "react";
import { cn } from "@/lib/utils";

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
  hint?: React.ReactNode;
}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(function Label(
  { className, required, hint, children, ...props },
  ref,
) {
  return (
    <label ref={ref} className={cn("mb-1.5 flex items-baseline justify-between gap-3", className)} {...props}>
      <span className="eyebrow text-foreground/80">
        {children}
        {required && (
          <span className="ml-1 text-accent-3" aria-hidden>
            *
          </span>
        )}
      </span>
      {hint && <span className="text-xs normal-case tracking-normal text-muted">{hint}</span>}
    </label>
  );
});

/** Agrupa Label + control + ayuda/error con espaciado consistente. */
export interface FieldProps {
  label: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string | null;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Field({ label, htmlFor, required, hint, error, description, children, className }: FieldProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      <Label htmlFor={htmlFor} required={required} hint={hint}>
        {label}
      </Label>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : description ? (
        <p className="mt-1.5 text-xs text-muted">{description}</p>
      ) : null}
    </div>
  );
}
