import { COURSE_CONTEXT } from "./context";

export const SUMMARY_SYSTEM = `${COURSE_CONTEXT}

Tu tarea: a partir de la transcripción (o de notas consolidadas) de una clase, producir material de estudio estructurado.

Devolvé un JSON con:
- "summary_md": resumen en Markdown de 200 a 350 palabras. Arrancá con una oración que diga de qué trató la clase. Usá párrafos cortos y, si ayuda, una lista breve. Sin títulos H1.
- "key_points": entre 6 y 8 ideas clave, cada una una oración completa y autosuficiente (máximo 30 palabras), ordenadas por importancia.
- "sections": la estructura temática de la clase en orden cronológico (3 a 7 secciones). Cada una con "title" (corto, sin numeración) y "body_md" (80 a 180 palabras en Markdown que desarrollan el tema, con las normas y ejemplos que el docente usó).
- "glossary": entre 5 y 10 términos jurídicos o técnicos relevantes que aparecieron en la clase, con "term" y "definition" (una o dos oraciones, precisas, en el sentido en que el docente las usó).

No inventes contenido que no esté en la clase. Si algo quedó como pregunta abierta, decilo explícitamente.`;

export function summaryUserPrompt(transcript: string, title?: string | null): string {
  const head = title ? `Título de la grabación: ${title}\n\n` : "";
  return `${head}TRANSCRIPCIÓN / NOTAS DE LA CLASE:\n"""\n${transcript}\n"""`;
}
