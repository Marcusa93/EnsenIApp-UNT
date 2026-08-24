"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { Card, CardTitle } from "@/components/ui";
import { formatPercent } from "@/lib/format";

export interface WeekBucket {
  /** Lunes de la semana, YYYY-MM-DD */
  week_start: string;
  label: string;
  events: number;
  active_days: number;
}

const tooltipBox = "rounded-xl border border-border bg-surface px-3 py-2 text-xs shadow-lg";

function WeekTooltip(props: TooltipContentProps<ValueType, NameType>) {
  const { active, payload } = props;
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as WeekBucket | undefined;
  if (!row) return null;
  return (
    <div className={tooltipBox}>
      <p className="eyebrow mb-1">Semana del {row.label}</p>
      <p>
        <span className="font-mono tabular-nums text-accent">{row.events}</span> acciones
      </p>
      <p>
        <span className="font-mono tabular-nums text-accent-2">{row.active_days}</span> {row.active_days === 1 ? "día activo" : "días activos"}
      </p>
    </div>
  );
}

export function WeeklyActivityChart({ data }: { data: WeekBucket[] }) {
  const total = data.reduce((a, d) => a + d.events, 0);
  return (
    <Card className="h-full">
      <div className="mb-4 flex items-start justify-between gap-3">
        <CardTitle eyebrow="Actividad por semana">{total === 0 ? "Todavía sin actividad" : `${total} acciones en ${data.length} semanas`}</CardTitle>
      </div>
      <div className="h-52 w-full" role="img" aria-label={`Acciones en el campus por semana: ${data.map((d) => `${d.label}: ${d.events}`).join(", ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 6" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--muted)", fontSize: 11, fontFamily: "var(--font-mono)" }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={16}
            />
            <YAxis
              tick={{ fill: "var(--muted)", fontSize: 11, fontFamily: "var(--font-mono)" }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              width={40}
            />
            <Tooltip content={WeekTooltip} cursor={{ fill: "var(--surface-2)", opacity: 0.6 }} />
            <Bar dataKey="events" fill="var(--accent)" radius={[6, 6, 0, 0]} maxBarSize={32} isAnimationActive animationDuration={700} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function CardsRadial({ known, total }: { known: number; total: number }) {
  const ratio = total > 0 ? known / total : 0;
  const data = [{ name: "placas", value: Math.round(ratio * 100), fill: "var(--accent-2)" }];
  return (
    <Card className="flex h-full flex-col">
      <CardTitle eyebrow="Placas interactivas">{total === 0 ? "Sin placas publicadas" : `${known} de ${total} placas conocidas`}</CardTitle>
      <div className="relative mx-auto mt-2 h-44 w-full max-w-56 flex-1" role="img" aria-label={`Placas conocidas: ${formatPercent(ratio)}`}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            data={data}
            innerRadius="72%"
            outerRadius="100%"
            startAngle={225}
            endAngle={-45}
            barSize={14}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar
              dataKey="value"
              cornerRadius={10}
              background={{ fill: "var(--surface-2)" }}
              isAnimationActive
              animationDuration={900}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-semibold tabular-nums tracking-tight text-accent-2">{formatPercent(ratio)}</span>
          <span className="eyebrow">conocidas</span>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-muted">
        {total === 0
          ? "Cuando el docente publique una grabación con placas, tu avance aparece acá."
          : ratio >= 0.8
            ? "Excelente: ya dominás casi todas las placas."
            : ratio >= 0.4
              ? "Buen ritmo. Repasá las que marcaste como “no la sé”."
              : "Abrí el modo placas de la última clase y marcá las que ya sabés."}
      </p>
    </Card>
  );
}
