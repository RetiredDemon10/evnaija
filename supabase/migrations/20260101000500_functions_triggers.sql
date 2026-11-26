-- EV Naija — helper functions, auth provisioning and data-integrity triggers

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.setting_text(p_key text, p_default text default null)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select nullif(value ->> 'value', '') from public.platform_settings where key = p_key),
    p_default
  );
$$;

create or replace function public.setting_int(p_key text, p_default integer)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select (value ->> 'value')::integer from public.platform_settings where key = p_key),
    p_default
  );
$$;

create or replace function public.setting_bool(p_key text, p_default boolean)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select (value ->> 'value')::boolean from public.platform_settings where key = p_key),
    p_default
  );
$$;

create or replace function public.has_role(p_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = p_role
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_role('admin'::public.app_role);
$$;

create or replace function public.is_operator()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_role('operator'::public.app_role);
$$;

create or replace function public.current_operator_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id
  from public.operator_profiles
  where user_id = auth.uid()
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Provision profile, role and operator record when Supabase creates a user
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_account_type text;
  v_full_name text;
  v_phone text;
  v_role public.app_role;
begin
  v_account_type := coalesce(new.raw_user_meta_data ->> 'account_type', 'customer');
  v_full_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    split_part(coalesce(new.email, 'EV Naija user'), '@', 1)
  );
  v_phone := nullif(new.raw_user_meta_data ->> 'phone', '');
  v_role := case when v_account_type = 'operator' then 'operator'::public.app_role else 'customer'::public.app_role end;

  insert into public.profiles (id, full_name, email, phone)
  values (new.id, v_full_name, coalesce(new.email, new.id::text || '@evnaija.local'), v_phone)
  on conflict (id) do update
    set full_name = excluded.full_name,
        email = excluded.email,
        phone = coalesce(profiles.phone, excluded.phone);

  insert into public.user_roles (user_id, role)
  values (new.id, v_role)
  on conflict (user_id, role) do nothing;

  if v_role = 'operator'::public.app_role then
    insert into public.operator_profiles (
      user_id,
      business_name,
      owner_name,
      email,
      phone,
      business_address,
      business_registration_number,
      business_description,
      status
    )
    values (
      new.id,
      coalesce(nullif(new.raw_user_meta_data ->> 'business_name', ''), v_full_name),
      v_full_name,
      coalesce(new.email, ''),
      coalesce(v_phone, ''),
      coalesce(new.raw_user_meta_data ->> 'business_address', ''),
      nullif(new.raw_user_meta_data ->> 'business_registration_number', ''),
      nullif(new.raw_user_meta_data ->> 'business_description', ''),
      'pending'
    )
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Protect sensitive columns from ordinary client updates
-- ---------------------------------------------------------------------------

create or replace function public.protect_profile_flags()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin()
     and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    new.is_suspended := old.is_suspended;
    new.suspended_reason := old.suspended_reason;
    new.email := old.email;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_flags on public.profiles;
create trigger profiles_protect_flags
  before update on public.profiles
  for each row execute function public.protect_profile_flags();

create or replace function public.protect_operator_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin()
     and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    new.user_id := old.user_id;
    new.status := old.status;
    new.rejection_reason := old.rejection_reason;
    new.reviewed_at := old.reviewed_at;
  end if;
  return new;
end;
$$;

drop trigger if exists operator_profiles_protect_fields on public.operator_profiles;
create trigger operator_profiles_protect_fields
  before update on public.operator_profiles
  for each row execute function public.protect_operator_profile_fields();

create or replace function public.protect_station_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin()
     and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    new.operator_id := old.operator_id;
    new.is_featured := old.is_featured;
    new.rating_average := old.rating_average;
    new.rating_count := old.rating_count;
    new.total_chargers := old.total_chargers;
    new.available_chargers := old.available_chargers;
    if new.status is distinct from old.status
       and not (old.status = 'rejected'::public.station_status and new.status = 'pending'::public.station_status) then
      new.status := old.status;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists stations_protect_fields on public.stations;
create trigger stations_protect_fields
  before update on public.stations
  for each row execute function public.protect_station_fields();

-- ---------------------------------------------------------------------------
-- Station image cover + payout account default uniqueness helpers
-- ---------------------------------------------------------------------------

create or replace function public.unset_other_station_covers()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.is_cover then
    update public.station_images
       set is_cover = false
     where station_id = new.station_id
       and id is distinct from new.id
       and is_cover = true;
  end if;
  return new;
end;
$$;

drop trigger if exists station_images_one_cover on public.station_images;
create trigger station_images_one_cover
  before insert or update of is_cover, station_id on public.station_images
  for each row execute function public.unset_other_station_covers();

create or replace function public.unset_other_default_payout_accounts()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.is_default then
    update public.payout_accounts
       set is_default = false
     where operator_id = new.operator_id
       and id is distinct from new.id
       and is_default = true;
  end if;
  return new;
end;
$$;

drop trigger if exists payout_accounts_one_default on public.payout_accounts;
create trigger payout_accounts_one_default
  before insert or update of is_default, operator_id on public.payout_accounts
  for each row execute function public.unset_other_default_payout_accounts();

