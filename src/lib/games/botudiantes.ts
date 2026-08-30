import type { AvatarConfig } from "@/components/avatar/operator-avatar";

/**
 * Botudiantes: estudiantes bot del Aula Magna Gamer, para practicar y sumar XP
 * sin depender de que haya un compañero disponible.
 *
 * La dificultad es gradual en dos ejes a la vez: qué preguntas entran a la
 * ronda (maxDifficulty filtra el banco por la dificultad 1-3 que ya trae cada
 * desafío generado) y qué tan seguido acierta el bot (prob). Contra el novato
 * practicás lo básico y casi siempre ganás; contra el jurista entran las
 * preguntas difíciles y hay que estar fino.
 *
 * El bonus por ganarle a un bot es menor que el de ganarle a un compañero
 * (DUEL_WIN_BONUS = 25): farmear contra bots está bien, pero el duelo humano
 * tiene que seguir siendo el que más paga.
 */

export interface Botudiante {
  id: string;
  nombre: string;
  /** 1 = fácil, 2 = medio, 3 = difícil. */
  nivel: 1 | 2 | 3;
  descripcion: string;
  /** Probabilidad de que el bot acierte cada pregunta. */
  prob: number;
  /** Dificultad máxima de las preguntas que entran a la ronda. */
  maxDifficulty: 1 | 2 | 3;
  /** XP extra si le ganás. */
  winBonus: number;
  config: AvatarConfig;
}

export const BOTUDIANTES: Botudiante[] = [
  {
    id: "botu-novato",
    nombre: "Botu Novato",
    nivel: 1,
    descripcion: "Recién se anotó en la materia. Preguntas básicas y más de un furcio.",
    prob: 0.35,
    maxDifficulty: 1,
    winBonus: 5,
    config: { chassis: "domo", tone: "bronce", glow: "ambar", build: "compacto", equipped: {} },
  },
  {
    id: "botu-aplicado",
    nombre: "Botu Aplicado",
    nivel: 2,
    descripcion: "Va a todas las clases y toma apuntes. Te va a hacer transpirar.",
    prob: 0.6,
    maxDifficulty: 2,
    winBonus: 10,
    config: { chassis: "antenas", tone: "titanio", glow: "cian", build: "estandar", equipped: {} },
  },
  {
    id: "botu-jurista",
    nombre: "Botu Jurista",
    nivel: 3,
    descripcion: "Se sabe la materia de memoria. Entran las preguntas difíciles.",
    prob: 0.85,
    maxDifficulty: 3,
    winBonus: 15,
    config: { chassis: "crestado", tone: "grafito", glow: "carmesi", build: "estilizado", equipped: {} },
  },
];

export const BOTUDIANTE_BY_ID = new Map(BOTUDIANTES.map((b) => [b.id, b]));

export const NIVEL_LABEL: Record<1 | 2 | 3, string> = {
  1: "Fácil",
  2: "Medio",
  3: "Difícil",
};
