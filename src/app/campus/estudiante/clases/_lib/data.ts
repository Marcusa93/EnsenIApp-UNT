// Sólo para Server Components / Server Actions: recibe el cliente Supabase con RLS.
import type { DbClient } from "@/lib/courses";
import { TIME_ZONE } from "@/lib/format";
import type { Enums, Tables } from "@/lib/types/helpers";
import {
  parseCards,
  parseGlossary,
  parseKeyPoints,
  parseSections,
  parseSegments,
  type IndexedCard,
} from "@/components/class-content/parse";
import type { GlossaryTerm, SummarySection, TranscriptSegment } from "@/lib/types/helpers";

/* ------------------------------------------------------------------ */
/* Tipos de salida                                                      */
/* ------------------------------------------------------------------ */

export type ClassTemporalState = "pasada" | "hoy" | "proxima" | "futura";

export interface TeacherRef {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export interface ClassListItem {
  id: string;
  course_id: string;
  course_name: string;
  class_date: string;
  topic: string;
  summary: string | null;
  sort_order: number;
  teacher: TeacherRef | null;
  recordings_count: number;
  materials_count: number;
  state: ClassTemporalState;
}

export interface MaterialItem {
  id: string;
  title: string;
  kind: Enums<"material_kind">;
  /** URL final (externa o firmada). Null si el archivo no pudo firmarse. */
  href: string | null;
  is_file: boolean;
}

export interface CardProgressRow {
  card_index: number;
  known: boolean;
  attempts: number;
  correct: number;
}

export interface RecordingContent {
  id: string;
  title: string | null;
  duration_seconds: number | null;
  created_at: string;
  summary: {
    summary_md: string;
    key_points: string[];
    sections: SummarySection[];
    glossary: GlossaryTerm[];
  } | null;
  cards: IndexedCard[];
  simplified: { facil: string | null; intermedio: string | null };
  transcript: { full_text: string; segments: TranscriptSegment[] } | null;
  progress: CardProgressRow[];
}

export interface ClassDetail {
  id: string;
  course_id: string;
  course_name: string;
  class_date: string;
  topic: string;
  summary: string | null;
  teacher: TeacherRef | null;
  state: ClassTemporalState;
  announcements: Pick<Tables<"announcements">, "id" | "title" | "body" | "created_at">[];
  materials: MaterialItem[];
  recordings: RecordingContent[];
  checkin: Pick<Tables<"student_checkins">, "id" | "difficulty" | "comment" | "created_at"> | null;
}

/* ------------------------------------------------------------------ */
/* Utilidades de fecha                                                  */
/* ------------------------------------------------------------------ */

const ymdFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Fecha de hoy en Tucumán como YYYY-MM-DD (comparable con `classes.class_date`). */
export function todayYmd(): string {
  return ymdFmt.format(new Date());
}

/** Asigna hoy / próxima (la primera futura) / futura / pasada a cada clase, ordenada por fecha. */
export function withTemporalState<T extends { class_date: string; sort_order: number }>(
  rows: T[],
  today = todayYmd(),
): (T & { state: ClassTemporalState })[] {
  const sorted = [...rows].sort(
    (a, b) => a.class_date.localeCompare(b.class_date) || a.sort_order - b.sort_order,
  );
  let nextAssigned = false;
  return sorted.map((r) => {
    let state: ClassTemporalState;
    if (r.class_date < today) state = "pasada";
    else if (r.class_date === today) state = "hoy";
    else if (!nextAssigned) {
      state = "proxima";
      nextAssigned = true;
    } else state = "futura";
    return { ...r, state };
  });
}

/* ------------------------------------------------------------------ */
/* Queries                                                              */
/* ------------------------------------------------------------------ */

const MATERIAL_BUCKET = "class-materials";
const SIGNED_URL_TTL = 60 * 60; // 1 h

interface RawClassRow {
  id: string;
  course_id: string;
  class_date: string;
  topic: string;
  summary: string | null;
  sort_order: number;
  teacher: TeacherRef | TeacherRef[] | null;
  recordings: { id: string }[] | null;
  materials: { id: string }[] | null;
}

function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

/** Cronograma de todos los cursos del estudiante. RLS ya limita grabaciones a publicadas. */
export async function getStudentClasses(
  supabase: DbClient,
  courses: { id: string; name: string }[],
): Promise<ClassListItem[]> {
  if (courses.length === 0) return [];
  const { data, error } = await supabase
    .from("classes")
    .select(
      "id, course_id, class_date, topic, summary, sort_order, teacher:profiles(id, full_name, avatar_url), recordings:class_recordings(id), materials:class_materials(id)",
    )
    .in(
      "course_id",
      courses.map((c) => c.id),
    );
  if (error) {
    console.error("[clases] getStudentClasses", { error });
    throw new Error("No se pudo cargar el cronograma. Probá de nuevo en unos segundos.");
  }
  const names = new Map(courses.map((c) => [c.id, c.name]));
  const rows = (data as unknown as RawClassRow[]).map((r) => ({
    id: r.id,
    course_id: r.course_id,
    course_name: names.get(r.course_id) ?? "Curso",
    class_date: r.class_date,
    topic: r.topic,
    summary: r.summary,
    sort_order: r.sort_order,
    teacher: one(r.teacher),
    recordings_count: r.recordings?.length ?? 0,
    materials_count: r.materials?.length ?? 0,
  }));
  return withTemporalState(rows);
}

interface RawMaterial {
  id: string;
  title: string;
  kind: Enums<"material_kind">;
  url: string | null;
  storage_path: string | null;
}

async function resolveMaterials(supabase: DbClient, rows: RawMaterial[]): Promise<MaterialItem[]> {
  return Promise.all(
    rows.map(async (m) => {
      if (m.storage_path) {
        const { data, error } = await supabase.storage
          .from(MATERIAL_BUCKET)
          .createSignedUrl(m.storage_path, SIGNED_URL_TTL);
        if (error || !data?.signedUrl) {
          console.error("[clases] no se pudo firmar material", { id: m.id, path: m.storage_path, error });
          return { id: m.id, title: m.title, kind: m.kind, href: null, is_file: true };
        }
        return { id: m.id, title: m.title, kind: m.kind, href: data.signedUrl, is_file: true };
      }
      return { id: m.id, title: m.title, kind: m.kind, href: m.url, is_file: false };
    }),
  );
}

interface RawRecording {
  id: string;
  title: string | null;
  duration_seconds: number | null;
  created_at: string;
  status: Enums<"recording_status">;
  summaries: Tables<"class_summaries">[] | null;
  cards: Pick<Tables<"interactive_cards">, "id" | "cards" | "created_at">[] | null;
  simplified: Pick<Tables<"simplified_content">, "level" | "content_md">[] | null;
  transcript: Pick<Tables<"transcripts">, "full_text" | "segments"> | Pick<Tables<"transcripts">, "full_text" | "segments">[] | null;
}

const RECORDING_SELECT =
  "id, title, duration_seconds, created_at, status, summaries:class_summaries(*), cards:interactive_cards(id, cards, created_at), simplified:simplified_content(level, content_md), transcript:transcripts(full_text, segments)";

function latest<T extends { created_at: string }>(rows: T[] | null | undefined): T | null {
  if (!rows || rows.length === 0) return null;
  return [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
}

function toRecordingContent(r: RawRecording, progress: CardProgressRow[]): RecordingContent {
  const summary = latest(r.summaries);
  const cards = latest(r.cards);
  const transcript = one(r.transcript);
  const facil = r.simplified?.find((s) => s.level === "facil")?.content_md ?? null;
  const intermedio = r.simplified?.find((s) => s.level === "intermedio")?.content_md ?? null;
  return {
    id: r.id,
    title: r.title,
    duration_seconds: r.duration_seconds,
    created_at: r.created_at,
    summary: summary
      ? {
          summary_md: summary.summary_md,
          key_points: parseKeyPoints(summary.key_points),
          sections: parseSections(summary.sections),
          glossary: parseGlossary(summary.glossary),
        }
      : null,
    cards: cards ? parseCards(cards.cards) : [],
    simplified: { facil, intermedio },
    transcript: transcript
      ? { full_text: transcript.full_text, segments: parseSegments(transcript.segments) }
      : null,
    progress,
  };
}

async function getProgressByRecording(
  supabase: DbClient,
  studentId: string,
  recordingIds: string[],
): Promise<Map<string, CardProgressRow[]>> {
  const map = new Map<string, CardProgressRow[]>();
  if (recordingIds.length === 0) return map;
  const { data, error } = await supabase
    .from("card_progress")
    .select("recording_id, card_index, known, attempts, correct")
    .eq("student_id", studentId)
    .in("recording_id", recordingIds);
  if (error) {
    // No bloquea la pantalla: el progreso es accesorio.
    console.error("[clases] card_progress", { error });
    return map;
  }
  for (const row of data ?? []) {
    const list = map.get(row.recording_id) ?? [];
    list.push({ card_index: row.card_index, known: row.known, attempts: row.attempts, correct: row.correct });
    map.set(row.recording_id, list);
  }
  return map;
}

/** Detalle completo de una clase para el estudiante. Null si no existe o RLS la oculta. */
export async function getClassDetail(
  supabase: DbClient,
  studentId: string,
  classId: string,
): Promise<ClassDetail | null> {
  const { data: cls, error } = await supabase
    .from("classes")
    .select(
      "id, course_id, class_date, topic, summary, sort_order, teacher:profiles(id, full_name, avatar_url), course:courses(id, name)",
    )
    .eq("id", classId)
    .maybeSingle();
  if (error) {
    console.error("[clases] getClassDetail", { classId, error });
    throw new Error("No se pudo cargar la clase.");
  }
  if (!cls) return null;

  const [annRes, matRes, recRes, checkinRes] = await Promise.all([
    supabase
      .from("announcements")
      .select("id, title, body, created_at")
      .eq("class_id", classId)
      .order("created_at", { ascending: false }),
    supabase
      .from("class_materials")
      .select("id, title, kind, url, storage_path")
      .eq("class_id", classId)
      .order("created_at", { ascending: true }),
    supabase
      .from("class_recordings")
      .select(RECORDING_SELECT)
      .eq("class_id", classId)
      .eq("published", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("student_checkins")
      .select("id, difficulty, comment, created_at")
      .eq("class_id", classId)
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (annRes.error) console.error("[clases] announcements", { classId, error: annRes.error });
  if (matRes.error) console.error("[clases] materials", { classId, error: matRes.error });
  if (recRes.error) {
    console.error("[clases] recordings", { classId, error: recRes.error });
    throw new Error("No se pudieron cargar las grabaciones de la clase.");
  }
  if (checkinRes.error) console.error("[clases] checkin", { classId, error: checkinRes.error });

  const rawRecordings = (recRes.data ?? []) as unknown as RawRecording[];
  const [materials, progress] = await Promise.all([
    resolveMaterials(supabase, (matRes.data ?? []) as RawMaterial[]),
    getProgressByRecording(
      supabase,
      studentId,
      rawRecordings.map((r) => r.id),
    ),
  ]);

  const raw = cls as unknown as {
    id: string;
    course_id: string;
    class_date: string;
    topic: string;
    summary: string | null;
    sort_order: number;
    teacher: TeacherRef | TeacherRef[] | null;
    course: { id: string; name: string } | { id: string; name: string }[] | null;
  };
  const [stated] = withTemporalState([{ class_date: raw.class_date, sort_order: raw.sort_order }]);

  return {
    id: raw.id,
    course_id: raw.course_id,
    course_name: one(raw.course)?.name ?? "Curso",
    class_date: raw.class_date,
    topic: raw.topic,
    summary: raw.summary,
    teacher: one(raw.teacher),
    state: stated.state === "futura" ? "proxima" : stated.state,
    announcements: annRes.data ?? [],
    materials,
    recordings: rawRecordings.map((r) => toRecordingContent(r, progress.get(r.id) ?? [])),
    checkin: checkinRes.data ?? null,
  };
}

export interface RecordingForCards {
  id: string;
  title: string | null;
  class_id: string;
  class_topic: string;
  cards: IndexedCard[];
  progress: CardProgressRow[];
}

/** Grabación publicada + placas + progreso propio, para el modo inmersivo. */
export async function getRecordingForCards(
  supabase: DbClient,
  studentId: string,
  recordingId: string,
): Promise<RecordingForCards | null> {
  const { data, error } = await supabase
    .from("class_recordings")
    .select("id, title, class_id, class:classes(topic), cards:interactive_cards(id, cards, created_at)")
    .eq("id", recordingId)
    .eq("published", true)
    .maybeSingle();
  if (error) {
    console.error("[placas] getRecordingForCards", { recordingId, error });
    throw new Error("No se pudieron cargar las placas.");
  }
  if (!data) return null;
  const raw = data as unknown as {
    id: string;
    title: string | null;
    class_id: string;
    class: { topic: string } | { topic: string }[] | null;
    cards: Pick<Tables<"interactive_cards">, "id" | "cards" | "created_at">[] | null;
  };
  const progress = await getProgressByRecording(supabase, studentId, [raw.id]);
  const set = latest(raw.cards);
  return {
    id: raw.id,
    title: raw.title,
    class_id: raw.class_id,
    class_topic: one(raw.class)?.topic ?? "Clase",
    cards: set ? parseCards(set.cards) : [],
    progress: progress.get(raw.id) ?? [],
  };
}
