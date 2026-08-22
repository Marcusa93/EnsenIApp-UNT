import * as React from "react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string | null | undefined;
  src?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
}

const sizes = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-base",
} as const;

/** Color determinístico a partir del nombre (para que cada persona tenga "su" tinte). */
function hue(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

export function Avatar({ name, src, size = "md", className, ...props }: AvatarProps) {
  const label = name ?? "Usuario";
  const h = hue(label);
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border font-mono font-semibold uppercase",
        sizes[size],
        className,
      )}
      style={{
        background: `linear-gradient(135deg, hsl(${h} 70% 55% / 0.35), hsl(${(h + 60) % 360} 70% 55% / 0.15))`,
      }}
      title={label}
      {...props}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={label} className="size-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        <span aria-hidden>{initials(label)}</span>
      )}
      <span className="sr-only">{label}</span>
    </span>
  );
}
