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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      employees: {
        Row: {
          ativo: boolean | null
          cargo: string | null
          cpf_encrypted: string | null
          cpf_hash: string
          created_at: string | null
          data_admissao: string | null
          failed_attempts: number | null
          foto_cadastro_url: string | null
          id: string
          locked_until: string | null
          nome: string
          pin_hash: string
          setor: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          cargo?: string | null
          cpf_encrypted?: string | null
          cpf_hash: string
          created_at?: string | null
          data_admissao?: string | null
          failed_attempts?: number | null
          foto_cadastro_url?: string | null
          id?: string
          locked_until?: string | null
          nome: string
          pin_hash: string
          setor?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          cargo?: string | null
          cpf_encrypted?: string | null
          cpf_hash?: string
          created_at?: string | null
          data_admissao?: string | null
          failed_attempts?: number | null
          foto_cadastro_url?: string | null
          id?: string
          locked_until?: string | null
          nome?: string
          pin_hash?: string
          setor?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      hour_bank_balance: {
        Row: {
          balance_minutes: number | null
          employee_id: string
          updated_at: string | null
        }
        Insert: {
          balance_minutes?: number | null
          employee_id: string
          updated_at?: string | null
        }
        Update: {
          balance_minutes?: number | null
          employee_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hour_bank_balance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hour_bank_ledger: {
        Row: {
          approval_status: Database["public"]["Enums"]["approval_status"] | null
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          employee_id: string
          id: string
          minutes: number
          ref_date: string
          source: Database["public"]["Enums"]["hour_bank_source"]
        }
        Insert: {
          approval_status?:
            | Database["public"]["Enums"]["approval_status"]
            | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          employee_id: string
          id?: string
          minutes: number
          ref_date: string
          source: Database["public"]["Enums"]["hour_bank_source"]
        }
        Update: {
          approval_status?:
            | Database["public"]["Enums"]["approval_status"]
            | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          employee_id?: string
          id?: string
          minutes?: number
          ref_date?: string
          source?: Database["public"]["Enums"]["hour_bank_source"]
        }
        Relationships: [
          {
            foreignKeyName: "hour_bank_ledger_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          attempted_at: string | null
          cpf_hash: string
          device_id: string | null
          id: string
          ip_address: string | null
          success: boolean
        }
        Insert: {
          attempted_at?: string | null
          cpf_hash: string
          device_id?: string | null
          id?: string
          ip_address?: string | null
          success: boolean
        }
        Update: {
          attempted_at?: string | null
          cpf_hash?: string
          device_id?: string | null
          id?: string
          ip_address?: string | null
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "login_attempts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "time_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      time_devices: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          device_secret_hash: string
          id: string
          nome: string
          unidade: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          device_secret_hash: string
          id?: string
          nome: string
          unidade: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          device_secret_hash?: string
          id?: string
          nome?: string
          unidade?: string
        }
        Relationships: []
      }
      time_punches: {
        Row: {
          created_at: string | null
          device_id: string
          employee_id: string
          id: string
          punch_type: Database["public"]["Enums"]["punch_type"]
          punched_at: string | null
          selfie_url: string
          status: Database["public"]["Enums"]["punch_status"] | null
          unidade: string
        }
        Insert: {
          created_at?: string | null
          device_id: string
          employee_id: string
          id?: string
          punch_type: Database["public"]["Enums"]["punch_type"]
          punched_at?: string | null
          selfie_url: string
          status?: Database["public"]["Enums"]["punch_status"] | null
          unidade: string
        }
        Update: {
          created_at?: string | null
          device_id?: string
          employee_id?: string
          id?: string
          punch_type?: Database["public"]["Enums"]["punch_type"]
          punched_at?: string | null
          selfie_url?: string
          status?: Database["public"]["Enums"]["punch_status"] | null
          unidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_punches_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "time_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_punches_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheets_daily: {
        Row: {
          balance_minutes: number | null
          break_minutes: number | null
          created_at: string | null
          employee_id: string
          expected_minutes: number | null
          first_punch_at: string | null
          id: string
          last_punch_at: string | null
          notes: string | null
          status: Database["public"]["Enums"]["timesheet_status"] | null
          updated_at: string | null
          work_date: string
          worked_minutes: number | null
        }
        Insert: {
          balance_minutes?: number | null
          break_minutes?: number | null
          created_at?: string | null
          employee_id: string
          expected_minutes?: number | null
          first_punch_at?: string | null
          id?: string
          last_punch_at?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["timesheet_status"] | null
          updated_at?: string | null
          work_date: string
          worked_minutes?: number | null
        }
        Update: {
          balance_minutes?: number | null
          break_minutes?: number | null
          created_at?: string | null
          employee_id?: string
          expected_minutes?: number | null
          first_punch_at?: string | null
          id?: string
          last_punch_at?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["timesheet_status"] | null
          updated_at?: string | null
          work_date?: string
          worked_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "timesheets_daily_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      work_schedules: {
        Row: {
          break_minutes: number | null
          break_required: boolean | null
          created_at: string | null
          employee_id: string
          expected_end: string | null
          expected_start: string | null
          id: string
          min_extra_minutes_to_count: number | null
          schedule_type: Database["public"]["Enums"]["schedule_type"]
          tolerance_early_minutes: number | null
          tolerance_late_minutes: number | null
          updated_at: string | null
          weekly_days: Json
        }
        Insert: {
          break_minutes?: number | null
          break_required?: boolean | null
          created_at?: string | null
          employee_id: string
          expected_end?: string | null
          expected_start?: string | null
          id?: string
          min_extra_minutes_to_count?: number | null
          schedule_type?: Database["public"]["Enums"]["schedule_type"]
          tolerance_early_minutes?: number | null
          tolerance_late_minutes?: number | null
          updated_at?: string | null
          weekly_days?: Json
        }
        Update: {
          break_minutes?: number | null
          break_required?: boolean | null
          created_at?: string | null
          employee_id?: string
          expected_end?: string | null
          expected_start?: string | null
          id?: string
          min_extra_minutes_to_count?: number | null
          schedule_type?: Database["public"]["Enums"]["schedule_type"]
          tolerance_early_minutes?: number | null
          tolerance_late_minutes?: number | null
          updated_at?: string | null
          weekly_days?: Json
        }
        Relationships: [
          {
            foreignKeyName: "work_schedules_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_rh: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "rh" | "gestor" | "colaborador"
      approval_status: "aprovado" | "pendente" | "rejeitado"
      hour_bank_source:
        | "automatico"
        | "ajuste_manual"
        | "abono"
        | "atestado"
        | "compensacao"
      punch_status: "ok" | "suspeito" | "ajustado" | "pendente"
      punch_type: "entrada" | "saida" | "intervalo_inicio" | "intervalo_fim"
      schedule_type: "fixa" | "flexivel" | "escala"
      timesheet_status: "ok" | "pendente" | "revisao" | "ajustado" | "falta"
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
      app_role: ["admin", "rh", "gestor", "colaborador"],
      approval_status: ["aprovado", "pendente", "rejeitado"],
      hour_bank_source: [
        "automatico",
        "ajuste_manual",
        "abono",
        "atestado",
        "compensacao",
      ],
      punch_status: ["ok", "suspeito", "ajustado", "pendente"],
      punch_type: ["entrada", "saida", "intervalo_inicio", "intervalo_fim"],
      schedule_type: ["fixa", "flexivel", "escala"],
      timesheet_status: ["ok", "pendente", "revisao", "ajustado", "falta"],
    },
  },
} as const
