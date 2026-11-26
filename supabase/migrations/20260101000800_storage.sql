-- EV Naija — storage buckets and object policies

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 2097152, array['image/png','image/jpeg','image/webp']),
  ('station-images', 'station-images', true, 8388608, array['image/png','image/jpeg','image/webp']),
  ('operator-documents', 'operator-documents', false, 10485760, array['image/png','image/jpeg','image/webp','application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Avatars: public read, owner-only writes in a folder named after the user id.
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'avatars');

drop policy if exists "avatars_owner_insert" on storage.objects;
create policy "avatars_owner_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_owner_delete" on storage.objects;
create policy "avatars_owner_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Station images: public read, operator-owned station folder writes.
drop policy if exists "station_images_public_read" on storage.objects;
create policy "station_images_public_read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'station-images');

drop policy if exists "station_images_operator_insert" on storage.objects;
create policy "station_images_operator_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'station-images'
    and (
      public.is_admin()
      or exists (
        select 1 from public.stations s
         where s.id::text = (storage.foldername(name))[1]
           and s.operator_id = public.current_operator_id()
      )
    )
  );

drop policy if exists "station_images_operator_update" on storage.objects;
create policy "station_images_operator_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'station-images'
    and (
      public.is_admin()
      or exists (
        select 1 from public.stations s
         where s.id::text = (storage.foldername(name))[1]
           and s.operator_id = public.current_operator_id()
      )
    )
  )
  with check (
    bucket_id = 'station-images'
    and (
      public.is_admin()
      or exists (
        select 1 from public.stations s
         where s.id::text = (storage.foldername(name))[1]
           and s.operator_id = public.current_operator_id()
      )
    )
  );

drop policy if exists "station_images_operator_delete" on storage.objects;
create policy "station_images_operator_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'station-images'
    and (
      public.is_admin()
      or exists (
        select 1 from public.stations s
         where s.id::text = (storage.foldername(name))[1]
           and s.operator_id = public.current_operator_id()
      )
    )
  );

-- Operator documents: private. Operators control their own folder; admins can
-- read every document for verification.
drop policy if exists "operator_documents_owner_read" on storage.objects;
create policy "operator_documents_owner_read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'operator-documents'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = public.current_operator_id()::text
    )
  );

drop policy if exists "operator_documents_owner_insert" on storage.objects;
create policy "operator_documents_owner_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'operator-documents'
    and (storage.foldername(name))[1] = public.current_operator_id()::text
  );

drop policy if exists "operator_documents_owner_update" on storage.objects;
create policy "operator_documents_owner_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'operator-documents'
    and (storage.foldername(name))[1] = public.current_operator_id()::text
  )
  with check (
    bucket_id = 'operator-documents'
    and (storage.foldername(name))[1] = public.current_operator_id()::text
  );

drop policy if exists "operator_documents_owner_delete" on storage.objects;
create policy "operator_documents_owner_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'operator-documents'
    and (storage.foldername(name))[1] = public.current_operator_id()::text
  );
