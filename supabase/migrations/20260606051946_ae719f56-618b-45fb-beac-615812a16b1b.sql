
CREATE TABLE public.trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_hash text not null,
  user_agent text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, device_hash)
);
CREATE INDEX trusted_devices_user_idx ON public.trusted_devices(user_id);

GRANT SELECT, DELETE ON public.trusted_devices TO authenticated;
GRANT ALL ON public.trusted_devices TO service_role;

ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own devices" ON public.trusted_devices
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "user removes own devices" ON public.trusted_devices
  FOR DELETE TO authenticated USING (user_id = auth.uid());
