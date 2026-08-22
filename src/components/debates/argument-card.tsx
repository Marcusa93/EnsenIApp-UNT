"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Heart, Reply, EyeOff, Eye, ChevronDown, ShieldAlert } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatRelative, formatDateTime } from "@/lib/format";
import { STANCE_META } from "./stance";
import { StanceBadge } from "./stance-badge";
import type { ArgumentView } from "./types";

export interface ArgumentCardProps {
  argument: ArgumentView;
  currentUserId: string;
  canModerate: boolean;
  /** Debate cerrado: no se puede responder ni apoyar */
  closed: boolean;
  /** Recién llegado por Realtime: resalta al entrar */
  isNew?: boolean;
  depth?: 0 | 1;
  onSupport: (argument: ArgumentView) => void;
  onReply: (argument: ArgumentView) => void;
  onHide: (argument: ArgumentView) => void;
  onRestore: (argument: ArgumentView) => void;
  /** Para las respuestas: si están desplegadas */
  className?: string;
}

const ROLE_TAG: Record<string, string> = { docente: "Docente", admin: "Equipo" };

export function ArgumentCard({
  argument,
  currentUserId,
  canModerate,
  closed,
  isNew,
  depth = 0,
  onSupport,
  onReply,
  onHide,
  onRestore,
  className,
}: ArgumentCardProps) {
  const [showReplies, setShowReplies] = React.useState(false);
  const meta = STANCE_META[argument.stance];
  const hidden = argument.status === "hidden";
  const isOwn = argument.author_id === currentUserId;
  const authorName = argument.author?.full_name ?? "Participante";
  const roleTag = argument.author ? ROLE_TAG[argument.author.role] : undefined;
  const replies = argument.replies;

  return (
    <motion.article
      layout
      initial={isNew ? { opacity: 0, y: 14, scale: 0.98 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "group relative rounded-2xl border bg-surface p-4 transition-[border-color,box-shadow] duration-300",
        depth === 0 ? meta.border : "border-border",
        hidden && "border-dashed opacity-80",
        isNew && "shadow-[0_0_0_1px_var(--accent),0_0_40px_-12px_var(--accent)]",
        className,
      )}
      aria-labelledby={`arg-${argument.id}-author`}
    >
      {/* franja de postura */}
      {depth === 0 && (
        <span
          className={cn("absolute inset-y-4 left-0 w-0.5 rounded-full", meta.bar)}
          aria-hidden
        />
      )}

      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={authorName} src={argument.author?.avatar_url} size="sm" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span id={`arg-${argument.id}-author`} className="truncate text-sm font-semibold">
                {authorName}
                {isOwn && <span className="ml-1 text-xs font-normal text-muted">(vos)</span>}
              </span>
              {roleTag && (
                <Badge tone="accent" size="sm">
                  {roleTag}
                </Badge>
              )}
            </div>
            <time
              dateTime={argument.created_at}
              title={formatDateTime(argument.created_at)}
              className="font-mono text-[11px] text-muted"
            >
              {formatRelative(argument.created_at)}
            </time>
          </div>
        </div>
        {depth === 1 ? (
          <span className={cn("font-mono text-[10px] uppercase tracking-widest", meta.text)}>{meta.label}</span>
        ) : (
          <StanceBadge stance={argument.stance} />
        )}
      </header>

      {hidden && (
        <div
          className="mt-3 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning"
          role="status"
        >
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            {isOwn ? "Tu argumento fue ocultado por el equipo docente" : "Argumento oculto por moderación"}
            {argument.hidden_reason ? `: ${argument.hidden_reason}` : "."}
          </span>
        </div>
      )}

      <p className={cn("mt-3 whitespace-pre-wrap text-sm leading-relaxed", hidden && "text-muted")}>
        {argument.content}
      </p>

      <footer className="mt-3 flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => onSupport(argument)}
          disabled={closed || hidden}
          aria-pressed={argument.supported_by_me}
          aria-label={
            argument.supported_by_me
              ? `Quitar apoyo (${argument.support_count})`
              : `Apoyar este argumento (${argument.support_count})`
          }
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 font-mono text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50",
            argument.supported_by_me
              ? "bg-accent-3/15 text-accent-3"
              : "text-muted hover:bg-surface-2 hover:text-foreground",
          )}
        >
          <motion.span
            key={argument.supported_by_me ? "on" : "off"}
            initial={{ scale: 0.6 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 18 }}
            className="inline-flex"
          >
            <Heart
              className={cn("size-3.5", argument.supported_by_me && "fill-current")}
              aria-hidden
            />
          </motion.span>
          <span className="tabular-nums">{argument.support_count}</span>
        </button>

        {depth === 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onReply(argument)}
            disabled={closed || hidden}
            leftIcon={<Reply />}
            className="font-mono text-xs"
          >
            Responder
          </Button>
        )}

        {canModerate && (
          <div className="ml-auto flex items-center gap-1">
            {hidden ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRestore(argument)}
                leftIcon={<Eye />}
                className="font-mono text-xs text-success"
              >
                Restaurar
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onHide(argument)}
                leftIcon={<EyeOff />}
                className="font-mono text-xs text-muted hover:text-warning"
              >
                Ocultar
              </Button>
            )}
          </div>
        )}
      </footer>

      {depth === 0 && replies.length > 0 && (
        <div className="mt-3 border-t border-border/70 pt-3">
          <button
            type="button"
            onClick={() => setShowReplies((v) => !v)}
            aria-expanded={showReplies}
            aria-controls={`arg-${argument.id}-replies`}
            className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <ChevronDown className={cn("size-3.5 transition-transform", showReplies && "rotate-180")} aria-hidden />
            {showReplies ? "Ocultar respuestas" : `Ver ${replies.length} ${replies.length === 1 ? "respuesta" : "respuestas"}`}
          </button>
          {showReplies && (
            <div id={`arg-${argument.id}-replies`} className="mt-3 flex flex-col gap-2 border-l border-border pl-3 sm:pl-4">
              {replies.map((r) => (
                <ArgumentCard
                  key={r.id}
                  argument={r}
                  depth={1}
                  currentUserId={currentUserId}
                  canModerate={canModerate}
                  closed={closed}
                  onSupport={onSupport}
                  onReply={onReply}
                  onHide={onHide}
                  onRestore={onRestore}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </motion.article>
  );
}
