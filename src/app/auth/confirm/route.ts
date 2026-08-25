import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/utils";

const VALID_OTP_TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

function isEmailOtpType(value: string | null): value is EmailOtpType {
  return value !== null && (VALID_OTP_TYPES as string[]).includes(value);
}

/**
 * Confirmación estándar de magic links / OTP por email (patrón oficial de Supabase SSR).
 * Los emails de Supabase apuntan acá con `token_hash` y `type`; verificamos el token
 * de un solo uso y redirigimos a `next` (sólo rutas internas).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = safeInternalPath(searchParams.get("next"), "/campus");

  if (!tokenHash || !isEmailOtpType(type)) {
    console.error("[auth/confirm] parámetros inválidos", { hasTokenHash: Boolean(tokenHash), type });
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    console.error("[auth/confirm] verifyOtp", error);
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
