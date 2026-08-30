/**
 * Texto del consentimiento informado.
 *
 * Vive en código y no en la base a propósito: cambiarlo tiene que quedar en el
 * historial del repositorio, con fecha y autor, como cualquier documento que
 * después hay que poder mostrarle a un comité de ética.
 *
 * IMPORTANTE: si se modifica el texto hay que subir VERSION. Quien ya había
 * decidido sobre la versión anterior vuelve a ver el cartel, porque aceptó otra
 * cosa. No hacerlo sería dar por bueno un sí que nadie dio sobre este texto.
 */

export const VERSION = "2026-08-30";

export const TITULO = "Uso de tus datos para investigar cómo se aprende en el campus";

/** Cada bloque es un párrafo o una lista; la UI los arma en orden. */
export const SECCIONES: { titulo: string; parrafos?: string[]; items?: string[] }[] = [
  {
    titulo: "De qué se trata",
    parrafos: [
      "La cátedra está estudiando cómo se estudia en este campus: qué material se usa, qué cuesta más, si practicar con los juegos ayuda a aprender y qué conviene cambiar. La idea es publicar los resultados y que otras cátedras de la Facultad puedan aprovecharlos.",
      "Te pedimos permiso para incluir tu actividad en ese análisis.",
    ],
  },
  {
    titulo: "Qué datos se usarían",
    items: [
      "Tu recorrido por el campus: qué clases abrís, qué resúmenes y placas mirás, cuándo entrás.",
      "Los check-ins donde contás qué tan difícil te resultó una clase.",
      "Las partidas de los juegos: aciertos, errores y tiempo, por clase.",
      "Las consultas que hacés y tus conversaciones con Alberdi.",
      "Tus entregas y sus notas.",
    ],
  },
  {
    titulo: "Qué NO se usa",
    items: [
      "Tu nombre, tu DNI y tu correo no entran en el análisis: antes de estudiar nada, tus datos se separan de tu identidad y se reemplazan por un código.",
      "No se publica nada que permita reconocerte. Los resultados se informan siempre agrupados.",
      "Nada de lo que digas acá cambia tu nota ni tu situación en la materia.",
    ],
  },
  {
    titulo: "Es voluntario, y decir que no no te perjudica",
    parrafos: [
      "Podés decir que no y seguir usando el campus exactamente igual: todas las funciones, sin ninguna diferencia. Tu docente igual va a ver tu actividad para acompañarte durante la cursada —eso es parte de cómo funciona la materia, no de la investigación—, pero tus datos quedan afuera del estudio.",
      "Sabemos que quien te está pidiendo esto es también quien te evalúa. Por eso: tu respuesta no se mira mientras cursás, no incide en la nota y podés cambiarla cuando quieras desde tu perfil, sin dar explicaciones.",
    ],
  },
  {
    titulo: "Hasta cuándo y quién accede",
    items: [
      "Sólo accede el equipo de investigación de la cátedra.",
      "Los datos del estudio se conservan hasta cinco años después de publicados los resultados, y después se eliminan.",
      "Si retirás tu consentimiento, tus datos salen de los análisis que se hagan de ahí en adelante.",
    ],
  },
  {
    titulo: "Tus derechos",
    parrafos: [
      "Podés pedir acceso a tus datos, su corrección o su eliminación, escribiendo a la cátedra. Este proyecto se rige por la Ley 25.326 de Protección de los Datos Personales.",
    ],
  },
];

export const CONTACTO =
  "Cátedra de Derecho de las Nuevas Tecnologías y Bioderecho · Facultad de Derecho, UNT · marco.rossi@derecho.unt.edu.ar";
