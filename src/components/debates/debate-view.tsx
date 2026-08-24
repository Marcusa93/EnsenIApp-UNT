"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowUpDown, CalendarDays, Radio, Sparkles, AlertCircle, Mic } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { track, useTrackPageView } from "@/lib/telemetry";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/label";
import { Textarea } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar } from "@/components/ui/avatar";
import {
  fetchArgument,
  hideArgument,
  postArgument,
  restoreArgument,
  setDebateStatus,
  toggleSupport,
} from "@/app/campus/debates/[debateId]/actions";
import { ArgumentCard } from "./argument-card";
import { Composer, type ComposerReplyTarget } from "./composer";
import { Countdown } from "./countdown";
import { ModerationBar } from "./moderation-bar";
import { StanceBalance } from "./stance-balance";
import { DebateStatusBadge, StanceIcon } from "./stance-badge";
import { STANCES, STANCE_META, emptyCounts, isDebateClosed, type DebateStance, type DebateStatus, type StanceCounts } from "./stance";
import type { ArgumentRow, ArgumentView, DebateDetail } from "./types";

export interface DebateViewProps {
  debate: DebateDetail;
  initialArguments: ArgumentView[];
  currentUserId: string;
  canModerate: boolean;
}

type SortMode = "supports" | "recent";

/* ---------------------------------------------------------------------------
 * Helpers de árbol (inmutables)
 * ------------------------------------------------------------------------- */

function findRoot(roots: ArgumentView[], id: string): ArgumentView | null {
  for (const r of roots) {
    if (r.id === id) return r;
    if (r.replies.some((c) => c.id === id)) return r;
  }
  return null;
}

function hasNode(roots: ArgumentView[], id: string): boolean {
  return roots.some((r) => r.id === id || r.replies.some((c) => c.id === id));
}

function insertNode(roots: ArgumentView[], node: ArgumentView): ArgumentView[] {
  if (hasNode(roots, node.id)) return replaceNode(roots, node);
  if (node.parent_id) {
    const root = findRoot(roots, node.parent_id);
    if (root) {
      return roots.map((r) => (r.id === root.id ? { ...r, replies: [...r.replies, node] } : r));
    }
  }
  return [...roots, { ...node, replies: [] }];
}

function replaceNode(roots: ArgumentView[], node: ArgumentView): ArgumentView[] {
  return roots.map((r) => {
    if (r.id === node.id) return { ...node, replies: r.replies };
    if (r.replies.some((c) => c.id === node.id)) {
      return { ...r, replies: r.replies.map((c) => (c.id === node.id ? { ...node, replies: [] } : c)) };
    }
    return r;
  });
}

function removeNode(roots: ArgumentView[], id: string): ArgumentView[] {
  return roots.filter((r) => r.id !== id).map((r) => ({ ...r, replies: r.replies.filter((c) => c.id !== id) }));
}

function patchNode(roots: ArgumentView[], id: string, patch: (n: ArgumentView) => ArgumentView): ArgumentView[] {
  return roots.map((r) => {
    if (r.id === id) return patch(r);
    if (r.replies.some((c) => c.id === id)) {
      return { ...r, replies: r.replies.map((c) => (c.id === id ? patch(c) : c)) };
    }
    return r;
  });
}

function countVisible(roots: ArgumentView[]): StanceCounts {
  const counts = emptyCounts();
  for (const r of roots) {
    if (r.status === "visible") counts[r.stance] += 1;
    for (const c of r.replies) if (c.status === "visible") counts[c.stance] += 1;
  }
  return counts;
}

/* ---------------------------------------------------------------------------
 * Vista principal
 * ------------------------------------------------------------------------- */

