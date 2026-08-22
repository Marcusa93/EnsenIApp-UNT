import Link from "next/link";
import { cn } from "@/lib/utils";

/** Isotipo: un nodo con tres órbitas (derecho · tecnología · vida). */
export function BrandMark({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id="brand-g" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--accent)" />
          <stop offset="0.55" stopColor="var(--accent-2)" />
          <stop offset="1" stopColor="var(--accent-3)" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" stroke="url(#brand-g)" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="3" fill="url(#brand-g)" />
      <path d="M16 7v6M16 19v6M7 16h6M19 16h6" stroke="url(#brand-g)" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="16" cy="7" r="1.6" fill="var(--accent-2)" />
      <circle cx="25" cy="16" r="1.6" fill="var(--accent-3)" />
      <circle cx="7" cy="16" r="1.6" fill="var(--accent)" />
    </svg>
  );
}

export function Brand({ href = "/", compact = false, className }: { href?: string; compact?: boolean; className?: string }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2.5", className)} aria-label="EnsenIA UNT">
      <BrandMark className="transition-transform duration-300 group-hover:rotate-90" />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="text-[15px] font-semibold tracking-tight">
            Ensen<span className="text-gradient">IA</span>
          </span>
          <span className="eyebrow mt-1 text-[9px]">Derecho · UNT</span>
        </span>
      )}
    </Link>
  );
}
