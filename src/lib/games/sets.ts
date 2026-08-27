/**
 * Conjuntos de equipo.
 *
 * Equipar varias piezas del mismo bloque temático activa un efecto que no se
 * consigue de ninguna otra forma. Es lo que hace que juntar equipo tenga una
 * intención — "me falta una del set forense" — en vez de ser sólo acumular.
 *
 * Los sets se definen acá, no en la base: son reglas de juego que conviene
 * poder ajustar mirando cómo juega la comisión, no datos de cada estudiante.
 */

export interface GearSet {
  id: string;
  name: string;
  /** De qué bloque de la materia habla el conjunto. */
  theme: string;
  /** Ítems que lo componen. */
  items: string[];
  /** Cuántas piezas hacen falta para activarlo. */
  needed: number;
  /** Qué te da, en lenguaje del estudiante. */
  perk: string;
  /** Clase CSS del efecto visual sobre el muñeco. */
  effectClass: string;
  emoji: string;
}

export const SETS: GearSet[] = [
  {
    id: "forense",
    name: "Unidad Forense",
    theme: "Ciberdelito",
    items: ["visor-forense", "inst-rastreador", "fondo-forense"],
    needed: 2,
    perk: "Rastro luminoso: el operador deja estela al girar.",
    effectClass: "set-forense",
    emoji: "🔎",
  },
  {
    id: "bio",
    name: "Comité de Bioética",
    theme: "Bioderecho",
    items: ["visor-bioetica", "toga-bioderecho", "inst-historia", "fondo-laboratorio"],
    needed: 2,
    perk: "Pulso vital: la luz del operador late como un monitor.",
    effectClass: "set-bio",
    emoji: "🧬",
  },
  {
    id: "cripto",
    name: "Nodo Validador",
    theme: "Criptoeconomía",
    items: ["toga-cripto", "inst-llave", "aura-cadena", "fondo-mercado"],
    needed: 2,
    perk: "Bloques encadenados girando alrededor tuyo.",
    effectClass: "set-cripto",
    emoji: "⛓️",
  },
  {
    id: "datos",
    name: "Custodia de Datos",
    theme: "Datos personales",
    items: ["comp-guardian", "aura-firma", "inst-historia"],
    needed: 2,
    perk: "Escudo permanente: un anillo defensivo alrededor del operador.",
    effectClass: "set-datos",
    emoji: "🛡️",
  },
  {
    id: "corte",
    name: "Alta Magistratura",
    theme: "La carrera completa",
    items: ["visor-magistral", "toga-corte", "inst-magno", "fondo-panteon"],
    needed: 3,
    perk: "Presencia de estrado: destello dorado y aura amplificada.",
    effectClass: "set-corte",
    emoji: "🏛️",
  },
];

export interface SetStatus {
  set: GearSet;
  /** Cuántas piezas del set tiene puestas ahora. */
  equipped: number;
  active: boolean;
}

/** Evalúa los sets contra lo que el operador tiene equipado en este momento. */
export function evaluateSets(equipped: Record<string, string | undefined>): SetStatus[] {
  const worn = new Set(Object.values(equipped).filter(Boolean) as string[]);
  return SETS.map((set) => {
    const count = set.items.filter((i) => worn.has(i)).length;
    return { set, equipped: count, active: count >= set.needed };
  });
}

/** Clases de los sets activos, para el efecto visual sobre el muñeco. */
export function activeSetClasses(equipped: Record<string, string | undefined>): string {
  return evaluateSets(equipped)
    .filter((s) => s.active)
    .map((s) => s.set.effectClass)
    .join(" ");
}
