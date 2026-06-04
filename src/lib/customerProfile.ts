export const CUSTOMER_PROFILES_TABLE = "customer_profiles";

export interface CustomerProfile {
  user_id: string;
  name: string;
  phone: string;
  company: string;
  cnpj: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerRegistrationData {
  name: string;
  phone: string;
  company: string;
  cnpj: string;
  email: string;
  password: string;
}
