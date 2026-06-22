import { supabase } from "@/integrations/supabase/client";
import { ORDERS_TABLE } from "@/lib/orders";

export async function ensureProxisImportId(
  orderId: string,
  existingProxisImportId?: number | null,
): Promise<number> {
  if (existingProxisImportId != null && existingProxisImportId > 0) {
    return existingProxisImportId;
  }

  const { data, error } = await supabase.rpc("allocate_proxis_import_id", {
    p_order_id: orderId,
  });

  if (error) {
    throw new Error(
      `Não foi possível gerar ID Proxis. Execute a migration supabase/migrations/20260528140000_proxis_import_id.sql no Supabase. (${error.message})`,
    );
  }

  const id = typeof data === "number" ? data : Number(data);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("ID Proxis inválido retornado pelo banco.");
  }

  return id;
}

export async function refreshOrderProxisImportId(orderId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from(ORDERS_TABLE)
    .select("proxis_import_id")
    .eq("id", orderId)
    .maybeSingle();

  if (error) return null;
  return data?.proxis_import_id ?? null;
}
