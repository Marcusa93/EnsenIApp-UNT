import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import type { Enums } from "@/lib/types/helpers";

const TIER_STYLE: Record<Enums<"badge_tier">, { ring: string; label: string }> = {
  bronce: { ring: "border-warning/40 bg-warning/10", label: "Bronce" },
  plata: { ring: "border-accent-2/40 bg-accent-2/10", label: "Plata" },
  oro: { ring: "border-accent-3/50 bg-accent-3/10 glow-2", label: "Oro" },
};

/** Medallero del estudiante: ganadas a color, pendientes en gris con su pista. */
export async function Medallero({ userId }: { userId: string }) {
  const supabase = await createClient();
  const [badgesRes, mineRes] = await Promise.all([
    supabase.from("badges").select("*").order("sort", { ascending: true }),
    supabase.from("student_badges").select("badge_id, awarded_at").eq("student_id", userId),
  ]);
  if (badgesRes.error) {
    console.error("[medallero] badges", badgesRes.error);
    return null;
  }
  const earned = new Map((mineRes.data ?? []).map((m) => [m.badge_id, m.awarded_at]));
  const badges = badgesRes.data ?? [];
  const count = earned.size;

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-baseline justify-between gap-2">
        <div>
          <CardTitle eyebrow="Medallero">
            {count} de {badges.length} medallas
          </CardTitle>
          <CardDescription>Se ganan usando el campus: clases, placas, Alberdi, debates, sesiones en vivo.</CardDescription>
        </div>
        <span className="font-mono text-2xl" aria-hidden>
          {badges
            .filter((b) => earned.has(b.id))
            .slice(0, 6)
            .map((b) => b.icon)
            .join(" ")}
        </span>
      </CardHeader>

      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-label="Medallas">
        {badges.map((b) => {
          const at = earned.get(b.id);
          const tier = TIER_STYLE[b.tier];
          return (
            <li
              key={b.id}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-3 transition",
                at ? tier.ring : "border-border bg-surface-2/40 opacity-70 grayscale",
              )}
            >
              <span className="mt-0.5 text-2xl leading-none" aria-hidden>
                {b.icon}
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-semibold leading-snug">{b.name}</span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted">{tier.label}</span>
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-muted">{b.description}</span>
                {at && <span className="mt-1 block font-mono text-[10px] uppercase tracking-widest text-accent-2">Ganada el {formatDate(at)}</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
