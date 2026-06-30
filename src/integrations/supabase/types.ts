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
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
