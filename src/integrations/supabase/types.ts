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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          description: string
          error_message: string | null
          id: string
          metadata: Json | null
          org_id: string | null
          success: boolean
          user_email: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string
          description: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          org_id?: string | null
          success?: boolean
          user_email?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          description?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          org_id?: string | null
          success?: boolean
          user_email?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_configs: {
        Row: {
          config: Json | null
          config_type: string
          created_at: string
          enabled: boolean
          id: string
          instance_name: string | null
          only_outside_hours: boolean | null
          org_id: string
          schedule_days: number[] | null
          schedule_end: string | null
          schedule_start: string | null
          system_prompt: string | null
          temperature: number | null
          updated_at: string
        }
        Insert: {
          config?: Json | null
          config_type: string
          created_at?: string
          enabled?: boolean
          id?: string
          instance_name?: string | null
          only_outside_hours?: boolean | null
          org_id: string
          schedule_days?: number[] | null
          schedule_end?: string | null
          schedule_start?: string | null
          system_prompt?: string | null
          temperature?: number | null
          updated_at?: string
        }
        Update: {
          config?: Json | null
          config_type?: string
          created_at?: string
          enabled?: boolean
          id?: string
          instance_name?: string | null
          only_outside_hours?: boolean | null
          org_id?: string
          schedule_days?: number[] | null
          schedule_end?: string | null
          schedule_start?: string | null
          system_prompt?: string | null
          temperature?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_knowledge_docs: {
        Row: {
          chunks: Json | null
          content: string
          created_at: string
          embedding: string | null
          file_url: string | null
          id: string
          keywords: string[] | null
          org_id: string
          processed: boolean | null
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          chunks?: Json | null
          content?: string
          created_at?: string
          embedding?: string | null
          file_url?: string | null
          id?: string
          keywords?: string[] | null
          org_id: string
          processed?: boolean | null
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          chunks?: Json | null
          content?: string
          created_at?: string
          embedding?: string | null
          file_url?: string | null
          id?: string
          keywords?: string[] | null
          org_id?: string
          processed?: boolean | null
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_scenarios: {
        Row: {
          behavior: Json | null
          created_at: string
          description: string
          enabled: boolean | null
          id: string
          name: string
          org_id: string
          scenario_key: string
          system_prompt: string
          temperature: number | null
          updated_at: string
        }
        Insert: {
          behavior?: Json | null
          created_at?: string
          description?: string
          enabled?: boolean | null
          id?: string
          name: string
          org_id: string
          scenario_key: string
          system_prompt?: string
          temperature?: number | null
          updated_at?: string
        }
        Update: {
          behavior?: Json | null
          created_at?: string
          description?: string
          enabled?: boolean | null
          id?: string
          name?: string
          org_id?: string
          scenario_key?: string
          system_prompt?: string
          temperature?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_scenarios_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          cancelled_reason: string | null
          created_at: string
          created_by: string | null
          created_via: string
          description: string | null
          duration_minutes: number
          id: string
          lead_id: string | null
          lead_name: string | null
          lead_phone: string | null
          location: string | null
          meeting_url: string | null
          notes: string | null
          org_id: string
          reminder_sent: boolean
          scheduled_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          cancelled_reason?: string | null
          created_at?: string
          created_by?: string | null
          created_via?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          lead_id?: string | null
          lead_name?: string | null
          lead_phone?: string | null
          location?: string | null
          meeting_url?: string | null
          notes?: string | null
          org_id: string
          reminder_sent?: boolean
          scheduled_at: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          cancelled_reason?: string | null
          created_at?: string
          created_by?: string | null
          created_via?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          lead_id?: string | null
          lead_name?: string | null
          lead_phone?: string | null
          location?: string | null
          meeting_url?: string | null
          notes?: string | null
          org_id?: string
          reminder_sent?: boolean
          scheduled_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_raw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_leads: {
        Row: {
          broadcast_id: string
          created_at: string
          delivered_at: string | null
          error_message: string | null
          id: string
          lead_id: string
          message_sent: string | null
          read_at: string | null
          replied_at: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          broadcast_id: string
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          lead_id: string
          message_sent?: string | null
          read_at?: string | null
          replied_at?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          broadcast_id?: string
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          lead_id?: string
          message_sent?: string | null
          read_at?: string | null
          replied_at?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_leads_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "broadcasts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_leads_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_raw"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcasts: {
        Row: {
          ai_config_id: string | null
          ai_enabled: boolean
          audience_type: string
          channel: string
          completed_at: string | null
          converted_count: number | null
          created_at: string
          created_by: string | null
          delay_between_messages: number | null
          delivered_count: number | null
          description: string | null
          failed_count: number | null
          follow_up_count: number | null
          follow_up_enabled: boolean | null
          follow_up_interval_hours: number | null
          id: string
          instance_name: string | null
          message_template: string | null
          message_variables: Json | null
          name: string
          org_id: string
          read_count: number | null
          replied_count: number | null
          scenario_key: string | null
          scheduled_at: string | null
          segment_custom_filter: Json | null
          segment_date_from: string | null
          segment_date_to: string | null
          segment_source: string[] | null
          segment_status: string[] | null
          segment_tags: string[] | null
          send_rate_per_minute: number | null
          sent_count: number | null
          started_at: string | null
          status: string
          total_leads: number | null
          type: string
          updated_at: string
        }
        Insert: {
          ai_config_id?: string | null
          ai_enabled?: boolean
          audience_type?: string
          channel?: string
          completed_at?: string | null
          converted_count?: number | null
          created_at?: string
          created_by?: string | null
          delay_between_messages?: number | null
          delivered_count?: number | null
          description?: string | null
          failed_count?: number | null
          follow_up_count?: number | null
          follow_up_enabled?: boolean | null
          follow_up_interval_hours?: number | null
          id?: string
          instance_name?: string | null
          message_template?: string | null
          message_variables?: Json | null
          name: string
          org_id: string
          read_count?: number | null
          replied_count?: number | null
          scenario_key?: string | null
          scheduled_at?: string | null
          segment_custom_filter?: Json | null
          segment_date_from?: string | null
          segment_date_to?: string | null
          segment_source?: string[] | null
          segment_status?: string[] | null
          segment_tags?: string[] | null
          send_rate_per_minute?: number | null
          sent_count?: number | null
          started_at?: string | null
          status?: string
          total_leads?: number | null
          type?: string
          updated_at?: string
        }
        Update: {
          ai_config_id?: string | null
          ai_enabled?: boolean
          audience_type?: string
          channel?: string
          completed_at?: string | null
          converted_count?: number | null
          created_at?: string
          created_by?: string | null
          delay_between_messages?: number | null
          delivered_count?: number | null
          description?: string | null
          failed_count?: number | null
          follow_up_count?: number | null
          follow_up_enabled?: boolean | null
          follow_up_interval_hours?: number | null
          id?: string
          instance_name?: string | null
          message_template?: string | null
          message_variables?: Json | null
          name?: string
          org_id?: string
          read_count?: number | null
          replied_count?: number | null
          scenario_key?: string | null
          scheduled_at?: string | null
          segment_custom_filter?: Json | null
          segment_date_from?: string | null
          segment_date_to?: string | null
          segment_source?: string[] | null
          segment_status?: string[] | null
          segment_tags?: string[] | null
          send_rate_per_minute?: number | null
          sent_count?: number | null
          started_at?: string | null
          status?: string
          total_leads?: number | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcasts_ai_config_id_fkey"
            columns: ["ai_config_id"]
            isOneToOne: false
            referencedRelation: "ai_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcasts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          created_at: string
          from_me: boolean
          id: string
          instance_name: string
          message_id: string | null
          message_text: string
          message_type: string
          org_id: string
          push_name: string | null
          remote_jid: string
          timestamp: string
        }
        Insert: {
          created_at?: string
          from_me?: boolean
          id?: string
          instance_name: string
          message_id?: string | null
          message_text?: string
          message_type?: string
          org_id: string
          push_name?: string | null
          remote_jid: string
          timestamp?: string
        }
        Update: {
          created_at?: string
          from_me?: boolean
          id?: string
          instance_name?: string
          message_id?: string | null
          message_text?: string
          message_type?: string
          org_id?: string
          push_name?: string | null
          remote_jid?: string
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      company_profiles: {
        Row: {
          address: string | null
          avg_ticket: string | null
          b2b_avg_ticket: string | null
          b2b_differentials: string | null
          b2b_objections_faq: Json | null
          b2b_products_services: Json | null
          b2b_sales_process: string | null
          b2b_target_audience: string | null
          b2b_tone_of_voice: string | null
          b2c_avg_ticket: string | null
          b2c_differentials: string | null
          b2c_objections_faq: Json | null
          b2c_products_services: Json | null
          b2c_sales_process: string | null
          b2c_target_audience: string | null
          b2c_tone_of_voice: string | null
          business_models: string[]
          cnpj: string | null
          company_name: string
          created_at: string
          description: string | null
          differentials: string | null
          email: string | null
          facebook: string | null
          founded_year: number | null
          id: string
          instagram: string | null
          linkedin: string | null
          logo_url: string | null
          mission: string | null
          objections_faq: Json | null
          org_id: string
          phone: string | null
          products_services: Json | null
          sales_process: string | null
          segment: string | null
          target_audience: string | null
          team_size: string | null
          tone_of_voice: string | null
          updated_at: string
          values: string | null
          vision: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          avg_ticket?: string | null
          b2b_avg_ticket?: string | null
          b2b_differentials?: string | null
          b2b_objections_faq?: Json | null
          b2b_products_services?: Json | null
          b2b_sales_process?: string | null
          b2b_target_audience?: string | null
          b2b_tone_of_voice?: string | null
          b2c_avg_ticket?: string | null
          b2c_differentials?: string | null
          b2c_objections_faq?: Json | null
          b2c_products_services?: Json | null
          b2c_sales_process?: string | null
          b2c_target_audience?: string | null
          b2c_tone_of_voice?: string | null
          business_models?: string[]
          cnpj?: string | null
          company_name?: string
          created_at?: string
          description?: string | null
          differentials?: string | null
          email?: string | null
          facebook?: string | null
          founded_year?: number | null
          id?: string
          instagram?: string | null
          linkedin?: string | null
          logo_url?: string | null
          mission?: string | null
          objections_faq?: Json | null
          org_id: string
          phone?: string | null
          products_services?: Json | null
          sales_process?: string | null
          segment?: string | null
          target_audience?: string | null
          team_size?: string | null
          tone_of_voice?: string | null
          updated_at?: string
          values?: string | null
          vision?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          avg_ticket?: string | null
          b2b_avg_ticket?: string | null
          b2b_differentials?: string | null
          b2b_objections_faq?: Json | null
          b2b_products_services?: Json | null
          b2b_sales_process?: string | null
          b2b_target_audience?: string | null
          b2b_tone_of_voice?: string | null
          b2c_avg_ticket?: string | null
          b2c_differentials?: string | null
          b2c_objections_faq?: Json | null
          b2c_products_services?: Json | null
          b2c_sales_process?: string | null
          b2c_target_audience?: string | null
          b2c_tone_of_voice?: string | null
          business_models?: string[]
          cnpj?: string | null
          company_name?: string
          created_at?: string
          description?: string | null
          differentials?: string | null
          email?: string | null
          facebook?: string | null
          founded_year?: number | null
          id?: string
          instagram?: string | null
          linkedin?: string | null
          logo_url?: string | null
          mission?: string | null
          objections_faq?: Json | null
          org_id?: string
          phone?: string | null
          products_services?: Json | null
          sales_process?: string | null
          segment?: string | null
          target_audience?: string | null
          team_size?: string | null
          tone_of_voice?: string | null
          updated_at?: string
          values?: string | null
          vision?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_cooldown: {
        Row: {
          cooldown_hours: number
          last_contacted_at: string
          org_id: string
          phone: string
        }
        Insert: {
          cooldown_hours?: number
          last_contacted_at?: string
          org_id: string
          phone: string
        }
        Update: {
          cooldown_hours?: number
          last_contacted_at?: string
          org_id?: string
          phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_cooldown_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_tracker: {
        Row: {
          ai_config_id: string | null
          created_at: string
          customer_msg_count: number
          detected_audience: string | null
          follow_up_paused: boolean
          id: string
          instance_name: string
          last_bot_msg_at: string | null
          last_customer_msg_at: string
          last_follow_up_step: number
          lead_id: string | null
          org_id: string
          pipeline_stage_key: string | null
          push_name: string | null
          remote_jid: string
          scenario_key: string | null
          updated_at: string
        }
        Insert: {
          ai_config_id?: string | null
          created_at?: string
          customer_msg_count?: number
          detected_audience?: string | null
          follow_up_paused?: boolean
          id?: string
          instance_name: string
          last_bot_msg_at?: string | null
          last_customer_msg_at?: string
          last_follow_up_step?: number
          lead_id?: string | null
          org_id: string
          pipeline_stage_key?: string | null
          push_name?: string | null
          remote_jid: string
          scenario_key?: string | null
          updated_at?: string
        }
        Update: {
          ai_config_id?: string | null
          created_at?: string
          customer_msg_count?: number
          detected_audience?: string | null
          follow_up_paused?: boolean
          id?: string
          instance_name?: string
          last_bot_msg_at?: string | null
          last_customer_msg_at?: string
          last_follow_up_step?: number
          lead_id?: string | null
          org_id?: string
          pipeline_stage_key?: string | null
          push_name?: string | null
          remote_jid?: string
          scenario_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_tracker_ai_config_id_fkey"
            columns: ["ai_config_id"]
            isOneToOne: false
            referencedRelation: "ai_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_tracker_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_raw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_tracker_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_stages: {
        Row: {
          created_at: string
          id: string
          name: string
          org_id: string
          stage_key: string | null
          stage_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          org_id: string
          stage_key?: string | null
          stage_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          stage_key?: string | null
          stage_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_stages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_rules: {
        Row: {
          ai_config_id: string
          context_hint: string | null
          created_at: string
          delay_minutes: number
          enabled: boolean
          id: string
          name: string
          org_id: string
          step_order: number
          updated_at: string
        }
        Insert: {
          ai_config_id: string
          context_hint?: string | null
          created_at?: string
          delay_minutes?: number
          enabled?: boolean
          id?: string
          name?: string
          org_id: string
          step_order?: number
          updated_at?: string
        }
        Update: {
          ai_config_id?: string
          context_hint?: string | null
          created_at?: string
          delay_minutes?: number
          enabled?: boolean
          id?: string
          name?: string
          org_id?: string
          step_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_rules_ai_config_id_fkey"
            columns: ["ai_config_id"]
            isOneToOne: false
            referencedRelation: "ai_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_instances: {
        Row: {
          created_at: string | null
          instance_name: string
          integration_id: string
          org_id: string
        }
        Insert: {
          created_at?: string | null
          instance_name: string
          integration_id: string
          org_id: string
        }
        Update: {
          created_at?: string | null
          instance_name?: string
          integration_id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_instances_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_instances_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          api_key: string | null
          config: Json | null
          created_at: string
          endpoint_url: string | null
          id: string
          org_id: string
          service_name: Database["public"]["Enums"]["integration_service"]
          status: string | null
          updated_at: string
        }
        Insert: {
          api_key?: string | null
          config?: Json | null
          created_at?: string
          endpoint_url?: string | null
          id?: string
          org_id: string
          service_name: Database["public"]["Enums"]["integration_service"]
          status?: string | null
          updated_at?: string
        }
        Update: {
          api_key?: string | null
          config?: Json | null
          created_at?: string
          endpoint_url?: string | null
          id?: string
          org_id?: string
          service_name?: Database["public"]["Enums"]["integration_service"]
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_raw: {
        Row: {
          created_at: string
          email: string | null
          enrichment_data: Json | null
          id: string
          name: string | null
          org_id: string
          phone: string | null
          source: Database["public"]["Enums"]["lead_source"]
          status: Database["public"]["Enums"]["lead_status"]
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          enrichment_data?: Json | null
          id?: string
          name?: string | null
          org_id: string
          phone?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          enrichment_data?: Json | null
          id?: string
          name?: string | null
          org_id?: string
          phone?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_raw_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          assigned_to: string | null
          automation_status: string | null
          created_at: string
          id: string
          lead_id: string
          message_sent_at: string | null
          notes: string | null
          org_id: string
          personalized_message: string | null
          probability: number | null
          stage_id: string
          updated_at: string
          value: number | null
        }
        Insert: {
          assigned_to?: string | null
          automation_status?: string | null
          created_at?: string
          id?: string
          lead_id: string
          message_sent_at?: string | null
          notes?: string | null
          org_id: string
          personalized_message?: string | null
          probability?: number | null
          stage_id: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          assigned_to?: string | null
          automation_status?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          message_sent_at?: string | null
          notes?: string | null
          org_id?: string
          personalized_message?: string | null
          probability?: number | null
          stage_id?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_raw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          external_mapping: Json | null
          form_token: string
          handoff_auto_stages: string[] | null
          handoff_number: string | null
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_mapping?: Json | null
          form_token?: string
          handoff_auto_stages?: string[] | null
          handoff_number?: string | null
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_mapping?: Json | null
          form_token?: string
          handoff_auto_stages?: string[] | null
          handoff_number?: string | null
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          created_at: string
          currency: string
          description: string | null
          features: Json
          id: string
          is_active: boolean
          is_popular: boolean
          name: string
          price_monthly: number
          price_yearly: number | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          is_popular?: boolean
          name: string
          price_monthly?: number
          price_yearly?: number | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          is_popular?: boolean
          name?: string
          price_monthly?: number
          price_yearly?: number | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          org_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          org_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          org_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      site_content: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      site_leads: {
        Row: {
          admin_notes: string | null
          company: string | null
          contacted_at: string | null
          created_at: string
          email: string
          form_source: string
          id: string
          message: string | null
          name: string
          partnership_type: string | null
          phone: string | null
          plan_selected: string | null
          status: string
        }
        Insert: {
          admin_notes?: string | null
          company?: string | null
          contacted_at?: string | null
          created_at?: string
          email: string
          form_source?: string
          id?: string
          message?: string | null
          name: string
          partnership_type?: string | null
          phone?: string | null
          plan_selected?: string | null
          status?: string
        }
        Update: {
          admin_notes?: string | null
          company?: string | null
          contacted_at?: string | null
          created_at?: string
          email?: string
          form_source?: string
          id?: string
          message?: string | null
          name?: string
          partnership_type?: string | null
          phone?: string | null
          plan_selected?: string | null
          status?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_org_id: { Args: { p_user_id: string }; Returns: string }
      increment_customer_msg_count: {
        Args: { p_conv_id: string }
        Returns: undefined
      }
      is_org_admin: { Args: { p_org_id: string }; Returns: boolean }
      is_org_member: { Args: { p_org_id: string }; Returns: boolean }
      match_knowledge_docs: {
        Args: {
          match_count?: number
          match_org_id: string
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          similarity: number
          title: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "member"
      integration_service:
        | "firecrawl"
        | "hasdata"
        | "evolution"
        | "supabase_external"
        | "perplexity"
      lead_source: "web" | "whatsapp" | "manual" | "import"
      lead_status: "pending" | "enriched" | "converted" | "discarded"
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
      app_role: ["admin", "member"],
      integration_service: [
        "firecrawl",
        "hasdata",
        "evolution",
        "supabase_external",
        "perplexity",
      ],
      lead_source: ["web", "whatsapp", "manual", "import"],
      lead_status: ["pending", "enriched", "converted", "discarded"],
    },
  },
} as const
