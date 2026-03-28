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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      clients: {
        Row: {
          arsenal_score: number
          birthdate: string | null
          budget_range: string | null
          city: string | null
          created_at: string
          email: string | null
          funnel_data: Json | null
          has_trade_in: boolean | null
          id: string
          interest: string | null
          lead_score: number
          name: string
          notes: string | null
          phone: string | null
          pipeline_stage: Database["public"]["Enums"]["pipeline_stage"]
          referred_by: string | null
          source: string | null
          status: Database["public"]["Enums"]["client_status"]
          temperature: Database["public"]["Enums"]["lead_temperature"]
          updated_at: string
        }
        Insert: {
          arsenal_score?: number
          birthdate?: string | null
          budget_range?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          funnel_data?: Json | null
          has_trade_in?: boolean | null
          id?: string
          interest?: string | null
          lead_score?: number
          name: string
          notes?: string | null
          phone?: string | null
          pipeline_stage?: Database["public"]["Enums"]["pipeline_stage"]
          referred_by?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          temperature?: Database["public"]["Enums"]["lead_temperature"]
          updated_at?: string
        }
        Update: {
          arsenal_score?: number
          birthdate?: string | null
          budget_range?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          funnel_data?: Json | null
          has_trade_in?: boolean | null
          id?: string
          interest?: string | null
          lead_score?: number
          name?: string
          notes?: string | null
          phone?: string | null
          pipeline_stage?: Database["public"]["Enums"]["pipeline_stage"]
          referred_by?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          temperature?: Database["public"]["Enums"]["lead_temperature"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      interactions: {
        Row: {
          client_id: string
          content: string
          created_at: string
          created_by: string | null
          id: string
          type: Database["public"]["Enums"]["interaction_type"]
        }
        Insert: {
          client_id: string
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          type?: Database["public"]["Enums"]["interaction_type"]
        }
        Update: {
          client_id?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          type?: Database["public"]["Enums"]["interaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "interactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          category: string
          created_at: string
          emoji: string | null
          id: string
          message: string
          title: string
          usage_count: number
          variables: string[] | null
        }
        Insert: {
          category: string
          created_at?: string
          emoji?: string | null
          id?: string
          message: string
          title: string
          usage_count?: number
          variables?: string[] | null
        }
        Update: {
          category?: string
          created_at?: string
          emoji?: string | null
          id?: string
          message?: string
          title?: string
          usage_count?: number
          variables?: string[] | null
        }
        Relationships: []
      }
      messages_sent: {
        Row: {
          channel: string
          client_id: string
          id: string
          message_content: string
          sent_at: string
          template_id: string | null
        }
        Insert: {
          channel?: string
          client_id: string
          id?: string
          message_content: string
          sent_at?: string
          template_id?: string | null
        }
        Update: {
          channel?: string
          client_id?: string
          id?: string
          message_content?: string
          sent_at?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_sent_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sent_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          acted_at: string | null
          client_id: string
          created_at: string
          id: string
          message: string | null
          priority: number
          status: string
          title: string
          type: Database["public"]["Enums"]["opportunity_type"]
        }
        Insert: {
          acted_at?: string | null
          client_id: string
          created_at?: string
          id?: string
          message?: string | null
          priority?: number
          status?: string
          title: string
          type: Database["public"]["Enums"]["opportunity_type"]
        }
        Update: {
          acted_at?: string | null
          client_id?: string
          created_at?: string
          id?: string
          message?: string | null
          priority?: number
          status?: string
          title?: string
          type?: Database["public"]["Enums"]["opportunity_type"]
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          referred_client_id: string | null
          referred_name: string | null
          referred_phone: string | null
          referrer_id: string
          reward_amount: number | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          referred_client_id?: string | null
          referred_name?: string | null
          referred_phone?: string | null
          referrer_id: string
          reward_amount?: number | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          referred_client_id?: string | null
          referred_name?: string | null
          referred_phone?: string | null
          referrer_id?: string
          reward_amount?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_client_id_fkey"
            columns: ["referred_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          client_id: string
          completed_at: string | null
          created_at: string
          due_date: string
          id: string
          reason: string
          status: string
          type: Database["public"]["Enums"]["task_type"]
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          created_at?: string
          due_date?: string
          id?: string
          reason: string
          status?: string
          type?: Database["public"]["Enums"]["task_type"]
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          created_at?: string
          due_date?: string
          id?: string
          reason?: string
          status?: string
          type?: Database["public"]["Enums"]["task_type"]
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          brand: string
          client_id: string
          created_at: string
          estimated_value: number | null
          id: string
          installments_paid: number | null
          installments_total: number | null
          is_financed: boolean | null
          km: number | null
          model: string
          monthly_payment: number | null
          status: Database["public"]["Enums"]["vehicle_status"]
          updated_at: string
          year: number | null
        }
        Insert: {
          brand: string
          client_id: string
          created_at?: string
          estimated_value?: number | null
          id?: string
          installments_paid?: number | null
          installments_total?: number | null
          is_financed?: boolean | null
          km?: number | null
          model: string
          monthly_payment?: number | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          updated_at?: string
          year?: number | null
        }
        Update: {
          brand?: string
          client_id?: string
          created_at?: string
          estimated_value?: number | null
          id?: string
          installments_paid?: number | null
          installments_total?: number | null
          is_financed?: boolean | null
          km?: number | null
          model?: string
          monthly_payment?: number | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_lead_score: {
        Args: { client_id_param: string }
        Returns: number
      }
    }
    Enums: {
      client_status: "lead" | "active" | "inactive" | "lost"
      interaction_type:
        | "whatsapp"
        | "call"
        | "visit"
        | "system"
        | "email"
        | "sms"
      lead_temperature: "hot" | "warm" | "cold" | "frozen"
      opportunity_type:
        | "trade"
        | "refinance"
        | "upsell"
        | "reactivation"
        | "birthday"
        | "milestone"
      pipeline_stage:
        | "new"
        | "contacted"
        | "interested"
        | "negotiating"
        | "closed_won"
        | "closed_lost"
        | "attending"
        | "thinking"
        | "waiting_response"
        | "scheduled"
      task_type: "opportunity" | "relationship" | "value" | "follow_up"
      vehicle_status: "current" | "sold" | "traded"
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
      client_status: ["lead", "active", "inactive", "lost"],
      interaction_type: ["whatsapp", "call", "visit", "system", "email", "sms"],
      lead_temperature: ["hot", "warm", "cold", "frozen"],
      opportunity_type: [
        "trade",
        "refinance",
        "upsell",
        "reactivation",
        "birthday",
        "milestone",
      ],
      pipeline_stage: [
        "new",
        "contacted",
        "interested",
        "negotiating",
        "closed_won",
        "closed_lost",
        "attending",
        "thinking",
        "waiting_response",
        "scheduled",
      ],
      task_type: ["opportunity", "relationship", "value", "follow_up"],
      vehicle_status: ["current", "sold", "traded"],
    },
  },
} as const
