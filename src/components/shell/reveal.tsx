"use client";

import * as React from "react";
import { motion, type HTMLMotionProps } from "motion/react";

export interface RevealProps extends HTMLMotionProps<"div"> {
  /** Retraso en segundos (para escalonar) */
  delay?: number;
  /** Animar al entrar en viewport (true) o al montar (false) */
  inView?: boolean;
  y?: number;
}

/** Entrada fade-up reutilizable (landing, listados). Cliente liviano. */
export function Reveal({ delay = 0, inView = true, y = 18, children, ...props }: RevealProps) {
  const animate = { opacity: 1, y: 0 };
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      {...(inView ? { whileInView: animate, viewport: { once: true, margin: "-10% 0px" } } : { animate })}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/** Contenedor que escalona a sus hijos <RevealItem>. */
export function RevealGroup({ children, stagger = 0.07, className }: { children: React.ReactNode; stagger?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-10% 0px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger } } }}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 18 },
        show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
      }}
    >
      {children}
    </motion.div>
  );
}
