/**
 * Rig 2.5D del operador.
 *
 * El muñeco se dibuja en función del ángulo hacia el que mira, en vez de tener
 * cuatro dibujos hechos a mano por cada ítem. Cada pieza pregunta al rig dónde
 * cae en pantalla y cuánto se angosta, y el conjunto gira de forma coherente.
 *
 * Ángulos: 0° = de frente, 90° = perfil a su izquierda (nuestra derecha),
 * 180° = de espaldas, 270° = el otro perfil.
 */

export interface Rig {
  /** Ángulo normalizado en radianes. */
  a: number;
  /** cos(a): 1 de frente, 0 de perfil, -1 de espaldas. Marca el "ancho" visible. */
  c: number;
  /** sin(a): de qué lado estamos mirando. Marca el desplazamiento lateral. */
  s: number;
  /** true cuando le vemos la espalda (no se dibujan cara ni visor). */
  back: boolean;
  /** Cuánto se comprime lo que es plano de frente (0.18 de perfil, 1 de frente). */
  flat: number;
  /** Eje horizontal de la figura. */
  cx: number;
}

export const CX = 120;

export function makeRig(degrees: number): Rig {
  const a = ((degrees % 360) + 360) % 360 * (Math.PI / 180);
  const c = Math.cos(a);
  const s = Math.sin(a);
  return {
    a,
    c,
    s,
    back: c < 0,
    // Nunca llega a 0: de perfil los rasgos se ven angostos, no desaparecidos.
    flat: 0.18 + 0.82 * Math.abs(c),
    cx: CX,
  };
}

/**
 * Dónde cae en pantalla un punto que, de frente, está a `offset` px del eje.
 * Al girar, lo que estaba al costado se acerca al centro.
 */
export function px(rig: Rig, offset: number): number {
  return rig.cx + offset * rig.c;
}

/** Ancho en pantalla de algo que de frente mide `w` y de perfil casi nada. */
export function pw(rig: Rig, w: number, minRatio = 0.18): number {
  return w * (minRatio + (1 - minRatio) * Math.abs(rig.c));
}

/**
 * Profundidad de un elemento que de frente está a `offset` del eje: positivo =
 * más cerca del espectador. Sirve para ordenar brazos y piezas al girar.
 */
export function depth(rig: Rig, offset: number): number {
  return -offset * rig.s;
}

/**
 * Desplazamiento lateral de una pieza que sobresale hacia adelante (una visera,
 * una nariz de casco): de frente no se corre, de perfil se va hacia el costado.
 */
export function protrude(rig: Rig, amount: number): number {
  return amount * rig.s;
}
