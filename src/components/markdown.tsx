import * as React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export interface MarkdownProps {
  children: string;
  className?: string;
  /** Tamaño base del texto */
  size?: "sm" | "md" | "lg";
}

const components: Components = {
  h1: ({ className, ...p }) => (
    <h1 className={cn("mt-8 mb-3 text-2xl font-semibold tracking-tight first:mt-0", className)} {...p} />
  ),
  h2: ({ className, ...p }) => (
    <h2
      className={cn("mt-8 mb-3 border-b border-border pb-2 text-xl font-semibold tracking-tight first:mt-0", className)}
      {...p}
    />
  ),
  h3: ({ className, ...p }) => (
    <h3 className={cn("mt-6 mb-2 text-lg font-semibold tracking-tight first:mt-0", className)} {...p} />
  ),
  h4: ({ className, ...p }) => <h4 className={cn("mt-5 mb-2 eyebrow text-foreground/80", className)} {...p} />,
  p: ({ className, ...p }) => <p className={cn("my-3 leading-relaxed first:mt-0 last:mb-0", className)} {...p} />,
  a: ({ className, ...p }) => (
    <a
      className={cn("font-medium text-accent-2 underline decoration-accent-2/40 underline-offset-4 hover:decoration-accent-2", className)}
      target={typeof p.href === "string" && /^https?:/.test(p.href) ? "_blank" : undefined}
      rel="noopener noreferrer"
      {...p}
    />
  ),
  ul: ({ className, ...p }) => <ul className={cn("my-3 list-disc space-y-1.5 pl-5 marker:text-accent", className)} {...p} />,
  ol: ({ className, ...p }) => (
    <ol className={cn("my-3 list-decimal space-y-1.5 pl-5 marker:font-mono marker:text-accent", className)} {...p} />
  ),
  li: ({ className, ...p }) => <li className={cn("leading-relaxed", className)} {...p} />,
  blockquote: ({ className, ...p }) => (
    <blockquote
      className={cn("my-4 border-l-2 border-accent-3/60 bg-surface-2/60 px-4 py-2 text-muted italic", className)}
      {...p}
    />
  ),
  hr: () => <hr className="my-6 border-border" />,
  strong: ({ className, ...p }) => <strong className={cn("font-semibold text-foreground", className)} {...p} />,
  code: ({ className, children, ...p }) => {
    const isBlock = typeof className === "string" && className.includes("language-");
    if (isBlock) {
      return (
        <code className={cn("font-mono text-[13px] leading-relaxed", className)} {...p}>
          {children}
        </code>
      );
    }
    return (
      <code
        className={cn("rounded-md border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[0.85em] text-accent-2", className)}
        {...p}
      >
        {children}
      </code>
    );
  },
  pre: ({ className, ...p }) => (
    <pre
      className={cn("my-4 overflow-x-auto rounded-xl border border-border bg-surface-2 p-4 text-sm", className)}
      {...p}
    />
  ),
  table: ({ className, ...p }) => (
    <div className="my-4 overflow-x-auto rounded-xl border border-border">
      <table className={cn("w-full border-collapse text-sm", className)} {...p} />
    </div>
  ),
  thead: ({ className, ...p }) => <thead className={cn("bg-surface-2", className)} {...p} />,
  th: ({ className, ...p }) => (
    <th className={cn("border-b border-border px-3 py-2 text-left eyebrow text-foreground/80", className)} {...p} />
  ),
  td: ({ className, ...p }) => <td className={cn("border-b border-border px-3 py-2 align-top last:border-b-0", className)} {...p} />,
  input: ({ className, ...p }) => (
    <input className={cn("mr-2 accent-[var(--accent)]", className)} {...p} disabled readOnly />
  ),
};

const sizes = { sm: "text-sm", md: "text-[15px]", lg: "text-base sm:text-lg" } as const;

/** Render de Markdown (GFM) con la tipografía del campus. Server-safe. */
export function Markdown({ children, className, size = "md" }: MarkdownProps) {
  return (
    <div className={cn("markdown max-w-none text-foreground", sizes[size], className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
