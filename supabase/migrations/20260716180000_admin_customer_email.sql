ALTER TABLE public.customer_profiles
ADD COLUMN IF NOT EXISTS email TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS observation TEXT DEFAULT NULL;

UPDATE public.customer_profiles cp
SET email = au.email::text
FROM auth.users au
WHERE cp.user_id = au.id AND cp.email IS NULL;

CREATE OR REPLACE FUNCTION public.admin_update_user_email(
  p_user_id UUID,
  p_email TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE auth.users SET email = p_email WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_user_email(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_user_email(UUID, TEXT) TO authenticated;
