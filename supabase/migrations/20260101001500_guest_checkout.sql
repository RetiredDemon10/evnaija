-- EV Naija — server-side guest checkout
--
-- Guests never sign in to reserve a charger. The `guest-booking` edge function
-- (service role) provisions a real auth user + profile so bookings, payments
-- and receipts keep working against the existing schema and RLS, then hands the
-- browser a per-booking bearer token. Payment and booking reads are authorised
-- by that token, so a guest can complete checkout without an account and later
-- claim the profile by setting a password.
--
-- Anti-abuse lives in public.guest_rate_limit_ok + public.guest_checkout_attempts.

-- ---------------------------------------------------------------------------
-- Guest markers
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists is_guest boolean not null default false,
  add column if not exists claimed_at timestamptz;

create index if not exists profiles_guest_idx on public.profiles (is_guest) where is_guest = true;

alter table public.bookings
  add column if not exists is_guest boolean not null default false,
  add column if not exists guest_email text,
  add column if not exists guest_token_hash text,
  add column if not exists guest_ip_hash text;

create index if not exists bookings_guest_token_idx
  on public.bookings (guest_token_hash)
  where guest_token_hash is not null;

-- ---------------------------------------------------------------------------
-- Attempt ledger + rate limiting (service role only)
-- ---------------------------------------------------------------------------

