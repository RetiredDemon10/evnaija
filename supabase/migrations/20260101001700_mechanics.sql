-- EV Naija — EV mechanic marketplace
--
-- Mechanics are independent repair professionals who register themselves, are
-- reviewed by admins, and appear in a public discovery directory. EV owners can
-- send a service request without signing in; requests are answerable only by the
-- assigned mechanic and admins.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.mechanic_status as enum ('pending', 'approved', 'rejected', 'suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.mechanic_service_mode as enum ('mobile', 'workshop', 'both');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.mechanic_service_type as enum (
    'battery_diagnostics', 'battery_repair', 'battery_replacement',
    'motor_repair', 'inverter_repair', 'charging_port_repair',
    'wiring_electrical', 'software_diagnostics', 'brakes', 'hvac',
    'tyre_service', 'general_service', 'towing'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.service_request_status as enum ('new', 'contacted', 'in_progress', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

alter type public.app_role add value if not exists 'mechanic';

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.mechanic_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  business_name text not null,
  owner_name text not null,
  email text not null,
  phone text not null,
  whatsapp text,
  state text not null,
  city text not null,
  address text not null,
  latitude numeric(9, 6) not null check (latitude between -90 and 90),
  longitude numeric(9, 6) not null check (longitude between -180 and 180),
  service_modes public.mechanic_service_mode[] not null default '{}'::public.mechanic_service_mode[],
  service_types public.mechanic_service_type[] not null default '{}'::public.mechanic_service_type[],
  brands_supported text[] not null default '{}'::text[],
  years_experience integer not null default 0 check (years_experience between 0 and 60),
  certifications text[] not null default '{}'::text[],
  description text,
  emergency_available boolean not null default false,
  hourly_rate numeric(12, 2) check (hourly_rate >= 0),
  callout_fee numeric(12, 2) check (callout_fee >= 0),
  operating_hours text not null default '08:00 – 18:00',
  logo_url text,
  status public.mechanic_status not null default 'pending',
  is_verified boolean not null default false,
  is_featured boolean not null default false,
  rating_average numeric(3, 2) not null default 0 check (rating_average between 0 and 5),
  rating_count integer not null default 0 check (rating_count >= 0),
  rejection_reason text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mechanic_profiles_status_idx on public.mechanic_profiles (status, is_featured desc, rating_average desc);
create index if not exists mechanic_profiles_city_idx on public.mechanic_profiles (state, city);
create index if not exists mechanic_profiles_location_idx on public.mechanic_profiles (latitude, longitude);
create index if not exists mechanic_profiles_name_trgm_idx on public.mechanic_profiles using gin (business_name gin_trgm_ops);
create index if not exists mechanic_profiles_types_idx on public.mechanic_profiles using gin (service_types);

create table if not exists public.mechanic_service_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  mechanic_id uuid not null references public.mechanic_profiles (id) on delete cascade,
  customer_id uuid references auth.users (id) on delete set null,
  name text not null,
  email text not null,
  phone text not null,
  vehicle_make text not null,
  vehicle_model text not null,
  issue_description text not null,
  preferred_date timestamptz,
  service_mode public.mechanic_service_mode not null default 'mobile',
  status public.service_request_status not null default 'new',
  mechanic_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mechanic_requests_mechanic_idx on public.mechanic_service_requests (mechanic_id, created_at desc);
create index if not exists mechanic_requests_customer_idx on public.mechanic_service_requests (customer_id, created_at desc);
create index if not exists mechanic_requests_status_idx on public.mechanic_service_requests (status, created_at desc);

-- Rate-limit anonymous service requests by email + hour, without storing raw email.
create table if not exists public.mechanic_request_attempts (
  id uuid primary key default gen_random_uuid(),
  email_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists mechanic_request_attempts_email_idx on public.mechanic_request_attempts (email_hash, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.mechanic_profiles enable row level security;
alter table public.mechanic_service_requests enable row level security;
alter table public.mechanic_request_attempts enable row level security;

drop policy if exists mechanic_profiles_select_public on public.mechanic_profiles;
create policy mechanic_profiles_select_public on public.mechanic_profiles
  for select to anon, authenticated
  using (status = 'approved'::public.mechanic_status);

drop policy if exists mechanic_profiles_select_own on public.mechanic_profiles;
create policy mechanic_profiles_select_own on public.mechanic_profiles
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists mechanic_profiles_insert_own on public.mechanic_profiles;
create policy mechanic_profiles_insert_own on public.mechanic_profiles
  for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending'::public.mechanic_status);

drop policy if exists mechanic_profiles_update_own on public.mechanic_profiles;
create policy mechanic_profiles_update_own on public.mechanic_profiles
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists mechanic_requests_select_involved on public.mechanic_service_requests;
create policy mechanic_requests_select_involved on public.mechanic_service_requests
  for select to authenticated
  using (
    customer_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.mechanic_profiles m
       where m.id = mechanic_service_requests.mechanic_id and m.user_id = auth.uid()
    )
  );

drop policy if exists mechanic_requests_update_involved on public.mechanic_service_requests;
create policy mechanic_requests_update_involved on public.mechanic_service_requests
  for update to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.mechanic_profiles m
       where m.id = mechanic_service_requests.mechanic_id and m.user_id = auth.uid()
    )
  );

-- Attempts are write-only from the service-role RPC; no client policy.

grant select on public.mechanic_profiles to anon, authenticated;
grant insert, update on public.mechanic_profiles to authenticated;
grant select, update on public.mechanic_service_requests to authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.current_mechanic_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id from public.mechanic_profiles where user_id = auth.uid() limit 1;
$$;

-- Keep non-admin updates from changing moderation flags (mirrors operators).
create or replace function public.mechanic_profiles_protect_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin()
     and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and coalesce(current_setting('mechanics.system_update', true), '') <> 'on' then
    new.user_id := old.user_id;
    new.status := old.status;
    new.is_verified := old.is_verified;
    new.is_featured := old.is_featured;
    new.rating_average := old.rating_average;
    new.rating_count := old.rating_count;
    new.rejection_reason := old.rejection_reason;
    new.reviewed_at := old.reviewed_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists mechanic_profiles_protect_fields on public.mechanic_profiles;
create trigger mechanic_profiles_protect_fields
  before update on public.mechanic_profiles
  for each row execute function public.mechanic_profiles_protect_fields();

-- ---------------------------------------------------------------------------
-- Registration and listing management
-- ---------------------------------------------------------------------------

create or replace function public.register_mechanic(
  p_business_name text,
  p_owner_name text,
  p_email text,
  p_phone text,
  p_whatsapp text,
  p_state text,
  p_city text,
  p_address text,
  p_latitude numeric,
  p_longitude numeric,
  p_service_modes public.mechanic_service_mode[],
  p_service_types public.mechanic_service_type[],
  p_brands_supported text[],
  p_years_experience integer,
  p_certifications text[],
  p_description text,
  p_emergency_available boolean,
  p_hourly_rate numeric,
  p_callout_fee numeric,
  p_operating_hours text,
  p_logo_url text
)
returns public.mechanic_profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
begin
  if v_user is null then
    raise exception 'You must be signed in to register as a mechanic.';
  end if;
  if coalesce(trim(p_business_name), '') = '' or coalesce(trim(p_phone), '') = '' then
    raise exception 'Business name and phone are required.';
  end if;
  if coalesce(array_length(p_service_modes, 1), 0) = 0
     or coalesce(array_length(p_service_types, 1), 0) = 0 then
    raise exception 'Choose at least one service mode and one speciality.';
  end if;

  insert into public.user_roles (user_id, role)
  values (v_user, 'mechanic'::public.app_role)
  on conflict do nothing;

  perform set_config('mechanics.system_update', 'on', true);
  insert into public.mechanic_profiles (
    user_id, business_name, owner_name, email, phone, whatsapp,
    state, city, address, latitude, longitude,
    service_modes, service_types, brands_supported, years_experience,
    certifications, description, emergency_available, hourly_rate,
    callout_fee, operating_hours, logo_url, status
  )
  values (
    v_user, trim(p_business_name), trim(p_owner_name), lower(trim(p_email)), trim(p_phone), nullif(trim(coalesce(p_whatsapp, '')), ''),
    trim(p_state), trim(p_city), trim(p_address), p_latitude, p_longitude,
    p_service_modes, p_service_types, coalesce(p_brands_supported, '{}'::text[]), coalesce(p_years_experience, 0),
    coalesce(p_certifications, '{}'::text[]), nullif(trim(coalesce(p_description, '')), ''), coalesce(p_emergency_available, false), p_hourly_rate,
    p_callout_fee, coalesce(nullif(trim(p_operating_hours), ''), '08:00 – 18:00'), nullif(trim(coalesce(p_logo_url, '')), ''), 'pending'::public.mechanic_status
  )
  on conflict (user_id) do update set
    business_name = excluded.business_name,
    owner_name = excluded.owner_name,
    email = excluded.email,
    phone = excluded.phone,
    whatsapp = excluded.whatsapp,
    state = excluded.state,
    city = excluded.city,
    address = excluded.address,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    service_modes = excluded.service_modes,
    service_types = excluded.service_types,
    brands_supported = excluded.brands_supported,
    years_experience = excluded.years_experience,
    certifications = excluded.certifications,
    description = excluded.description,
    emergency_available = excluded.emergency_available,
    hourly_rate = excluded.hourly_rate,
    callout_fee = excluded.callout_fee,
    operating_hours = excluded.operating_hours,
    logo_url = excluded.logo_url,
    status = case when public.mechanic_profiles.status = 'rejected'::public.mechanic_status
                  then 'pending'::public.mechanic_status else public.mechanic_profiles.status end,
    rejection_reason = case when public.mechanic_profiles.status = 'rejected'::public.mechanic_status
                            then null else public.mechanic_profiles.rejection_reason end,
    updated_at = now()
  returning id into v_id;

  return (select * from public.mechanic_profiles where id = v_id);
end;
$$;

create or replace function public.admin_set_mechanic_status(
  p_mechanic_id uuid,
  p_status public.mechanic_status,
  p_featured boolean default null,
  p_verified boolean default null,
  p_reason text default null
)
returns public.mechanic_profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := auth.uid();
  v_result public.mechanic_profiles;
begin
  if v_admin is null or not public.is_admin() then
    raise exception 'Administrator access required.';
  end if;
  update public.mechanic_profiles
     set status = p_status,
         is_featured = coalesce(p_featured, is_featured),
         is_verified = coalesce(p_verified, is_verified),
         rejection_reason = case when p_status = 'rejected'::public.mechanic_status then p_reason else null end,
         reviewed_at = now(),
         updated_at = now()
   where id = p_mechanic_id
  returning * into v_result;
  if v_result.id is null then raise exception 'Mechanic not found.'; end if;

  insert into public.admin_audit_logs (admin_id, action, entity_type, entity_id, details)
  values (v_admin, 'mechanic.status.' || p_status::text, 'mechanic', p_mechanic_id::text,
          jsonb_build_object('status', p_status::text, 'reason', p_reason));
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Service requests (anon-safe RPC with rate limiting)
-- ---------------------------------------------------------------------------

create or replace function public.create_mechanic_service_request(
  p_mechanic_id uuid,
  p_name text,
  p_email text,
  p_phone text,
  p_vehicle_make text,
  p_vehicle_model text,
  p_issue_description text,
  p_preferred_date timestamptz,
  p_service_mode public.mechanic_service_mode
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_hash text;
  v_attempts integer;
  v_reference text;
begin
  if not exists (select 1 from public.mechanic_profiles m
                  where m.id = p_mechanic_id and m.status = 'approved'::public.mechanic_status) then
    raise exception 'This mechanic is not available for requests.';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid email address.';
  end if;
  if coalesce(length(trim(p_issue_description)), 0) < 10 then
    raise exception 'Describe the issue in at least 10 characters.';
  end if;

  v_hash := encode(digest(v_email, 'sha256'), 'hex');
  select count(*) into v_attempts
    from public.mechanic_request_attempts a
   where a.email_hash = v_hash and a.created_at > now() - interval '1 hour';
  if v_attempts >= 5 then
    raise exception 'Too many requests from this email. Please try again later.';
  end if;
  insert into public.mechanic_request_attempts (email_hash) values (v_hash);

  v_reference := 'MRN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.mechanic_service_requests (
    reference, mechanic_id, customer_id, name, email, phone,
    vehicle_make, vehicle_model, issue_description, preferred_date, service_mode, status
  )
  values (
    v_reference, p_mechanic_id, auth.uid(), trim(p_name), v_email, trim(p_phone),
    trim(p_vehicle_make), trim(p_vehicle_model), trim(p_issue_description),
    p_preferred_date, p_service_mode, 'new'::public.service_request_status
  );
  return v_reference;
end;
$$;

create or replace function public.update_mechanic_request_status(
  p_request_id uuid,
  p_status public.service_request_status,
  p_notes text default null
)
returns public.mechanic_service_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_result public.mechanic_service_requests;
begin
  if v_user is null then raise exception 'You must be signed in.'; end if;
  if not public.is_admin() and not exists (
    select 1 from public.mechanic_profiles m
     join public.mechanic_service_requests r on r.mechanic_id = m.id
    where r.id = p_request_id and m.user_id = v_user
  ) then
    raise exception 'You cannot update this request.';
  end if;
  update public.mechanic_service_requests
     set status = p_status,
         mechanic_notes = coalesce(p_notes, mechanic_notes),
         updated_at = now()
   where id = p_request_id
  returning * into v_result;
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function permissions
-- ---------------------------------------------------------------------------

revoke all on function public.current_mechanic_id() from public;
revoke all on function public.register_mechanic(text, text, text, text, text, text, text, text, numeric, numeric, public.mechanic_service_mode[], public.mechanic_service_type[], text[], integer, text[], text, boolean, numeric, numeric, text, text) from public;
revoke all on function public.admin_set_mechanic_status(uuid, public.mechanic_status, boolean, boolean, text) from public;
revoke all on function public.create_mechanic_service_request(uuid, text, text, text, text, text, text, timestamptz, public.mechanic_service_mode) from public;
revoke all on function public.update_mechanic_request_status(uuid, public.service_request_status, text) from public;

grant execute on function public.current_mechanic_id() to authenticated;
grant execute on function public.register_mechanic(text, text, text, text, text, text, text, text, numeric, numeric, public.mechanic_service_mode[], public.mechanic_service_type[], text[], integer, text[], text, boolean, numeric, numeric, text, text) to authenticated;
grant execute on function public.admin_set_mechanic_status(uuid, public.mechanic_status, boolean, boolean, text) to authenticated;
grant execute on function public.create_mechanic_service_request(uuid, text, text, text, text, text, text, timestamptz, public.mechanic_service_mode) to anon, authenticated;
grant execute on function public.update_mechanic_request_status(uuid, public.service_request_status, text) to authenticated;
