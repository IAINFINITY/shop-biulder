-- Allow public customer signups again.
-- The Before User Created hook still points to block_public_signups in the
-- Supabase dashboard, so keeping this function name and making it permissive
-- restores the public catalog signup flow.

DO $do$
BEGIN
  EXECUTE $sql$
    CREATE OR REPLACE FUNCTION public.block_public_signups(event jsonb)
    RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $fn$
    BEGIN
      RETURN '{}'::jsonb;
    END;
    $fn$;
  $sql$;

  EXECUTE 'REVOKE ALL ON FUNCTION public.block_public_signups(jsonb) FROM PUBLIC';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.block_public_signups(jsonb) TO supabase_auth_admin';
END;
$do$;
