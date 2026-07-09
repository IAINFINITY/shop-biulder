export async function loadSupabaseClient() {
  const module = await import("@/integrations/supabase/client");
  return module.supabase;
}
