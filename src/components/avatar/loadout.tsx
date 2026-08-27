"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Lock, Pencil, Sparkles } from "lucide-react";
import { Badge, Button, Card, Dialog } from "@/components/ui";
import { cn } from "@/lib/utils";
import { Turntable } from "./turntable";
import { OperatorForge } from "./operator-forge";
import { equipItem, markItemsSeen } from "@/app/campus/estudiante/juegos/avatar-actions";
import { EmoteBar } from "./emote-bar";
import { ShareStory } from "./share-story";
import { SetPanel } from "./set-panel";
import { EMOTE_BY_ID, type Emote, type EmoteProgress } from "@/lib/games/emotes";

/**
 * Vestidor: el retrato grande y las ranuras de equipo. Lo bloqueado también se
 * muestra (en silueta y con el requisito a la vista) porque saber qué falta es
 * justamente lo que empuja a seguir jugando.
 */

export interface LoadoutItem {
  id: string;
  name: string;
  description: string;
  slot: string;
  rarity: "comun" | "raro" | "epico" | "legendario";
  unlocked: boolean;
  requirement: string;
  isNew: boolean;
}

export interface LoadoutAvatar {
  callsign: string;
  chassis: string;
  tone: string;
  glow: string;
  build: string;
  equipped: Record<string, string>;
}

const SLOT_LABEL: Record<string, string> = {
  visor: "Visor",
  toga: "Toga",
  instrumento: "Instrumento",
  companion: "Compañero",
  aura: "Aura",
  fondo: "Escenario",
};

const SLOT_ORDER = ["visor", "toga", "instrumento", "companion", "aura", "fondo"];

/** Los slots opcionales se pueden dejar vacíos; los de vestimenta, no. */
const OPTIONAL_SLOTS = new Set(["companion", "aura"]);

const RARITY: Record<LoadoutItem["rarity"], { label: string; className: string; tone: "muted" | "accent-2" | "accent" | "accent-3" }> = {
  comun: { label: "Común", className: "border-border", tone: "muted" },
  raro: { label: "Raro", className: "border-accent-2/50", tone: "accent-2" },
  epico: { label: "Épico", className: "border-accent/50", tone: "accent" },
  legendario: { label: "Legendario", className: "border-accent-3/60", tone: "accent-3" },
};

