"use client";

import * as React from "react";
import { useActionState } from "react";
import { Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button, Card, CardHeader, CardTitle, CardDescription, Field, Input, Select, Textarea } from "@/components/ui";
import { createReport, type ActionState } from "@/app/campus/docente/informes/actions";
import { REPORT_SCOPES, REPORT_SCOPE_LABEL, REPORT_SCOPE_DESCRIPTION, isReportScope, type ReportScope } from "@/lib/reports/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface ReportRequestFormProps {
  courseId: string;
  classes: { id: string; topic: string; class_date: string }[];
  activities: { id: string; title: string; status: string }[];
  students: { id: string; full_name: string }[];
  initial?: { scope?: string; student_id?: string; class_id?: string; activity_id?: string };
}

const initialState: ActionState = { error: null };

export function ReportRequestForm({ courseId, classes, activities, students, initial }: ReportRequestFormProps) {
  const [state, action, pending] = useActionState(createReport, initialState);
  const [scope, setScope] = React.useState<ReportScope>(
    initial?.scope && isReportScope(initial.scope) ? initial.scope : "uso_curso",
  );

  const needsStudent = scope === "estudiante";
  const needsClass = scope === "clase";
  const optionalClass = scope === "consultas";
  const optionalActivity = scope === "actividad";
  const showRange = scope !== "clase";

  return (
    <Card highlight className="self-start">
      <CardHeader>
        <CardTitle as="h2" eyebrow="Pedir informe">
          ¿Qué querés saber de la cursada?
        </CardTitle>
        <CardDescription>
          Elegí un enfoque, acotá con filtros si hace falta y, si querés, hacé una pregunta puntual. El informe tarda
          entre 30 segundos y 2 minutos.
        </CardDescription>
      </CardHeader>

      <form action={action} className="flex flex-col gap-5">
        <input type="hidden" name="course_id" value={courseId} />
        <input type="hidden" name="scope" value={scope} />

        <fieldset>
          <legend className="eyebrow mb-2 text-foreground/80">Enfoque</legend>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Enfoque del informe">
            {REPORT_SCOPES.map((s) => {
              const active = s === scope;
              return (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setScope(s)}
                  className={cn(
                    "relative flex flex-col items-start gap-1 rounded-2xl border p-3.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                    active
                      ? "border-accent bg-accent/10"
                      : "border-border bg-surface hover:border-accent/40 hover:bg-surface-2",
                  )}
                >
                  <span className={cn("text-sm font-semibold", active ? "text-foreground" : "text-foreground/90")}>
                    {REPORT_SCOPE_LABEL[s]}
                  </span>
                  <span className="text-xs leading-relaxed text-muted">{REPORT_SCOPE_DESCRIPTION[s]}</span>
                  {active && (
                    <motion.span
                      layoutId="scope-dot"
                      className="absolute right-3 top-3 size-2 rounded-full bg-accent"
                      aria-hidden
                    />
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={scope}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="grid gap-4 sm:grid-cols-2"
          >
            {needsStudent && (
              <Field label="Estudiante" htmlFor="student_id" required className="sm:col-span-2">
                <Select
                  id="student_id"
                  name="student_id"
                  required
                  defaultValue={initial?.student_id ?? ""}
                  placeholder="Elegí un estudiante"
                  options={students.map((s) => ({ value: s.id, label: s.full_name }))}
                />
              </Field>
            )}

            {(needsClass || optionalClass) && (
              <Field
                label="Clase"
                htmlFor="class_id"
                required={needsClass}
                hint={optionalClass ? "Opcional" : undefined}
                className="sm:col-span-2"
              >
                <Select
                  id="class_id"
                  name="class_id"
                  required={needsClass}
                  defaultValue={initial?.class_id ?? ""}
                  placeholder={needsClass ? "Elegí la clase" : "Todas las clases"}
                >
                  {!needsClass && <option value="">Todas las clases</option>}
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {formatDate(c.class_date)} · {c.topic}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            {optionalActivity && (
              <Field label="Actividad" htmlFor="activity_id" hint="Opcional" className="sm:col-span-2">
                <Select id="activity_id" name="activity_id" defaultValue={initial?.activity_id ?? ""}>
                  <option value="">Todas las actividades publicadas</option>
                  {activities.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title} ({a.status === "closed" ? "cerrada" : "publicada"})
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            {showRange && (
              <>
                <Field label="Desde" htmlFor="from" hint="Opcional · default 30 días">
                  <Input id="from" name="from" type="date" className="h-11" />
                </Field>
                <Field label="Hasta" htmlFor="to" hint="Opcional">
                  <Input id="to" name="to" type="date" className="h-11" />
                </Field>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <Field
          label="¿Qué querés saber?"
          htmlFor="question"
          hint="Opcional"
          description="Una pregunta concreta orienta el análisis. Ej.: “¿Por qué bajó la participación en las últimas dos semanas?”"
        >
          <Textarea id="question" name="question" rows={3} maxLength={600} placeholder="Escribí tu pregunta…" />
        </Field>

        {state.error && (
          <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
            {state.error}
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted">Los datos se analizan agregados; no se comparten con terceros.</p>
          <Button type="submit" loading={pending} leftIcon={<Sparkles />} size="lg">
            Generar informe
          </Button>
        </div>
      </form>
    </Card>
  );
}
