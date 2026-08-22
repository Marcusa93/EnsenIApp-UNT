"use client";

import * as React from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type { UsageDay } from "./dashboard-data";

const dayLabel = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" });

function labelFor(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return dayLabel.format(new Date(y, m - 1, d)).replace(".", "");
}

function UsageTooltip({ active, payload, label }: TooltipContentProps<number, string>) {
  if (!active || !payload?.length) return null;
  const events = payload.find((p) => p.dataKey === "events")?.value ?? 0;
  const students = payload.find((p) => p.dataKey === "students")?.value ?? 0;
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="eyebrow mb-1">{labelFor(String(label))}</p>
      <p>
        <span className="font-mono tabular-nums text-accent">{events}</span> eventos
      </p>
      <p>
        <span className="font-mono tabular-nums text-accent-2">{students}</span> estudiantes activos
      </p>
    </div>
  );
}

export function UsageChart({ data }: { data: UsageDay[] }) {
  const chartData = React.useMemo(() => data.map((d) => ({ ...d, label: labelFor(d.date) })), [data]);
  return (
    <div className="h-56 w-full" role="img" aria-label="Uso del campus por día en los últimos 14 días">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="usage-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-2)" stopOpacity={0.45} />
              <stop offset="100%" stopColor="var(--accent-2)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 6" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={labelFor}
            tick={{ fill: "var(--muted)", fontSize: 11, fontFamily: "var(--font-mono)" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            yAxisId="events"
            tick={{ fill: "var(--muted)", fontSize: 11, fontFamily: "var(--font-mono)" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <YAxis yAxisId="students" orientation="right" hide allowDecimals={false} />
          <Tooltip content={UsageTooltip} cursor={{ fill: "var(--surface-2)", opacity: 0.6 }} />
          <Bar yAxisId="events" dataKey="events" fill="var(--accent)" radius={[6, 6, 0, 0]} maxBarSize={28} />
          <Area
            yAxisId="students"
            dataKey="students"
            type="monotone"
            stroke="var(--accent-2)"
            strokeWidth={2}
            fill="url(#usage-fill)"
            dot={false}
            activeDot={{ r: 4, fill: "var(--accent-2)", stroke: "var(--surface)" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