export function Loadout({
  avatar,
  items,
  progress,
  share,
}: {
  avatar: LoadoutAvatar;
  items: LoadoutItem[];
  progress: EmoteProgress;
  share: { levelName: string; levelNumber: number; xp: number; streak: number };
}) {
  const router = useRouter();
  const [config, setConfig] = React.useState(avatar);
  const [slot, setSlot] = React.useState<string>("visor");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState(false);
  /** Ítem bloqueado que se está probando: se ve puesto, pero como proyección. */
  const [trying, setTrying] = React.useState<LoadoutItem | null>(null);
  /**
   * Emote sonando. Se guarda el objeto entero y no su id: buscarlo de nuevo en
   * el render agregaba una indirección que devolvía undefined y dejaba al muñeco
   * sin animar.
   */
  const [emote, setEmote] = React.useState<Emote | null>(null);
  const emoteTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const playEmote = React.useCallback((id: string) => {
    const e = EMOTE_BY_ID.get(id);
    if (!e) return;
    if (emoteTimer.current) clearTimeout(emoteTimer.current);
    // Se apaga y se vuelve a prender para que la animación reinicie si repetís.
    // Con setTimeout y no rAF: si la pestaña está en segundo plano, rAF no corre
    // y el emote quedaría colgado esperando para siempre.
    setEmote(null);
    emoteTimer.current = setTimeout(() => {
      setEmote(e);
      emoteTimer.current = setTimeout(() => setEmote(null), e.duration + 60);
    }, 20);
  }, []);

  React.useEffect(() => () => {
    if (emoteTimer.current) clearTimeout(emoteTimer.current);
  }, []);
  const [error, setError] = React.useState<string | null>(null);

  const nuevos = items.filter((i) => i.isNew);

  // Al abrir el vestidor se dan por vistos los desbloqueos nuevos.
  React.useEffect(() => {
    if (nuevos.length > 0) void markItemsSeen();
    // Sólo al montar: la marca es un efecto colateral, no debe repetirse por render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => setConfig(avatar), [avatar]);

  const bySlot = React.useMemo(() => {
    const map = new Map<string, LoadoutItem[]>();
    for (const s of SLOT_ORDER) map.set(s, []);
    for (const it of items) map.get(it.slot)?.push(it);
    return map;
  }, [items]);

  const owned = items.filter((i) => i.unlocked).length;

  async function equip(itemId: string | null) {
    setBusy(itemId ?? "none");
    setError(null);

    // Optimista: el retrato responde en el acto.
    const previous = config.equipped;
    const next = { ...previous };
    if (itemId) next[slot] = itemId;
    else delete next[slot];
    setConfig((c) => ({ ...c, equipped: next }));

    const res = await equipItem({ slot: slot as "visor", itemId });
    if (!res.ok) {
      setConfig((c) => ({ ...c, equipped: previous }));
      setError(res.error);
    } else {
      router.refresh();
    }
    setBusy(null);
  }

  // Cambiar de ranura corta la prueba: probar es algo puntual de un ítem.
  React.useEffect(() => setTrying(null), [slot]);

  /** Desde el panel de conjuntos: ir a esa ranura y probar lo que falta. */
  const focusItem = React.useCallback((item: LoadoutItem) => {
    setSlot(item.slot);
    // El efecto que limpia `trying` al cambiar de ranura corre primero, así que
    // la prueba se agenda para después de ese ciclo.
    setTimeout(() => {
      if (!item.unlocked) setTrying(item);
    }, 0);
  }, []);

  const slotItems = bySlot.get(slot) ?? [];

  // Lo que se dibuja: lo equipado, o lo que se está probando encima.
  const shown = trying
    ? { ...config, equipped: { ...config.equipped, [trying.slot]: trying.id } }
    : config;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-12 lg:gap-6">
        {/* Retrato */}
        <div className="flex min-w-0 flex-col items-center gap-3 lg:col-span-5">
          <Turntable config={shown} size={300} ghostSlot={trying?.slot ?? null} emoteClass={emote?.className ?? null} title={config.callsign} className="w-full" />
          <div className="text-center">
            {trying ? (
              <>
                <p className="font-mono text-sm uppercase tracking-[0.2em] text-accent-2">{trying.name}</p>
                <p className="mt-0.5 text-xs text-muted">
                  Así te quedaría. {trying.requirement}.
                </p>
              </>
            ) : (
              <>
                <p className="font-mono text-sm uppercase tracking-[0.2em] text-foreground">{config.callsign}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {owned} de {items.length} equipos desbloqueados
                </p>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-start justify-center gap-2">
            <Button variant="secondary" size="sm" leftIcon={<Pencil />} onClick={() => setEditing(true)}>
              Cambiar aspecto
            </Button>
            <div className="flex flex-col items-center">
              <ShareStory
                config={config}
                callsign={config.callsign}
                levelName={share.levelName}
                levelNumber={share.levelNumber}
                xp={share.xp}
                itemsOwned={owned}
                itemsTotal={items.length}
                streak={share.streak}
              />
            </div>
          </div>

          <div className="w-full">
            <EmoteBar progress={progress} playing={emote?.id ?? null} onPlay={playEmote} />
          </div>
        </div>

        {/* Ranuras */}
        <div className="flex min-w-0 flex-col gap-3 lg:col-span-7">
          {nuevos.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 rounded-xl border border-accent-3/40 bg-accent-3/10 px-3 py-2 text-sm text-accent-3"
            >
              <Sparkles className="size-4 shrink-0" aria-hidden />
              Desbloqueaste {nuevos.length} {nuevos.length === 1 ? "equipo nuevo" : "equipos nuevos"}:{" "}
              {nuevos.map((n) => n.name).join(", ")}
            </motion.div>
          )}

          {/* Selector de ranura */}
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {SLOT_ORDER.map((s) => {
              const count = (bySlot.get(s) ?? []).filter((i) => i.unlocked).length;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSlot(s)}
                  aria-pressed={slot === s}
                  className={cn(
                    "shrink-0 rounded-xl border px-3 py-2 text-xs font-medium transition",
                    slot === s
                      ? "border-accent bg-accent/10 text-foreground"
                      : "border-border bg-surface-2/50 text-muted hover:border-accent/40",
                  )}
                >
                  {SLOT_LABEL[s]}
                  <span className="ml-1.5 font-mono text-[10px] opacity-70">{count}</span>
                </button>
              );
            })}
          </div>

          {error && (
            <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              {error}
            </p>
          )}

          <AnimatePresence mode="wait">
            <motion.ul
              key={slot}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col gap-2"
            >
              {OPTIONAL_SLOTS.has(slot) && (
                <li>
                  <button
                    type="button"
                    onClick={() => equip(null)}
                    disabled={busy != null}
                    className={cn(
                      "w-full rounded-2xl border px-3.5 py-3 text-left text-sm transition",
                      !config.equipped[slot]
                        ? "border-accent bg-accent/10"
                        : "border-border bg-surface-2/40 hover:border-accent/40",
                    )}
                  >
                    <span className="font-medium">Sin {SLOT_LABEL[slot].toLowerCase()}</span>
                    <span className="mt-0.5 block text-xs text-muted">Dejar la ranura vacía.</span>
                  </button>
                </li>
              )}

              {slotItems.map((item) => {
                const isEquipped = config.equipped[slot] === item.id;
                const r = RARITY[item.rarity];
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => (item.unlocked ? equip(item.id) : setTrying((t) => (t?.id === item.id ? null : item)))}
                      disabled={busy != null}
                      className={cn(
                        "w-full rounded-2xl border px-3.5 py-3 text-left transition",
                        isEquipped
                          ? "border-accent bg-accent/10"
                          : item.unlocked
                            ? cn("bg-surface-2/40 hover:border-accent/40", r.className)
                            : "border-border bg-surface-2/20 opacity-60",
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        {!item.unlocked && <Lock className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">{item.name}</span>
                            {item.rarity !== "comun" && (
                              <Badge size="sm" tone={r.tone}>
                                {r.label}
                              </Badge>
                            )}
                            {item.isNew && item.unlocked && (
                              <Badge size="sm" tone="accent-3" dot live>
                                Nuevo
                              </Badge>
                            )}
                            {isEquipped && (
                              <Badge size="sm" tone="accent">
                                Equipado
                              </Badge>
                            )}
                            {trying?.id === item.id && (
                              <Badge size="sm" tone="accent-2" dot live>
                                Probando
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 text-[13px] leading-relaxed text-muted">{item.description}</p>
                          {!item.unlocked && (
                            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] uppercase tracking-wider text-accent-2">
                              {item.requirement}
                              <span className="text-muted normal-case tracking-normal">
                                {trying?.id === item.id ? "· tocá otra vez para sacarlo" : "· tocá para probártelo"}
                              </span>
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </motion.ul>
          </AnimatePresence>

          <SetPanel equipped={config.equipped} items={items} onFocusItem={focusItem} />
        </div>
      </div>

      <Dialog open={editing} onOpenChange={setEditing} size="lg" title="Aspecto del operador">
        <OperatorForge
          mode="editar"
          initial={{ ...config, equipped: config.equipped }}
          onDone={() => setEditing(false)}
        />
      </Dialog>
    </div>
  );
}
