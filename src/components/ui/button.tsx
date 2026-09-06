import * as React from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Renderiza el hijo (p. ej. <Link>) con los estilos del botón en vez de un <button>. */
  asChild?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const base =
  "relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl font-display font-semibold tracking-[-0.005em] transition-[background-color,border-color,color,box-shadow,transform] duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

const variants: Record<ButtonVariant, string> = {
  // Carmesí institucional: sombra cálida en vez de neón; al hover se oscurece como tinta.
  primary:
    "bg-accent text-white shadow-[0_10px_24px_-14px_var(--accent)] hover:bg-accent-deep hover:shadow-[0_14px_30px_-14px_var(--accent)]",
  secondary:
    "border border-border bg-surface text-foreground shadow-[0_1px_0_rgba(0,0,0,0.02)] hover:border-accent/50 hover:bg-surface-2",
  outline: "border border-accent/50 bg-transparent text-accent hover:bg-accent/8 hover:border-accent",
  ghost: "text-muted hover:bg-surface-2 hover:text-foreground",
  danger: "border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-[15px]",
  icon: "h-10 w-10 p-0",
};

export function buttonClasses(opts: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(base, variants[opts.variant ?? "primary"], sizes[opts.size ?? "md"], opts.className);
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = "primary",
    size = "md",
    loading = false,
    asChild = false,
    leftIcon,
    rightIcon,
    disabled,
    children,
    type,
    ...props
  },
  ref,
) {
  const classes = buttonClasses({ variant, size, className });

  if (asChild && React.isValidElement<{ className?: string }>(children)) {
    return React.cloneElement(children, {
      className: cn(classes, children.props.className),
    });
  }

  return (
    <button
      ref={ref}
      type={type ?? "button"}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
      ) : (
        leftIcon && <span className="inline-flex [&>svg]:size-4">{leftIcon}</span>
      )}
      {children}
      {rightIcon && !loading && <span className="inline-flex [&>svg]:size-4">{rightIcon}</span>}
    </button>
  );
});
