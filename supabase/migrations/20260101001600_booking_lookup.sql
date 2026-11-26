-- EV Naija — public booking lookup for the Manage Booking page.
--
-- Anonymous visitors cannot read `bookings` directly (RLS). This function is
-- called only by the `lookup-booking` edge function with the service role, after
-- that function has rate-limited the request by IP. A caller must know BOTH the
-- booking reference and either the per-booking guest token or the email on the
-- booking. Only a tracking subset is returned — never the QR code, token hash
-- or customer id.

-- ---------------------------------------------------------------------------
-- Attempt ledger + rate limiting (service role only)
-- ---------------------------------------------------------------------------

create table if not exists public.booking_lookup_attempts (
  id uuid primary key default gen_random_uuid(),
  ip_hash text,
  reference text,
  outcome text not null,
  created_at timestamptz not null default now()
);

create index if not exists booking_lookup_attempts_ip_idx
  on public.booking_lookup_attempts (ip_hash, created_at desc);

-- RLS on with no policies: only the service role can read or write this table.
alter table public.booking_lookup_attempts enable row level security;

create or replace function public.booking_lookup_rate_limit_ok(p_ip_hash text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    coalesce((
      select count(*) from public.booking_lookup_attempts a
       where a.ip_hash = p_ip_hash
         and a.created_at > now() - interval '1 hour'
    ), 0) < 60
    and coalesce((
      select count(*) from public.booking_lookup_attempts a
       where a.ip_hash = p_ip_hash
         and a.outcome = 'not_found'
         and a.created_at > now() - interval '10 minutes'
    ), 0) < 15;
$$;

-- ---------------------------------------------------------------------------
-- Lookup
-- ---------------------------------------------------------------------------

create or replace function public.lookup_booking(p_reference text, p_secret text)
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
  v_secret text := lower(trim(coalesce(p_secret, '')));
  v_account_email text;
  v_token_hash text;
  v_authorized boolean := false;
begin
  if p_reference is null or v_secret = '' then
    return null;
  end if;

  -- Accept the secure confirmation link pasted as the secret.
  if v_secret like '%token=%' then
    v_secret := split_part(split_part(v_secret, 'token=', 2), '&', 1);
    v_secret := lower(trim(v_secret));
  end if;
  if v_secret = '' then
    return null;
  end if;

  select * into v_booking
    from public.bookings
   where upper(booking_reference) = upper(trim(p_reference));
  if not found then
    return null;
  end if;

  -- A 64-character hex token is the per-booking guest bearer token.
  if v_secret ~ '^[0-9a-f]{64}$' then
    v_token_hash := encode(digest(v_secret, 'sha256'), 'hex');
    v_authorized := v_booking.guest_token_hash = v_token_hash;
  else
    -- Otherwise the caller must know the email attached to the booking.
    if v_booking.is_guest
       and lower(coalesce(v_booking.guest_email, '')) = v_secret then
      v_authorized := true;
    end if;
    if not v_authorized then
      select lower(u.email) into v_account_email
        from auth.users u
       where u.id = v_booking.customer_id;
      v_authorized := coalesce(v_account_email, '') = v_secret;
    end if;
  end if;

  if not v_authorized then
    return null;
  end if;

  select * into v_station from public.stations where id = v_booking.station_id;
  select * into v_charger from public.chargers where id = v_booking.charger_id;
  select * into v_payment
    from public.payments
   where booking_id = v_booking.id
   order by created_at desc
   limit 1;

  -- Deliberately drop sensitive columns before returning.
  return (to_jsonb(v_booking)
      - 'guest_token_hash'
      - 'guest_ip_hash'
      - 'qr_code'
      - 'customer_id')
    || jsonb_build_object(
         'station', case when v_station.id is null then null else jsonb_build_object(
           'id', v_station.id,
           'name', v_station.name,
           'slug', v_station.slug,
           'city', v_station.city,
           'state', v_station.state,
           'address', v_station.address,
           'operating_hours', v_station.operating_hours,
           'contact_phone', v_station.contact_phone
         ) end,
         'charger', case when v_charger.id is null then null else jsonb_build_object(
           'id', v_charger.id,
           'name', v_charger.name,
           'charger_code', v_charger.charger_code,
           'connector_type', v_charger.connector_type,
           'capacity_kw', v_charger.capacity_kw,
           'speed_category', v_charger.speed_category,
           'price_per_kwh', v_charger.price_per_kwh
         ) end,
         'payment', case when v_payment.id is null then null else jsonb_build_object(
           'id', v_payment.id,
           'reference', v_payment.reference,
           'amount', v_payment.amount,
           'currency', v_payment.currency,
           'status', v_payment.status,
           'paid_at', v_payment.paid_at
         ) end
       );
end;
$$;

-- ---------------------------------------------------------------------------
-- Function permissions
-- ---------------------------------------------------------------------------

revoke all on function public.booking_lookup_rate_limit_ok(text) from public;
revoke all on function public.lookup_booking(text, text) from public;

grant execute on function public.booking_lookup_rate_limit_ok(text) to service_role;
grant execute on function public.lookup_booking(text, text) to service_role;
