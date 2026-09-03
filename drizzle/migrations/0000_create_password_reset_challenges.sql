CREATE TABLE public.password_reset_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  challenge_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.password_reset_challenges TO service_role;

ALTER TABLE public.password_reset_challenges ENABLE ROW LEVEL SECURITY;

CREATE INDEX password_reset_challenges_user_idx ON public.password_reset_challenges(user_id);
CREATE INDEX password_reset_challenges_expiry_idx ON public.password_reset_challenges(expires_at);

CREATE POLICY "deny password reset challenge client access"
  ON public.password_reset_challenges
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);