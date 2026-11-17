-- Daredevil's Eye: opt-in private image history, usage audit and encrypted BYOK
-- Apply once in the Supabase SQL Editor for this project.

create table if not exists public.user_api_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  key_ciphertext text not null,
  key_iv text not null,
  key_version integer not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_type text not null check (request_type in ('describe','ask')),
  question text not null default '',
  system_prompt text not null default '',
  response_text text not null,
  model text not null,
  attempted_models text[] not null default '{}',
  finish_reason text,
  response_language text not null default 'en-US',
  prompt_tokens integer,
  output_tokens integer,
  total_tokens integer,
  photo_path text,
  photo_mime text,
  photo_size_bytes integer,
  ip_fingerprint text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists ai_history_user_created_idx
  on public.ai_history(user_id, created_at desc);

create table if not exists public.api_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  request_type text not null,
  model text not null,
  prompt_tokens integer,
  output_tokens integer,
  total_tokens integer,
  image_size_bytes integer,
  ip_fingerprint text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days')
);
create index if not exists api_usage_user_created_idx
  on public.api_usage(user_id, created_at desc);
create index if not exists api_usage_expiry_idx
  on public.api_usage(expires_at);

alter table public.user_api_keys enable row level security;
alter table public.ai_history enable row level security;
alter table public.api_usage enable row level security;

-- These tables are accessed only by the trusted Cloudflare Worker using
-- the Supabase server-side Secret key (service_role). Browser roles receive
-- no direct table privileges; RLS remains enabled as defense in depth.
revoke all on table public.user_api_keys, public.ai_history, public.api_usage from anon, authenticated;
grant all on table public.user_api_keys, public.ai_history, public.api_usage to service_role;
grant usage, select on sequence public.api_usage_id_seq to service_role;

drop policy if exists "Users can read their encrypted Gemini key metadata" on public.user_api_keys;
create policy "Users can read their encrypted Gemini key metadata"
  on public.user_api_keys for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can read their own AI history" on public.ai_history;
create policy "Users can read their own AI history"
  on public.ai_history for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own AI history" on public.ai_history;
create policy "Users can delete their own AI history"
  on public.ai_history for delete to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can read their own usage history" on public.api_usage;
create policy "Users can read their own usage history"
  on public.api_usage for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own usage history" on public.api_usage;
create policy "Users can delete their own usage history"
  on public.api_usage for delete to authenticated
  using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('daredevil-history', 'daredevil-history', false, 4000000, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 4000000, allowed_mime_types = array['image/jpeg'];

drop policy if exists "Users can read their own private history photos" on storage.objects;
create policy "Users can read their own private history photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'daredevil-history' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete their own private history photos" on storage.objects;
create policy "Users can delete their own private history photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'daredevil-history' and (storage.foldername(name))[1] = auth.uid()::text);

-- The Worker uses the Supabase service-role credential and enforces ownership
-- in every request. Never place the service-role key in browser code.
