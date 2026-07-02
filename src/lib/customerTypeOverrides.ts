import { onlyDigits } from "@/lib/brazilianIds";
import type { CustomerType } from "@/lib/pricing";

export const CUSTOMER_TYPE_OVERRIDES_TABLE = "customer_type_overrides";

export type CustomerTypeOverride = {
  cnpj: string;
  customer_type: CustomerType;
  created_at: string;
  updated_at: string;
};

export function normalizeCustomerCnpj(value: string | null | undefined): string {
  return onlyDigits(value ?? "").slice(0, 14);
}

export function buildCustomerTypeOverrideMap(rows: CustomerTypeOverride[]): Map<string, CustomerType> {
  const map = new Map<string, CustomerType>();

  for (const row of rows) {
    const cnpj = normalizeCustomerCnpj(row.cnpj);
    if (!cnpj) continue;
    map.set(cnpj, row.customer_type);
  }

  return map;
}
