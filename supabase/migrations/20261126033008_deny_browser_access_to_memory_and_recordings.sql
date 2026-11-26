-- Explicit deny policies are defense in depth; browser roles also have no table grants.
create policy scene_memory_deny_browser_roles
  on public.scene_memory_entries
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy emergency_recordings_deny_browser_roles
  on public.emergency_recordings
  for all
  to anon, authenticated
  using (false)
  with check (false);
