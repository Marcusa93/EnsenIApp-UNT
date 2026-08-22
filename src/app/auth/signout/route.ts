import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Cierra la sesión (POST desde el menú de usuario) y vuelve a /login. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) console.error("[auth/signout]", error);
  // 303: el navegador hace GET al destino en vez de repetir el POST.
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}

/** Un GET accidental (link, prefetch) no debe cerrar sesión: lo mandamos al campus. */
export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/campus", request.url));
}
