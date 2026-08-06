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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      _prisma_migrations: {
        Row: {
          applied_steps_count: number
          checksum: string
          finished_at: string | null
          id: string
          logs: string | null
          migration_name: string
          rolled_back_at: string | null
          started_at: string
        }
        Insert: {
          applied_steps_count?: number
          checksum: string
          finished_at?: string | null
          id: string
          logs?: string | null
          migration_name: string
          rolled_back_at?: string | null
          started_at?: string
        }
        Update: {
          applied_steps_count?: number
          checksum?: string
          finished_at?: string | null
          id?: string
          logs?: string | null
          migration_name?: string
          rolled_back_at?: string | null
          started_at?: string
        }
        Relationships: []
      }
      allowed_users: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          display_name: string | null
          email: string
          id: string
          last_login_at: string | null
          role: Database["public"]["Enums"]["app_auth_role"]
          supabase_user_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          email: string
          id: string
          last_login_at?: string | null
          role?: Database["public"]["Enums"]["app_auth_role"]
          supabase_user_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          email?: string
          id?: string
          last_login_at?: string | null
          role?: Database["public"]["Enums"]["app_auth_role"]
          supabase_user_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      analysis_cache: {
        Row: {
          analysisId: string
          conversationId: string
          createdAt: string
          id: string
          sourceFingerprint: string
          tenantId: string
        }
        Insert: {
          analysisId: string
          conversationId: string
          createdAt?: string
          id: string
          sourceFingerprint: string
          tenantId: string
        }
        Update: {
          analysisId?: string
          conversationId?: string
          createdAt?: string
          id?: string
          sourceFingerprint?: string
          tenantId?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_cache_analysisId_fkey"
            columns: ["analysisId"]
            isOneToOne: false
            referencedRelation: "conversation_analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analysis_cache_conversationId_fkey"
            columns: ["conversationId"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analysis_cache_tenantId_fkey"
            columns: ["tenantId"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_runs: {
        Row: {
          channelId: string
          createdAt: string
          dateRef: string
          failureCount: number
          finishedAt: string | null
          id: string
          processed: number
          startedAt: string
          status: Database["public"]["Enums"]["RunStatus"]
          successCount: number
          tenantId: string
          totalConversations: number
        }
        Insert: {
          channelId: string
          createdAt?: string
          dateRef: string
          failureCount?: number
          finishedAt?: string | null
          id: string
          processed?: number
          startedAt: string
          status: Database["public"]["Enums"]["RunStatus"]
          successCount?: number
          tenantId: string
          totalConversations?: number
        }
        Update: {
          channelId?: string
          createdAt?: string
          dateRef?: string
          failureCount?: number
          finishedAt?: string | null
          id?: string
          processed?: number
          startedAt?: string
          status?: Database["public"]["Enums"]["RunStatus"]
          successCount?: number
          tenantId?: string
          totalConversations?: number
        }
        Relationships: [
          {
            foreignKeyName: "analysis_runs_channelId_fkey"
            columns: ["channelId"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analysis_runs_tenantId_fkey"
            columns: ["tenantId"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_audit_events: {
        Row: {
          actor_email: string | null
          actor_role: string | null
          actor_user_id: string | null
          created_at: string
          details_json: Json | null
          event_type: string
          id: string
          ip: string | null
          outcome: string
          reason: string | null
          request_method: string | null
          request_path: string | null
          target_email: string | null
          tenant_id: string | null
          user_agent: string | null
        }
        Insert: {
          actor_email?: string | null
          actor_role?: string | null
          actor_user_id?: string | null
          created_at?: string
          details_json?: Json | null
          event_type: string
          id: string
          ip?: string | null
          outcome: string
          reason?: string | null
          request_method?: string | null
          request_path?: string | null
          target_email?: string | null
          tenant_id?: string | null
          user_agent?: string | null
        }
        Update: {
          actor_email?: string | null
          actor_role?: string | null
          actor_user_id?: string | null
          created_at?: string
          details_json?: Json | null
          event_type?: string
          id?: string
          ip?: string | null
          outcome?: string
          reason?: string | null
          request_method?: string | null
          request_path?: string | null
          target_email?: string | null
          tenant_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      channels: {
        Row: {
          chatwootAccountId: number
          chatwootInboxId: number
          createdAt: string
          id: string
          name: string
          provider: string | null
          tenantId: string
          updatedAt: string
        }
        Insert: {
          chatwootAccountId: number
          chatwootInboxId: number
          createdAt?: string
          id: string
          name: string
          provider?: string | null
          tenantId: string
          updatedAt: string
        }
        Update: {
          chatwootAccountId?: number
          chatwootInboxId?: number
          createdAt?: string
          id?: string
          name?: string
          provider?: string | null
          tenantId?: string
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_tenantId_fkey"
            columns: ["tenantId"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_records: {
        Row: {
          attentionsJson: Json | null
          channelId: string
          chatLinks: string[]
          closedAt: string | null
          cnpj: string | null
          companyName: string | null
          contactName: string | null
          conversationIds: number[]
          createdAt: string
          dateRef: string
          gapsJson: Json | null
          id: string
          labels: string[]
          openedAt: string | null
          phonePk: string
          responsibleBucket: Database["public"]["Enums"]["ResponsibleBucket"]
          responsibleLabel: string | null
          responsibleMessageBreakdown: Json | null
          responsibleMessageCount: number
          runId: string
          severity: string
          status: string
          tenantId: string
          updatedAt: string
        }
        Insert: {
          attentionsJson?: Json | null
          channelId: string
          chatLinks?: string[]
          closedAt?: string | null
          cnpj?: string | null
          companyName?: string | null
          contactName?: string | null
          conversationIds?: number[]
          createdAt?: string
          dateRef: string
          gapsJson?: Json | null
          id: string
          labels?: string[]
          openedAt?: string | null
          phonePk: string
          responsibleBucket?: Database["public"]["Enums"]["ResponsibleBucket"]
          responsibleLabel?: string | null
          responsibleMessageBreakdown?: Json | null
          responsibleMessageCount?: number
          runId: string
          severity?: string
          status: string
          tenantId: string
          updatedAt?: string
        }
        Update: {
          attentionsJson?: Json | null
          channelId?: string
          chatLinks?: string[]
          closedAt?: string | null
          cnpj?: string | null
          companyName?: string | null
          contactName?: string | null
          conversationIds?: number[]
          createdAt?: string
          dateRef?: string
          gapsJson?: Json | null
          id?: string
          labels?: string[]
          openedAt?: string | null
          phonePk?: string
          responsibleBucket?: Database["public"]["Enums"]["ResponsibleBucket"]
          responsibleLabel?: string | null
          responsibleMessageBreakdown?: Json | null
          responsibleMessageCount?: number
          runId?: string
          severity?: string
          status?: string
          tenantId?: string
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_records_channelId_fkey"
            columns: ["channelId"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_records_runId_fkey"
            columns: ["runId"]
            isOneToOne: false
            referencedRelation: "analysis_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_records_tenantId_fkey"
            columns: ["tenantId"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_states: {
        Row: {
          channelId: string
          cnpj: string | null
          companyName: string | null
          contactName: string | null
          createdAt: string
          currentLabels: string[]
          currentSeverity: string
          currentStatus: string
          firstIssueAt: string | null
          firstSeenAt: string
          id: string
          lastIssueAt: string | null
          lastRunId: string | null
          lastSeenAt: string
          openConversationIds: number[]
          phonePk: string
          resolvedAt: string | null
          responsibleBucket: Database["public"]["Enums"]["ResponsibleBucket"]
          responsibleLabel: string | null
          responsibleMessageBreakdown: Json | null
          responsibleMessageCount: number
          tenantId: string
          updatedAt: string
        }
        Insert: {
          channelId: string
          cnpj?: string | null
          companyName?: string | null
          contactName?: string | null
          createdAt?: string
          currentLabels?: string[]
          currentSeverity?: string
          currentStatus: string
          firstIssueAt?: string | null
          firstSeenAt: string
          id: string
          lastIssueAt?: string | null
          lastRunId?: string | null
          lastSeenAt: string
          openConversationIds?: number[]
          phonePk: string
          resolvedAt?: string | null
          responsibleBucket?: Database["public"]["Enums"]["ResponsibleBucket"]
          responsibleLabel?: string | null
          responsibleMessageBreakdown?: Json | null
          responsibleMessageCount?: number
          tenantId: string
          updatedAt?: string
        }
        Update: {
          channelId?: string
          cnpj?: string | null
          companyName?: string | null
          contactName?: string | null
          createdAt?: string
          currentLabels?: string[]
          currentSeverity?: string
          currentStatus?: string
          firstIssueAt?: string | null
          firstSeenAt?: string
          id?: string
          lastIssueAt?: string | null
          lastRunId?: string | null
          lastSeenAt?: string
          openConversationIds?: number[]
          phonePk?: string
          resolvedAt?: string | null
          responsibleBucket?: Database["public"]["Enums"]["ResponsibleBucket"]
          responsibleLabel?: string | null
          responsibleMessageBreakdown?: Json | null
          responsibleMessageCount?: number
          tenantId?: string
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_states_channelId_fkey"
            columns: ["channelId"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_states_lastRunId_fkey"
            columns: ["lastRunId"]
            isOneToOne: false
            referencedRelation: "analysis_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_states_tenantId_fkey"
            columns: ["tenantId"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      "clinic+b2b_admin_users": {
        Row: {
          created_at: string
          display_name: string
          is_active: boolean
          permissions: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          is_active?: boolean
          permissions?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          is_active?: boolean
          permissions?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      "clinic+b2b_catalog_banners": {
        Row: {
          active: boolean
          created_at: string
          id: string
          image_url: string
          image_url_avif: string | null
          image_url_mobile: string | null
          image_url_mobile_avif: string | null
          label: string
          link_url: string | null
          slot: string
          sort_order: number
          updated_at: string
          visible_to: string[] | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          image_url: string
          image_url_avif?: string | null
          image_url_mobile?: string | null
          image_url_mobile_avif?: string | null
          label: string
          link_url?: string | null
          slot?: string
          sort_order?: number
          updated_at?: string
          visible_to?: string[] | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          image_url?: string
          image_url_avif?: string | null
          image_url_mobile?: string | null
          image_url_mobile_avif?: string | null
          label?: string
          link_url?: string | null
          slot?: string
          sort_order?: number
          updated_at?: string
          visible_to?: string[] | null
        }
        Relationships: []
      }
      "clinic+b2b_catalog_notification_reads": {
        Row: {
          created_at: string
          id: string
          notification_id: string
          read_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notification_id: string
          read_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notification_id?: string
          read_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      "clinic+b2b_catalog_notifications": {
        Row: {
          active: boolean
          body: string
          created_at: string
          cta_label: string | null
          cta_url: string | null
          ends_at: string | null
          id: string
          image_url: string | null
          priority: number
          starts_at: string | null
          summary: string
          target_user_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          body: string
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          priority?: number
          starts_at?: string | null
          summary: string
          target_user_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          priority?: number
          starts_at?: string | null
          summary?: string
          target_user_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      "clinic+b2b_clinic_catalogo_front_b2b": {
        Row: {
          active: boolean
          average_rating: number
          brand: string | null
          compare_at_price: number | null
          created_at: string
          description: string
          family: string
          id: string
          image_alts: string[] | null
          image_fit: string | null
          image_height: number | null
          image_url: string | null
          image_urls: string[]
          image_width: number | null
          is_featured: boolean
          is_promotion: boolean
          name: string
          price: number
          product_code: string | null
          review_count: number
          stock: number | null
          type: string
          updated_at: string
          visible_to: string[] | null
        }
        Insert: {
          active?: boolean
          average_rating?: number
          brand?: string | null
          compare_at_price?: number | null
          created_at?: string
          description?: string
          family: string
          id?: string
          image_alts?: string[] | null
          image_fit?: string | null
          image_height?: number | null
          image_url?: string | null
          image_urls?: string[]
          image_width?: number | null
          is_featured?: boolean
          is_promotion?: boolean
          name: string
          price?: number
          product_code?: string | null
          review_count?: number
          stock?: number | null
          type: string
          updated_at?: string
          visible_to?: string[] | null
        }
        Update: {
          active?: boolean
          average_rating?: number
          brand?: string | null
          compare_at_price?: number | null
          created_at?: string
          description?: string
          family?: string
          id?: string
          image_alts?: string[] | null
          image_fit?: string | null
          image_height?: number | null
          image_url?: string | null
          image_urls?: string[]
          image_width?: number | null
          is_featured?: boolean
          is_promotion?: boolean
          name?: string
          price?: number
          product_code?: string | null
          review_count?: number
          stock?: number | null
          type?: string
          updated_at?: string
          visible_to?: string[] | null
        }
        Relationships: []
      }
      "clinic+b2b_customer_addresses": {
        Row: {
          cep: string
          city: string
          complement: string
          created_at: string
          ibge: string
          id: string
          is_default: boolean
          label: string
          neighborhood: string
          number: string
          state: string
          street: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cep?: string
          city?: string
          complement?: string
          created_at?: string
          ibge?: string
          id?: string
          is_default?: boolean
          label?: string
          neighborhood?: string
          number?: string
          state?: string
          street?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cep?: string
          city?: string
          complement?: string
          created_at?: string
          ibge?: string
          id?: string
          is_default?: boolean
          label?: string
          neighborhood?: string
          number?: string
          state?: string
          street?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      "clinic+b2b_customer_price_overrides": {
        Row: {
          active: boolean
          created_at: string
          customer_type: string
          id: string
          price: number
          product_code: string
          proxis_tpr_id: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          customer_type: string
          id?: string
          price?: number
          product_code: string
          proxis_tpr_id?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          customer_type?: string
          id?: string
          price?: number
          product_code?: string
          proxis_tpr_id?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      "clinic+b2b_customer_profiles": {
        Row: {
          address_cep: string
          address_city: string
          address_complement: string
          address_ibge: string
          address_neighborhood: string
          address_number: string
          address_state: string
          address_street: string
          cnpj: string
          company: string
          created_at: string
          customer_type: string
          email: string | null
          linked_company_cnpj: string | null
          name: string
          observation: string | null
          phone: string
          price_table_synced_at: string | null
          proxis_found: boolean
          proxis_pes_id: number | null
          proxis_synced_at: string | null
          proxis_tpr_id: number | null
          representante_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address_cep?: string
          address_city?: string
          address_complement?: string
          address_ibge?: string
          address_neighborhood?: string
          address_number?: string
          address_state?: string
          address_street?: string
          cnpj: string
          company: string
          created_at?: string
          customer_type?: string
          email?: string | null
          linked_company_cnpj?: string | null
          name: string
          observation?: string | null
          phone: string
          price_table_synced_at?: string | null
          proxis_found?: boolean
          proxis_pes_id?: number | null
          proxis_synced_at?: string | null
          proxis_tpr_id?: number | null
          representante_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address_cep?: string
          address_city?: string
          address_complement?: string
          address_ibge?: string
          address_neighborhood?: string
          address_number?: string
          address_state?: string
          address_street?: string
          cnpj?: string
          company?: string
          created_at?: string
          customer_type?: string
          email?: string | null
          linked_company_cnpj?: string | null
          name?: string
          observation?: string | null
          phone?: string
          price_table_synced_at?: string | null
          proxis_found?: boolean
          proxis_pes_id?: number | null
          proxis_synced_at?: string | null
          proxis_tpr_id?: number | null
          representante_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      "clinic+b2b_customer_type_overrides": {
        Row: {
          cnpj: string
          created_at: string
          customer_type: string
          updated_at: string
        }
        Insert: {
          cnpj: string
          created_at?: string
          customer_type?: string
          updated_at?: string
        }
        Update: {
          cnpj?: string
          created_at?: string
          customer_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      "clinic+b2b_customer_favorites": {
        Row: {
          created_at: string
          product_id: string
          quantity: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          product_id: string
          quantity?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          product_id?: string
          quantity?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      "clinic+b2b_customer_types": {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      "clinic+b2b_orders": {
        Row: {
          created_at: string
          customer_address_cep: string
          customer_address_city: string
          customer_address_complement: string
          customer_address_ibge: string
          customer_address_neighborhood: string
          customer_address_number: string
          customer_address_state: string
          customer_address_street: string
          customer_cnpj: string
          customer_company: string
          customer_name: string
          customer_observation: string | null
          customer_phone: string
          id: string
          items: Json
          proxis_attempts: number
          proxis_doc_ped_web: string | null
          proxis_error: string | null
          proxis_import_id: number | null
          proxis_last_attempt_at: string | null
          proxis_status: string
          proxis_synced_at: string | null
          status: string
          submission_key: string
          total_items: number
        }
        Insert: {
          created_at?: string
          customer_address_cep?: string
          customer_address_city?: string
          customer_address_complement?: string
          customer_address_ibge?: string
          customer_address_neighborhood?: string
          customer_address_number?: string
          customer_address_state?: string
          customer_address_street?: string
          customer_cnpj: string
          customer_company: string
          customer_name: string
          customer_observation?: string | null
          customer_phone: string
          id?: string
          items?: Json
          proxis_attempts?: number
          proxis_doc_ped_web?: string | null
          proxis_error?: string | null
          proxis_import_id?: number | null
          proxis_last_attempt_at?: string | null
          proxis_status?: string
          proxis_synced_at?: string | null
          status?: string
          submission_key?: string
          total_items?: number
        }
        Update: {
          created_at?: string
          customer_address_cep?: string
          customer_address_city?: string
          customer_address_complement?: string
          customer_address_ibge?: string
          customer_address_neighborhood?: string
          customer_address_number?: string
          customer_address_state?: string
          customer_address_street?: string
          customer_cnpj?: string
          customer_company?: string
          customer_name?: string
          customer_observation?: string | null
          customer_phone?: string
          id?: string
          items?: Json
          proxis_attempts?: number
          proxis_doc_ped_web?: string | null
          proxis_error?: string | null
          proxis_import_id?: number | null
          proxis_last_attempt_at?: string | null
          proxis_status?: string
          proxis_synced_at?: string | null
          status?: string
          submission_key?: string
          total_items?: number
        }
        Relationships: []
      }
      "clinic+b2b_price_tables": {
        Row: {
          active: boolean
          created_at: string
          name: string
          synced_at: string | null
          tpr_id: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          name?: string
          synced_at?: string | null
          tpr_id: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          name?: string
          synced_at?: string | null
          tpr_id?: number
          updated_at?: string
        }
        Relationships: []
      }
      "clinic+b2b_product_brands": {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      "clinic+b2b_product_families": {
        Row: {
          created_at: string
          id: string
          name: string
          type_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          type_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          type_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      "clinic+b2b_product_reviews": {
        Row: {
          admin_responded_at: string | null
          admin_response: string | null
          comment: string | null
          created_at: string
          id: string
          product_id: string
          rating: number
          tags: string[]
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_responded_at?: string | null
          admin_response?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          product_id: string
          rating: number
          tags?: string[]
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_responded_at?: string | null
          admin_response?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          product_id?: string
          rating?: number
          tags?: string[]
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      "clinic+b2b_product_types": {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      "clinic+b2b_support_conversations": {
        Row: {
          admin_typing_at: string | null
          assigned_admin_id: string | null
          created_at: string
          customer_cnpj: string | null
          customer_company: string | null
          customer_name: string
          customer_phone: string | null
          customer_typing_at: string | null
          customer_user_id: string
          id: string
          last_message_at: string
          last_message_preview: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          admin_typing_at?: string | null
          assigned_admin_id?: string | null
          created_at?: string
          customer_cnpj?: string | null
          customer_company?: string | null
          customer_name: string
          customer_phone?: string | null
          customer_typing_at?: string | null
          customer_user_id: string
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Update: {
          admin_typing_at?: string | null
          assigned_admin_id?: string | null
          created_at?: string
          customer_cnpj?: string | null
          customer_company?: string | null
          customer_name?: string
          customer_phone?: string | null
          customer_typing_at?: string | null
          customer_user_id?: string
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      "clinic+b2b_support_messages": {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          sender_role: string
          sender_user_id: string
          updated_at: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_role: string
          sender_user_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_role?: string
          sender_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      "clinic+b2b_user_roles": {
        Row: {
          id: string
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          role: string
          user_id: string
        }
        Update: {
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          chatwootContactId: number | null
          createdAt: string
          id: string
          identifierHash: string | null
          identifierLast4: string | null
          name: string | null
          tenantId: string
          updatedAt: string
        }
        Insert: {
          chatwootContactId?: number | null
          createdAt?: string
          id: string
          identifierHash?: string | null
          identifierLast4?: string | null
          name?: string | null
          tenantId: string
          updatedAt: string
        }
        Update: {
          chatwootContactId?: number | null
          createdAt?: string
          id?: string
          identifierHash?: string | null
          identifierLast4?: string | null
          name?: string | null
          tenantId?: string
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_tenantId_fkey"
            columns: ["tenantId"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_analyses: {
        Row: {
          aiRawJson: Json | null
          contactId: string | null
          conversationId: string
          costUsd: number | null
          createdAt: string
          finalizationStatus:
            | Database["public"]["Enums"]["FinalizationStatus"]
            | null
          id: string
          improvementsJson: Json | null
          model: string | null
          nextStepsJson: Json | null
          promptVersion: string | null
          riskLevel: string | null
          runId: string
          summary: string | null
          tokensIn: number | null
          tokensOut: number | null
        }
        Insert: {
          aiRawJson?: Json | null
          contactId?: string | null
          conversationId: string
          costUsd?: number | null
          createdAt?: string
          finalizationStatus?:
            | Database["public"]["Enums"]["FinalizationStatus"]
            | null
          id: string
          improvementsJson?: Json | null
          model?: string | null
          nextStepsJson?: Json | null
          promptVersion?: string | null
          riskLevel?: string | null
          runId: string
          summary?: string | null
          tokensIn?: number | null
          tokensOut?: number | null
        }
        Update: {
          aiRawJson?: Json | null
          contactId?: string | null
          conversationId?: string
          costUsd?: number | null
          createdAt?: string
          finalizationStatus?:
            | Database["public"]["Enums"]["FinalizationStatus"]
            | null
          id?: string
          improvementsJson?: Json | null
          model?: string | null
          nextStepsJson?: Json | null
          promptVersion?: string | null
          riskLevel?: string | null
          runId?: string
          summary?: string | null
          tokensIn?: number | null
          tokensOut?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_analyses_contactId_fkey"
            columns: ["contactId"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_analyses_conversationId_fkey"
            columns: ["conversationId"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_analyses_runId_fkey"
            columns: ["runId"]
            isOneToOne: false
            referencedRelation: "analysis_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_delta_states: {
        Row: {
          channelId: string
          chatwootConversationId: number
          createdAt: string
          id: string
          lastAnalyzedAt: string | null
          lastAnalyzedMessageId: number | null
          lastDeltaHash: string | null
          lastFullAt: string | null
          lastLabels: string[]
          lastMessageAt: string | null
          lastMessageRole: string | null
          lastRunMode: string | null
          lastStatus: string | null
          stateSummary: string | null
          tenantId: string
          updatedAt: string
        }
        Insert: {
          channelId: string
          chatwootConversationId: number
          createdAt?: string
          id: string
          lastAnalyzedAt?: string | null
          lastAnalyzedMessageId?: number | null
          lastDeltaHash?: string | null
          lastFullAt?: string | null
          lastLabels?: string[]
          lastMessageAt?: string | null
          lastMessageRole?: string | null
          lastRunMode?: string | null
          lastStatus?: string | null
          stateSummary?: string | null
          tenantId: string
          updatedAt?: string
        }
        Update: {
          channelId?: string
          chatwootConversationId?: number
          createdAt?: string
          id?: string
          lastAnalyzedAt?: string | null
          lastAnalyzedMessageId?: number | null
          lastDeltaHash?: string | null
          lastFullAt?: string | null
          lastLabels?: string[]
          lastMessageAt?: string | null
          lastMessageRole?: string | null
          lastRunMode?: string | null
          lastStatus?: string | null
          stateSummary?: string | null
          tenantId?: string
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_delta_states_channelId_fkey"
            columns: ["channelId"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_delta_states_tenantId_fkey"
            columns: ["tenantId"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_timeline_events: {
        Row: {
          channelId: string
          chatwootConversationId: number
          createdAt: string
          dateRef: string
          eventType: string
          id: string
          phonePk: string
          reason: string
          severity: string
          source: string
          tenantId: string
        }
        Insert: {
          channelId: string
          chatwootConversationId: number
          createdAt?: string
          dateRef: string
          eventType: string
          id: string
          phonePk: string
          reason: string
          severity?: string
          source: string
          tenantId: string
        }
        Update: {
          channelId?: string
          chatwootConversationId?: number
          createdAt?: string
          dateRef?: string
          eventType?: string
          id?: string
          phonePk?: string
          reason?: string
          severity?: string
          source?: string
          tenantId?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_timeline_events_channelId_fkey"
            columns: ["channelId"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_timeline_events_tenantId_fkey"
            columns: ["tenantId"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          channelId: string
          chatwootConversationId: number
          contactId: string | null
          createdAt: string
          id: string
          labels: string[] | null
          lastActivityAt: string | null
          resolvedAt: string | null
          status: string | null
          tenantId: string
          updatedAt: string
        }
        Insert: {
          channelId: string
          chatwootConversationId: number
          contactId?: string | null
          createdAt?: string
          id: string
          labels?: string[] | null
          lastActivityAt?: string | null
          resolvedAt?: string | null
          status?: string | null
          tenantId: string
          updatedAt: string
        }
        Update: {
          channelId?: string
          chatwootConversationId?: number
          contactId?: string | null
          createdAt?: string
          id?: string
          labels?: string[] | null
          lastActivityAt?: string | null
          resolvedAt?: string | null
          status?: string | null
          tenantId?: string
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_channelId_fkey"
            columns: ["channelId"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_contactId_fkey"
            columns: ["contactId"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_tenantId_fkey"
            columns: ["tenantId"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_secrets: {
        Row: {
          created_at: string
          description: string | null
          name: string
          secret: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          name: string
          secret: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          name?: string
          secret?: string
          updated_at?: string
        }
        Relationships: []
      }
      gaps: {
        Row: {
          analysisId: string
          category: string | null
          confirmedData: string | null
          createdAt: string
          description: string | null
          id: string
          isCritical: boolean
          messageReference: string | null
          name: string
          severity: Database["public"]["Enums"]["GapSeverity"]
          userReportedData: string | null
        }
        Insert: {
          analysisId: string
          category?: string | null
          confirmedData?: string | null
          createdAt?: string
          description?: string | null
          id: string
          isCritical?: boolean
          messageReference?: string | null
          name: string
          severity?: Database["public"]["Enums"]["GapSeverity"]
          userReportedData?: string | null
        }
        Update: {
          analysisId?: string
          category?: string | null
          confirmedData?: string | null
          createdAt?: string
          description?: string | null
          id?: string
          isCritical?: boolean
          messageReference?: string | null
          name?: string
          severity?: Database["public"]["Enums"]["GapSeverity"]
          userReportedData?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gaps_analysisId_fkey"
            columns: ["analysisId"]
            isOneToOne: false
            referencedRelation: "conversation_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      insights: {
        Row: {
          analysisId: string
          createdAt: string
          id: string
          operationalStateJson: Json | null
          severity: Database["public"]["Enums"]["InsightSeverity"]
          summary: string
          title: string
          type: string | null
        }
        Insert: {
          analysisId: string
          createdAt?: string
          id: string
          operationalStateJson?: Json | null
          severity: Database["public"]["Enums"]["InsightSeverity"]
          summary: string
          title: string
          type?: string | null
        }
        Update: {
          analysisId?: string
          createdAt?: string
          id?: string
          operationalStateJson?: Json | null
          severity?: Database["public"]["Enums"]["InsightSeverity"]
          summary?: string
          title?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insights_analysisId_fkey"
            columns: ["analysisId"]
            isOneToOne: false
            referencedRelation: "conversation_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      job_events: {
        Row: {
          createdAt: string
          eventType: string
          id: string
          payloadJson: Json | null
          runId: string
        }
        Insert: {
          createdAt?: string
          eventType: string
          id: string
          payloadJson?: Json | null
          runId: string
        }
        Update: {
          createdAt?: string
          eventType?: string
          id?: string
          payloadJson?: Json | null
          runId?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_events_runId_fkey"
            columns: ["runId"]
            isOneToOne: false
            referencedRelation: "analysis_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          chatwootMessageId: number
          content: string
          contentHash: string | null
          conversationId: string
          createdAt: string
          id: string
          role: string
          senderName: string | null
          tenantId: string
        }
        Insert: {
          chatwootMessageId: number
          content: string
          contentHash?: string | null
          conversationId: string
          createdAt: string
          id: string
          role: string
          senderName?: string | null
          tenantId: string
        }
        Update: {
          chatwootMessageId?: number
          content?: string
          contentHash?: string | null
          conversationId?: string
          createdAt?: string
          id?: string
          role?: string
          senderName?: string | null
          tenantId?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversationId_fkey"
            columns: ["conversationId"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_tenantId_fkey"
            columns: ["tenantId"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          generatedAt: string
          id: string
          reportJson: Json | null
          reportMarkdown: string
          runId: string
          version: string | null
        }
        Insert: {
          generatedAt?: string
          id: string
          reportJson?: Json | null
          reportMarkdown: string
          runId: string
          version?: string | null
        }
        Update: {
          generatedAt?: string
          id?: string
          reportJson?: Json | null
          reportMarkdown?: string
          runId?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_runId_fkey"
            columns: ["runId"]
            isOneToOne: false
            referencedRelation: "analysis_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      review_marks: {
        Row: {
          channel_id: string
          contact_key: string | null
          conversation_id: number | null
          created_at: string
          date_ref: string
          id: string
          item_key: string
          item_summary: string | null
          item_title: string | null
          reviewed: boolean
          reviewed_at: string
          reviewed_by_allowed_user_id: string | null
          reviewed_by_email: string | null
          reviewed_by_name: string | null
          reviewed_by_role: string | null
          reviewed_by_user_id: string | null
          section: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          channel_id: string
          contact_key?: string | null
          conversation_id?: number | null
          created_at?: string
          date_ref: string
          id: string
          item_key: string
          item_summary?: string | null
          item_title?: string | null
          reviewed?: boolean
          reviewed_at?: string
          reviewed_by_allowed_user_id?: string | null
          reviewed_by_email?: string | null
          reviewed_by_name?: string | null
          reviewed_by_role?: string | null
          reviewed_by_user_id?: string | null
          section: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          channel_id?: string
          contact_key?: string | null
          conversation_id?: number | null
          created_at?: string
          date_ref?: string
          id?: string
          item_key?: string
          item_summary?: string | null
          item_title?: string | null
          reviewed?: boolean
          reviewed_at?: string
          reviewed_by_allowed_user_id?: string | null
          reviewed_by_email?: string | null
          reviewed_by_name?: string | null
          reviewed_by_role?: string | null
          reviewed_by_user_id?: string | null
          section?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_marks_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_marks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_checkpoints: {
        Row: {
          channelId: string
          createdAt: string
          id: string
          lastChatwootCursor: string | null
          lastSyncedAt: string | null
          tenantId: string
          updatedAt: string
        }
        Insert: {
          channelId: string
          createdAt?: string
          id: string
          lastChatwootCursor?: string | null
          lastSyncedAt?: string | null
          tenantId: string
          updatedAt: string
        }
        Update: {
          channelId?: string
          createdAt?: string
          id?: string
          lastChatwootCursor?: string | null
          lastSyncedAt?: string | null
          tenantId?: string
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_checkpoints_channelId_fkey"
            columns: ["channelId"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_checkpoints_tenantId_fkey"
            columns: ["tenantId"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          createdAt: string
          id: string
          name: string
          slug: string
          updatedAt: string
        }
        Insert: {
          createdAt?: string
          id: string
          name: string
          slug: string
          updatedAt: string
        }
        Update: {
          createdAt?: string
          id?: string
          name?: string
          slug?: string
          updatedAt?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_update_user_email: {
        Args: { p_email: string; p_user_id: string }
        Returns: undefined
      }
      allocate_proxis_import_id: {
        Args: { p_order_id: string }
        Returns: number
      }
      block_public_signups: { Args: { event: Json }; Returns: Json }
      check_auth_email_exists: { Args: { p_email: string }; Returns: boolean }
      clinic_b2b_can_view_order: {
        Args: { p_customer_cnpj: string }
        Returns: boolean
      }
      clinic_b2b_current_email: { Args: never; Returns: string }
      clinic_b2b_is_allowed_user: { Args: never; Returns: boolean }
      clinic_b2b_is_internal_staff: { Args: never; Returns: boolean }
      clinic_b2b_is_own_record: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      clinic_b2b_is_superadmin: { Args: never; Returns: boolean }
      count_product_reviews: { Args: { p_product_id: string }; Returns: number }
      dispatch_report_day_auto_sync: { Args: never; Returns: undefined }
      ensure_support_conversation: {
        Args: { p_subject?: string }
        Returns: string
      }
      get_product_reviews: {
        Args: { p_page?: number; p_page_size?: number; p_product_id: string }
        Returns: {
          admin_responded_at: string
          admin_response: string
          comment: string
          created_at: string
          id: string
          product_id: string
          rating: number
          tags: string[]
          title: string
          updated_at: string
          user_id: string
          user_name: string
        }[]
      }
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
      list_admin_users: {
        Args: never
        Returns: {
          created_at: string
          display_name: string
          email: string
          is_active: boolean
          permissions: Json
          role: string
          user_id: string
        }[]
      }
      list_internal_staff: {
        Args: never
        Returns: {
          created_at: string
          email: string
          role: string
          user_id: string
        }[]
      }
      register_customer_profile: {
        Args: {
          p_address_cep?: string
          p_address_city?: string
          p_address_complement?: string
          p_address_ibge?: string
          p_address_neighborhood?: string
          p_address_number?: string
          p_address_state?: string
          p_address_street?: string
          p_cnpj: string
          p_company: string
          p_customer_type: string
          p_name: string
          p_phone: string
        }
        Returns: undefined
      }
      set_admin_display_name: {
        Args: { p_display_name: string; p_user_id: string }
        Returns: undefined
      }
      set_customer_default_address: {
        Args: { p_address_id: string; p_user_id: string }
        Returns: undefined
      }
      set_customer_representante: {
        Args: { p_customer_user_id: string; p_representante_id: string }
        Returns: undefined
      }
      set_internal_staff_role: {
        Args: { p_email: string; p_role: string }
        Returns: undefined
      }
      sync_customer_proxis_link: {
        Args: {
          p_proxis_found?: boolean
          p_proxis_pes_id?: number
          p_proxis_tpr_id?: number
          p_user_id?: string
        }
        Returns: undefined
      }
      toggle_admin_active: {
        Args: { p_active: boolean; p_user_id: string }
        Returns: undefined
      }
      top_selling_products: {
        Args: { p_limit?: number }
        Returns: {
          order_count: number
          product_id: string
          total_quantity: number
        }[]
      }
      update_admin_display_name: {
        Args: { p_display_name: string; p_user_id: string }
        Returns: undefined
      }
      update_admin_permissions: {
        Args: { p_permissions: Json; p_user_id: string }
        Returns: undefined
      }
      update_admin_role: {
        Args: { p_role: string; p_user_id: string }
        Returns: undefined
      }
      update_own_customer_profile: {
        Args: {
          p_address_cep?: string
          p_address_city?: string
          p_address_complement?: string
          p_address_ibge?: string
          p_address_neighborhood?: string
          p_address_number?: string
          p_address_state?: string
          p_address_street?: string
          p_cnpj?: string
          p_company?: string
          p_name?: string
          p_phone?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_auth_role: "superadmin" | "admin"
      FinalizationStatus: "finalizada" | "continuada"
      GapSeverity: "alta" | "media" | "baixa" | "nao_informado"
      InsightSeverity: "critical" | "high" | "medium" | "low" | "info"
      ResponsibleBucket: "ia" | "suellen" | "samuel"
      RunStatus: "running" | "completed" | "failed"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_auth_role: ["superadmin", "admin"],
      FinalizationStatus: ["finalizada", "continuada"],
      GapSeverity: ["alta", "media", "baixa", "nao_informado"],
      InsightSeverity: ["critical", "high", "medium", "low", "info"],
      ResponsibleBucket: ["ia", "suellen", "samuel"],
      RunStatus: ["running", "completed", "failed"],
    },
  },
} as const
