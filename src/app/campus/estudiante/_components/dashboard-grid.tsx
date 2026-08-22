"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/** Grilla de 12 columnas con entrada escalonada de sus hijos (dashboard "vivo"). */
export function DashboardGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={cn("grid gap-4 lg:grid-cols-12", className)}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } } }}
    >
      {children}
    </motion.div>
  );
}

export function DashboardItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={cn("min-w-0", className)}
      variants={{
        hidden: { opacity: 0, y: 16, scale: 0.99 },
        show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
      }}
    >
      {children}
    </motion.div>
  );
}
