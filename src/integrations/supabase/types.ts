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
      checklist_agendamento_employees: {
        Row: {
          agendamento_id: string
          created_at: string
          employee_id: string
          id: string
        }
        Insert: {
          agendamento_id: string
          created_at?: string
          employee_id: string
          id?: string
        }
        Update: {
          agendamento_id?: string
          created_at?: string
          employee_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_agendamento_employees_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "checklist_agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_agendamento_employees_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_agendamentos: {
        Row: {
          ativo: boolean
          checklist_id: string
          company_id: string
          created_at: string
          hora: string
          id: string
          lembrete_apos_minutos: number | null
          updated_at: string
          weekly_days: Json
        }
        Insert: {
          ativo?: boolean
          checklist_id: string
          company_id: string
          created_at?: string
          hora: string
          id?: string
          lembrete_apos_minutos?: number | null
          updated_at?: string
          weekly_days?: Json
        }
        Update: {
          ativo?: boolean
          checklist_id?: string
          company_id?: string
          created_at?: string
          hora?: string
          id?: string
          lembrete_apos_minutos?: number | null
          updated_at?: string
          weekly_days?: Json
        }
        Relationships: [
          {
            foreignKeyName: "checklist_agendamentos_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_agendamentos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_execucoes: {
        Row: {
          agendamento_id: string | null
          checklist_id: string
          company_id: string
          concluido_em: string | null
          created_at: string
          data: string
          employee_id: string
          id: string
          iniciado_em: string | null
          lembrete_enviado_em: string | null
          status: Database["public"]["Enums"]["checklist_execucao_status"]
          updated_at: string
        }
        Insert: {
          agendamento_id?: string | null
          checklist_id: string
          company_id: string
          concluido_em?: string | null
          created_at?: string
          data?: string
          employee_id: string
          id?: string
          iniciado_em?: string | null
          lembrete_enviado_em?: string | null
          status?: Database["public"]["Enums"]["checklist_execucao_status"]
          updated_at?: string
        }
        Update: {
          agendamento_id?: string | null
          checklist_id?: string
          company_id?: string
          concluido_em?: string | null
          created_at?: string
          data?: string
          employee_id?: string
          id?: string
          iniciado_em?: string | null
          lembrete_enviado_em?: string | null
          status?: Database["public"]["Enums"]["checklist_execucao_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_execucoes_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "checklist_agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_execucoes_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_execucoes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_execucoes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          checklist_id: string
          created_at: string
          criterios_ia: string | null
          descricao: string
          foto_modelo_url: string | null
          id: string
          ordem: number
          tipo: Database["public"]["Enums"]["checklist_item_type"]
          updated_at: string
        }
        Insert: {
          checklist_id: string
          created_at?: string
          criterios_ia?: string | null
          descricao: string
          foto_modelo_url?: string | null
          id?: string
          ordem?: number
          tipo: Database["public"]["Enums"]["checklist_item_type"]
          updated_at?: string
        }
        Update: {
          checklist_id?: string
          created_at?: string
          criterios_ia?: string | null
          descricao?: string
          foto_modelo_url?: string | null
          id?: string
          ordem?: number
          tipo?: Database["public"]["Enums"]["checklist_item_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_respostas: {
        Row: {
          confianca_ia: number | null
          created_at: string
          execucao_id: string
          foto_url: string | null
          id: string
          item_id: string
          motivo_ia: string | null
          observacao_gestor: string | null
          revisado_em: string | null
          revisado_por: string | null
          status_final: Database["public"]["Enums"]["checklist_resposta_status"]
          status_ia:
            | Database["public"]["Enums"]["checklist_resposta_status"]
            | null
          texto_resposta: string | null
          updated_at: string
        }
        Insert: {
          confianca_ia?: number | null
          created_at?: string
          execucao_id: string
          foto_url?: string | null
          id?: string
          item_id: string
          motivo_ia?: string | null
          observacao_gestor?: string | null
          revisado_em?: string | null
          revisado_por?: string | null
          status_final?: Database["public"]["Enums"]["checklist_resposta_status"]
          status_ia?:
            | Database["public"]["Enums"]["checklist_resposta_status"]
            | null
          texto_resposta?: string | null
          updated_at?: string
        }
        Update: {
          confianca_ia?: number | null
          created_at?: string
          execucao_id?: string
          foto_url?: string | null
          id?: string
          item_id?: string
          motivo_ia?: string | null
          observacao_gestor?: string | null
          revisado_em?: string | null
          revisado_por?: string | null
          status_final?: Database["public"]["Enums"]["checklist_resposta_status"]
          status_ia?:
            | Database["public"]["Enums"]["checklist_resposta_status"]
            | null
          texto_resposta?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_respostas_execucao_id_fkey"
            columns: ["execucao_id"]
            isOneToOne: false
            referencedRelation: "checklist_execucoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_respostas_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "checklist_items"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_whatsapp_sessions: {
        Row: {
          company_id: string
          context: Json
          created_at: string
          current_item_id: string | null
          employee_id: string
          execucao_id: string | null
          expires_at: string
          id: string
          phone: string
          state: string
          updated_at: string
        }
        Insert: {
          company_id: string
          context?: Json
          created_at?: string
          current_item_id?: string | null
          employee_id: string
          execucao_id?: string | null
          expires_at?: string
          id?: string
          phone: string
          state?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          context?: Json
          created_at?: string
          current_item_id?: string | null
          employee_id?: string
          execucao_id?: string | null
          expires_at?: string
          id?: string
          phone?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_whatsapp_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_whatsapp_sessions_current_item_id_fkey"
            columns: ["current_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_whatsapp_sessions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_whatsapp_sessions_execucao_id_fkey"
            columns: ["execucao_id"]
            isOneToOne: false
            referencedRelation: "checklist_execucoes"
            referencedColumns: ["id"]
          },
        ]
      }
      checklists: {
        Row: {
          ativo: boolean
          company_id: string
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          company_id: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          company_id?: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklists_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          ativo: boolean | null
          cnpj_hash: string | null
          created_at: string | null
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean | null
          cnpj_hash?: string | null
          created_at?: string | null
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean | null
          cnpj_hash?: string | null
          created_at?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      company_integrations: {
        Row: {
          client_token: string | null
          company_id: string
          created_at: string | null
          id: string
          instance_id: string | null
          instance_token: string | null
          integration_type: string
          is_active: boolean | null
          updated_at: string | null
        }
        Insert: {
          client_token?: string | null
          company_id: string
          created_at?: string | null
          id?: string
          instance_id?: string | null
          instance_token?: string | null
          integration_type?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Update: {
          client_token?: string | null
          company_id?: string
          created_at?: string | null
          id?: string
          instance_id?: string | null
          instance_token?: string | null
          integration_type?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_integrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      document_signatures: {
        Row: {
          acceptance_text: string | null
          created_at: string | null
          document_hash: string | null
          document_id: string
          employee_id: string
          id: string
          ip_address: string | null
          notes: string | null
          pin_verified: boolean | null
          selfie_url: string | null
          signed_at: string | null
          signed_via: string | null
          status: Database["public"]["Enums"]["signature_status"]
          user_agent: string | null
        }
        Insert: {
          acceptance_text?: string | null
          created_at?: string | null
          document_hash?: string | null
          document_id: string
          employee_id: string
          id?: string
          ip_address?: string | null
          notes?: string | null
          pin_verified?: boolean | null
          selfie_url?: string | null
          signed_at?: string | null
          signed_via?: string | null
          status?: Database["public"]["Enums"]["signature_status"]
          user_agent?: string | null
        }
        Update: {
          acceptance_text?: string | null
          created_at?: string | null
          document_hash?: string | null
          document_id?: string
          employee_id?: string
          id?: string
          ip_address?: string | null
          notes?: string | null
          pin_verified?: boolean | null
          selfie_url?: string | null
          signed_at?: string | null
          signed_via?: string | null
          status?: Database["public"]["Enums"]["signature_status"]
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_signatures_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "employee_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_signatures_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_documents: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          document_type: Database["public"]["Enums"]["document_type"]
          employee_id: string
          file_url: string
          id: string
          ref_month: string | null
          requires_signature: boolean | null
          title: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          document_type?: Database["public"]["Enums"]["document_type"]
          employee_id: string
          file_url: string
          id?: string
          ref_month?: string | null
          requires_signature?: boolean | null
          title: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          document_type?: Database["public"]["Enums"]["document_type"]
          employee_id?: string
          file_url?: string
          id?: string
          ref_month?: string | null
          requires_signature?: boolean | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          ativo: boolean | null
          auth_user_id: string | null
          cargo: string | null
          company_id: string | null
          cpf_encrypted: string | null
          cpf_hash: string
          created_at: string | null
          data_admissao: string | null
          email: string | null
          failed_attempts: number | null
          foto_cadastro_url: string | null
          id: string
          locked_until: string | null
          nome: string
          pin_hash: string
          sector_id: string | null
          setor: string | null
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          auth_user_id?: string | null
          cargo?: string | null
          company_id?: string | null
          cpf_encrypted?: string | null
          cpf_hash: string
          created_at?: string | null
          data_admissao?: string | null
          email?: string | null
          failed_attempts?: number | null
          foto_cadastro_url?: string | null
          id?: string
          locked_until?: string | null
          nome: string
          pin_hash: string
          sector_id?: string | null
          setor?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          auth_user_id?: string | null
          cargo?: string | null
          company_id?: string | null
          cpf_encrypted?: string | null
          cpf_hash?: string
          created_at?: string | null
          data_admissao?: string | null
          email?: string | null
          failed_attempts?: number | null
          foto_cadastro_url?: string | null
          id?: string
          locked_until?: string | null
          nome?: string
          pin_hash?: string
          sector_id?: string | null
          setor?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      extra_people: {
        Row: {
          company_id: string
          cpf_encrypted: string | null
          cpf_hash: string
          cpf_last4: string | null
          created_at: string
          foto_url: string | null
          id: string
          nome_completo: string
          updated_at: string
        }
        Insert: {
          company_id: string
          cpf_encrypted?: string | null
          cpf_hash: string
          cpf_last4?: string | null
          created_at?: string
          foto_url?: string | null
          id?: string
          nome_completo: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          cpf_encrypted?: string | null
          cpf_hash?: string
          cpf_last4?: string | null
          created_at?: string
          foto_url?: string | null
          id?: string
          nome_completo?: string
          updated_at?: string
        }
        Relationships: []
      }
      extra_time_records: {
        Row: {
          company_id: string
          comprovante_pagamento_url: string | null
          created_at: string
          created_by: string | null
          entrada_at: string
          entrada_foto_url: string | null
          extra_person_id: string
          id: string
          observacao_admin: string | null
          record_date: string
          retorno_intervalo_at: string | null
          retorno_intervalo_foto_url: string | null
          saida_at: string | null
          saida_foto_url: string | null
          saida_intervalo_at: string | null
          saida_intervalo_foto_url: string | null
          total_minutes: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_id: string
          comprovante_pagamento_url?: string | null
          created_at?: string
          created_by?: string | null
          entrada_at?: string
          entrada_foto_url?: string | null
          extra_person_id: string
          id?: string
          observacao_admin?: string | null
          record_date?: string
          retorno_intervalo_at?: string | null
          retorno_intervalo_foto_url?: string | null
          saida_at?: string | null
          saida_foto_url?: string | null
          saida_intervalo_at?: string | null
          saida_intervalo_foto_url?: string | null
          total_minutes?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_id?: string
          comprovante_pagamento_url?: string | null
          created_at?: string
          created_by?: string | null
          entrada_at?: string
          entrada_foto_url?: string | null
          extra_person_id?: string
          id?: string
          observacao_admin?: string | null
          record_date?: string
          retorno_intervalo_at?: string | null
          retorno_intervalo_foto_url?: string | null
          saida_at?: string | null
          saida_foto_url?: string | null
          saida_intervalo_at?: string | null
          saida_intervalo_foto_url?: string | null
          total_minutes?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "extra_time_records_extra_person_id_fkey"
            columns: ["extra_person_id"]
            isOneToOne: false
            referencedRelation: "extra_people"
            referencedColumns: ["id"]
          },
        ]
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
      monthly_closings: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          company_id: string
          created_at: string | null
          days_absent: number | null
          days_pending: number | null
          days_worked: number | null
          employee_id: string
          id: string
          notes: string | null
          ref_month: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["closing_status"]
          total_balance_minutes: number | null
          total_break_minutes: number | null
          total_expected_minutes: number | null
          total_worked_minutes: number | null
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          company_id: string
          created_at?: string | null
          days_absent?: number | null
          days_pending?: number | null
          days_worked?: number | null
          employee_id: string
          id?: string
          notes?: string | null
          ref_month: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["closing_status"]
          total_balance_minutes?: number | null
          total_break_minutes?: number | null
          total_expected_minutes?: number | null
          total_worked_minutes?: number | null
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          company_id?: string
          created_at?: string | null
          days_absent?: number | null
          days_pending?: number | null
          days_worked?: number | null
          employee_id?: string
          id?: string
          notes?: string | null
          ref_month?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["closing_status"]
          total_balance_minutes?: number | null
          total_break_minutes?: number | null
          total_expected_minutes?: number | null
          total_worked_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_closings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_closings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          is_enabled: boolean
          message_template: string | null
          notification_type: string
          schedule_time: string | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          is_enabled?: boolean
          message_template?: string | null
          notification_type: string
          schedule_time?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          is_enabled?: boolean
          message_template?: string | null
          notification_type?: string
          schedule_time?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      punch_corrections: {
        Row: {
          attachment_url: string | null
          created_at: string | null
          current_punch_id: string | null
          employee_id: string
          id: string
          punch_type: Database["public"]["Enums"]["punch_type"]
          reason: string
          requested_time: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["correction_status"]
          work_date: string
        }
        Insert: {
          attachment_url?: string | null
          created_at?: string | null
          current_punch_id?: string | null
          employee_id: string
          id?: string
          punch_type: Database["public"]["Enums"]["punch_type"]
          reason: string
          requested_time: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["correction_status"]
          work_date: string
        }
        Update: {
          attachment_url?: string | null
          created_at?: string | null
          current_punch_id?: string | null
          employee_id?: string
          id?: string
          punch_type?: Database["public"]["Enums"]["punch_type"]
          reason?: string
          requested_time?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["correction_status"]
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "punch_corrections_current_punch_id_fkey"
            columns: ["current_punch_id"]
            isOneToOne: false
            referencedRelation: "time_punches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "punch_corrections_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      sector_schedules: {
        Row: {
          break_minutes: number | null
          created_at: string | null
          expected_end: string
          expected_start: string
          id: string
          sector_id: string
          tolerance_early_minutes: number | null
          tolerance_late_minutes: number | null
          updated_at: string | null
          weekly_days: Json | null
        }
        Insert: {
          break_minutes?: number | null
          created_at?: string | null
          expected_end?: string
          expected_start?: string
          id?: string
          sector_id: string
          tolerance_early_minutes?: number | null
          tolerance_late_minutes?: number | null
          updated_at?: string | null
          weekly_days?: Json | null
        }
        Update: {
          break_minutes?: number | null
          created_at?: string | null
          expected_end?: string
          expected_start?: string
          id?: string
          sector_id?: string
          tolerance_early_minutes?: number | null
          tolerance_late_minutes?: number | null
          updated_at?: string | null
          weekly_days?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "sector_schedules_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: true
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      sectors: {
        Row: {
          ativo: boolean | null
          company_id: string | null
          created_at: string | null
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "sectors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_audit_log: {
        Row: {
          acceptance_text: string | null
          action: string
          auth_user_id: string | null
          created_at: string
          document_hash: string | null
          document_id: string
          employee_id: string
          id: string
          ip_address: string | null
          pin_verified: boolean | null
          selfie_url: string | null
          signature_id: string
          signed_via: string | null
          user_agent: string | null
        }
        Insert: {
          acceptance_text?: string | null
          action: string
          auth_user_id?: string | null
          created_at?: string
          document_hash?: string | null
          document_id: string
          employee_id: string
          id?: string
          ip_address?: string | null
          pin_verified?: boolean | null
          selfie_url?: string | null
          signature_id: string
          signed_via?: string | null
          user_agent?: string | null
        }
        Update: {
          acceptance_text?: string | null
          action?: string
          auth_user_id?: string | null
          created_at?: string
          document_hash?: string | null
          document_id?: string
          employee_id?: string
          id?: string
          ip_address?: string | null
          pin_verified?: boolean | null
          selfie_url?: string | null
          signature_id?: string
          signed_via?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signature_audit_log_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "employee_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_audit_log_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_audit_log_signature_id_fkey"
            columns: ["signature_id"]
            isOneToOne: false
            referencedRelation: "document_signatures"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_otp: {
        Row: {
          code_hash: string
          created_at: string
          employee_id: string
          expires_at: string
          id: string
          signature_id: string
          used: boolean
        }
        Insert: {
          code_hash: string
          created_at?: string
          employee_id: string
          expires_at: string
          id?: string
          signature_id: string
          used?: boolean
        }
        Update: {
          code_hash?: string
          created_at?: string
          employee_id?: string
          expires_at?: string
          id?: string
          signature_id?: string
          used?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "signature_otp_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_otp_signature_id_fkey"
            columns: ["signature_id"]
            isOneToOne: false
            referencedRelation: "document_signatures"
            referencedColumns: ["id"]
          },
        ]
      }
      time_devices: {
        Row: {
          ativo: boolean | null
          company_id: string | null
          created_at: string | null
          device_secret_hash: string
          id: string
          nome: string
          unidade: string
        }
        Insert: {
          ativo?: boolean | null
          company_id?: string | null
          created_at?: string | null
          device_secret_hash: string
          id?: string
          nome: string
          unidade: string
        }
        Update: {
          ativo?: boolean | null
          company_id?: string | null
          created_at?: string | null
          device_secret_hash?: string
          id?: string
          nome?: string
          unidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_devices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      time_punches: {
        Row: {
          created_at: string | null
          device_id: string | null
          employee_id: string
          id: string
          punch_type: Database["public"]["Enums"]["punch_type"]
          punched_at: string | null
          selfie_url: string | null
          status: Database["public"]["Enums"]["punch_status"] | null
          unidade: string
        }
        Insert: {
          created_at?: string | null
          device_id?: string | null
          employee_id: string
          id?: string
          punch_type: Database["public"]["Enums"]["punch_type"]
          punched_at?: string | null
          selfie_url?: string | null
          status?: Database["public"]["Enums"]["punch_status"] | null
          unidade: string
        }
        Update: {
          created_at?: string | null
          device_id?: string | null
          employee_id?: string
          id?: string
          punch_type?: Database["public"]["Enums"]["punch_type"]
          punched_at?: string | null
          selfie_url?: string | null
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
      user_company_access: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_company_access_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
      get_user_company_ids: { Args: { _user_id: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_rh: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "rh" | "gestor" | "colaborador" | "super_admin"
      approval_status: "aprovado" | "pendente" | "rejeitado"
      checklist_execucao_status:
        | "pendente"
        | "em_andamento"
        | "concluido"
        | "reprovado"
        | "revisar"
      checklist_item_type: "foto_ia" | "sim_nao"
      checklist_resposta_status:
        | "pendente"
        | "aprovado"
        | "reprovado"
        | "revisar"
      closing_status: "pendente" | "conferido" | "fechado"
      correction_status: "pendente" | "aprovado" | "rejeitado"
      document_type:
        | "holerite"
        | "espelho_ponto"
        | "contrato"
        | "advertencia"
        | "comunicado"
        | "outro"
      hour_bank_source:
        | "automatico"
        | "ajuste_manual"
        | "abono"
        | "atestado"
        | "compensacao"
      punch_status: "ok" | "suspeito" | "ajustado" | "pendente"
      punch_type: "entrada" | "saida" | "intervalo_inicio" | "intervalo_fim"
      schedule_type: "fixa" | "flexivel" | "escala"
      signature_status: "pendente" | "assinado" | "recusado"
      timesheet_status:
        | "ok"
        | "pendente"
        | "revisao"
        | "ajustado"
        | "falta"
        | "abono"
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
      app_role: ["admin", "rh", "gestor", "colaborador", "super_admin"],
      approval_status: ["aprovado", "pendente", "rejeitado"],
      checklist_execucao_status: [
        "pendente",
        "em_andamento",
        "concluido",
        "reprovado",
        "revisar",
      ],
      checklist_item_type: ["foto_ia", "sim_nao"],
      checklist_resposta_status: [
        "pendente",
        "aprovado",
        "reprovado",
        "revisar",
      ],
      closing_status: ["pendente", "conferido", "fechado"],
      correction_status: ["pendente", "aprovado", "rejeitado"],
      document_type: [
        "holerite",
        "espelho_ponto",
        "contrato",
        "advertencia",
        "comunicado",
        "outro",
      ],
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
      signature_status: ["pendente", "assinado", "recusado"],
      timesheet_status: [
        "ok",
        "pendente",
        "revisao",
        "ajustado",
        "falta",
        "abono",
      ],
    },
  },
} as const
