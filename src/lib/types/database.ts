export type UserRole = "estudiante" | "docente" | "admin";
export type RecordingStatus =
  | "uploaded"
  | "transcribing"
  | "processing"
  | "ready"
  | "error";
export type SimplificationLevel = "facil" | "intermedio";
export type ReportStatus = "pending" | "processing" | "ready" | "error";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  avatar_url: string | null;
  created_at: string;
}

export interface Subject {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Course {
  id: string;
  subject_id: string;
  name: string;
  term: string;
  enrollment_code: string;
  created_at: string;
}

export interface ClassSession {
  id: string;
  course_id: string;
  teacher_id: string | null;
  class_date: string;
  topic: string;
  summary: string | null;
  sort_order: number;
  created_at: string;
}

export interface Announcement {
  id: string;
  course_id: string;
  class_id: string | null;
  author_id: string;
  title: string;
  body: string;
  created_at: string;
}

export interface ClassRecording {
  id: string;
  class_id: string;
  storage_path: string;
  duration_seconds: number | null;
  status: RecordingStatus;
  error_message: string | null;
  uploaded_by: string;
  created_at: string;
}

export interface Transcript {
  id: string;
  recording_id: string;
  full_text: string;
  segments: { start: number; end: number; text: string }[];
  language: string;
  model: string | null;
  created_at: string;
}

export interface ClassSummary {
  id: string;
  recording_id: string;
  summary_md: string;
  key_points: string[];
  model: string | null;
  created_at: string;
}

export interface InteractiveCard {
  id: string;
  recording_id: string;
  cards: { question: string; answer: string; type: "flashcard" | "quiz" }[];
  model: string | null;
  created_at: string;
}

export interface SimplifiedContent {
  id: string;
  recording_id: string;
  level: SimplificationLevel;
  content_md: string;
  model: string | null;
  created_at: string;
}

export interface AiFeedback {
  id: string;
  student_id: string;
  recording_id: string | null;
  feedback_md: string;
  model: string | null;
  created_at: string;
}

export interface StudentCheckin {
  id: string;
  student_id: string;
  class_id: string;
  difficulty: number;
  comment: string | null;
  created_at: string;
}

export interface UsageEvent {
  id: string;
  student_id: string;
  entity_type: string;
  entity_id: string | null;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ReportRequest {
  id: string;
  requested_by: string;
  course_id: string | null;
  scope: string;
  filters: Record<string, unknown>;
  status: ReportStatus;
  result_md: string | null;
  created_at: string;
  completed_at: string | null;
}

type Table<Row, Insert = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Row>;
  Relationships: [];
};

/** Minimal typed surface for @supabase/ssr — extend as needed. */
export interface Database {
  public: {
    Tables: {
      profiles: Table<Profile>;
      subjects: Table<Subject>;
      courses: Table<Course>;
      classes: Table<ClassSession>;
      announcements: Table<Announcement>;
      class_recordings: Table<ClassRecording>;
      transcripts: Table<Transcript>;
      class_summaries: Table<ClassSummary>;
      interactive_cards: Table<InteractiveCard>;
      simplified_content: Table<SimplifiedContent>;
      ai_feedback: Table<AiFeedback>;
      student_checkins: Table<StudentCheckin>;
      usage_events: Table<UsageEvent>;
      report_requests: Table<ReportRequest>;
      teacher_assignments: Table<{ teacher_id: string; course_id: string }>;
      enrollments: Table<{ student_id: string; course_id: string; status: string; created_at: string }>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
