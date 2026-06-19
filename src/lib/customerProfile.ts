import type { AddressFormData } from "@/lib/address";
import type { CustomerType } from "@/lib/pricing";

export const CUSTOMER_PROFILES_TABLE = "customer_profiles";

export interface CustomerProfile {
  user_id: string;
  name: string;
  phone: string;
  company: string;
  cnpj: string;
  customer_type: CustomerType;
  address_cep: string;
  address_street: string;
  address_number: string;
  address_complement: string;
  address_neighborhood: string;
  address_city: string;
  address_state: string;
  address_ibge: string;
  created_at: string;
  updated_at: string;
}

export type CustomerFormCore = {
  name: string;
  phone: string;
  company: string;
  cnpj: string;
  customer_type: CustomerType;
};

export interface CustomerRegistrationData extends CustomerFormCore, AddressFormData {
  email: string;
  password: string;
}

export function profileAddressToForm(profile: CustomerProfile): AddressFormData {
  return {
    cep: profile.address_cep,
    street: profile.address_street,
    number: profile.address_number,
    complement: profile.address_complement,
    neighborhood: profile.address_neighborhood,
    city: profile.address_city,
    state: profile.address_state,
    ibge: profile.address_ibge,
  };
}

export function addressFormToProfileColumns(address: AddressFormData) {
  return {
    p_address_cep: address.cep,
    p_address_street: address.street,
    p_address_number: address.number,
    p_address_complement: address.complement,
    p_address_neighborhood: address.neighborhood,
    p_address_city: address.city,
    p_address_state: address.state,
    p_address_ibge: address.ibge,
  };
}
