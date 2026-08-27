/**
 * Rig 2.5D del operador.
 *
 * El muñeco se dibuja en función del ángulo hacia el que mira, en vez de tener
 * un dibujo hecho a mano por cada vista de cada ítem.
 *
 * La clave está en distinguir dos cosas que se comportan distinto al girar:
 *
 *  - Un VOLUMEN (la cabeza, el torso) tiene ancho y profundidad. Al girar, su
 *    silueta pasa de mostrar el ancho a mostrar la profundidad, así que el ancho
 *    proyectado es la elipse √((W·cos)² + (D·sin)²) — nunca se achica a cero.
 *    Tratarlo como plano fue el error que convertía al muñeco en un palo de perfil.
 *  - Una SUPERFICIE plana (el visor, una placa pectoral) sí desaparece de canto:
 *    su profundidad es casi nula y la misma fórmula lo resuelve sola.
 *
 * Ángulos: 0° = de frente, 90° = perfil (nos da su costado izquierdo),
 * 180° = de espaldas, 270° = el otro perfil.
 */

export interface Rig {
  a: number;
  /** cos: 1 de frente, 0 de perfil, -1 de espaldas. */
  c: number;
  /** sin: hacia qué lado gira. */
  s: number;
  /** true cuando le vemos la espalda. */
  back: boolean;
  /** Cuánto se ve de la cara frontal (1 de frente, 0 de perfil). */
  facing: number;
  /** Eje vertical de la figura en el lienzo. */
  cx: number;
  /** Escala general de la complexión. */
  build: number;
  /** Proporciones por zona: la relación entre ellas define la silueta. */
  shape: { shoulders: number; waist: number };
}

export const CX = 120;

export function makeRig(
  degrees: number,
  build = 1,
  shape: { shoulders: number; waist: number } = { shoulders: 1, waist: 1 },
): Rig {
  const a = (((degrees % 360) + 360) % 360) * (Math.PI / 180);
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { a, c, s, back: c < 0, facing: Math.max(0, c), cx: CX, build, shape };
}

/**
 * Dónde cae en pantalla un punto del cuerpo.
 * @param lateral distancia al eje cuando se lo mira de frente (+ = a su izquierda)
 * @param forward cuánto sobresale hacia adelante (+ = hacia el espectador de frente)
 */
export function place(rig: Rig, lateral: number, forward = 0): number {
  return rig.cx + (lateral * rig.c + forward * rig.s) * rig.build;
}

/**
 * Ancho proyectado de una pieza de `width` de ancho y `depth` de profundidad.
 * Para superficies planas se pasa una profundidad chica y desaparecen de canto.
 */
export function proj(rig: Rig, width: number, depth: number): number {
  const w = width * rig.c;
  const d = depth * rig.s;
  return Math.sqrt(w * w + d * d) * rig.build;
}

/** Profundidad de un punto: mayor = más cerca del espectador. Ordena las capas. */
export function depthAt(rig: Rig, lateral: number, forward = 0): number {
  return forward * rig.c - lateral * rig.s;
}

/**
 * Cuánto se ve una superficie orientada hacia adelante: 1 de frente, 0 de canto.
 * Sirve para atenuar visores y placas en vez de cortarlos de golpe.
 */
export function faceAlpha(rig: Rig, sharpness = 1.8): number {
  return Math.min(1, Math.max(0, rig.c) * sharpness);
}

/** Compatibilidad: ancho de algo tratado como volumen suave. */
export function pw(rig: Rig, width: number, minRatio = 0.35): number {
  return proj(rig, width, width * minRatio);
}

export function px(rig: Rig, offset: number): number {
  return place(rig, offset, 0);
}

export function protrude(rig: Rig, amount: number): number {
  return amount * rig.s;
}
