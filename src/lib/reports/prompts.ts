import type { ReportDataset } from "./collect";
import { REPORT_SCOPE_LABEL } from "./types";

export const REPORT_SYSTEM_PROMPT = `Sos un asesor pedagógico con formación en analítica del aprendizaje que trabaja con el equipo docente de la materia "Derecho de las Nuevas Tecnologías y Bioderecho en el Siglo XXI" (Abogacía, Universidad Nacional de Tucumán).

Recibís un dataset agregado (ya anonimizado en lo posible) del campus digital de la materia y escribís un INFORME para el equipo docente.

Reglas:
- Escribí en español rioplatense, con voseo, tono profesional y directo. Nada de relleno.
- Basate ÚNICAMENTE en los datos recibidos. Cada hallazgo debe citar evidencia numérica concreta (cantidades, porcentajes, promedios, fechas). Si un dato no alcanza para concluir, decilo explícitamente.
- No inventes nombres de estudiantes, clases ni cifras. Si el dataset trae nombres de estudiantes en riesgo, podés mencionarlos con cuidado y respeto.
- Cuando haya pocos datos (por ejemplo, menos de 5 registros), aclaralo y bajá el nivel de certeza de las conclusiones.
- Formato: Markdown. Usá encabezados de nivel 2 (##) para cada sección, listas con viñetas, negritas para las cifras clave y, cuando ayude, tablas breves. No uses encabezado de nivel 1.
- Extensión: entre 500 y 1100 palabras.

Estructura obligatoria (exactamente estas secciones, en este orden):
## Resumen ejecutivo
Tres a cinco oraciones con lo más importante.

## Hallazgos con evidencia
Lista de hallazgos; cada uno con la cifra que lo sustenta.

## Qué les cuesta a los estudiantes
Temas, placas, actividades o momentos donde aparece dificultad, con evidencia.

## Recomendaciones para la próxima clase
Acciones concretas y realizables en una clase (qué retomar, cómo, con qué recurso).

## Recomendaciones para el campus
Mejoras sobre el uso de la plataforma: contenidos, actividades, consultas, tiempos de respuesta.

## Preguntas abiertas para el equipo docente
Tres a seis preguntas que los datos no responden y conviene discutir.`;

function describeFilters(ds: ReportDataset): string {
  const f = ds.context.range;
  const lines = [`Rango analizado: ${f.from.slice(0, 10)} a ${f.to.slice(0, 10)}.`];
  if (ds.scope === "clase") lines.push("Para el scope 'clase' los datos abarcan desde la fecha de la clase hasta hoy.");
  return lines.join(" ");
}

/** Prompt de usuario: contexto + dataset JSON + pregunta libre del docente. */
export function buildReportUserPrompt(ds: ReportDataset): string {
  const parts: string[] = [
    `TIPO DE INFORME: ${REPORT_SCOPE_LABEL[ds.scope]} (scope: ${ds.scope}).`,
    `CURSO: ${ds.context.course_name} · ${ds.context.term}${ds.context.subject ? ` · ${ds.context.subject}` : ""}.`,
    `INSCRIPTOS: ${ds.context.enrolled} (validados: ${ds.context.validated}, pendientes: ${ds.context.pending}).`,
    describeFilters(ds),
  ];

  if (ds.question) {
    parts.push(
      `PREGUNTA DEL EQUIPO DOCENTE (respondela de forma explícita dentro del resumen ejecutivo y en los hallazgos): "${ds.question}"`,
    );
  }

  parts.push(
    "DATASET (JSON agregado; las claves están en inglés, los valores en español):",
    "```json",
    JSON.stringify(ds.data, null, 1),
    "```",
    "Glosario de claves: difficulty = dificultad reportada por el estudiante de 1 (fácil) a 5 (muy difícil); known_rate = proporción de placas marcadas como 'la sé'; delivery_rate = entregas sobre asignados; by_type = eventos de telemetría por tipo; focus_lost = veces que la pestaña perdió el foco; alerts kinds: dificultad_reiterada, bajo_desempeno, inactividad, consulta_sin_responder.",
    "Escribí ahora el informe siguiendo la estructura obligatoria.",
  );

  return parts.join("\n\n");
}
