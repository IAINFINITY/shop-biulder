import type { CustomerProfile } from "@/lib/customerProfile";
import type { User } from "@supabase/supabase-js";

const AUTH_PROFILE_STORAGE_KEY = "clinicplus_customer_profile_cache";
const AUTH_BOOTSTRAP_STORAGE_KEY = "clinicplus_auth_bootstrap";

export type AuthBootstrapSnapshot = {
  user: User;
  isAdmin: boolean;
};

function normalizeCustomerProfile(profile: CustomerProfile): CustomerProfile {
  return {
    ...profile,
    proxis_pes_id: profile.proxis_pes_id ?? null,
    proxis_tpr_id: profile.proxis_tpr_id ?? null,
    proxis_found: profile.proxis_found ?? false,
    proxis_synced_at: profile.proxis_synced_at ?? null,
  };
}

export function readCachedCustomerProfile(userId?: string | null): CustomerProfile | null {
  if (typeof window === "undefined" || !userId) return null;

  try {
    const raw = window.sessionStorage.getItem(AUTH_PROFILE_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<CustomerProfile> | null;
    if (!parsed || parsed.user_id !== userId) return null;

    return normalizeCustomerProfile(parsed as CustomerProfile);
  } catch {
    return null;
  }
}

export function readAuthBootstrapSnapshot(): AuthBootstrapSnapshot | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(AUTH_BOOTSTRAP_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<AuthBootstrapSnapshot> | null;
    if (!parsed?.user || typeof parsed.user !== "object") return null;

    return {
      user: parsed.user as User,
      isAdmin: Boolean(parsed.isAdmin),
    };
  } catch {
    return null;
  }
}
