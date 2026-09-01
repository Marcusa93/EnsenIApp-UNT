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

/**
 * Docente a cargo. Se resuelve desde `faculty` (lectura pública) y no desde `profiles`,
 * porque la RLS de profiles sólo deja ver el propio perfil al estudiante.
 */
export interface TeacherRef {
  id: string;
  full_name: string;
  position: string | null;
}

export interface StudentCourseRef {
  id: string;
  name: string;
  subject_id: string;
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
  /** Apunte publicado: la clase tiene contenido aunque no se haya grabado. */
  has_note: boolean;
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

/** Un tramo de audio de la grabación, con URL firmada lista para el <audio>. */
export interface AudioChunk {
  url: string;
  start: number;
  duration: number;
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
  /** Vacío si el audio no está disponible (chunks sin metadatos o URLs no firmables). */
  audio: AudioChunk[];
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
  /** El texto de la clase escrito por el equipo docente (RLS ya filtra borradores). */
  note: { body_md: string; updated_at: string } | null;
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
  teacher_id: string | null;
  class_date: string;
  topic: string;
  summary: string | null;
  sort_order: number;
  recordings: { id: string }[] | null;
  materials: { id: string }[] | null;
  notes: { class_id: string }[] | { class_id: string } | null;
}

function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

/** Mapa profile_id → docente a partir de `faculty` de las materias indicadas. */
async function getFacultyByProfile(supabase: DbClient, subjectIds: string[]): Promise<Map<string, TeacherRef>> {
  const map = new Map<string, TeacherRef>();
  const ids = Array.from(new Set(subjectIds.filter(Boolean)));
  if (ids.length === 0) return map;
  const { data, error } = await supabase
    .from("faculty")
    .select("profile_id, full_name, position")
    .in("subject_id", ids);
  if (error) {
    // No bloquea: el docente es informativo.
    console.error("[clases] faculty", { error });
    return map;
  }
  for (const f of data ?? []) {
    if (f.profile_id) map.set(f.profile_id, { id: f.profile_id, full_name: f.full_name, position: f.position });
  }
  return map;
}

/** Cronograma de todos los cursos del estudiante. RLS ya limita grabaciones a publicadas. */
export async function getStudentClasses(
  supabase: DbClient,
  courses: StudentCourseRef[],
): Promise<ClassListItem[]> {
  if (courses.length === 0) return [];
  const [{ data, error }, faculty] = await Promise.all([
    supabase
      .from("classes")
      .select(
        "id, course_id, teacher_id, class_date, topic, summary, sort_order, recordings:class_recordings(id), materials:class_materials(id), notes:class_notes(class_id)",
      )
      .in(
        "course_id",
        courses.map((c) => c.id),
      ),
    getFacultyByProfile(
      supabase,
      courses.map((c) => c.subject_id),
    ),
  ]);
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
    teacher: r.teacher_id ? (faculty.get(r.teacher_id) ?? null) : null,
    recordings_count: r.recordings?.length ?? 0,
    materials_count: r.materials?.length ?? 0,
    has_note: Array.isArray(r.notes) ? r.notes.length > 0 : r.notes != null,
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

const RECORDING_BUCKET = "class-recordings";

/** Chunks de audio de grabaciones publicadas, con URL firmada por SIGNED_URL_TTL. */
async function resolveAudio(supabase: DbClient, recordingIds: string[]): Promise<Map<string, AudioChunk[]>> {
  const out = new Map<string, AudioChunk[]>();
  if (recordingIds.length === 0) return out;
  const { data, error } = await supabase
    .from("recording_chunks")
    .select("recording_id, chunk_index, storage_path, start_seconds, duration_seconds")
    .in("recording_id", recordingIds)
    .order("chunk_index", { ascending: true });
  if (error) {
    console.error("[clases] audio chunks", error);
    return out;
  }
  await Promise.all(
    (data ?? []).map(async (c) => {
      const { data: signed, error: signError } = await supabase.storage
        .from(RECORDING_BUCKET)
        .createSignedUrl(c.storage_path, SIGNED_URL_TTL);
      if (signError || !signed?.signedUrl) {
        console.error("[clases] no se pudo firmar chunk", { path: c.storage_path, signError });
        return;
      }
      const list = out.get(c.recording_id) ?? [];
      list.push({ url: signed.signedUrl, start: Number(c.start_seconds), duration: Number(c.duration_seconds ?? 0) });
      out.set(c.recording_id, list);
    }),
  );
  for (const list of out.values()) list.sort((a, b) => a.start - b.start);
  return out;
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

function toRecordingContent(r: RawRecording, progress: CardProgressRow[], audio: AudioChunk[]): RecordingContent {
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
    audio,
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
      "id, course_id, teacher_id, class_date, topic, summary, sort_order, course:courses(id, name, subject_id)",
    )
    .eq("id", classId)
    .maybeSingle();
  if (error) {
    console.error("[clases] getClassDetail", { classId, error });
    throw new Error("No se pudo cargar la clase.");
  }
  if (!cls) return null;

  const raw = cls as unknown as {
    id: string;
    course_id: string;
    teacher_id: string | null;
    class_date: string;
    topic: string;
    summary: string | null;
    sort_order: number;
    course: { id: string; name: string; subject_id: string } | { id: string; name: string; subject_id: string }[] | null;
  };
  const course = one(raw.course);

  const [annRes, matRes, noteRes, recRes, checkinRes, faculty] = await Promise.all([
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
    supabase.from("class_notes").select("body_md, updated_at").eq("class_id", classId).maybeSingle(),
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
    getFacultyByProfile(supabase, course ? [course.subject_id] : []),
  ]);

  if (annRes.error) console.error("[clases] announcements", { classId, error: annRes.error });
  if (matRes.error) console.error("[clases] materials", { classId, error: matRes.error });
  if (noteRes.error) console.error("[clases] apunte", { classId, error: noteRes.error });
  if (recRes.error) {
    console.error("[clases] recordings", { classId, error: recRes.error });
    throw new Error("No se pudieron cargar las grabaciones de la clase.");
  }
  if (checkinRes.error) console.error("[clases] checkin", { classId, error: checkinRes.error });

  const rawRecordings = (recRes.data ?? []) as unknown as RawRecording[];
  const [materials, progress, audio] = await Promise.all([
    resolveMaterials(supabase, (matRes.data ?? []) as RawMaterial[]),
    getProgressByRecording(
      supabase,
      studentId,
      rawRecordings.map((r) => r.id),
    ),
    resolveAudio(
      supabase,
      rawRecordings.map((r) => r.id),
    ),
  ]);

  const [stated] = withTemporalState([{ class_date: raw.class_date, sort_order: raw.sort_order }]);

  return {
    id: raw.id,
    course_id: raw.course_id,
    course_name: course?.name ?? "Curso",
    class_date: raw.class_date,
    topic: raw.topic,
    summary: raw.summary,
    teacher: raw.teacher_id ? (faculty.get(raw.teacher_id) ?? null) : null,
    state: stated.state === "futura" ? "proxima" : stated.state,
    announcements: annRes.data ?? [],
    materials,
    note: noteRes.data ?? null,
    recordings: rawRecordings.map((r) => toRecordingContent(r, progress.get(r.id) ?? [], audio.get(r.id) ?? [])),
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
