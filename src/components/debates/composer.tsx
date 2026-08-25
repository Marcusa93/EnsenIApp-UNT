"use client";

import * as React from "react";
import { Send, X, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { STANCES, STANCE_META, type DebateStance } from "./stance";
import { StanceIcon } from "./stance-badge";
import { ARGUMENT_MAX_LENGTH } from "./constants";

export interface ComposerReplyTarget {
  id: string;
  authorName: string;
  stance: DebateStance;
  excerpt: string;
}

export interface ComposerProps {
  disabled?: boolean;
  /** Motivo por el que está deshabilitado (se muestra en lugar del formulario) */
  disabledReason?: string;
  defaultStance?: DebateStance;
  replyTo?: ComposerReplyTarget | null;
  onCancelReply?: () => void;
  onSubmit: (input: { stance: DebateStance; content: string; parentId: string | null }) => Promise<{ error?: string } | void>;
  className?: string;
}

export function Composer({
  disabled,
  disabledReason,
  defaultStance = "a_favor",
  replyTo,
  onCancelReply,
  onSubmit,
  className,
}: ComposerProps) {
  const [stance, setStance] = React.useState<DebateStance>(defaultStance);
  const [content, setContent] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const id = React.useId();

  // Al responder, la postura se alinea con la del argumento respondido (ajuste durante el render).
  const [prevReplyTo, setPrevReplyTo] = React.useState(replyTo);
  if (prevReplyTo !== replyTo) {
    setPrevReplyTo(replyTo);
    if (replyTo) setStance(replyTo.stance);
  }

  React.useEffect(() => {
    if (replyTo) textareaRef.current?.focus();
  }, [replyTo]);

  const trimmed = content.trim();
  const remaining = ARGUMENT_MAX_LENGTH - content.length;
  const tooLong = remaining < 0;
  const canSend = trimmed.length > 0 && !tooLong && !pending && !disabled;

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canSend) return;
    setPending(true);
    setError(null);
    try {
      const res = await onSubmit({ stance, content: trimmed, parentId: replyTo?.id ?? null });
      if (res && "error" in res && res.error) {
        setError(res.error);
      } else {
        setContent("");
        onCancelReply?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo publicar el argumento.");
    } finally {
      setPending(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void submit();
    }
  };

  if (disabled) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-2xl border border-dashed border-border bg-surface-2/40 px-4 py-3 text-sm text-muted",
          className,
        )}
        role="status"
      >
        <Lock className="size-4 shrink-0" aria-hidden />
        {disabledReason ?? "Este debate está cerrado: ya no se pueden publicar argumentos."}
      </div>
    );
  }

  const meta = STANCE_META[stance];

  return (
    <form
      onSubmit={submit}
      className={cn(
        "rounded-2xl border bg-surface p-3 transition-[border-color] duration-300 sm:p-4",
        meta.border,
        className,
      )}
      aria-labelledby={`${id}-title`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span id={`${id}-title`} className="eyebrow">
          {replyTo ? "Responder" : "Nuevo argumento"}
        </span>
        <div role="radiogroup" aria-label="Postura" className="flex gap-1 rounded-xl border border-border bg-surface-2 p-1">
          {STANCES.map((s) => {
            const m = STANCE_META[s];
            const active = s === stance;
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setStance(s)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 font-mono text-[11px] uppercase tracking-widest transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
                  m.ring,
                  active ? cn("bg-surface shadow-sm", m.text) : "text-muted hover:text-foreground",
                )}
              >
                <StanceIcon stance={s} className="size-3" />
                <span className="hidden sm:inline">{m.label}</span>
                <span className="sm:hidden">{m.short}</span>
              </button>
            );
          })}
        </div>
      </div>

      {replyTo && (
        <div className="mb-3 flex items-start justify-between gap-2 rounded-xl border border-border bg-surface-2/60 px-3 py-2 text-xs">
          <div className="min-w-0">
            <span className="font-mono uppercase tracking-widest text-muted">En respuesta a </span>
            <span className="font-semibold">{replyTo.authorName}</span>
            <p className="mt-0.5 truncate text-muted">{replyTo.excerpt}</p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="shrink-0 rounded-md p-1 text-muted hover:bg-surface hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            aria-label="Cancelar respuesta"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      )}

      <label htmlFor={`${id}-content`} className="sr-only">
        Contenido del argumento
      </label>
      <Textarea
        ref={textareaRef}
        id={`${id}-content`}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={onKeyDown}
        rows={replyTo ? 3 : 4}
        placeholder={
          replyTo
            ? "Respondé con un argumento, una pregunta o una objeción concreta…"
            : "Fundamentá tu postura. Citá la clase, una norma o un caso si podés."
        }
        invalid={tooLong}
        aria-describedby={`${id}-count`}
        maxLength={ARGUMENT_MAX_LENGTH + 200}
        className="bg-surface-2/40"
      />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span
          id={`${id}-count`}
          className={cn(
            "font-mono text-[11px] tabular-nums",
            tooLong ? "text-danger" : remaining < 200 ? "text-warning" : "text-muted",
          )}
          aria-live="polite"
        >
          {content.length.toLocaleString("es-AR")} / {ARGUMENT_MAX_LENGTH.toLocaleString("es-AR")}
        </span>
        <div className="flex items-center gap-2">
          <span className="hidden font-mono text-[10px] uppercase tracking-widest text-muted sm:inline">
            Ctrl + Enter
          </span>
          <Button type="submit" size="sm" loading={pending} disabled={!canSend} leftIcon={<Send />}>
            {replyTo ? "Responder" : "Publicar"}
          </Button>
        </div>
      </div>

      {error && (
        <p className="mt-2 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