-- ---------------------------------------------------------------------------
-- Denormalised charger counts and station ratings
-- ---------------------------------------------------------------------------

create or replace function public.refresh_station_charger_counts(p_station_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.stations s
     set total_chargers = (
           select count(*)::integer from public.chargers c where c.station_id = s.id
         ),
         available_chargers = (
           select count(*)::integer
             from public.chargers c
            where c.station_id = s.id
              and c.is_active = true
              and c.status = 'available'::public.charger_status
         )
   where s.id = p_station_id;
$$;

create or replace function public.sync_station_charger_counts()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_station_charger_counts(old.station_id);
    return old;
  end if;

  perform public.refresh_station_charger_counts(new.station_id);
  if tg_op = 'UPDATE' and old.station_id is distinct from new.station_id then
    perform public.refresh_station_charger_counts(old.station_id);
  end if;
  return new;
end;
$$;

drop trigger if exists chargers_sync_station_counts on public.chargers;
create trigger chargers_sync_station_counts
  after insert or update of status, is_active, station_id or delete on public.chargers
  for each row execute function public.sync_station_charger_counts();

create or replace function public.refresh_station_rating(p_station_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.stations s
     set rating_average = coalesce((
           select round(avg(r.overall_rating)::numeric, 2)
             from public.reviews r
            where r.station_id = s.id
              and r.status = 'published'::public.review_status
         ), 0),
         rating_count = (
           select count(*)::integer
             from public.reviews r
            where r.station_id = s.id
              and r.status = 'published'::public.review_status
         )
   where s.id = p_station_id;
$$;

create or replace function public.sync_station_rating()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_station_rating(old.station_id);
    return old;
  end if;

  perform public.refresh_station_rating(new.station_id);
  if tg_op = 'UPDATE' and old.station_id is distinct from new.station_id then
    perform public.refresh_station_rating(old.station_id);
  end if;
  return new;
end;
$$;

drop trigger if exists reviews_sync_station_rating on public.reviews;
create trigger reviews_sync_station_rating
  after insert or update of status, overall_rating, station_id or delete on public.reviews
  for each row execute function public.sync_station_rating();

-- ---------------------------------------------------------------------------
-- Review validation and moderation default
-- ---------------------------------------------------------------------------

create or replace function public.prepare_review()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
      from public.bookings b
     where b.id = new.booking_id
       and b.customer_id = new.customer_id
       and b.station_id = new.station_id
       and b.status = 'completed'::public.booking_status
  ) then
    raise exception 'A review can only be submitted for a completed booking at this station.';
  end if;

  new.is_verified := true;
  if public.setting_bool('review_moderation_required', false) then
    new.status := 'hidden'::public.review_status;
  else
    new.status := 'published'::public.review_status;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists reviews_prepare_insert on public.reviews;
create trigger reviews_prepare_insert
  before insert on public.reviews
  for each row execute function public.prepare_review();

-- ---------------------------------------------------------------------------
-- Support conversation state
-- ---------------------------------------------------------------------------

create or replace function public.touch_support_ticket()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.support_tickets
     set status = case
           when new.is_staff then 'pending'::public.ticket_status
           else 'open'::public.ticket_status
         end,
         updated_at = now()
   where id = new.ticket_id;
  return new;
end;
$$;

drop trigger if exists support_messages_touch_ticket on public.support_messages;
create trigger support_messages_touch_ticket
  after insert on public.support_messages
  for each row execute function public.touch_support_ticket();

-- ---------------------------------------------------------------------------
-- Reusable updated_at triggers
-- ---------------------------------------------------------------------------

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists vehicles_set_updated_at on public.vehicles;
create trigger vehicles_set_updated_at before update on public.vehicles
  for each row execute function public.set_updated_at();

drop trigger if exists operator_profiles_set_updated_at on public.operator_profiles;
create trigger operator_profiles_set_updated_at before update on public.operator_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists locations_set_updated_at on public.locations;
create trigger locations_set_updated_at before update on public.locations
  for each row execute function public.set_updated_at();

drop trigger if exists stations_set_updated_at on public.stations;
create trigger stations_set_updated_at before update on public.stations
  for each row execute function public.set_updated_at();

drop trigger if exists chargers_set_updated_at on public.chargers;
create trigger chargers_set_updated_at before update on public.chargers
  for each row execute function public.set_updated_at();

drop trigger if exists bookings_set_updated_at on public.bookings;
create trigger bookings_set_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

drop trigger if exists reviews_set_updated_at on public.reviews;
create trigger reviews_set_updated_at before update on public.reviews
  for each row execute function public.set_updated_at();

drop trigger if exists support_tickets_set_updated_at on public.support_tickets;
create trigger support_tickets_set_updated_at before update on public.support_tickets
  for each row execute function public.set_updated_at();

drop trigger if exists platform_settings_set_updated_at on public.platform_settings;
create trigger platform_settings_set_updated_at before update on public.platform_settings
  for each row execute function public.set_updated_at();
