import * as React from "react";
import { cn } from "@/lib/utils";

export const inputClasses =
  "flex w-full rounded-xl border border-border bg-surface px-3.5 text-sm text-foreground shadow-none transition-[border-color,box-shadow] duration-200 placeholder:text-muted/70 hover:border-muted/50 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/25";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  leftIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, leftIcon, type = "text", ...props },
  ref,
) {
  if (leftIcon) {
    return (
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-muted [&>svg]:size-4">
          {leftIcon}
        </span>
        <input
          ref={ref}
          type={type}
          aria-invalid={invalid || undefined}
          className={cn(inputClasses, "h-11 pl-10", className)}
          {...props}
        />
      </div>
    );
  }
  return (
    <input
      ref={ref}
      type={type}
      aria-invalid={invalid || undefined}
      className={cn(inputClasses, "h-11", className)}
      {...props}
    />
  );
});

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, rows = 4, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(inputClasses, "min-h-24 resize-y py-3 leading-relaxed", className)}
      {...props}
    />
  );
});
