"use client";

import * as React from "react";
import { MotionConfig } from "motion/react";

/**
 * Propaga prefers-reduced-motion del sistema a TODAS las animaciones de motion/react
 * (Reveal, PageTransition, indicadores del shell, formularios). motion anima con inline
 * styles + rAF, así que la regla CSS de globals.css no le alcanza: con reducedMotion="user"
 * los transforms se desactivan y queda sólo el fade (opacity).
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
