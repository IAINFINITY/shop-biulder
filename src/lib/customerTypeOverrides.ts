import { onlyDigits } from "@/lib/brazilianIds";

export const CUSTOMER_TYPE_OVERRIDES_TABLE = "customer_type_overrides";

export type CustomerTypeOverride = {
  cnpj: string;
  customer_type: string;
  created_at: string;
  updated_at: string;
};

export function normalizeCustomerCnpj(value: string | null | undefined): string {
  return onlyDigits(value ?? "").slice(0, 14);
}

export function buildCustomerTypeOverrideMap(rows: CustomerTypeOverride[]): Map<string, string> {
  const map = new Map<string, string>();

  for (const row of rows) {
    const cnpj = normalizeCustomerCnpj(row.cnpj);
    if (!cnpj) continue;
    map.set(cnpj, row.customer_type);
  }

  return map;
}
