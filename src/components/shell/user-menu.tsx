"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, LogOut, Home } from "lucide-react";
import Link from "next/link";
import type { Profile } from "@/lib/types/helpers";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<Profile["role"], string> = {
  estudiante: "Estudiante",
  docente: "Docente",
  admin: "Admin",
};

export function roleTone(role: Profile["role"]): "accent" | "accent-2" | "accent-3" {
  if (role === "admin") return "accent-3";
  if (role === "docente") return "accent-2";
  return "accent";
}

export function UserMenu({ profile, className }: { profile: Profile; className?: string }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-2 text-sm transition hover:border-accent/50 focus-visible:outline-2 focus-visible:outline-ring"
      >
        <Avatar name={profile.full_name} src={profile.avatar_url} size="sm" />
        <span className="hidden max-w-36 truncate font-medium sm:inline">{profile.full_name}</span>
        <ChevronDown className={cn("size-4 text-muted transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="glass absolute right-0 z-50 mt-2 w-64 origin-top-right overflow-hidden rounded-2xl p-1.5 shadow-2xl"
          >
            <div className="px-3 py-2.5">
              <p className="truncate text-sm font-semibold">{profile.full_name}</p>
              <p className="truncate text-xs text-muted">{profile.email ?? "Acceso por nombre"}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone={roleTone(profile.role)} size="sm">
                  {ROLE_LABEL[profile.role]}
                </Badge>
                {profile.status === "pendiente" && (
                  <Badge tone="warning" size="sm" dot>
                    Pendiente
                  </Badge>
                )}
                {profile.status === "validado" && (
                  <Badge tone="success" size="sm" dot>
                    Validado
                  </Badge>
                )}
              </div>
            </div>
            <div className="my-1 h-px bg-border" />
            <Link
              href="/"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-muted transition hover:bg-surface-2 hover:text-foreground"
            >
              <Home className="size-4" aria-hidden />
              Ir a la portada
            </Link>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-muted transition hover:bg-danger/10 hover:text-danger"
              >
                <LogOut className="size-4" aria-hidden />
                Cerrar sesión
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export { ROLE_LABEL };
