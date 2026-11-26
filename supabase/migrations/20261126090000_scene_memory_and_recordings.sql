-- Optional five-photo scene memory and private emergency recording metadata.
-- All reads/writes are performed by the trusted Cloudflare Worker with its server-side secret key.
-- No direct Data API access is granted to anon/authenticated clients.

create table if not exists public.scene_memory_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  guest_session_hash text,
  scene_summary text not null check (char_length(scene_summary) between 1 and 1200),
  facts jsonb not null default '[]'::jsonb check (jsonb_typeof(facts) = 'array'),
  question text not null default '' check (char_length(question) <= 1000),
  answer text not null default '' check (char_length(answer) <= 3500),
  source_camera text not null default 'unknown' check (source_camera in ('phone','esp32','upload','unknown')),
  created_at timestamptz not null default now(),
  constraint scene_memory_owner_check check (
    (user_id is not null and guest_session_hash is null)
    or (user_id is null and guest_session_hash is not null and guest_session_hash ~ '^[0-9a-f]{64}
  )
);
create index if not exists scene_memory_user_created_idx
  on public.scene_memory_entries(user_id, created_at desc) where user_id is not null;
create index if not exists scene_memory_guest_created_idx
  on public.scene_memory_entries(guest_session_hash, created_at desc) where guest_session_hash is not null;
alter table public.scene_memory_entries enable row level security;
revoke all on table public.scene_memory_entries from anon, authenticated;
comment on table public.scene_memory_entries is
  'Opt-in text-only visual memory. Stores at most five recent observations per account or private guest session; never stores image bytes.';

create or replace function public.trim_scene_memory_to_five()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  owner_scope text;
begin
  owner_scope := coalesce(new.user_id::text, new.guest_session_hash);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_scope, 0));
  if new.user_id is not null then
    delete from public.scene_memory_entries
    where user_id = new.user_id
      and id in (
        select id from public.scene_memory_entries
        where user_id = new.user_id
        order by created_at desc, id desc
        offset 5
      );
  else
    delete from public.scene_memory_entries
    where guest_session_hash = new.guest_session_hash
      and id in (
        select id from public.scene_memory_entries
        where guest_session_hash = new.guest_session_hash
        order by created_at desc, id desc
        offset 5
      );
  end if;
  return new;
end;
$$;
revoke all on function public.trim_scene_memory_to_five() from public, anon, authenticated;
grant execute on function public.trim_scene_memory_to_five() to service_role;
drop trigger if exists scene_memory_keep_five on public.scene_memory_entries;
create trigger scene_memory_keep_five
after insert on public.scene_memory_entries
for each row execute function public.trim_scene_memory_to_five();

create table if not exists public.emergency_recordings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  guest_session_hash text,
  device_id text not null check (device_id ~ '^[a-f0-9]{32}$'),
  camera_source text not null check (camera_source in ('phone','esp32')),
  mime_type text not null check (mime_type ~ '^video/(webm|mp4)(;codecs=[a-z0-9,._-]+)?,
  object_prefix text not null unique,
  status text not null default 'recording' check (status in ('recording','complete','failed')),
  duration_seconds integer not null default 0 check (duration_seconds between 0 and 300),
  total_bytes bigint not null default 0 check (total_bytes between 0 and 52428800),
  chunk_count integer not null default 0 check (chunk_count between 0 and 120),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 days'),
  constraint emergency_recording_owner_check check (
    (user_id is not null and guest_session_hash is null)
    or (user_id is null and guest_session_hash ~ '^[0-9a-f]{64}$')
  )
);
create index if not exists emergency_recordings_user_created_idx
  on public.emergency_recordings(user_id, created_at desc) where user_id is not null;
create index if not exists emergency_recordings_guest_created_idx
  on public.emergency_recordings(guest_session_hash, created_at desc) where guest_session_hash is not null;
create index if not exists emergency_recordings_expiry_idx on public.emergency_recordings(expires_at);
alter table public.emergency_recordings enable row level security;
revoke all on table public.emergency_recordings from anon, authenticated;
comment on table public.emergency_recordings is
  'Private SOS incident recording metadata. Video chunks are stored only in a private Cloudflare R2 bucket and are accessed through authenticated Worker routes.';
),
  object_prefix text not null unique,
  status text not null default 'recording' check (status in ('recording','complete','failed')),
  duration_seconds integer not null default 0 check (duration_seconds between 0 and 300),
  total_bytes bigint not null default 0 check (total_bytes between 0 and 52428800),
  chunk_count integer not null default 0 check (chunk_count between 0 and 120),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 days'),
  constraint emergency_recording_owner_check check (
    (user_id is not null and guest_session_hash is null)
    or (user_id is null and guest_session_hash ~ '^[0-9a-f]{64}$')
  )
);
create index if not exists emergency_recordings_user_created_idx
  on public.emergency_recordings(user_id, created_at desc) where user_id is not null;
