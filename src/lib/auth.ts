import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { homeForRole } from "@/lib/nav";
import type { Profile, UserRole } from "@/lib/types/helpers";

export interface AuthContext {
  user: User;
  profile: Profile;
}

/**
 * Usuario + perfil de la sesión actual, o null si no hay sesión.
 * Cacheado por request (React cache) para que layout y page no dupliquen queries.
 */
export const getOptionalUser = cache(async (): Promise<AuthContext | null> => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[auth] no se pudo leer el perfil", { userId: user.id, error: profileError });
    return null;
  }
  if (!profile) {
    // El trigger handle_new_user debería haberlo creado; si no, no hay perfil válido.
    console.error("[auth] usuario sin perfil", { userId: user.id });
    return null;
  }
  return { user, profile };
});

/** Exige sesión. Si no hay, redirige a /login?next=<ruta actual si se pasa>. */
export async function requireUser(next?: string): Promise<AuthContext> {
  const ctx = await getOptionalUser();
  if (!ctx) {
    const target = next ? `/login?next=${encodeURIComponent(next)}` : "/login";
    redirect(target);
  }
  if (ctx.profile.status === "bloqueado") {
    redirect("/login?error=bloqueado");
  }
  return ctx;
}

/** Exige sesión y uno de los roles indicados; si no coincide, redirige al home de su rol. */
export async function requireRole(...roles: UserRole[]): Promise<AuthContext> {
  const ctx = await requireUser();
  if (roles.length > 0 && !roles.includes(ctx.profile.role)) {
    redirect(homeForRole(ctx.profile.role));
  }
  return ctx;
}

export function isTeacherRole(role: UserRole): boolean {
  return role === "docente" || role === "admin";
}
