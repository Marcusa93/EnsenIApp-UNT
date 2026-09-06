"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { THEME_STORAGE_KEY, type ThemePreference } from "@/lib/theme";

export type { ThemePreference } from "@/lib/theme";

function readPreference(): ThemePreference {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return raw === "light" || raw === "dark" ? raw : "auto";
  } catch {
    return "auto";
  }
}

const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function applyTheme(pref: ThemePreference) {
  const root = document.documentElement;
  if (pref === "auto") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", pref);
  try {
    if (pref === "auto") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    /* storage no disponible */
  }
  listeners.forEach((l) => l());
}

export function useThemePreference(): [ThemePreference, (p: ThemePreference) => void] {
  const pref = React.useSyncExternalStore(subscribe, readPreference, () => "auto" as ThemePreference);
  return [pref, applyTheme];
}

const ORDER: ThemePreference[] = ["auto", "light", "dark"];
const LABEL: Record<ThemePreference, string> = {
  auto: "Tema automático (según el sistema)",
  light: "Tema papel (claro)",
  dark: "Tema tinta (oscuro)",
};
const ICON: Record<ThemePreference, React.ComponentType<{ className?: string }>> = {
  auto: Monitor,
  light: Sun,
  dark: Moon,
};

/** Botón que rota automático → papel → tinta. */
export function ThemeToggle({ className }: { className?: string }) {
  const [pref, setPref] = useThemePreference();
  const Icon = ICON[pref];
  const next = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length];
  return (
    <button
      type="button"
      onClick={() => setPref(next)}
      aria-label={`${LABEL[pref]}. Cambiar a ${LABEL[next].toLowerCase()}`}
      title={LABEL[pref]}
      className={cn(
        "relative flex size-9 items-center justify-center rounded-xl border border-border bg-surface-2/60 text-muted transition hover:border-accent/40 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
        className,
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

/** Segmento de tres opciones para menús y la página de cuenta. */
export function ThemeSegment({ className }: { className?: string }) {
  const [pref, setPref] = useThemePreference();
  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      className={cn("grid grid-cols-3 gap-1 rounded-xl border border-border bg-surface-2 p-1", className)}
    >
      {ORDER.map((p) => {
        const Icon = ICON[p];
        const active = pref === p;
        return (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setPref(p)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg px-2 py-1.5 font-display text-[10px] font-bold uppercase tracking-wider transition",
              active ? "bg-surface text-accent shadow-sm" : "text-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {p === "auto" ? "Auto" : p === "light" ? "Papel" : "Tinta"}
          </button>
        );
      })}
    </div>
  );
}
