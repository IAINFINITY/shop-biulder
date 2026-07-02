-- Papéis internos de atendimento e suporte.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'consultor') THEN
    ALTER TYPE public.app_role ADD VALUE 'consultor';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'representante') THEN
    ALTER TYPE public.app_role ADD VALUE 'representante';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'admin_atendimento') THEN
    ALTER TYPE public.app_role ADD VALUE 'admin_atendimento';
  END IF;
END
$$;