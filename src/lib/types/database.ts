export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          class_id: string | null
          content: Json
          course_id: string
          created_at: string
          created_by: string
          due_at: string | null
          id: string
          instructions_md: string | null
          max_score: number | null
          published_at: string | null
          recording_id: string | null
          status: Database["public"]["Enums"]["activity_status"]
          target: Database["public"]["Enums"]["activity_target"]
          title: string
          type: Database["public"]["Enums"]["activity_type"]
          updated_at: string
        }
        Insert: {
          class_id?: string | null
          content?: Json
          course_id: string
          created_at?: string
          created_by: string
          due_at?: string | null
          id?: string
          instructions_md?: string | null
          max_score?: number | null
          published_at?: string | null
          recording_id?: string | null
          status?: Database["public"]["Enums"]["activity_status"]
          target?: Database["public"]["Enums"]["activity_target"]
          title: string
          type?: Database["public"]["Enums"]["activity_type"]
          updated_at?: string
        }
        Update: {
          class_id?: string | null
          content?: Json
          course_id?: string
          created_at?: string
          created_by?: string
          due_at?: string | null
          id?: string
          instructions_md?: string | null
          max_score?: number | null
          published_at?: string | null
          recording_id?: string | null
          status?: Database["public"]["Enums"]["activity_status"]
          target?: Database["public"]["Enums"]["activity_target"]
          title?: string
          type?: Database["public"]["Enums"]["activity_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_course_engagement"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "class_recordings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "v_recording_status"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_assignments: {
        Row: {
          activity_id: string
          assigned_by: string | null
          created_at: string
          student_id: string
        }
        Insert: {
          activity_id: string
          assigned_by?: string | null
          created_at?: string
          student_id: string
        }
        Update: {
          activity_id?: string
          assigned_by?: string | null
          created_at?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_assignments_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_submissions: {
        Row: {
          activity_id: string
          ai_feedback_md: string | null
          answers: Json
          auto_score: number | null
          graded_at: string | null
          graded_by: string | null
          id: string
          score: number | null
          started_at: string
          status: Database["public"]["Enums"]["submission_status"]
          student_id: string
          submitted_at: string | null
          teacher_feedback_md: string | null
          time_spent_seconds: number
        }
        Insert: {
          activity_id: string
          ai_feedback_md?: string | null
          answers?: Json
          auto_score?: number | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          score?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["submission_status"]
          student_id: string
          submitted_at?: string | null
          teacher_feedback_md?: string | null
          time_spent_seconds?: number
        }
        Update: {
          activity_id?: string
          ai_feedback_md?: string | null
          answers?: Json
          auto_score?: number | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          score?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["submission_status"]
          student_id?: string
          submitted_at?: string | null
          teacher_feedback_md?: string | null
          time_spent_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "activity_submissions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_submissions_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_feedback: {
        Row: {
          created_at: string
          feedback_md: string
          id: string
          model: string | null
          recording_id: string | null
          student_id: string
        }
        Insert: {
          created_at?: string
          feedback_md: string
          id?: string
          model?: string | null
          recording_id?: string | null
          student_id: string
        }
        Update: {
          created_at?: string
          feedback_md?: string
          id?: string
          model?: string | null
          recording_id?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_feedback_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "class_recordings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_feedback_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "v_recording_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_feedback_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      alberdi_conversations: {
        Row: {
          class_id: string | null
          course_id: string
          created_at: string
          id: string
          student_id: string
          title: string
          updated_at: string
        }
        Insert: {
          class_id?: string | null
          course_id: string
          created_at?: string
          id?: string
          student_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          class_id?: string | null
          course_id?: string
          created_at?: string
          id?: string
          student_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alberdi_conversations_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alberdi_conversations_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alberdi_conversations_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_course_engagement"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "alberdi_conversations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      alberdi_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          model: string | null
          refused: boolean
          role: Database["public"]["Enums"]["alberdi_role"]
          sources: Json
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          model?: string | null
          refused?: boolean
          role: Database["public"]["Enums"]["alberdi_role"]
          sources?: Json
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          model?: string | null
          refused?: boolean
          role?: Database["public"]["Enums"]["alberdi_role"]
          sources?: Json
        }
        Relationships: [
          {
            foreignKeyName: "alberdi_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "alberdi_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          author_id: string
          body: string
          class_id: string | null
          course_id: string
          created_at: string
          id: string
          title: string
        }
        Insert: {
          author_id: string
          body: string
          class_id?: string | null
          course_id: string
          created_at?: string
          id?: string
          title: string
        }
        Update: {
          author_id?: string
          body?: string
          class_id?: string | null
          course_id?: string
          created_at?: string
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_course_engagement"
            referencedColumns: ["course_id"]
          },
        ]
      }
      avatar_items: {
        Row: {
          description: string
          id: string
          name: string
          rarity: Database["public"]["Enums"]["avatar_rarity"]
          req_badge: string | null
          req_kind: Database["public"]["Enums"]["avatar_req"]
          req_value: number
          slot: Database["public"]["Enums"]["avatar_slot"]
          sort: number
        }
        Insert: {
          description: string
          id: string
          name: string
          rarity?: Database["public"]["Enums"]["avatar_rarity"]
          req_badge?: string | null
          req_kind?: Database["public"]["Enums"]["avatar_req"]
          req_value?: number
          slot: Database["public"]["Enums"]["avatar_slot"]
          sort?: number
        }
        Update: {
          description?: string
          id?: string
          name?: string
          rarity?: Database["public"]["Enums"]["avatar_rarity"]
          req_badge?: string | null
          req_kind?: Database["public"]["Enums"]["avatar_req"]
          req_value?: number
          slot?: Database["public"]["Enums"]["avatar_slot"]
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "avatar_items_req_badge_fkey"
            columns: ["req_badge"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          description: string
          icon: string
          id: string
          name: string
          sort: number
          tier: Database["public"]["Enums"]["badge_tier"]
        }
        Insert: {
          description: string
          icon: string
          id: string
          name: string
          sort?: number
          tier?: Database["public"]["Enums"]["badge_tier"]
        }
        Update: {
          description?: string
          icon?: string
          id?: string
          name?: string
          sort?: number
          tier?: Database["public"]["Enums"]["badge_tier"]
        }
        Relationships: []
      }
      card_progress: {
        Row: {
          attempts: number
          card_index: number
          correct: number
          known: boolean
          last_seen_at: string
          recording_id: string
          student_id: string
        }
        Insert: {
          attempts?: number
          card_index: number
          correct?: number
          known?: boolean
          last_seen_at?: string
          recording_id: string
          student_id: string
        }
        Update: {
          attempts?: number
          card_index?: number
          correct?: number
          known?: boolean
          last_seen_at?: string
          recording_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_progress_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "class_recordings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_progress_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "v_recording_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      class_materials: {
        Row: {
          class_id: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["material_kind"]
          storage_path: string | null
          title: string
          uploaded_by: string
          url: string | null
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["material_kind"]
          storage_path?: string | null
          title: string
          uploaded_by: string
          url?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["material_kind"]
          storage_path?: string | null
          title?: string
          uploaded_by?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_materials_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_materials_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      class_recordings: {
        Row: {
          chunks_done: number
          chunks_total: number
          class_id: string
          created_at: string
          current_step: string | null
          duration_seconds: number | null
          error_message: string | null
          generation_model: string | null
          id: string
          mime_type: string | null
          processing_log: Json
          progress: number
          published: boolean
          size_bytes: number | null
          status: Database["public"]["Enums"]["recording_status"]
          storage_path: string
          title: string | null
          transcription_model: string | null
          uploaded_by: string
        }
        Insert: {
          chunks_done?: number
          chunks_total?: number
          class_id: string
          created_at?: string
          current_step?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          generation_model?: string | null
          id?: string
          mime_type?: string | null
          processing_log?: Json
          progress?: number
          published?: boolean
          size_bytes?: number | null
          status?: Database["public"]["Enums"]["recording_status"]
          storage_path: string
          title?: string | null
          transcription_model?: string | null
          uploaded_by: string
        }
        Update: {
          chunks_done?: number
          chunks_total?: number
          class_id?: string
          created_at?: string
          current_step?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          generation_model?: string | null
          id?: string
          mime_type?: string | null
          processing_log?: Json
          progress?: number
          published?: boolean
          size_bytes?: number | null
          status?: Database["public"]["Enums"]["recording_status"]
          storage_path?: string
          title?: string | null
          transcription_model?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_recordings_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_recordings_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      class_summaries: {
        Row: {
          created_at: string
          glossary: Json
          id: string
          key_points: Json
          model: string | null
          recording_id: string
          sections: Json
          summary_md: string
        }
        Insert: {
          created_at?: string
          glossary?: Json
          id?: string
          key_points?: Json
          model?: string | null
          recording_id: string
          sections?: Json
          summary_md: string
        }
        Update: {
          created_at?: string
          glossary?: Json
          id?: string
          key_points?: Json
          model?: string | null
          recording_id?: string
          sections?: Json
          summary_md?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_summaries_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "class_recordings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_summaries_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "v_recording_status"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          class_date: string
          course_id: string
          created_at: string
          id: string
          sort_order: number
          summary: string | null
          teacher_id: string | null
          topic: string
        }
        Insert: {
          class_date: string
          course_id: string
          created_at?: string
          id?: string
          sort_order?: number
          summary?: string | null
          teacher_id?: string | null
          topic: string
        }
        Update: {
          class_date?: string
          course_id?: string
          created_at?: string
          id?: string
          sort_order?: number
          summary?: string | null
          teacher_id?: string | null
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_course_engagement"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "classes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_games: {
        Row: {
          course_id: string
          enabled: boolean
          game: Database["public"]["Enums"]["game_key"]
          updated_at: string
        }
        Insert: {
          course_id: string
          enabled?: boolean
          game: Database["public"]["Enums"]["game_key"]
          updated_at?: string
        }
        Update: {
          course_id?: string
          enabled?: boolean
          game?: Database["public"]["Enums"]["game_key"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_games_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_games_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_course_engagement"
            referencedColumns: ["course_id"]
          },
        ]
      }
      courses: {
        Row: {
          created_at: string
          enrollment_code: string
          id: string
          is_default: boolean
          name: string
          subject_id: string
          term: string
        }
        Insert: {
          created_at?: string
          enrollment_code?: string
          id?: string
          is_default?: boolean
          name: string
          subject_id: string
          term: string
        }
        Update: {
          created_at?: string
          enrollment_code?: string
          id?: string
          is_default?: boolean
          name?: string
          subject_id?: string
          term?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      debate_arguments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          debate_id: string
          hidden_by: string | null
          hidden_reason: string | null
          id: string
          parent_id: string | null
          stance: Database["public"]["Enums"]["debate_stance"]
          status: Database["public"]["Enums"]["argument_status"]
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          debate_id: string
          hidden_by?: string | null
          hidden_reason?: string | null
          id?: string
          parent_id?: string | null
          stance: Database["public"]["Enums"]["debate_stance"]
          status?: Database["public"]["Enums"]["argument_status"]
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          debate_id?: string
          hidden_by?: string | null
          hidden_reason?: string | null
          id?: string
          parent_id?: string | null
          stance?: Database["public"]["Enums"]["debate_stance"]
          status?: Database["public"]["Enums"]["argument_status"]
        }
        Relationships: [
          {
            foreignKeyName: "debate_arguments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debate_arguments_debate_id_fkey"
            columns: ["debate_id"]
            isOneToOne: false
            referencedRelation: "debates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debate_arguments_hidden_by_fkey"
            columns: ["hidden_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debate_arguments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "debate_arguments"
            referencedColumns: ["id"]
          },
        ]
      }
      debate_supports: {
        Row: {
          argument_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          argument_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          argument_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debate_supports_argument_id_fkey"
            columns: ["argument_id"]
            isOneToOne: false
            referencedRelation: "debate_arguments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debate_supports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      debates: {
        Row: {
          ai_synthesis_md: string | null
          class_id: string | null
          closes_at: string | null
          context_md: string | null
          course_id: string
          created_at: string
          created_by: string
          id: string
          recording_id: string | null
          status: Database["public"]["Enums"]["debate_status"]
          title: string
        }
        Insert: {
          ai_synthesis_md?: string | null
          class_id?: string | null
          closes_at?: string | null
          context_md?: string | null
          course_id: string
          created_at?: string
          created_by: string
          id?: string
          recording_id?: string | null
          status?: Database["public"]["Enums"]["debate_status"]
          title: string
        }
        Update: {
          ai_synthesis_md?: string | null
          class_id?: string | null
          closes_at?: string | null
          context_md?: string | null
          course_id?: string
          created_at?: string
          created_by?: string
          id?: string
          recording_id?: string | null
          status?: Database["public"]["Enums"]["debate_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "debates_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_course_engagement"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "debates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debates_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "class_recordings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debates_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "v_recording_status"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          course_id: string
          created_at: string
          status: string
          student_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          status?: string
          student_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_course_engagement"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      faculty: {
        Row: {
          created_at: string
          full_name: string
          id: string
          position: string
          profile_id: string | null
          rank: number
          subject_id: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          position: string
          profile_id?: string | null
          rank?: number
          subject_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          position?: string
          profile_id?: string | null
          rank?: number
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "faculty_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faculty_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      game_challenges: {
        Row: {
          class_id: string | null
          correct_index: number
          course_id: string
          created_at: string
          difficulty: number
          explanation: string | null
          game: Database["public"]["Enums"]["game_key"]
          id: string
          options: Json
          prompt: string
          recording_id: string | null
          source_quote: string | null
          source_seconds: number | null
        }
        Insert: {
          class_id?: string | null
          correct_index: number
          course_id: string
          created_at?: string
          difficulty?: number
          explanation?: string | null
          game: Database["public"]["Enums"]["game_key"]
          id?: string
          options?: Json
          prompt: string
          recording_id?: string | null
          source_quote?: string | null
          source_seconds?: number | null
        }
        Update: {
          class_id?: string | null
          correct_index?: number
          course_id?: string
          created_at?: string
          difficulty?: number
          explanation?: string | null
          game?: Database["public"]["Enums"]["game_key"]
          id?: string
          options?: Json
          prompt?: string
          recording_id?: string | null
          source_quote?: string | null
          source_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "game_challenges_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_challenges_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_challenges_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_course_engagement"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "game_challenges_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "class_recordings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_challenges_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "v_recording_status"
            referencedColumns: ["id"]
          },
        ]
      }
      game_runs: {
        Row: {
          class_id: string | null
          correct: number
          course_id: string
          created_at: string
          duration_seconds: number | null
          game: Database["public"]["Enums"]["game_key"]
          id: string
          student_id: string
          total: number
          xp: number
        }
        Insert: {
          class_id?: string | null
          correct?: number
          course_id: string
          created_at?: string
          duration_seconds?: number | null
          game: Database["public"]["Enums"]["game_key"]
          id?: string
          student_id: string
          total?: number
          xp?: number
        }
        Update: {
          class_id?: string | null
          correct?: number
          course_id?: string
          created_at?: string
          duration_seconds?: number | null
          game?: Database["public"]["Enums"]["game_key"]
          id?: string
          student_id?: string
          total?: number
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_runs_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_runs_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_runs_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_course_engagement"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "game_runs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      interactive_cards: {
        Row: {
          cards: Json
          created_at: string
          id: string
          model: string | null
          recording_id: string
        }
        Insert: {
          cards?: Json
          created_at?: string
          id?: string
          model?: string | null
          recording_id: string
        }
        Update: {
          cards?: Json
          created_at?: string
          id?: string
          model?: string | null
          recording_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interactive_cards_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "class_recordings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactive_cards_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "v_recording_status"
            referencedColumns: ["id"]
          },
        ]
      }
      live_prompts: {
        Row: {
          class_id: string
          created_at: string
          created_by: string | null
          display_order: number
          id: string
          question: string
          type: Database["public"]["Enums"]["live_prompt_type"]
        }
        Insert: {
          class_id: string
          created_at?: string
          created_by?: string | null
          display_order?: number
          id?: string
          question: string
          type?: Database["public"]["Enums"]["live_prompt_type"]
        }
        Update: {
          class_id?: string
          created_at?: string
          created_by?: string | null
          display_order?: number
          id?: string
          question?: string
          type?: Database["public"]["Enums"]["live_prompt_type"]
        }
        Relationships: [
          {
            foreignKeyName: "live_prompts_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_prompts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      live_responses: {
        Row: {
          created_at: string
          id: string
          normalized_word: string
          participant_id: string
          prompt_id: string
          session_id: string
          word: string
        }
        Insert: {
          created_at?: string
          id?: string
          normalized_word: string
          participant_id: string
          prompt_id: string
          session_id: string
          word: string
        }
        Update: {
          created_at?: string
          id?: string
          normalized_word?: string
          participant_id?: string
          prompt_id?: string
          session_id?: string
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_responses_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_responses_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "live_prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_responses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      live_sessions: {
        Row: {
          active_prompt_id: string | null
          class_id: string
          class_topic: string | null
          code: string
          created_at: string
          created_by: string
          ended_at: string | null
          id: string
          started_at: string | null
          status: Database["public"]["Enums"]["live_session_status"]
        }
        Insert: {
          active_prompt_id?: string | null
          class_id: string
          class_topic?: string | null
          code: string
          created_at?: string
          created_by: string
          ended_at?: string | null
          id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["live_session_status"]
        }
        Update: {
          active_prompt_id?: string | null
          class_id?: string
          class_topic?: string | null
          code?: string
          created_at?: string
          created_by?: string
          ended_at?: string | null
          id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["live_session_status"]
        }
        Relationships: [
          {
            foreignKeyName: "live_sessions_active_prompt_id_fkey"
            columns: ["active_prompt_id"]
            isOneToOne: false
            referencedRelation: "live_prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_campaigns: {
        Row: {
          body: string
          channels: Database["public"]["Enums"]["delivery_channel"][]
          completed_at: string | null
          course_id: string | null
          created_at: string
          created_by: string
          failed_count: number
          id: string
          recipient_ids: string[]
          recipients_count: number
          sent_count: number
          target: Database["public"]["Enums"]["activity_target"]
          title: string
          url: string | null
        }
        Insert: {
          body: string
          channels?: Database["public"]["Enums"]["delivery_channel"][]
          completed_at?: string | null
          course_id?: string | null
          created_at?: string
          created_by: string
          failed_count?: number
          id?: string
          recipient_ids?: string[]
          recipients_count?: number
          sent_count?: number
          target?: Database["public"]["Enums"]["activity_target"]
          title: string
          url?: string | null
        }
        Update: {
          body?: string
          channels?: Database["public"]["Enums"]["delivery_channel"][]
          completed_at?: string | null
          course_id?: string | null
          created_at?: string
          created_by?: string
          failed_count?: number
          id?: string
          recipient_ids?: string[]
          recipients_count?: number
          sent_count?: number
          target?: Database["public"]["Enums"]["activity_target"]
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_campaigns_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_campaigns_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_course_engagement"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "notification_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          attempts: number
          channel: Database["public"]["Enums"]["delivery_channel"]
          created_at: string
          error: string | null
          id: string
          notification_id: string
          provider_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["delivery_status"]
        }
        Insert: {
          attempts?: number
          channel: Database["public"]["Enums"]["delivery_channel"]
          created_at?: string
          error?: string | null
          id?: string
          notification_id: string
          provider_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
        }
        Update: {
          attempts?: number
          channel?: Database["public"]["Enums"]["delivery_channel"]
          created_at?: string
          error?: string | null
          id?: string
          notification_id?: string
          provider_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          email_enabled: boolean
          muted_kinds: Database["public"]["Enums"]["notification_kind"][]
          push_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          email_enabled?: boolean
          muted_kinds?: Database["public"]["Enums"]["notification_kind"][]
          push_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          email_enabled?: boolean
          muted_kinds?: Database["public"]["Enums"]["notification_kind"][]
          push_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          course_id: string | null
          created_at: string
          created_by: string | null
          data: Json
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          read_at: string | null
          title: string
          url: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          data?: Json
          id?: string
          kind: Database["public"]["Enums"]["notification_kind"]
          read_at?: string | null
          title: string
          url?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          data?: Json
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          read_at?: string | null
          title?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_course_engagement"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "notifications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_responses: {
        Row: {
          created_at: string
          free_text: string | null
          option_index: number | null
          poll_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          free_text?: string | null
          option_index?: number | null
          poll_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          free_text?: string | null
          option_index?: number | null
          poll_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_responses_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_responses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          allow_free_text: boolean
          class_id: string | null
          closes_at: string | null
          course_id: string
          created_at: string
          created_by: string
          id: string
          options: Json
          question: string
          status: Database["public"]["Enums"]["poll_status"]
        }
        Insert: {
          allow_free_text?: boolean
          class_id?: string | null
          closes_at?: string | null
          course_id: string
          created_at?: string
          created_by: string
          id?: string
          options?: Json
          question: string
          status?: Database["public"]["Enums"]["poll_status"]
        }
        Update: {
          allow_free_text?: boolean
          class_id?: string | null
          closes_at?: string | null
          course_id?: string
          created_at?: string
          created_by?: string
          id?: string
          options?: Json
          question?: string
          status?: Database["public"]["Enums"]["poll_status"]
        }
        Relationships: [
          {
            foreignKeyName: "polls_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_course_engagement"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "polls_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          dni: string | null
          email: string | null
          full_name: string
          id: string
          is_anonymous: boolean
          last_seen_at: string | null
          onboarding_done: boolean
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["profile_status"]
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          dni?: string | null
          email?: string | null
          full_name: string
          id: string
          is_anonymous?: boolean
          last_seen_at?: string | null
          onboarding_done?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["profile_status"]
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          dni?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_anonymous?: boolean
          last_seen_at?: string | null
          onboarding_done?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["profile_status"]
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          failed_count: number
          id: string
          last_used_at: string | null
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          failed_count?: number
          id?: string
          last_used_at?: string | null
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          failed_count?: number
          id?: string
          last_used_at?: string | null
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recording_chunks: {
        Row: {
          chunk_index: number
          created_at: string
          duration_seconds: number | null
          error_message: string | null
          id: string
          recording_id: string
          segments: Json
          size_bytes: number | null
          start_seconds: number
          storage_path: string
          text: string | null
          transcribed: boolean
        }
        Insert: {
          chunk_index: number
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          recording_id: string
          segments?: Json
          size_bytes?: number | null
          start_seconds?: number
          storage_path: string
          text?: string | null
          transcribed?: boolean
        }
        Update: {
          chunk_index?: number
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          recording_id?: string
          segments?: Json
          size_bytes?: number | null
          start_seconds?: number
          storage_path?: string
          text?: string | null
          transcribed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "recording_chunks_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "class_recordings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recording_chunks_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "v_recording_status"
            referencedColumns: ["id"]
          },
        ]
      }
      report_requests: {
        Row: {
          completed_at: string | null
          course_id: string | null
          created_at: string
          filters: Json
          id: string
          requested_by: string
          result_md: string | null
          scope: string
          status: Database["public"]["Enums"]["report_status"]
        }
        Insert: {
          completed_at?: string | null
          course_id?: string | null
          created_at?: string
          filters?: Json
          id?: string
          requested_by: string
          result_md?: string | null
          scope: string
          status?: Database["public"]["Enums"]["report_status"]
        }
        Update: {
          completed_at?: string | null
          course_id?: string | null
          created_at?: string
          filters?: Json
          id?: string
          requested_by?: string
          result_md?: string | null
          scope?: string
          status?: Database["public"]["Enums"]["report_status"]
        }
        Relationships: [
          {
            foreignKeyName: "report_requests_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_requests_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_course_engagement"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "report_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      roster: {
        Row: {
          course_id: string
          created_at: string
          created_by: string | null
          dni: string | null
          email: string
          full_name: string | null
          id: string
          matched_profile_id: string | null
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by?: string | null
          dni?: string | null
          email: string
          full_name?: string | null
          id?: string
          matched_profile_id?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string | null
          dni?: string | null
          email?: string
          full_name?: string | null
          id?: string
          matched_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roster_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_course_engagement"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "roster_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_matched_profile_id_fkey"
            columns: ["matched_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      simplified_content: {
        Row: {
          content_md: string
          created_at: string
          id: string
          level: Database["public"]["Enums"]["simplification_level"]
          model: string | null
          recording_id: string
        }
        Insert: {
          content_md: string
          created_at?: string
          id?: string
          level: Database["public"]["Enums"]["simplification_level"]
          model?: string | null
          recording_id: string
        }
        Update: {
          content_md?: string
          created_at?: string
          id?: string
          level?: Database["public"]["Enums"]["simplification_level"]
          model?: string | null
          recording_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simplified_content_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "class_recordings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simplified_content_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "v_recording_status"
            referencedColumns: ["id"]
          },
        ]
      }
      student_avatar_items: {
        Row: {
          item_id: string
          seen: boolean
          student_id: string
          unlocked_at: string
        }
        Insert: {
          item_id: string
          seen?: boolean
          student_id: string
          unlocked_at?: string
        }
        Update: {
          item_id?: string
          seen?: boolean
          student_id?: string
          unlocked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_avatar_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "avatar_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_avatar_items_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_avatars: {
        Row: {
          build: string
          callsign: string
          chassis: string
          created_at: string
          equipped: Json
          glow: string
          student_id: string
          tone: string
          updated_at: string
        }
        Insert: {
          build?: string
          callsign: string
          chassis?: string
          created_at?: string
          equipped?: Json
          glow?: string
          student_id: string
          tone?: string
          updated_at?: string
        }
        Update: {
          build?: string
          callsign?: string
          chassis?: string
          created_at?: string
          equipped?: Json
          glow?: string
          student_id?: string
          tone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_avatars_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_badges: {
        Row: {
          awarded_at: string
          badge_id: string
          seen: boolean
          student_id: string
        }
        Insert: {
          awarded_at?: string
          badge_id: string
          seen?: boolean
          student_id: string
        }
        Update: {
          awarded_at?: string
          badge_id?: string
          seen?: boolean
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_badges_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_checkins: {
        Row: {
          class_id: string
          comment: string | null
          created_at: string
          difficulty: number
          id: string
          student_id: string
        }
        Insert: {
          class_id: string
          comment?: string | null
          created_at?: string
          difficulty: number
          id?: string
          student_id: string
        }
        Update: {
          class_id?: string
          comment?: string | null
          created_at?: string
          difficulty?: number
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_checkins_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_checkins_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_game_stats: {
        Row: {
          answered: number
          best_streak: number
          correct: number
          course_id: string
          last_played_on: string | null
          runs: number
          streak_days: number
          student_id: string
          updated_at: string
          xp: number
        }
        Insert: {
          answered?: number
          best_streak?: number
          correct?: number
          course_id: string
          last_played_on?: string | null
          runs?: number
          streak_days?: number
          student_id: string
          updated_at?: string
          xp?: number
        }
        Update: {
          answered?: number
          best_streak?: number
          correct?: number
          course_id?: string
          last_played_on?: string | null
          runs?: number
          streak_days?: number
          student_id?: string
          updated_at?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "student_game_stats_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_game_stats_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_course_engagement"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "student_game_stats_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_questions: {
        Row: {
          ai_answer_md: string | null
          answered_at: string | null
          answered_by: string | null
          class_id: string | null
          course_id: string
          created_at: string
          id: string
          is_anonymous: boolean
          is_public: boolean
          question: string
          recording_id: string | null
          status: Database["public"]["Enums"]["question_status"]
          student_id: string
          teacher_answer_md: string | null
        }
        Insert: {
          ai_answer_md?: string | null
          answered_at?: string | null
          answered_by?: string | null
          class_id?: string | null
          course_id: string
          created_at?: string
          id?: string
          is_anonymous?: boolean
          is_public?: boolean
          question: string
          recording_id?: string | null
          status?: Database["public"]["Enums"]["question_status"]
          student_id: string
          teacher_answer_md?: string | null
        }
        Update: {
          ai_answer_md?: string | null
          answered_at?: string | null
          answered_by?: string | null
          class_id?: string | null
          course_id?: string
          created_at?: string
          id?: string
          is_anonymous?: boolean
          is_public?: boolean
          question?: string
          recording_id?: string | null
          status?: Database["public"]["Enums"]["question_status"]
          student_id?: string
          teacher_answer_md?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_questions_answered_by_fkey"
            columns: ["answered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_questions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_questions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_questions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_course_engagement"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "student_questions_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "class_recordings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_questions_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "v_recording_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_questions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      teacher_alerts: {
        Row: {
          course_id: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["alert_kind"]
          message: string
          metadata: Json
          resolved: boolean
          resolved_by: string | null
          student_id: string | null
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["alert_kind"]
          message: string
          metadata?: Json
          resolved?: boolean
          resolved_by?: string | null
          student_id?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["alert_kind"]
          message?: string
          metadata?: Json
          resolved?: boolean
          resolved_by?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_alerts_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_alerts_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_course_engagement"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "teacher_alerts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_alerts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_assignments: {
        Row: {
          course_id: string
          teacher_id: string
        }
        Insert: {
          course_id: string
          teacher_id: string
        }
        Update: {
          course_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_course_engagement"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "teacher_assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transcripts: {
        Row: {
          created_at: string
          full_text: string
          id: string
          language: string
          model: string | null
          recording_id: string
          segments: Json
        }
        Insert: {
          created_at?: string
          full_text: string
          id?: string
          language?: string
          model?: string | null
          recording_id: string
          segments?: Json
        }
        Update: {
          created_at?: string
          full_text?: string
          id?: string
          language?: string
          model?: string | null
          recording_id?: string
          segments?: Json
        }
        Relationships: [
          {
            foreignKeyName: "transcripts_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: true
            referencedRelation: "class_recordings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transcripts_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: true
            referencedRelation: "v_recording_status"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_events: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string
          event_type: string
          id: string
          metadata: Json
          student_id: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type: string
          event_type: string
          id?: string
          metadata?: Json
          student_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          event_type?: string
          id?: string
          metadata?: Json
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_alberdi_stats: {
        Row: {
          conversations: number | null
          course_id: string | null
          last_at: string | null
          questions: number | null
          refused: number | null
          students: number | null
        }
        Relationships: [
          {
            foreignKeyName: "alberdi_conversations_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alberdi_conversations_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_course_engagement"
            referencedColumns: ["course_id"]
          },
        ]
      }
      v_course_engagement: {
        Row: {
          active_7d: number | null
          avg_difficulty: number | null
          course_id: string | null
          enrolled: number | null
          questions_open: number | null
          questions_total: number | null
        }
        Relationships: []
      }
      v_live_wordcloud: {
        Row: {
          display_word: string | null
          frequency: number | null
          normalized_word: string | null
          prompt_id: string | null
          session_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_responses_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "live_prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_responses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      v_recording_status: {
        Row: {
          chunks_done: number | null
          chunks_total: number | null
          class_id: string | null
          created_at: string | null
          current_step: string | null
          duration_seconds: number | null
          error_message: string | null
          has_cards: boolean | null
          has_simplified: boolean | null
          has_summary: boolean | null
          has_transcript: boolean | null
          id: string | null
          progress: number | null
          published: boolean | null
          status: Database["public"]["Enums"]["recording_status"] | null
          title: string | null
        }
        Insert: {
          chunks_done?: number | null
          chunks_total?: number | null
          class_id?: string | null
          created_at?: string | null
          current_step?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          has_cards?: never
          has_simplified?: never
          has_summary?: never
          has_transcript?: never
          id?: string | null
          progress?: number | null
          published?: boolean | null
          status?: Database["public"]["Enums"]["recording_status"] | null
          title?: string | null
        }
        Update: {
          chunks_done?: number | null
          chunks_total?: number | null
          class_id?: string | null
          created_at?: string | null
          current_step?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          has_cards?: never
          has_simplified?: never
          has_summary?: never
          has_transcript?: never
          id?: string | null
          progress?: number | null
          published?: boolean | null
          status?: Database["public"]["Enums"]["recording_status"] | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_recordings_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      auth_can_see_activity: { Args: { a_id: string }; Returns: boolean }
      auth_is_enrolled: { Args: { target_course: string }; Returns: boolean }
      auth_is_teacher_of: { Args: { target_course: string }; Returns: boolean }
      auth_profile_status: {
        Args: never
        Returns: Database["public"]["Enums"]["profile_status"]
      }
      auth_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      award_badges: { Args: { p_student: string }; Returns: undefined }
      default_course_id: { Args: never; Returns: string }
      game_leaderboard: {
        Args: { p_course: string; p_limit?: number }
        Returns: {
          callsign: string
          chassis: string
          equipped: Json
          glow: string
          nombre: string
          streak_days: number
          student_id: string
          tone: string
          xp: number
        }[]
      }
      try_uuid: { Args: { v: string }; Returns: string }
      unlock_avatar_items: { Args: { p_student: string }; Returns: undefined }
      unread_notifications_count: { Args: never; Returns: number }
    }
    Enums: {
      activity_status: "draft" | "published" | "closed"
      activity_target: "todos" | "seleccionados"
      activity_type:
        | "lectura"
        | "cuestionario"
        | "placas"
        | "entrega"
        | "debate"
        | "encuesta"
      alberdi_role: "user" | "assistant"
      alert_kind:
        | "dificultad_reiterada"
        | "bajo_desempeno"
        | "inactividad"
        | "consulta_sin_responder"
      argument_status: "visible" | "hidden"
      avatar_rarity: "comun" | "raro" | "epico" | "legendario"
      avatar_req:
        | "inicio"
        | "nivel"
        | "racha"
        | "aciertos"
        | "partidas"
        | "medalla"
      avatar_slot:
        | "visor"
        | "toga"
        | "instrumento"
        | "companion"
        | "aura"
        | "fondo"
      badge_tier: "bronce" | "plata" | "oro"
      debate_stance: "a_favor" | "en_contra" | "neutral"
      debate_status: "open" | "closed" | "archived"
      delivery_channel: "email" | "push"
      delivery_status: "pending" | "sent" | "failed" | "skipped"
      game_key: "duelo" | "momento" | "glosario"
      live_prompt_type: "nube"
      live_session_status: "draft" | "live" | "ended"
      material_kind: "pdf" | "link" | "video" | "doc" | "otro"
      notification_kind:
        | "aviso"
        | "actividad_publicada"
        | "actividad_corregida"
        | "consulta_respondida"
        | "grabacion_publicada"
        | "debate"
        | "encuesta"
        | "alerta_docente"
        | "manual"
        | "sistema"
      poll_status: "draft" | "open" | "closed"
      profile_status: "pendiente" | "validado" | "bloqueado"
      question_status:
        | "abierta"
        | "respondida_ia"
        | "respondida_docente"
        | "cerrada"
      recording_status:
        | "uploaded"
        | "transcribing"
        | "processing"
        | "generating"
        | "ready"
        | "error"
      report_status: "pending" | "processing" | "ready" | "error"
      simplification_level: "facil" | "intermedio"
      submission_status: "en_progreso" | "entregada" | "corregida" | "reabierta"
      user_role: "estudiante" | "docente" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activity_status: ["draft", "published", "closed"],
      activity_target: ["todos", "seleccionados"],
      activity_type: [
        "lectura",
        "cuestionario",
        "placas",
        "entrega",
        "debate",
        "encuesta",
      ],
      alberdi_role: ["user", "assistant"],
      alert_kind: [
        "dificultad_reiterada",
        "bajo_desempeno",
        "inactividad",
        "consulta_sin_responder",
      ],
      argument_status: ["visible", "hidden"],
      avatar_rarity: ["comun", "raro", "epico", "legendario"],
      avatar_req: [
        "inicio",
        "nivel",
        "racha",
        "aciertos",
        "partidas",
        "medalla",
      ],
      avatar_slot: [
        "visor",
        "toga",
        "instrumento",
        "companion",
        "aura",
        "fondo",
      ],
      badge_tier: ["bronce", "plata", "oro"],
      debate_stance: ["a_favor", "en_contra", "neutral"],
      debate_status: ["open", "closed", "archived"],
      delivery_channel: ["email", "push"],
      delivery_status: ["pending", "sent", "failed", "skipped"],
      game_key: ["duelo", "momento", "glosario"],
      live_prompt_type: ["nube"],
      live_session_status: ["draft", "live", "ended"],
      material_kind: ["pdf", "link", "video", "doc", "otro"],
      notification_kind: [
        "aviso",
        "actividad_publicada",
        "actividad_corregida",
        "consulta_respondida",
        "grabacion_publicada",
        "debate",
        "encuesta",
        "alerta_docente",
        "manual",
        "sistema",
      ],
      poll_status: ["draft", "open", "closed"],
      profile_status: ["pendiente", "validado", "bloqueado"],
      question_status: [
        "abierta",
        "respondida_ia",
        "respondida_docente",
        "cerrada",
      ],
      recording_status: [
        "uploaded",
        "transcribing",
        "processing",
        "generating",
        "ready",
        "error",
      ],
      report_status: ["pending", "processing", "ready", "error"],
      simplification_level: ["facil", "intermedio"],
      submission_status: ["en_progreso", "entregada", "corregida", "reabierta"],
      user_role: ["estudiante", "docente", "admin"],
    },
  },
} as const

