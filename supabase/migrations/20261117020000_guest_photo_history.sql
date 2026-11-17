-- Guest photo history, pre-analysis photo persistence, and 30-day guest retention.
-- Guest records are owned by a SHA-256 digest of a random HttpOnly cookie.
-- The raw bearer token is never stored in PostgreSQL or the browser's JavaScript storage.

alter table public.ai_history
  alter column user_id drop not null;

alter table public.ai_history
  add column if not exists guest_session_hash text,
  add column if not exists analysis_status text not null default 'completed',
  add column if not exists analysis_error text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_history_owner_check'
      and conrelid = 'public.ai_history'::regclass
  ) then
    alter table public.ai_history
      add constraint ai_history_owner_check
      check (
        (user_id is not null and guest_session_hash is null)
        or
        (user_id is null and guest_session_hash ~ '^[0-9a-f]{64}$')
      );
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_history_analysis_status_check'
      and conrelid = 'public.ai_history'::regclass
  ) then
    alter table public.ai_history
      add constraint ai_history_analysis_status_check
      check (analysis_status in ('pending', 'completed', 'failed'));
  end if;
end $$;

create index if not exists ai_history_guest_created_idx
  on public.ai_history(guest_session_hash, created_at desc)
  where guest_session_hash is not null;

comment on column public.ai_history.guest_session_hash is
  'SHA-256 of a random, HttpOnly, 30-day guest-history cookie. The bearer token itself is never stored.';
comment on column public.ai_history.analysis_status is
  'AI photo-analysis lifecycle: pending, completed, or failed. The photo record is inserted before the Gemini call.';
comment on column public.ai_history.analysis_error is
  'Short, sanitised failure reason for a photo analysis that did not complete.';

-- Existing policies expose only authenticated users' own rows. Guest records
-- have user_id NULL and are accessible only through the same-origin Worker,
-- which checks the HttpOnly guest cookie and uses the service key.
revoke all on table public.ai_history from anon, authenticated;
grant all on table public.ai_history to service_role;
