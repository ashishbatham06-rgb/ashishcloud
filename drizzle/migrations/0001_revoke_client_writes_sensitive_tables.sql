-- All client writes on these tables happen through server functions (service_role).
-- Remove direct Data API write privileges from anon/authenticated; keep RLS-scoped SELECT.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.files FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.folders FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.share_links FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.trusted_devices FROM authenticated, anon;

REVOKE INSERT, DELETE, TRUNCATE ON public.profiles FROM authenticated, anon;

COMMENT ON TABLE public.files IS 'Rows are written only by service_role (upload server route). Clients read their own rows under RLS.';
COMMENT ON TABLE public.share_links IS 'Rows are written only by service_role (share server functions). Clients read their own links under RLS.';
