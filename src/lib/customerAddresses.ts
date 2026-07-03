import type { AddressFormData } from "@/lib/address";

export const CUSTOMER_ADDRESSES_TABLE = "customer_addresses";

export type CustomerAddress = AddressFormData & {
  id: string;
  user_id: string;
  label: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type CustomerAddressFormData = AddressFormData & {
  label: string;
  is_default: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeBoolean(value: unknown): boolean {
  return Boolean(value);
}

export function emptyCustomerAddressForm(): CustomerAddressFormData {
  return {
    label: "Principal",
    is_default: true,
    cep: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    ibge: "",
  };
}

export function customerAddressFromRow(row: unknown): CustomerAddress {
  const record = isRecord(row) ? row : {};

  return {
    id: normalizeText(record.id),
    user_id: normalizeText(record.user_id),
    label: normalizeText(record.label) || "Endereço",
    is_default: normalizeBoolean(record.is_default),
    cep: normalizeText(record.cep),
    street: normalizeText(record.street),
    number: normalizeText(record.number),
    complement: normalizeText(record.complement),
    neighborhood: normalizeText(record.neighborhood),
    city: normalizeText(record.city),
    state: normalizeText(record.state),
    ibge: normalizeText(record.ibge),
    created_at: normalizeText(record.created_at),
    updated_at: normalizeText(record.updated_at),
  };
}

export function customerAddressFormFromAddress(address: CustomerAddress): CustomerAddressFormData {
  return {
    label: address.label,
    is_default: address.is_default,
    cep: address.cep,
    street: address.street,
    number: address.number,
    complement: address.complement,
    neighborhood: address.neighborhood,
    city: address.city,
    state: address.state,
    ibge: address.ibge,
  };
}

export function customerAddressRowFromForm(userId: string, form: CustomerAddressFormData) {
  return {
    user_id: userId,
    label: form.label.trim() || "Endereço",
    is_default: form.is_default,
    cep: form.cep.trim(),
    street: form.street.trim(),
    number: form.number.trim(),
    complement: form.complement.trim(),
    neighborhood: form.neighborhood.trim(),
    city: form.city.trim(),
    state: form.state.trim().toUpperCase(),
    ibge: form.ibge.trim(),
  };
}