create index if not exists emergency_recordings_guest_created_idx
  on public.emergency_recordings(guest_session_hash, created_at desc) where guest_session_hash is not null;
create index if not exists emergency_recordings_expiry_idx on public.emergency_recordings(expires_at);
alter table public.emergency_recordings enable row level security;
revoke all on table public.emergency_recordings from anon, authenticated;
comment on table public.emergency_recordings is
  'Private SOS incident recording metadata. Video chunks are stored only in a private Cloudflare R2 bucket and are accessed through authenticated Worker routes.';
)
  )
);
create index if not exists scene_memory_user_created_idx
  on public.scene_memory_entries(user_id, created_at desc) where user_id is not null;
create index if not exists scene_memory_guest_created_idx
  on public.scene_memory_entries(guest_session_hash, created_at desc) where guest_session_hash is not null;
alter table public.scene_memory_entries enable row level security;
revoke all on table public.scene_memory_entries from anon, authenticated;
comment on table public.scene_memory_entries is
  'Opt-in text-only visual memory. Stores at most five recent observations per account or private guest session; never stores image bytes.';

create or replace function public.trim_scene_memory_to_five()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  owner_scope text;
begin
  owner_scope := coalesce(new.user_id::text, new.guest_session_hash);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_scope, 0));
  if new.user_id is not null then
    delete from public.scene_memory_entries
    where user_id = new.user_id
      and id in (
        select id from public.scene_memory_entries
        where user_id = new.user_id
        order by created_at desc, id desc
        offset 5
      );
  else
    delete from public.scene_memory_entries
    where guest_session_hash = new.guest_session_hash
      and id in (
        select id from public.scene_memory_entries
        where guest_session_hash = new.guest_session_hash
        order by created_at desc, id desc
        offset 5
      );
  end if;
  return new;
end;
$$;
revoke all on function public.trim_scene_memory_to_five() from public, anon, authenticated;
grant execute on function public.trim_scene_memory_to_five() to service_role;
drop trigger if exists scene_memory_keep_five on public.scene_memory_entries;
create trigger scene_memory_keep_five
after insert on public.scene_memory_entries
for each row execute function public.trim_scene_memory_to_five();

create table if not exists public.emergency_recordings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  guest_session_hash text,
  device_id text not null check (device_id ~ '^[a-f0-9]{32}$'),
  camera_source text not null check (camera_source in ('phone','esp32')),
  mime_type text not null check (mime_type ~ '^video/(webm|mp4)(;codecs=[a-z0-9,._-]+)?,
  object_prefix text not null unique,
  status text not null default 'recording' check (status in ('recording','complete','failed')),
  duration_seconds integer not null default 0 check (duration_seconds between 0 and 300),
  total_bytes bigint not null default 0 check (total_bytes between 0 and 52428800),
  chunk_count integer not null default 0 check (chunk_count between 0 and 120),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 days'),
  constraint emergency_recording_owner_check check (
    (user_id is not null and guest_session_hash is null)
    or (user_id is null and guest_session_hash ~ '^[0-9a-f]{64}$')
  )
);
create index if not exists emergency_recordings_user_created_idx
  on public.emergency_recordings(user_id, created_at desc) where user_id is not null;
create index if not exists emergency_recordings_guest_created_idx
  on public.emergency_recordings(guest_session_hash, created_at desc) where guest_session_hash is not null;
create index if not exists emergency_recordings_expiry_idx on public.emergency_recordings(expires_at);
alter table public.emergency_recordings enable row level security;
revoke all on table public.emergency_recordings from anon, authenticated;
comment on table public.emergency_recordings is
  'Private SOS incident recording metadata. Video chunks are stored only in a private Cloudflare R2 bucket and are accessed through authenticated Worker routes.';
),
  object_prefix text not null unique,
  status text not null default 'recording' check (status in ('recording','complete','failed')),
  duration_seconds integer not null default 0 check (duration_seconds between 0 and 300),
  total_bytes bigint not null default 0 check (total_bytes between 0 and 52428800),
  chunk_count integer not null default 0 check (chunk_count between 0 and 120),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 days'),
  constraint emergency_recording_owner_check check (
    (user_id is not null and guest_session_hash is null)
    or (user_id is null and guest_session_hash ~ '^[0-9a-f]{64}$')
  )
);
create index if not exists emergency_recordings_user_created_idx
  on public.emergency_recordings(user_id, created_at desc) where user_id is not null;
create index if not exists emergency_recordings_guest_created_idx
  on public.emergency_recordings(guest_session_hash, created_at desc) where guest_session_hash is not null;
create index if not exists emergency_recordings_expiry_idx on public.emergency_recordings(expires_at);
alter table public.emergency_recordings enable row level security;
revoke all on table public.emergency_recordings from anon, authenticated;
comment on table public.emergency_recordings is
  'Private SOS incident recording metadata. Video chunks are stored only in a private Cloudflare R2 bucket and are accessed through authenticated Worker routes.';
