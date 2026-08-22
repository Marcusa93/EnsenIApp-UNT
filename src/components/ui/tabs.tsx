"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface TabsContextValue {
  value: string;
  setValue: (v: string) => void;
  baseId: string;
  variant: "underline" | "pills";
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabs(component: string) {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error(`<${component}> debe usarse dentro de <Tabs>`);
  return ctx;
}

export interface TabsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  variant?: "underline" | "pills";
}

export function Tabs({ value, defaultValue, onValueChange, variant = "underline", className, children, ...props }: TabsProps) {
  const [internal, setInternal] = React.useState(defaultValue ?? "");
  const isControlled = value !== undefined;
  const current = isControlled ? value : internal;
  const baseId = React.useId();

  const setValue = React.useCallback(
    (v: string) => {
      if (!isControlled) setInternal(v);
      onValueChange?.(v);
    },
    [isControlled, onValueChange],
  );

  const ctx = React.useMemo(() => ({ value: current, setValue, baseId, variant }), [current, setValue, baseId, variant]);

  return (
    <TabsContext.Provider value={ctx}>
      <div className={cn("flex flex-col", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { variant } = useTabs("TabsList");
  const ref = React.useRef<HTMLDivElement>(null);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const tabs = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])') ?? []);
    const idx = tabs.findIndex((t) => t === document.activeElement);
    if (idx === -1) return;
    let next = idx;
    if (e.key === "ArrowRight") next = (idx + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;
    e.preventDefault();
    tabs[next]?.focus();
    tabs[next]?.click();
  };

  return (
    <div
      ref={ref}
      role="tablist"
      onKeyDown={onKeyDown}
      className={cn(
        "relative flex gap-1 overflow-x-auto",
        variant === "underline" ? "border-b border-border" : "rounded-xl border border-border bg-surface-2 p-1",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  icon?: React.ReactNode;
  count?: number;
}

export function TabsTrigger({ value, icon, count, className, children, ...props }: TabsTriggerProps) {
  const ctx = useTabs("TabsTrigger");
  const active = ctx.value === value;
  return (
    <button
      type="button"
      role="tab"
      id={`${ctx.baseId}-tab-${value}`}
      aria-selected={active}
      aria-controls={`${ctx.baseId}-panel-${value}`}
      tabIndex={active ? 0 : -1}
      onClick={() => ctx.setValue(value)}
      className={cn(
        "relative inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
        ctx.variant === "underline" ? "h-10 rounded-b-none" : "h-8",
        active ? "text-foreground" : "text-muted hover:text-foreground",
        className,
      )}
      {...props}
    >
      {active && (
        <motion.span
          layoutId={`${ctx.baseId}-indicator`}
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
          className={cn(
            "absolute",
            ctx.variant === "underline"
              ? "inset-x-0 -bottom-px h-0.5 rounded-full bg-accent"
              : "inset-0 rounded-lg bg-surface shadow-sm",
          )}
          aria-hidden
        />
      )}
      <span className="relative inline-flex items-center gap-2 [&>svg]:size-4">
        {icon}
        {children}
        {count !== undefined && (
          <span className="rounded-full bg-surface-2 px-1.5 font-mono text-[10px] text-muted">{count}</span>
        )}
      </span>
    </button>
  );
}

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  /** Mantener montado aunque no esté activo */
  forceMount?: boolean;
}

export function TabsContent({ value, forceMount, className, children, ...props }: TabsContentProps) {
  const ctx = useTabs("TabsContent");
  const active = ctx.value === value;
  if (!active && !forceMount) return null;
  return (
    <div
      role="tabpanel"
      id={`${ctx.baseId}-panel-${value}`}
      aria-labelledby={`${ctx.baseId}-tab-${value}`}
      hidden={!active}
      tabIndex={0}
      className={cn("animate-fade-in pt-4 focus-visible:outline-none", className)}
      {...props}
    >
      {children}
    </div>
  );
}
