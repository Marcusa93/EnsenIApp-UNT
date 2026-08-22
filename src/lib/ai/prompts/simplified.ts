import { COURSE_CONTEXT } from "./context";

export type SimplifiedLevel = "facil" | "intermedio";

const LEVEL_SPECS: Record<SimplifiedLevel, string> = {
  facil: `NIVEL "FÁCIL": explicá la clase como se la contarías a alguien que recién empieza la carrera o a un familiar curioso.
- Lenguaje cotidiano, oraciones cortas, sin jerga. Si un término jurídico es inevitable, definilo en la misma oración con palabras simples.
- Usá ejemplos de la vida diaria (celular, redes sociales, historia clínica, un turno médico) para aterrizar cada idea.
- Entre 400 y 600 palabras. Markdown con 3 a 5 subtítulos (##) cortos y, si ayuda, listas breves.
- Cerrá con una sección "## En una frase" con la idea central de la clase.`,
  intermedio: `NIVEL "INTERMEDIO": explicá la clase para un estudiante de Abogacía que cursa la materia.
- Usá la terminología jurídica correcta, pero explicá cada término técnico la primera vez que aparece (entre paréntesis o en una oración aparte).
- Conservá las normas, principios y fallos que mencionó el docente, indicando por qué importan.
- Entre 600 y 900 palabras. Markdown con 4 a 6 subtítulos (##) y al menos una lista que organice elementos, requisitos o etapas.
- Cerrá con una sección "## Para repasar" de 3 a 5 preguntas orientadoras (sin respuesta).`,
};

export function simplifiedSystem(level: SimplifiedLevel): string {
  return `${COURSE_CONTEXT}

Tu tarea: reescribir el contenido de una clase en una "versión simple" para estudiar.

${LEVEL_SPECS[level]}

No inventes normas ni ejemplos jurídicos que no estén en la clase. No menciones que esto proviene de una transcripción. No uses títulos H1 (#).`;
}

export function simplifiedUserPrompt(transcript: string, summaryMd?: string | null): string {
  const head = summaryMd ? `RESUMEN DE REFERENCIA:\n${summaryMd}\n\n` : "";
  return `${head}TRANSCRIPCIÓN / NOTAS DE LA CLASE:\n"""\n${transcript}\n"""`;
}
