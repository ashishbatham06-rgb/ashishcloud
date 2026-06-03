
-- admin_otps: explicit deny-all to authenticated/anon (server-role only)
CREATE POLICY "no client access"
  ON public.admin_otps FOR ALL TO authenticated, anon
  USING (false) WITH CHECK (false);
