import type { DbClient } from "@/lib/courses";
import type { LoadoutItem, LoadoutAvatar } from "@/components/avatar/loadout";
import { LEVELS } from "./config";

/**
 * Arma lo que necesita el vestidor: el operador, el catálogo completo y, para lo
 * que todavía está bloqueado, el requisito escrito en criollo.
 */

export interface AvatarData {
  avatar: LoadoutAvatar | null;
  items: LoadoutItem[];
  /** Desbloqueos que el estudiante todavía no vio. */
  nuevos: LoadoutItem[];
}

function requirementText(
  kind: string,
  value: number,
  badgeName: string | null,
): string {
  switch (kind) {
    case "inicio":
      return "Disponible desde el inicio";
    case "nivel": {
      const level = LEVELS.find((l) => l.n === value);
      return level ? `Se abre en nivel ${value} · ${level.name}` : `Se abre en nivel ${value}`;
    }
    case "racha":
      return `Jugá ${value} días seguidos`;
    case "aciertos":
      return `Acertá ${value} respuestas en total`;
    case "partidas":
      return `Jugá ${value} partidas`;
    case "medalla":
      return badgeName ? `Ganá la medalla «${badgeName}»` : "Se abre con una medalla";
    default:
      return "Bloqueado";
  }
}

export async function getAvatarData(supabase: DbClient, studentId: string): Promise<AvatarData> {
  const [avatarRes, catalogRes, ownedRes] = await Promise.all([
    supabase
      .from("student_avatars")
      .select("callsign, chassis, tone, glow, equipped")
      .eq("student_id", studentId)
      .maybeSingle(),
    supabase
      .from("avatar_items")
      .select("id, name, description, slot, rarity, req_kind, req_value, req_badge, sort, badges(name)")
      .order("sort"),
    supabase.from("student_avatar_items").select("item_id, seen").eq("student_id", studentId),
  ]);

  if (catalogRes.error) console.error("[avatar] catálogo", catalogRes.error);

  const ownedMap = new Map((ownedRes.data ?? []).map((o) => [o.item_id, o.seen]));

  const items: LoadoutItem[] = (catalogRes.data ?? []).map((it) => {
    const badge = it.badges as { name: string } | null;
    const unlocked = ownedMap.has(it.id);
    return {
      id: it.id,
      name: it.name,
      description: it.description,
      slot: it.slot,
      rarity: it.rarity as LoadoutItem["rarity"],
      unlocked,
      requirement: requirementText(it.req_kind, it.req_value, badge?.name ?? null),
      isNew: unlocked && ownedMap.get(it.id) === false,
    };
  });

  const a = avatarRes.data;
  return {
    avatar: a
      ? {
          callsign: a.callsign,
          chassis: a.chassis,
          tone: a.tone,
          glow: a.glow,
          equipped: (a.equipped as Record<string, string>) ?? {},
        }
      : null,
    items,
    nuevos: items.filter((i) => i.isNew),
  };
}