export function DebateView({ debate, initialArguments, currentUserId, canModerate }: DebateViewProps) {
  const router = useRouter();
  useTrackPageView("debate", debate.id);

  const [roots, setRoots] = React.useState<ArgumentView[]>(initialArguments);
  const [newIds, setNewIds] = React.useState<Set<string>>(() => new Set());
  const [sort, setSort] = React.useState<SortMode>("supports");
  const [activeStance, setActiveStance] = React.useState<DebateStance>("a_favor");
  const [replyTo, setReplyTo] = React.useState<ComposerReplyTarget | null>(null);
  const [status, setStatus] = React.useState<DebateStatus>(debate.status);
  const [closesAt, setClosesAt] = React.useState<string | null>(debate.closes_at);
  const [expired, setExpired] = React.useState(() => isDebateClosed({ status: debate.status, closes_at: debate.closes_at }) && debate.status === "open");
  const [synthesis, setSynthesis] = React.useState<string | null>(debate.ai_synthesis_md);
  const [live, setLive] = React.useState(false);
  const [notice, setNotice] = React.useState<{ tone: "error" | "info"; text: string } | null>(null);
  const [pending, setPending] = React.useState<"status" | "synthesis" | null>(null);
  const [hideTarget, setHideTarget] = React.useState<ArgumentView | null>(null);
  const [hideReason, setHideReason] = React.useState("");
  const [hiding, setHiding] = React.useState(false);
  const composerRef = React.useRef<HTMLDivElement>(null);

  // Sincronizar con datos frescos tras router.refresh() (ajuste de estado durante el render).
  const [prevArgs, setPrevArgs] = React.useState(initialArguments);
  if (prevArgs !== initialArguments) {
    setPrevArgs(initialArguments);
    setRoots(initialArguments);
  }
  const [prevDebate, setPrevDebate] = React.useState(debate);
  if (prevDebate !== debate) {
    setPrevDebate(debate);
    setStatus(debate.status);
    setClosesAt(debate.closes_at);
    setSynthesis(debate.ai_synthesis_md);
  }

  React.useEffect(() => {
    void track("debate_opened", { entity_type: "debate", entity_id: debate.id });
  }, [debate.id]);

  const closed = status !== "open" || expired;
  const counts = React.useMemo(() => countVisible(roots), [roots]);
  const visibleCount = counts.a_favor + counts.en_contra + counts.neutral;

  const showNotice = React.useCallback((text: string, tone: "error" | "info" = "error") => {
    setNotice({ tone, text });
    window.setTimeout(() => setNotice((n) => (n?.text === text ? null : n)), 6000);
  }, []);

  /* --------------------------- Realtime --------------------------- */
  const upsertFromServer = React.useCallback(
    async (argumentId: string, markNew: boolean) => {
      const res = await fetchArgument({ debateId: debate.id, argumentId });
      if (!res.ok) return;
      if (!res.data) {
        setRoots((prev) => removeNode(prev, argumentId));
        return;
      }
      const node = res.data;
      setRoots((prev) => insertNode(prev, node));
      if (markNew) {
        setNewIds((prev) => new Set(prev).add(node.id));
        window.setTimeout(() => {
          setNewIds((prev) => {
            const next = new Set(prev);
            next.delete(node.id);
            return next;
          });
        }, 6000);
      }
    },
    [debate.id],
  );

  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`debate:${debate.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "debate_arguments", filter: `debate_id=eq.${debate.id}` },
        (payload) => {
          const row = payload.new as ArgumentRow;
          if (row.author_id === currentUserId) return; // ya lo agregamos al publicar
          void upsertFromServer(row.id, true);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "debate_arguments", filter: `debate_id=eq.${debate.id}` },
        (payload) => {
          const row = payload.new as ArgumentRow;
          void upsertFromServer(row.id, false);
        },
      )
      .subscribe((state) => setLive(state === "SUBSCRIBED"));
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [debate.id, currentUserId, upsertFromServer]);

  /* --------------------------- Acciones --------------------------- */
  const handleSubmit = async (input: { stance: DebateStance; content: string; parentId: string | null }) => {
    const res = await postArgument({ debateId: debate.id, ...input });
    if (!res.ok) return { error: res.error };
    void track("argument_posted", {
      entity_type: "debate",
      entity_id: debate.id,
      metadata: { argument_id: res.data.id, stance: input.stance, reply: Boolean(input.parentId) },
    });
    await upsertFromServer(res.data.id, true);
    setActiveStance(input.stance);
    return undefined;
  };

  const handleSupport = async (arg: ArgumentView) => {
    const next = !arg.supported_by_me;
    setRoots((prev) =>
      patchNode(prev, arg.id, (n) => ({
        ...n,
        supported_by_me: next,
        support_count: Math.max(0, n.support_count + (next ? 1 : -1)),
      })),
    );
    const res = await toggleSupport({ debateId: debate.id, argumentId: arg.id });
    if (!res.ok) {
      setRoots((prev) =>
        patchNode(prev, arg.id, (n) => ({
          ...n,
          supported_by_me: !next,
          support_count: Math.max(0, n.support_count + (next ? -1 : 1)),
        })),
      );
      showNotice(res.error);
      return;
    }
    if (res.data.supported) {
      void track("argument_supported", { entity_type: "debate", entity_id: debate.id, metadata: { argument_id: arg.id } });
    }
  };

  const handleReply = (arg: ArgumentView) => {
    setReplyTo({
      id: arg.id,
      authorName: arg.author?.full_name ?? "Participante",
      stance: arg.stance,
      excerpt: arg.content.slice(0, 140),
    });
    composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const confirmHide = async () => {
    if (!hideTarget) return;
    setHiding(true);
    const res = await hideArgument({ debateId: debate.id, argumentId: hideTarget.id, reason: hideReason.trim() || undefined });
    setHiding(false);
    if (!res.ok) {
      showNotice(res.error);
      return;
    }
    const reason = hideReason.trim() || null;
    setRoots((prev) =>
      patchNode(prev, hideTarget.id, (n) => ({ ...n, status: "hidden", hidden_reason: reason, hidden_by: currentUserId })),
    );
    setHideTarget(null);
    setHideReason("");
  };

  const handleRestore = async (arg: ArgumentView) => {
    const res = await restoreArgument({ debateId: debate.id, argumentId: arg.id });
    if (!res.ok) {
      showNotice(res.error);
      return;
    }
    setRoots((prev) => patchNode(prev, arg.id, (n) => ({ ...n, status: "visible", hidden_reason: null, hidden_by: null })));
  };

  const handleSetStatus = async (next: DebateStatus) => {
    setPending("status");
    const res = await setDebateStatus({ debateId: debate.id, status: next });
    setPending(null);
    if (!res.ok) {
      showNotice(res.error);
      return;
    }
    setStatus(next);
    if (next === "open") {
      setExpired(false);
      if (closesAt && new Date(closesAt).getTime() <= Date.now()) setClosesAt(null);
    }
    router.refresh();
  };

  const handleSynthesize = async () => {
    setPending("synthesis");
    try {
      const res = await fetch(`/api/debates/${debate.id}/synthesize`, { method: "POST" });
      const body: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          body && typeof body === "object" && "error" in body && typeof body.error === "string"
            ? body.error
            : "No se pudo generar la síntesis.";
        showNotice(msg);
        return;
      }
      if (body && typeof body === "object" && "synthesis_md" in body && typeof body.synthesis_md === "string") {
        setSynthesis(body.synthesis_md);
        showNotice("Síntesis generada. Ya es visible para todo el curso.", "info");
        router.refresh();
      }
    } catch (err) {
      console.error("[debates] synthesize", err);
      showNotice("Se perdió la conexión mientras se generaba la síntesis.");
    } finally {
      setPending(null);
    }
  };

  /* --------------------------- Orden --------------------------- */
  const sorted = React.useMemo(() => {
    const bySort = (a: ArgumentView, b: ArgumentView) => {
      if (sort === "supports" && a.support_count !== b.support_count) return b.support_count - a.support_count;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    };
    const out: Record<DebateStance, ArgumentView[]> = { a_favor: [], en_contra: [], neutral: [] };
    for (const r of roots) out[r.stance].push(r);
    for (const s of STANCES) out[s].sort(bySort);
    return out;
  }, [roots, sort]);

  const hiddenForMe = (n: ArgumentView) => n.status === "hidden" && !canModerate && n.author_id !== currentUserId;

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/campus/debates"
        className="inline-flex w-fit items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Debates
      </Link>

      {/* Cabecera */}
      <Card padding="lg" className="relative overflow-hidden">
        <div className="campus-grid-fade pointer-events-none absolute inset-0 opacity-40" aria-hidden />
        <div className="relative flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-[10px] uppercase tracking-widest text-muted">
            {debate.course && <span>{debate.course.name}</span>}
            {debate.class && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3" aria-hidden />
                {debate.class.topic}
              </span>
            )}
            {debate.recording && (
              <span className="inline-flex items-center gap-1">
                <Mic className="size-3" aria-hidden />
                {debate.recording.title ?? "Grabación"}
              </span>
            )}
            <span
              className={cn("ml-auto inline-flex items-center gap-1", live ? "text-success" : "text-muted")}
              title={live ? "Recibiendo argumentos en vivo" : "Conectando…"}
            >
              <Radio className={cn("size-3", live && "animate-pulse")} aria-hidden />
              {live ? "En vivo" : "Conectando"}
            </span>
          </div>

          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="text-gradient text-2xl font-semibold tracking-tight sm:text-3xl">{debate.title}</h1>
            <DebateStatusBadge status={status} closedByDate={expired} />
          </div>

          {debate.context_md && (
            <Markdown size="sm" className="text-foreground/90">
              {debate.context_md}
            </Markdown>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <Countdown closesAt={closesAt} open={status === "open"} onExpire={() => setExpired(true)} />
            {debate.creator && (
              <span className="inline-flex items-center gap-2 text-xs text-muted">
                <Avatar name={debate.creator.full_name} src={debate.creator.avatar_url} size="xs" />
                Propuesto por {debate.creator.full_name}
              </span>
            )}
          </div>

          <StanceBalance counts={counts} size="md" />
        </div>
      </Card>

      {canModerate && (
        <ModerationBar
          status={status}
          expired={expired}
          hasSynthesis={Boolean(synthesis)}
          visibleCount={visibleCount}
          pending={pending}
          onSetStatus={handleSetStatus}
          onSynthesize={handleSynthesize}
        />
      )}

      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            role={notice.tone === "error" ? "alert" : "status"}
            className={cn(
              "flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm",
              notice.tone === "error" ? "border-danger/40 bg-danger/10 text-danger" : "border-success/40 bg-success/10 text-success",
            )}
          >
            <AlertCircle className="size-4 shrink-0" aria-hidden />
            {notice.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Síntesis IA */}
      {synthesis && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          aria-labelledby="synthesis-title"
          className="rounded-2xl border border-accent/40 bg-accent/5 p-5 sm:p-6"
        >
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="size-4 text-accent" aria-hidden />
            <h2 id="synthesis-title" className="eyebrow text-accent">
              Síntesis del debate · IA
            </h2>
          </div>
          <Markdown size="sm">{synthesis}</Markdown>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-muted">
            Generada a partir de los argumentos visibles. Revisada por el equipo docente.
          </p>
        </motion.section>
      )}

      {/* Composer */}
      <div ref={composerRef}>
        <Composer
          disabled={closed}
          disabledReason={
            status === "archived"
              ? "Este debate está archivado."
              : expired && status === "open"
                ? "El plazo venció: ya no se pueden publicar argumentos."
                : "Este debate está cerrado: ya no se pueden publicar argumentos."
          }
          defaultStance={activeStance}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onSubmit={handleSubmit}
        />
      </div>

      {/* Controles: tabs mobile + orden */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={activeStance}
          onValueChange={(v) => setActiveStance(v as DebateStance)}
          variant="pills"
          className="lg:hidden"
        >
          <TabsList aria-label="Postura">
            {STANCES.map((s) => (
              <TabsTrigger key={s} value={s} icon={<StanceIcon stance={s} />} count={counts[s]} className={cn(activeStance === s && STANCE_META[s].text)}>
                {STANCE_META[s].short}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="hidden items-center gap-2 font-mono text-[11px] text-muted lg:flex">
          {visibleCount} {visibleCount === 1 ? "argumento" : "argumentos"}
        </div>
        <div className="ml-auto flex items-center gap-1 rounded-xl border border-border bg-surface-2 p-1" role="radiogroup" aria-label="Ordenar por">
          {(
            [
              ["supports", "Más apoyados"],
              ["recent", "Recientes"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={sort === v}
              onClick={() => setSort(v)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 font-mono text-[11px] uppercase tracking-widest transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                sort === v ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground",
              )}
            >
              {v === "supports" && <ArrowUpDown className="size-3" aria-hidden />}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Columnas por postura */}
      <div className="grid gap-4 lg:grid-cols-3">
        {STANCES.map((s) => {
          const meta = STANCE_META[s];
          const list = sorted[s].filter((n) => !hiddenForMe(n));
          return (
            <section
              key={s}
              aria-labelledby={`col-${s}`}
              className={cn("flex flex-col gap-3", activeStance === s ? "flex" : "hidden lg:flex")}
            >
              <header className={cn("hidden items-center justify-between rounded-2xl border px-4 py-2.5 lg:flex", meta.border, meta.bg)}>
                <h2 id={`col-${s}`} className={cn("inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest", meta.text)}>
                  <StanceIcon stance={s} />
                  {meta.label}
                </h2>
                <span className="font-mono text-xs tabular-nums text-muted">{counts[s]}</span>
              </header>
              <h2 id={`col-${s}-m`} className="sr-only lg:hidden">
                {meta.label}
              </h2>

              {list.length === 0 ? (
                <div className={cn("rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted", meta.border)}>
                  {closed
                    ? `Nadie argumentó ${meta.label.toLowerCase()}.`
                    : `Todavía nadie argumentó ${meta.label.toLowerCase()}. ¿Te animás a abrir la columna?`}
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {list.map((arg) => (
                    <ArgumentCard
                      key={arg.id}
                      argument={{ ...arg, replies: arg.replies.filter((c) => !hiddenForMe(c)) }}
                      currentUserId={currentUserId}
                      canModerate={canModerate}
                      closed={closed}
                      isNew={newIds.has(arg.id)}
                      onSupport={(a) => void handleSupport(a)}
                      onReply={handleReply}
                      onHide={(a) => {
                        setHideTarget(a);
                        setHideReason("");
                      }}
                      onRestore={(a) => void handleRestore(a)}
                    />
                  ))}
                </AnimatePresence>
              )}
            </section>
          );
        })}
      </div>

      {/* Diálogo de ocultar */}
      <Dialog
        open={hideTarget !== null}
        onOpenChange={(open) => !open && !hiding && setHideTarget(null)}
        title="Ocultar argumento"
        description="El argumento deja de verse para el curso. El autor lo va a ver marcado como oculto, junto con el motivo si lo indicás."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setHideTarget(null)} disabled={hiding}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={() => void confirmHide()} loading={hiding}>
              Ocultar
            </Button>
          </>
        }
      >
        {hideTarget && (
          <blockquote className="mb-4 line-clamp-3 rounded-xl border border-border bg-surface-2/60 px-3 py-2 text-xs text-muted">
            {hideTarget.content}
          </blockquote>
        )}
        <Field label="Motivo" htmlFor="hide-reason" hint="Opcional · máx. 300">
          <Textarea
            id="hide-reason"
            rows={3}
            maxLength={300}
            value={hideReason}
            onChange={(e) => setHideReason(e.target.value)}
            placeholder="Ej.: falta de respeto, fuera de tema, sin fundamento…"
          />
        </Field>
      </Dialog>
    </div>
  );
}
