"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getOptionalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCoursesForRole } from "@/lib/courses";
import { COURSE_COOKIE } from "./active-course";
import { fail, succeed, type ActionResult } from "./types";

const schema = z.string().guid();

/** Guarda el curso activo en la cookie `ensenia.course` (sólo si el usuario puede operarlo). */
export async function setActiveCourse(courseId: string): Promise<ActionResult> {
  const parsed = schema.safeParse(courseId);
  if (!parsed.success) return fail("Curso inválido.");

  const ctx = await getOptionalUser();
  if (!ctx) return fail("Tu sesión expiró. Volvé a ingresar.");

  try {
    const supabase = await createClient();
    const courses = await getCoursesForRole(supabase, ctx.user.id, ctx.profile.role);
    if (!courses.some((c) => c.id === parsed.data)) return fail("No tenés acceso a ese curso.");
  } catch (err) {
    console.error("[docente] setActiveCourse", err);
    return fail("No se pudo cambiar de curso.");
  }

  const cookieStore = await cookies();
  cookieStore.set(COURSE_COOKIE, parsed.data, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 180,
  });
  revalidatePath("/campus/docente", "layout");
  return succeed(undefined);
}
