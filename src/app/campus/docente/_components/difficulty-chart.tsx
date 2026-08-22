"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type { DifficultyByClass } from "./dashboard-data";
import { formatDate } from "@/lib/format";

function colorFor(avg: number): string {
  if (avg >= 4) return "var(--danger)";
  if (avg >= 3) return "var(--warning)";
  return "var(--accent-2)";
}

function DifficultyTooltip({ active, payload }: TooltipContentProps<number, string>) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as DifficultyByClass | undefined;
  if (!row) return null;
  return (
    <div className="max-w-64 rounded-xl border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="eyebrow mb-1">{formatDate(row.class_date)}</p>
      <p className="font-medium leading-snug">{row.topic}</p>
      <p className="mt-1 text-muted">
        Dificultad <span className="font-mono tabular-nums text-foreground">{row.avg.toFixed(1)}</span> / 5 ·{" "}
        <span className="font-mono tabular-nums text-foreground">{row.count}</span> check-ins
      </p>
    </div>
  );
}

export function DifficultyChart({ data }: { data: DifficultyByClass[] }) {
  const chartData = React.useMemo(
    () => data.map((d, i) => ({ ...d, idx: `C${i + 1}` })),
    [data],
  );
  return (
    <div className="h-56 w-full" role="img" aria-label="Dificultad promedio reportada por clase">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 6" vertical={false} />
          <XAxis
            dataKey="idx"
            tick={{ fill: "var(--muted)", fontSize: 11, fontFamily: "var(--font-mono)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 5]}
            ticks={[1, 2, 3, 4, 5]}
            tick={{ fill: "var(--muted)", fontSize: 11, fontFamily: "var(--font-mono)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={DifficultyTooltip} cursor={{ fill: "var(--surface-2)", opacity: 0.6 }} />
          <Bar dataKey="avg" radius={[6, 6, 0, 0]} maxBarSize={36}>
            {chartData.map((d) => (
              <Cell key={d.class_id} fill={colorFor(d.avg)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
