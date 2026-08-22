// Server-only: usa createAdminClient. No importar desde componentes cliente.
import type { DbClient } from "@/lib/courses";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/types/helpers";
import { emptyCounts, type StanceCounts } from "@/components/debates/stance";
import type { ArgumentAuthor, ArgumentView, DebateDetail, DebateListItem } from "@/components/debates/types";

function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

/** Debates visibles para el usuario (RLS: inscripto / docente del curso / admin). */
export async function listDebates(supabase: DbClient): Promise<DebateListItem[]> {
  const { data, error } = await supabase
    .from("debates")
    .select(
      "*, course:courses(id, name, term), class:classes(id, topic, class_date), arguments:debate_arguments(stance, status)",
    )
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[debates] listDebates", { error });
    throw new Error("No se pudieron cargar los debates.");
  }

  return (data ?? []).map((row) => {
    const { arguments: args, course, class: cls, ...debate } = row;
    const counts: StanceCounts = emptyCounts();
    let total = 0;
    for (const a of args ?? []) {
      if (a.status !== "visible") continue;
      counts[a.stance] += 1;
      total += 1;
    }
    return {
      ...debate,
      course: one(course),
      class: one(cls),
      counts,
      argument_count: total,
    };
  });
}

/** Un debate con su curso, clase, grabación y creador. null si no existe o RLS lo oculta. */
export async function getDebateDetail(supabase: DbClient, debateId: string): Promise<DebateDetail | null> {
  const { data, error } = await supabase
    .from("debates")
    .select(
      "*, course:courses(id, name, term), class:classes(id, topic, class_date), recording:class_recordings(id, title)",
    )
    .eq("id", debateId)
    .maybeSingle();
  if (error) {
    console.error("[debates] getDebateDetail", { debateId, error });
    throw new Error("No se pudo cargar el debate.");
  }
  if (!data) return null;
  const { course, class: cls, recording, ...debate } = data;
  const authors = await fetchAuthors([debate.created_by]);
  return {
    ...debate,
    course: one(course),
    class: one(cls),
    recording: one(recording),
    creator: authors.get(debate.created_by) ?? null,
  };
}

/**
 * Nombres y avatares de autores. Los perfiles de otros estudiantes no son visibles por RLS
 * (sólo el propio, los del docente del curso y admin), así que se resuelven con el cliente
 * admin DESPUÉS de que el acceso al debate ya fue validado por RLS en la query anterior.
 * Sólo se exponen campos públicos dentro del aula: nombre, avatar y rol.
 */
export async function fetchAuthors(ids: string[]): Promise<Map<string, ArgumentAuthor>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const map = new Map<string, ArgumentAuthor>();
  if (unique.length === 0) return map;
  const admin = createAdminClient();
  const { data, error } = await admin.from("profiles").select("id, full_name, avatar_url, role").in("id", unique);
  if (error) {
    console.error("[debates] fetchAuthors", { error });
    return map;
  }
  for (const p of data ?? []) map.set(p.id, p);
  return map;
}

/** Argumentos del debate (RLS: visibles + propios; docente ve todo) como árbol de 1 nivel. */
export async function getDebateArguments(
  supabase: DbClient,
  debateId: string,
  userId: string,
): Promise<ArgumentView[]> {
  const { data, error } = await supabase
    .from("debate_arguments")
    .select("*, supports:debate_supports(user_id)")
    .eq("debate_id", debateId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[debates] getDebateArguments", { debateId, error });
    throw new Error("No se pudieron cargar los argumentos.");
  }

  const rows = data ?? [];
  const authors = await fetchAuthors(rows.map((r) => r.author_id));

  const nodes = new Map<string, ArgumentView>();
  for (const r of rows) {
    const { supports, ...arg } = r;
    const supporters = supports ?? [];
    nodes.set(arg.id, {
      id: arg.id,
      debate_id: arg.debate_id,
      parent_id: arg.parent_id,
      stance: arg.stance,
      content: arg.content,
      status: arg.status,
      hidden_reason: arg.hidden_reason,
      hidden_by: arg.hidden_by,
      author_id: arg.author_id,
      author: authors.get(arg.author_id) ?? null,
      created_at: arg.created_at,
      support_count: supporters.length,
      supported_by_me: supporters.some((s) => s.user_id === userId),
      replies: [],
    });
  }

  const roots: ArgumentView[] = [];
  for (const node of nodes.values()) {
    if (node.parent_id && nodes.has(node.parent_id)) {
      // Aplanamos a un solo nivel: una respuesta a una respuesta cuelga del argumento raíz.
      let parent = nodes.get(node.parent_id)!;
      while (parent.parent_id && nodes.has(parent.parent_id)) parent = nodes.get(parent.parent_id)!;
      parent.replies.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

/** ¿El usuario puede moderar este debate? Admin siempre; docente si está asignado al curso. */
export async function canModerateCourse(supabase: DbClient, userId: string, role: UserRole, courseId: string) {
  if (role === "admin") return true;
  if (role !== "docente") return false;
  const { data, error } = await supabase
    .from("teacher_assignments")
    .select("course_id")
    .eq("teacher_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (error) {
    console.error("[debates] canModerateCourse", { userId, courseId, error });
    return false;
  }
  return Boolean(data);
}
