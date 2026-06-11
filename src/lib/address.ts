import { onlyDigits } from "@/lib/brazilianIds";

export type AddressFormData = {
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  ibge: string;
};

export const emptyAddressForm = (): AddressFormData => ({
  cep: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  ibge: "",
});

export const formatCep = (value: string) => {
  const digits = onlyDigits(value).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

export const isCepComplete = (cep: string) => onlyDigits(cep).length === 8;

export function assertAddressReady(address: AddressFormData): string | null {
  if (!isCepComplete(address.cep)) return "CEP incompleto. Preencha 8 digitos.";
  if (!address.street.trim()) return "Informe o endereco (rua).";
  if (!address.neighborhood.trim()) return "Informe o bairro.";
  if (!address.city.trim()) return "Informe a cidade.";
  if (!address.state.trim() || address.state.trim().length !== 2) return "Informe o estado (UF).";
  if (!address.number.trim()) return "Informe o numero do endereco.";
  return null;
}

export function addressToProxisPayload(address: AddressFormData) {
  return {
    cep: onlyDigits(address.cep),
    street: address.street.trim(),
    number: address.number.trim(),
    complement: address.complement.trim(),
    neighborhood: address.neighborhood.trim(),
    city: address.city.trim(),
    state: address.state.trim().toUpperCase(),
    ibge: onlyDigits(address.ibge),
  };
}

export function addressToOrderColumns(address: AddressFormData) {
  const normalized = addressToProxisPayload(address);
  return {
    customer_address_cep: normalized.cep,
    customer_address_street: normalized.street,
    customer_address_number: normalized.number,
    customer_address_complement: normalized.complement,
    customer_address_neighborhood: normalized.neighborhood,
    customer_address_city: normalized.city,
    customer_address_state: normalized.state,
    customer_address_ibge: normalized.ibge,
  };
}
