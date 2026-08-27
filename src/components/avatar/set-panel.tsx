"use client";

import { Check } from "lucide-react";
import { Badge, Card, CardTitle } from "@/components/ui";
import { cn } from "@/lib/utils";
import { evaluateSets } from "@/lib/games/sets";
import type { LoadoutItem } from "./loadout";

/**
 * Conjuntos: qué tenés armado y qué te falta. Se muestran siempre, incluso los
 * que están lejos — la gracia del set es saber que existe y quererlo completar.
 */
export function SetPanel({
  equipped,
  items,
  onFocusItem,
}: {
  equipped: Record<string, string | undefined>;
  items: LoadoutItem[];
  onFocusItem: (item: LoadoutItem) => void;
}) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const statuses = evaluateSets(equipped);
  const worn = new Set(Object.values(equipped).filter(Boolean) as string[]);

  return (
    <Card>
      <CardTitle eyebrow="Conjuntos" as="h2">
        Equipo que se potencia junto
      </CardTitle>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
        Llevando varias piezas del mismo bloque de la materia se activa un efecto que no se consigue de otra forma.
      </p>

      <ul className="mt-3 flex flex-col gap-2.5">
        {statuses.map(({ set, equipped: count, active }) => (
          <li
            key={set.id}
            className={cn(
              "rounded-2xl border p-3.5 transition",
              active ? "border-accent-3/50 bg-accent-3/5" : "border-border bg-surface-2/40",
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base" aria-hidden>
                {set.emoji}
              </span>
              <span className="text-sm font-medium">{set.name}</span>
              <Badge size="sm" tone="muted">
                {set.theme}
              </Badge>
              {active ? (
                <Badge size="sm" tone="accent-3" dot live>
                  Activo
                </Badge>
              ) : (
                <Badge size="sm" tone="muted">
                  {count}/{set.needed}
                </Badge>
              )}
            </div>

            <p className={cn("mt-1.5 text-[13px] leading-relaxed", active ? "text-accent-3" : "text-muted")}>
              {set.perk}
            </p>

            {/* Piezas del conjunto: puestas, disponibles o por conseguir */}
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {set.items.map((id) => {
                const item = byId.get(id);
                if (!item) return null;
                const isWorn = worn.has(id);
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => onFocusItem(item)}
                      className={cn(
                        "rounded-lg border px-2 py-1 text-[11px] transition",
                        isWorn
                          ? "border-accent/50 bg-accent/10 text-foreground"
                          : item.unlocked
                            ? "border-border bg-surface-2 text-muted hover:border-accent/40"
                            : "border-dashed border-border text-muted/70 hover:border-accent-2/50",
                      )}
                    >
                      {isWorn && <Check className="mr-1 inline size-3" aria-hidden />}
                      {item.name}
                    </button>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </Card>
  );
}
