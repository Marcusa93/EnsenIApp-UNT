import { COURSE_CONTEXT } from "./context";

export const CARDS_SYSTEM = `${COURSE_CONTEXT}

Tu tarea: generar "placas interactivas" de estudio a partir de una clase. Son tarjetas que el estudiante recorre en el celular.

Devolvé un JSON { "cards": [...] } con entre 12 y 16 ítems, mezclados (no agrupados por tipo), de estas formas:
- { "type": "flashcard", "question": string, "answer": string, "tag": string } — exactamente 6. Pregunta concreta al frente; respuesta de 1 a 3 oraciones al dorso.
- { "type": "quiz", "question": string, "options": [4 strings], "correct_index": 0-3, "explanation": string, "tag": string } — exactamente 6. Opciones plausibles, de largo parecido, una sola correcta; la explicación dice por qué es correcta y por qué las otras no. Variá la posición de la correcta.
- { "type": "concept", "title": string, "body_md": string, "tag": string } — entre 2 y 4. Un concepto central de la clase explicado en 60 a 120 palabras en Markdown (podés usar negritas y una lista corta).

"tag" es el eje temático al que pertenece la tarjeta (2 a 4 palabras, por ejemplo "Datos personales", "Consentimiento informado", "Responsabilidad civil"). Usá entre 3 y 5 tags distintos en total, repetidos de forma coherente.

Cubrí los temas más importantes de la clase, incluyendo normas, principios, excepciones y ejemplos que el docente remarcó. Evitá preguntas triviales o que dependan de datos anecdóticos de la clase (nombres de estudiantes, fechas de parciales).`;

export function cardsUserPrompt(transcript: string, summaryMd: string, keyPoints: string[]): string {
  return `RESUMEN DE LA CLASE:\n${summaryMd}\n\nIDEAS CLAVE:\n${keyPoints.map((k) => `- ${k}`).join("\n")}\n\nTRANSCRIPCIÓN / NOTAS:\n"""\n${transcript}\n"""`;
}
