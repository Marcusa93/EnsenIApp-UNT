"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Clock } from "lucide-react";
import { navForRole, type NavItem } from "@/lib/nav";
import type { Profile } from "@/lib/types/helpers";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { Brand } from "./brand";
import { NavIcon } from "./nav-icon";
import { OfflineBanner } from "./offline-banner";
import { PageTransition } from "./page-transition";
import { ROLE_LABEL, UserMenu, roleTone } from "./user-menu";
import { AvisosBell } from "./avisos-bell";

export interface CampusShellProps {
  profile: Profile;
  children: React.ReactNode;
  /**
   * Overlays persistentes (Alberdi flotante, celebración de medallas): van FUERA de
   * <PageTransition> a propósito. Ese motion.div tiene key={pathname}, así que todo
   * lo que entra como `children` se desmonta y remonta en cada navegación — un overlay
   * "disponible en todo momento" perdería su estado (conversación abierta, posición
   * arrastrada) con cada cambio de pantalla si viviera ahí adentro.
   */
  overlays?: React.ReactNode;
}

/** Ítem activo: coincidencia exacta o prefijo más largo (para que /clases no marque /). */
function useActiveHref(items: NavItem[]) {
  const pathname = usePathname();
  return React.useMemo(() => {
    let best: string | null = null;
    for (const item of items) {
      const match = pathname === item.href || pathname.startsWith(item.href + "/");
      if (match && (best === null || item.href.length > best.length)) best = item.href;
    }
    return best;
  }, [items, pathname]);
}

export function CampusShell({ profile, children, overlays }: CampusShellProps) {
  const items = React.useMemo(() => navForRole(profile.role), [profile.role]);
  const active = useActiveHref(items);
  const pending = profile.status === "pendiente";

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface/60 lg:flex">
        <div className="flex h-16 items-center px-5">
          <Brand href="/campus" />
        </div>
        <nav aria-label="Principal" className="flex-1 overflow-y-auto px-3 py-2">
          <p className="eyebrow mb-2 px-3 text-[10px]">{ROLE_LABEL[profile.role]}</p>
          <ul className="flex flex-col gap-0.5">
            {items.map((item) => {
              const isActive = active === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive ? "text-foreground" : "text-muted hover:bg-surface-2 hover:text-foreground",
                    )}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="sidebar-active"
                        transition={{ type: "spring", stiffness: 500, damping: 40 }}
                        className="absolute inset-0 rounded-xl border border-accent/30 bg-accent/10"
                        aria-hidden
                      />
                    )}
                    <NavIcon
                      name={item.icon}
                      className={cn(
                        "relative size-[18px] transition-colors",
                        isActive ? "text-accent" : "text-muted group-hover:text-foreground",
                      )}
                    />
                    <span className="relative">{item.label}</span>
                    {isActive && (
                      <span className="relative ml-auto size-1.5 rounded-full bg-accent-2 animate-pulse-ring" aria-hidden />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="border-t border-border p-4">
          <p className="eyebrow text-[10px]">Derecho de las Nuevas Tecnologías y Bioderecho</p>
          <p className="mt-1 text-[11px] text-muted">Facultad de Derecho · UNT</p>
        </div>
      </aside>

      {/* Columna principal */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40">
          <OfflineBanner />
          <div className="glass flex h-14 items-center justify-between gap-3 border-b border-t-0 border-x-0 px-4 sm:h-16 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Brand href="/campus" className="lg:hidden" />
              <div className="hidden items-center gap-2 lg:flex">
                <Badge tone={roleTone(profile.role)} size="sm">
                  {ROLE_LABEL[profile.role]}
                </Badge>
                {pending && (
                  <Tooltip content="Tu email todavía no figura en el padrón. Podés usar el campus; el equipo docente va a validarte.">
                    <span tabIndex={0} className="inline-flex rounded-full">
                      <Badge tone="warning" size="sm" dot live>
                        <Clock className="size-3" aria-hidden /> Pendiente de validación
                      </Badge>
                    </span>
                  </Tooltip>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {pending && (
                <Badge tone="warning" size="sm" dot live className="lg:hidden">
                  Pendiente
                </Badge>
              )}
              <AvisosBell userId={profile.id} />
              <UserMenu profile={profile} />
            </div>
          </div>
        </header>

        <main id="contenido" className="flex-1 px-4 pb-24 pt-5 sm:px-6 sm:pt-8 lg:px-10 lg:pb-12">
          <div className="mx-auto w-full max-w-6xl">
            <PageTransition>{children}</PageTransition>
          </div>
        </main>

        {overlays}

        {/* Bottom nav (mobile) */}
        <nav
          aria-label="Principal"
          className="glass safe-bottom fixed inset-x-0 bottom-0 z-40 border-b-0 border-x-0 lg:hidden"
        >
          <ul className="flex items-stretch justify-around px-1">
            {items.slice(0, 5).map((item) => {
              const isActive = active === item.href;
              return (
                <li key={item.href} className="flex-1">
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                      isActive ? "text-accent" : "text-muted",
                    )}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="bottomnav-active"
                        transition={{ type: "spring", stiffness: 500, damping: 40 }}
                        className="absolute top-0 h-0.5 w-8 rounded-full bg-accent"
                        aria-hidden
                      />
                    )}
                    <NavIcon name={item.icon} className="size-5" />
                    <span className="font-mono uppercase tracking-wider">{item.label}</span>
                  </Link>
                </li>
              );
            })}
            {items.length > 5 && (
              <li className="flex-1">
                <MoreMenu items={items.slice(5)} active={active} />
              </li>
            )}
          </ul>
        </nav>
      </div>
    </div>
  );
}

function MoreMenu({ items, active }: { items: NavItem[]; active: string | null }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const isActive = items.some((i) => i.href === active);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "flex w-full flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
          isActive || open ? "text-accent" : "text-muted",
        )}
      >
        <span className="flex size-5 items-center justify-center">
          <span className="grid grid-cols-2 gap-0.5">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="size-1.5 rounded-sm bg-current" />
            ))}
          </span>
        </span>
        <span className="font-mono uppercase tracking-wider">Más</span>
      </button>
      {open && (
        <div role="menu" className="glass absolute bottom-full right-1 z-50 mb-2 w-52 rounded-2xl p-1.5 shadow-2xl">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition hover:bg-surface-2",
                active === item.href ? "text-accent" : "text-foreground",
              )}
            >
              <NavIcon name={item.icon} className="size-4" />
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
