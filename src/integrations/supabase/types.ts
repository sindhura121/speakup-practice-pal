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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          badge: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          badge: string
          earned_at?: string
          id?: string
          user_id?: string
        }
        Update: {
          badge?: string
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      match_queue: {
        Row: {
          created_at: string
          duration_sec: number
          kind: string
          level: string
          room_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_sec: number
          kind: string
          level: string
          room_id?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          duration_sec?: number
          kind?: string
          level?: string
          room_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_queue_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_sessions: {
        Row: {
          attempt_of: string | null
          config: Json
          created_at: string
          duration_sec: number
          feedback: Json
          id: string
          mode: string
          overall_score: number | null
          prompt: string
          recording_path: string | null
          scores: Json
          transcript: string | null
          user_id: string
        }
        Insert: {
          attempt_of?: string | null
          config?: Json
          created_at?: string
          duration_sec?: number
          feedback?: Json
          id?: string
          mode: string
          overall_score?: number | null
          prompt: string
          recording_path?: string | null
          scores?: Json
          transcript?: string | null
          user_id?: string
        }
        Update: {
          attempt_of?: string | null
          config?: Json
          created_at?: string
          duration_sec?: number
          feedback?: Json
          id?: string
          mode?: string
          overall_score?: number | null
          prompt?: string
          recording_path?: string | null
          scores?: Json
          transcript?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_sessions_attempt_of_fkey"
            columns: ["attempt_of"]
            isOneToOne: false
            referencedRelation: "practice_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_color: string
          created_at: string
          display_name: string
          id: string
          level: string
          xp: number
        }
        Insert: {
          avatar_color?: string
          created_at?: string
          display_name?: string
          id: string
          level?: string
          xp?: number
        }
        Update: {
          avatar_color?: string
          created_at?: string
          display_name?: string
          id?: string
          level?: string
          xp?: number
        }
        Relationships: []
      }
      prompt_history: {
        Row: {
          core_idea: string | null
          created_at: string
          id: string
          mode: string
          prompt: string
          user_id: string
        }
        Insert: {
          core_idea?: string | null
          created_at?: string
          id?: string
          mode: string
          prompt: string
          user_id?: string
        }
        Update: {
          core_idea?: string | null
          created_at?: string
          id?: string
          mode?: string
          prompt?: string
          user_id?: string
        }
        Relationships: []
      }
      room_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_ai: boolean
          personality: string | null
          room_id: string
          speaker_name: string
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_ai?: boolean
          personality?: string | null
          room_id: string
          speaker_name: string
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_ai?: boolean
          personality?: string | null
          room_id?: string
          speaker_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "room_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_participants: {
        Row: {
          display_name: string
          id: string
          joined_at: string
          left_at: string | null
          room_id: string
          side: string | null
          user_id: string
        }
        Insert: {
          display_name: string
          id?: string
          joined_at?: string
          left_at?: string | null
          room_id: string
          side?: string | null
          user_id?: string
        }
        Update: {
          display_name?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          room_id?: string
          side?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          ai_count: number
          ai_personalities: Json
          capacity: number
          code: string
          created_at: string
          duration_sec: number
          host_id: string
          id: string
          is_public: boolean
          kind: string
          started_at: string | null
          status: string
          topic: string
        }
        Insert: {
          ai_count?: number
          ai_personalities?: Json
          capacity?: number
          code: string
          created_at?: string
          duration_sec?: number
          host_id?: string
          id?: string
          is_public?: boolean
          kind: string
          started_at?: string | null
          status?: string
          topic: string
        }
        Update: {
          ai_count?: number
          ai_personalities?: Json
          capacity?: number
          code?: string
          created_at?: string
          duration_sec?: number
          host_id?: string
          id?: string
          is_public?: boolean
          kind?: string
          started_at?: string | null
          status?: string
          topic?: string
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id?: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: []
      }
      user_reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reported_user_id: string
          reporter_id: string
          room_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reported_user_id: string
          reporter_id?: string
          room_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reported_user_id?: string
          reporter_id?: string
          room_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      find_match: {
        Args: {
          _duration: number
          _kind: string
          _level: string
          _name: string
          _topic: string
        }
        Returns: string
      }
      is_room_member: {
        Args: { _room: string; _user: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
