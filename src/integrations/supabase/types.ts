export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      products: {
        Row: {
          active: boolean
          created_at: string
          description: string
          family: string
          id: string
          image_url: string | null
          name: string
          price: number
          type: string
          updated_at: string
        }
        Insert: {
          active: boolean
          created_at: string
          description: string
          family: string
          id: string
          image_url: string | null
          name: string
          price: number
          type: string
          updated_at: string
        }
        Update: {
          active: boolean
          created_at: string
          description: string
          family: string
          id: string
          image_url: string | null
          name: string
          price: number
          type: string
          updated_at: string
        }
        Relationships: []
      }
      "Clinic+ - Catálogo Front B2B": {
        Row: {
          active: boolean
          created_at: string
          description: string
          family: string
          id: string
          image_url: string | null
          image_urls: string[]
          name: string
          price: number
          product_code: string | null
          type: string
          updated_at: string
        }
        Insert: {
          active: boolean
          created_at: string
          description: string
          family: string
          id: string
          image_url: string | null
          image_urls: string[]
          name: string
          price: number
          product_code: string | null
          type: string
          updated_at: string
        }
        Update: {
          active: boolean
          created_at: string
          description: string
          family: string
          id: string
          image_url: string | null
          image_urls: string[]
          name: string
          price: number
          product_code: string | null
          type: string
          updated_at: string
        }
        Relationships: []
      }

      orders: {
        Row: {
          created_at: string
          customer_cnpj: string
          customer_company: string
          customer_observation: string | null
          customer_name: string
          customer_phone: string
          customer_address_cep: string
          customer_address_street: string
          customer_address_number: string
          customer_address_complement: string
          customer_address_neighborhood: string
          customer_address_city: string
          customer_address_state: string
          customer_address_ibge: string
          id: string
          items: Json
          proxis_import_id: number | null
          status: string
          total_items: number
        }
        Insert: {
          created_at: string
          customer_cnpj: string
          customer_company: string
          customer_observation: string | null
          customer_name: string
          customer_phone: string
          customer_address_cep: string
          customer_address_street: string
          customer_address_number: string
          customer_address_complement: string
          customer_address_neighborhood: string
          customer_address_city: string
          customer_address_state: string
          customer_address_ibge: string
          id: string
          items: Json
          proxis_import_id: number | null
          status: string
          total_items: number
        }
        Update: {
          created_at: string
          customer_cnpj: string
          customer_company: string
          customer_observation: string | null
          customer_name: string
          customer_phone: string
          customer_address_cep: string
          customer_address_street: string
          customer_address_number: string
          customer_address_complement: string
          customer_address_neighborhood: string
          customer_address_city: string
          customer_address_state: string
          customer_address_ibge: string
          id: string
          items: Json
          proxis_import_id: number | null
          status: string
          total_items: number
        }
        Relationships: []
      }
      product_types: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at: string
          id: string
          name: string
        }
        Update: {
          created_at: string
          id: string
          name: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Relationships: []
      }
      customer_profiles: {
        Row: {
          user_id: string
          name: string
          phone: string
          company: string
          cnpj: string
          customer_type: string
          proxis_pes_id: number | null
          proxis_tpr_id: number | null
          proxis_found: boolean
          proxis_synced_at: string | null
          address_cep: string
          address_street: string
          address_number: string
          address_complement: string
          address_neighborhood: string
          address_city: string
          address_state: string
          address_ibge: string
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          name: string
          phone: string
          company: string
          cnpj: string
          customer_type: string
          proxis_pes_id: number | null
          proxis_tpr_id: number | null
          proxis_found: boolean
          proxis_synced_at: string | null
          address_cep: string
          address_street: string
          address_number: string
          address_complement: string
          address_neighborhood: string
          address_city: string
          address_state: string
          address_ibge: string
          created_at: string
          updated_at: string
        }
        Update: {
          user_id: string
          name: string
          phone: string
          company: string
          cnpj: string
          customer_type: string
          proxis_pes_id: number | null
          proxis_tpr_id: number | null
          proxis_found: boolean
          proxis_synced_at: string | null
          address_cep: string
          address_street: string
          address_number: string
          address_complement: string
          address_neighborhood: string
          address_city: string
          address_state: string
          address_ibge: string
          created_at: string
          updated_at: string
        }
        Relationships: []
      }
      customer_price_overrides: {
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
          active: boolean
          created_at: string
          customer_type: string
          id: string
          price: number
          product_code: string
          proxis_tpr_id: number | null
          updated_at: string
        }
        Update: {
          active: boolean
          created_at: string
          customer_type: string
          id: string
          price: number
          product_code: string
          proxis_tpr_id: number | null
          updated_at: string
        }
        Relationships: []
      }
      customer_type_overrides: {
        Row: {
          cnpj: string
          customer_type: string
          created_at: string
          updated_at: string
        }
        Insert: {
          cnpj: string
          customer_type?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          cnpj?: string
          customer_type?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      support_conversations: {
        Row: {
          assigned_admin_id: string | null
          created_at: string
          customer_cnpj: string | null
          customer_company: string | null
          customer_name: string
          customer_phone: string | null
          customer_user_id: string
          customer_typing_at: string | null
          id: string
          last_message_at: string
          last_message_preview: string | null
          admin_typing_at: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          assigned_admin_id?: string | null
          created_at?: string
          customer_cnpj?: string | null
          customer_company?: string | null
          customer_name: string
          customer_phone?: string | null
          customer_user_id: string
          customer_typing_at?: string | null
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          admin_typing_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Update: {
          assigned_admin_id?: string | null
          created_at?: string
          customer_cnpj?: string | null
          customer_company?: string | null
          customer_name?: string
          customer_phone?: string | null
          customer_user_id?: string
          customer_typing_at?: string | null
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          admin_typing_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_conversations_assigned_admin_id_fkey"
            columns: ["assigned_admin_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_conversations_customer_user_id_fkey"
            columns: ["customer_user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
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
        Relationships: [
          {
            foreignKeyName: "support_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "users"
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
      register_customer_profile: {
        Args: {
          p_name: string
          p_phone: string
          p_company: string
          p_cnpj: string
          p_customer_type: string
          p_address_cep: string
          p_address_street: string
          p_address_number: string
          p_address_complement: string
          p_address_neighborhood: string
          p_address_city: string
          p_address_state: string
          p_address_ibge: string
        }
        Returns: undefined
      }
      ensure_support_conversation: {
        Args: {
          p_subject?: string
        }
        Returns: string
      }
      list_internal_staff: {
        Args: Record<string, never>
        Returns: {
          created_at: string
          email: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      set_internal_staff_role: {
        Args: {
          p_email: string
          p_role: Database["public"]["Enums"]["app_role"]
        }
        Returns: undefined
      }
      sync_customer_proxis_link: {
        Args: {
          p_proxis_found: boolean
          p_proxis_pes_id: number | null
          p_proxis_tpr_id: number | null
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user" | "consultor" | "representante" | "admin_atendimento"
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
      app_role: ["admin", "user", "consultor", "representante", "admin_atendimento"],
    },
  },
} as const
