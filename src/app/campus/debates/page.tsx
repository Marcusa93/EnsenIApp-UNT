import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Swords, MessageSquare, CalendarDays } from "lucide-react";
import { requireUser, isTeacherRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { DebateStatusBadge } from "@/components/debates/stance-badge";
import { StanceBalance } from "@/components/debates/stance-balance";
import { isDebateClosed } from "@/components/debates/stance";
import { listDebates } from "./_lib/data";

export const metadata: Metadata = { title: "Debates · EnsenIA UNT" };

export default async function DebatesPage() {
  const { user, profile } = await requireUser("/campus/debates");
  const supabase = await createClient();
  const debates = await listDebates(supabase);
  const teacher = isTeacherRole(profile.role);
  const now = new Date();

  const open = debates.filter((d) => !isDebateClosed(d, now));
  const closed = debates.filter((d) => isDebateClosed(d, now));

  return (
    <div>
      <PageHeader
        eyebrow={teacher ? "Docente · Debates" : "Debates"}
        title="Debates de la cursada"
        description={
          teacher
            ? "Proponé un tema a partir de una clase, moderá los argumentos y sintetizá el debate con IA al cierre."
            : "Tomá postura, fundamentá con lo visto en clase y apoyá los argumentos que te convencen."
        }
        actions={
          teacher ? (
            <Button asChild>
              <Link href="/campus/debates/nuevo">
                <Plus className="size-4" aria-hidden />
                Nuevo debate
              </Link>
            </Button>
          ) : undefined
        }
      />

      {debates.length === 0 ? (
        <EmptyState
          icon={Swords}
          title="Todavía no hay debates"
          description={
            teacher
              ? "Creá el primero desde una grabación: la IA te propone título, contexto y posturas iniciales."
              : "Cuando el equipo docente abra un debate lo vas a ver acá. Mientras tanto, repasá las clases."
          }
          action={
            teacher ? (
              <Button asChild>
                <Link href="/campus/debates/nuevo">Crear el primer debate</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-8">
          <Section title="En curso" count={open.length} emptyText="No hay debates abiertos en este momento.">
            {open.map((d, i) => (
              <DebateCard key={d.id} debate={d} index={i} userId={user.id} />
            ))}
          </Section>
          {closed.length > 0 && (
            <Section title="Cerrados" count={closed.length}>
              {closed.map((d, i) => (
                <DebateCard key={d.id} debate={d} index={i} userId={user.id} />
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  emptyText,
  children,
}: {
  title: string;
  count: number;
  emptyText?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`sec-${title}`}>
      <div className="mb-3 flex items-center gap-2">
        <h2 id={`sec-${title}`} className="eyebrow">
          {title}
        </h2>
        <span className="rounded-full bg-surface-2 px-1.5 font-mono text-[10px] text-muted">{count}</span>
      </div>
      {count === 0 && emptyText ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted">{emptyText}</p>
      ) : (
        <div className="stagger grid gap-4 md:grid-cols-2">{children}</div>
      )}
    </section>
  );
}

function DebateCard({
  debate,
  index,
  userId,
}: {
  debate: Awaited<ReturnType<typeof listDebates>>[number];
  index: number;
  userId: string;
}) {
  const closedByDate = debate.status === "open" && isDebateClosed(debate);
  return (
    <Link
      href={`/campus/debates/${debate.id}`}
      className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <Card interactive padding="sm" className="flex h-full flex-col gap-3 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-widest text-muted">
              {debate.course && <span className="truncate">{debate.course.name}</span>}
              {debate.class && (
                <>
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1 truncate">
                    <CalendarDays className="size-3" aria-hidden />
                    {debate.class.topic}
                  </span>
                </>
              )}
            </div>
            <h3 className="text-base font-semibold leading-snug tracking-tight">{debate.title}</h3>
          </div>
          <DebateStatusBadge status={debate.status} closedByDate={closedByDate} className="shrink-0" />
        </div>

        {debate.context_md && (
          <p className="line-clamp-2 text-sm leading-relaxed text-muted">
            {debate.context_md.replace(/[#*_>`\[\]]/g, "").slice(0, 220)}
          </p>
        )}

        <StanceBalance counts={debate.counts} className="mt-auto" />

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 font-mono text-[11px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <MessageSquare className="size-3.5" aria-hidden />
            {debate.argument_count} {debate.argument_count === 1 ? "argumento" : "argumentos"}
          </span>
          <span>
            {debate.closes_at
              ? closedByDate || debate.status !== "open"
                ? `Cerró ${formatDate(debate.closes_at)}`
                : `Cierra ${formatDateTime(debate.closes_at)}`
              : debate.created_by === userId
                ? "Sin fecha de cierre"
                : `Creado ${formatDate(debate.created_at)}`}
          </span>
        </div>
      </Card>
    </Link>
  );
}