create table if not exists public.guest_checkout_attempts (
  id uuid primary key default gen_random_uuid(),
  email text,
  ip_hash text,
  outcome text not null,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists guest_checkout_attempts_email_idx
  on public.guest_checkout_attempts (email, created_at desc);
create index if not exists guest_checkout_attempts_ip_idx
  on public.guest_checkout_attempts (ip_hash, created_at desc);

-- RLS on with no policies: only the service role (which bypasses RLS) can read
-- or write this table.
alter table public.guest_checkout_attempts enable row level security;

create or replace function public.guest_rate_limit_ok(p_email text, p_ip_hash text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    coalesce((
      select count(*) from public.guest_checkout_attempts a
       where a.email = lower(trim(coalesce(p_email, '')))
         and a.outcome = 'created'
         and a.created_at > now() - interval '1 hour'
    ), 0) < 5
    and coalesce((
      select count(*) from public.guest_checkout_attempts a
       where a.email = lower(trim(coalesce(p_email, '')))
         and a.outcome = 'created'
         and a.created_at > now() - interval '60 seconds'
    ), 0) = 0
    and coalesce((
      select count(*) from public.guest_checkout_attempts a
       where a.ip_hash = p_ip_hash
         and a.created_at > now() - interval '1 hour'
    ), 0) < 20;
$$;

-- ---------------------------------------------------------------------------
-- Shared booking creation core
-- ---------------------------------------------------------------------------

-- Single source of truth for pricing, availability and hold logic. Called only
-- by public.create_booking (signed-in) and public.create_guest_booking
-- (service role). Clients cannot execute it directly.
create or replace function public.create_booking_core(
  p_customer_id uuid,
  p_station_id uuid,
  p_charger_id uuid,
  p_vehicle_id uuid,
  p_start_time timestamptz,
  p_duration_minutes integer,
  p_is_guest boolean default false,
  p_guest_email text default null,
  p_guest_token_hash text default null,
  p_guest_ip_hash text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_station public.stations%rowtype;
  v_charger public.chargers%rowtype;
  v_vehicle public.vehicles%rowtype;
  v_battery_kwh numeric(8, 2);
  v_availability public.charger_availability%rowtype;
  v_booking public.bookings%rowtype;
  v_start timestamptz;
  v_end timestamptz;
  v_energy numeric(10, 2);
  v_charging numeric(12, 2);
  v_tax numeric(12, 2);
  v_total numeric(12, 2);
  v_commission numeric(12, 2);
  v_earning numeric(12, 2);
  v_commission_percent numeric(5, 2) := 15;
  v_service_fee numeric(12, 2) := 500;
  v_vat_percent numeric(5, 2) := 7.5;
  v_hold_minutes integer := 15;
  v_max_active integer := 3;
  v_active integer := 0;
  v_reference text;
begin
  if p_customer_id is null then
    raise exception 'A customer is required to reserve a charger.';
  end if;

  if exists (select 1 from public.profiles p where p.id = p_customer_id and p.is_suspended) then
    raise exception 'Your account is suspended. Contact EV Naija support to restore booking access.';
  end if;

  if p_duration_minutes < 15 or p_duration_minutes > 720 then
    raise exception 'A booking must last between 15 minutes and 12 hours.';
  end if;

  if p_start_time < now() - interval '1 minute' then
    raise exception 'Choose a start time in the future.';
  end if;

  if p_start_time > now() + interval '60 days' then
    raise exception 'Bookings can only be made up to 60 days ahead.';
  end if;

  select * into v_station from public.stations where id = p_station_id;
  if not found or v_station.status <> 'approved'::public.station_status then
    raise exception 'This station is not currently accepting bookings.';
  end if;

  select * into v_charger
    from public.chargers
   where id = p_charger_id
     and station_id = p_station_id;

  if not found or not v_charger.is_active then
    raise exception 'This charger is not available for booking.';
  end if;

  if v_charger.status in ('offline'::public.charger_status, 'maintenance'::public.charger_status) then
    raise exception 'This charger is currently offline or under maintenance.';
  end if;

  if p_vehicle_id is not null then
    select * into v_vehicle
      from public.vehicles
     where id = p_vehicle_id
       and user_id = p_customer_id;
    if not found then
      raise exception 'Select one of your saved vehicles.';
    end if;
    v_battery_kwh := v_vehicle.battery_capacity_kwh;
  end if;

  v_start := p_start_time;
  v_end := v_start + make_interval(mins => p_duration_minutes);

  select * into v_availability
    from public.charger_availability
   where charger_id = p_charger_id
     and day_of_week = extract(dow from (v_start at time zone 'Africa/Lagos'))::smallint;

  if found then
    if v_availability.is_closed then
      raise exception 'This charger is closed on the selected day.';
    end if;
    if (v_start at time zone 'Africa/Lagos')::time < v_availability.opens_at
       or (v_end at time zone 'Africa/Lagos')::time > v_availability.closes_at then
      raise exception 'The selected time is outside this charger''s operating hours.';
    end if;
  end if;

  -- Serialise bookings per charger so two drivers cannot take the same slot.
  perform pg_advisory_xact_lock(hashtextextended(p_charger_id::text, 0));

  if exists (
    select 1
      from public.bookings b
     where b.charger_id = p_charger_id
       and b.status in (
         'pending_payment'::public.booking_status,
         'confirmed'::public.booking_status,
         'checked_in'::public.booking_status,
         'in_progress'::public.booking_status
       )
       and (b.status <> 'pending_payment'::public.booking_status or b.hold_expires_at > now())
       and b.start_time < v_end
       and b.end_time > v_start
  ) then
    raise exception 'That charger was just reserved by another driver. Choose a different slot.';
  end if;

  select count(*) into v_active
    from public.bookings b
   where b.customer_id = p_customer_id
     and b.status in (
       'pending_payment'::public.booking_status,
       'confirmed'::public.booking_status,
       'checked_in'::public.booking_status,
       'in_progress'::public.booking_status
     )
     and (b.status <> 'pending_payment'::public.booking_status or b.hold_expires_at > now());

  v_max_active := public.setting_int('max_active_bookings_per_user', 3);
  if v_active >= v_max_active then
    raise exception 'You have reached the maximum number of active bookings. Complete or cancel an existing booking first.';
  end if;

  select global_commission_percent, service_fee_amount, vat_percent
    into v_commission_percent, v_service_fee, v_vat_percent
    from public.commission_settings
   order by updated_at desc
   limit 1;

  v_commission_percent := coalesce(v_commission_percent, 15);
  v_service_fee := coalesce(v_service_fee, 500);
  v_vat_percent := coalesce(v_vat_percent, 7.5);
  v_hold_minutes := public.setting_int('booking_hold_minutes', 15);

  v_energy := round(
    least(
      v_charger.capacity_kw * (p_duration_minutes / 60.0),
      coalesce(v_battery_kwh, v_charger.capacity_kw)
    )::numeric,
    2
  );
  v_charging := round(v_energy * v_charger.price_per_kwh, 2);
  v_tax := round(v_service_fee * v_vat_percent / 100.0, 2);
  v_total := v_charging + v_charger.booking_fee + v_service_fee + v_tax;
  v_commission := round(v_charging * v_commission_percent / 100.0, 2);
  v_earning := v_charging - v_commission + v_charger.booking_fee;

  v_reference := 'EVN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  while exists (select 1 from public.bookings where booking_reference = v_reference) loop
    v_reference := 'EVN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  end loop;

  insert into public.bookings (
    booking_reference, customer_id, station_id, charger_id, vehicle_id,
    start_time, end_time, duration_minutes, energy_kwh,
    charging_fee, booking_fee, service_fee, tax_amount, discount_amount, total_amount,
    platform_commission, operator_earning, status, payment_status, qr_code, hold_expires_at,
    is_guest, guest_email, guest_token_hash, guest_ip_hash
  ) values (
    v_reference, p_customer_id, p_station_id, p_charger_id, p_vehicle_id,
    v_start, v_end, p_duration_minutes, v_energy,
    v_charging, v_charger.booking_fee, v_service_fee, v_tax, 0, v_total,
    v_commission, v_earning, 'pending_payment', 'pending',
    'EVN|' || v_reference || '|' || v_start::text,
    now() + make_interval(mins => v_hold_minutes),
    p_is_guest, case when p_is_guest then lower(trim(p_guest_email)) else null end,
    p_guest_token_hash, p_guest_ip_hash
  )
  returning * into v_booking;

  insert into public.payments (booking_id, customer_id, reference, amount, currency, status, metadata)
  values (
    v_booking.id, p_customer_id, 'PAY-' || v_reference, v_total, 'NGN', 'pending',
    jsonb_build_object(
      'booking_reference', v_reference,
      'charger', v_charger.name,
      'is_guest', p_is_guest
    )
  );

  insert into public.booking_status_history (booking_id, status, notes, changed_by)
  values (v_booking.id, 'pending_payment', 'Charger held while payment is completed.', p_customer_id);

  insert into public.notifications (user_id, title, message, type, link)
  values (
    p_customer_id,
    'Charger held',
    format('We are holding %s at %s for %s minutes while you complete payment.', v_charger.name, v_station.name, v_hold_minutes),
    'booking',
    case when p_is_guest
      then '/book/confirmation/' || v_booking.id
      else '/app/bookings/' || v_booking.id
    end
  );

  return v_booking;
end;
$$;

-- Signed-in booking path — unchanged signature and grants, now delegating to the core.
create or replace function public.create_booking(
  p_station_id uuid,
  p_charger_id uuid,
  p_vehicle_id uuid,
  p_start_time timestamptz,
  p_duration_minutes integer
)
returns public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'You must be signed in to reserve a charger.';
  end if;

  return public.create_booking_core(
    v_user, p_station_id, p_charger_id, p_vehicle_id, p_start_time, p_duration_minutes,
    false, null, null, null
  );
end;
$$;

-- Service-role only: the guest-booking edge function calls this after it has
-- provisioned (or reused) the guest profile.
create or replace function public.create_guest_booking(
  p_customer_id uuid,
  p_station_id uuid,
  p_charger_id uuid,
  p_vehicle_id uuid,
  p_start_time timestamptz,
  p_duration_minutes integer,
  p_guest_email text,
  p_guest_token_hash text,
  p_guest_ip_hash text default null
)
returns public.bookings
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.create_booking_core(
    p_customer_id, p_station_id, p_charger_id, p_vehicle_id, p_start_time, p_duration_minutes,
    true, p_guest_email, p_guest_token_hash, p_guest_ip_hash
  );
$$;

-- ---------------------------------------------------------------------------
-- Token-gated guest reads + claim
-- ---------------------------------------------------------------------------

create or replace function public.get_guest_booking(p_booking_id uuid, p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_booking public.bookings%rowtype;
  v_station public.stations%rowtype;
  v_charger public.chargers%rowtype;
  v_payment public.payments%rowtype;
  v_hash text;
begin
  if p_booking_id is null or p_token is null or length(p_token) < 20 then
    return null;
  end if;

  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  select * into v_booking
    from public.bookings
   where id = p_booking_id
     and is_guest
     and guest_token_hash = v_hash;

  if not found then
    return null;
  end if;

  select * into v_station from public.stations where id = v_booking.station_id;
  select * into v_charger from public.chargers where id = v_booking.charger_id;
  select * into v_payment
    from public.payments
   where booking_id = v_booking.id
   order by created_at desc
   limit 1;

  return to_jsonb(v_booking)
    || jsonb_build_object(
         'station', jsonb_build_object(
           'id', v_station.id,
           'name', v_station.name,
           'slug', v_station.slug,
           'city', v_station.city,
           'state', v_station.state,
           'address', v_station.address,
           'latitude', v_station.latitude,
           'longitude', v_station.longitude,
           'operating_hours', v_station.operating_hours,
           'google_maps_url', v_station.google_maps_url,
           'contact_phone', v_station.contact_phone
         ),
         'charger', jsonb_build_object(
           'id', v_charger.id,
           'name', v_charger.name,
           'charger_code', v_charger.charger_code,
           'connector_type', v_charger.connector_type,
           'capacity_kw', v_charger.capacity_kw,
           'speed_category', v_charger.speed_category,
           'price_per_kwh', v_charger.price_per_kwh
         ),
         'payment', case when v_payment.id is null then null else jsonb_build_object(
           'id', v_payment.id,
           'reference', v_payment.reference,
           'amount', v_payment.amount,
           'currency', v_payment.currency,
           'status', v_payment.status,
           'channel', v_payment.channel,
           'paid_at', v_payment.paid_at
         ) end
       );
end;
$$;

-- Called after a guest sets a password from their recovery link so the profile
-- stops behaving like a guest account.
create or replace function public.mark_guest_claimed()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  update public.profiles
     set is_guest = false,
         claimed_at = coalesce(claimed_at, now())
   where id = auth.uid()
     and is_guest = true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function permissions
-- ---------------------------------------------------------------------------

revoke all on function public.create_booking_core(uuid, uuid, uuid, uuid, timestamptz, integer, boolean, text, text, text) from public;
revoke all on function public.create_guest_booking(uuid, uuid, uuid, uuid, timestamptz, integer, text, text, text) from public;
revoke all on function public.get_guest_booking(uuid, text) from public;
revoke all on function public.guest_rate_limit_ok(text, text) from public;
revoke all on function public.mark_guest_claimed() from public;

grant execute on function public.create_guest_booking(uuid, uuid, uuid, uuid, timestamptz, integer, text, text, text) to service_role;
grant execute on function public.guest_rate_limit_ok(text, text) to service_role;
grant execute on function public.get_guest_booking(uuid, text) to anon, authenticated;
grant execute on function public.mark_guest_claimed() to authenticated;
