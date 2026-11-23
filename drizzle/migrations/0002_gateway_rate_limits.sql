CREATE TABLE public.gateway_rate_limits (
  bucket_hash text PRIMARY KEY,
  hits integer NOT NULL DEFAULT 0 CHECK (hits >= 0),
  expires_at timestamptz NOT NULL
);

GRANT ALL ON TABLE public.gateway_rate_limits TO service_role;
REVOKE ALL ON TABLE public.gateway_rate_limits FROM anon, authenticated;
ALTER TABLE public.gateway_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Server role manages gateway rate limits"
  ON public.gateway_rate_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
CREATE INDEX gateway_rate_limits_expires_at_idx ON public.gateway_rate_limits (expires_at);

CREATE OR REPLACE FUNCTION public.consume_gateway_rate_limit(
  p_bucket_hash text,
  p_max_hits integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hits integer;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_bucket_hash IS NULL OR length(p_bucket_hash) < 16 OR length(p_bucket_hash) > 128
     OR p_max_hits < 1 OR p_max_hits > 10000
     OR p_window_seconds < 1 OR p_window_seconds > 86400 THEN
    RETURN false;
  END IF;

  INSERT INTO public.gateway_rate_limits (bucket_hash, hits, expires_at)
  VALUES (p_bucket_hash, 1, v_now + make_interval(secs => p_window_seconds))
  ON CONFLICT (bucket_hash) DO UPDATE
    SET hits = CASE
          WHEN public.gateway_rate_limits.expires_at <= v_now THEN 1
          ELSE public.gateway_rate_limits.hits + 1
        END,
        expires_at = CASE
          WHEN public.gateway_rate_limits.expires_at <= v_now
            THEN v_now + make_interval(secs => p_window_seconds)
          ELSE public.gateway_rate_limits.expires_at
        END
  RETURNING hits INTO v_hits;

  RETURN v_hits <= p_max_hits;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_gateway_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_gateway_rate_limit(text, integer, integer) TO service_role;