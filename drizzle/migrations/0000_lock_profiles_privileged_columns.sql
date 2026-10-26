-- Column-level lockdown: authenticated users may only update safe profile fields.
-- storage_quota_bytes / storage_used_bytes / disabled / email / phone are service-role managed.
REVOKE UPDATE ON public.profiles FROM authenticated, anon;
GRANT UPDATE (display_name, avatar_url) ON public.profiles TO authenticated;

COMMENT ON TABLE public.profiles IS 'User profiles. Privileged columns (storage_quota_bytes, storage_used_bytes, disabled, email, phone, id) are managed by service_role only.';

-- Defense in depth: block privileged column changes from any non-service role.
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_cols()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.storage_quota_bytes IS DISTINCT FROM OLD.storage_quota_bytes
     OR NEW.storage_used_bytes IS DISTINCT FROM OLD.storage_used_bytes
     OR NEW.disabled IS DISTINCT FROM OLD.disabled
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.phone IS DISTINCT FROM OLD.phone
     OR NEW.id IS DISTINCT FROM OLD.id THEN
    IF current_user <> 'service_role' AND current_user NOT IN ('postgres', 'supabase_admin') THEN
      RAISE EXCEPTION 'Ashish Cloud: privileged profile columns may only be changed by the service role';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_privileged_cols_guard ON public.profiles;
CREATE TRIGGER profiles_privileged_cols_guard
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_privileged_cols();
