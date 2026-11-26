-- EV Naija — reject bookings that cross the charger's local midnight
--
-- charger_availability stores an opening and closing time for each local day.
-- Comparing only the time-of-day of end_time let a booking ending at 00:00
-- (the next local day) pass a 22:00 close. End times must stay on the same
-- local date as the start time.

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
  if v_user is null then
    raise exception 'You must be signed in to reserve a charger.';
  end if;

  if exists (select 1 from public.profiles p where p.id = v_user and p.is_suspended) then
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
       and user_id = v_user;
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
       or (v_end at time zone 'Africa/Lagos')::date <> (v_start at time zone 'Africa/Lagos')::date
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
   where b.customer_id = v_user
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
    platform_commission, operator_earning, status, payment_status, qr_code, hold_expires_at
  ) values (
    v_reference, v_user, p_station_id, p_charger_id, p_vehicle_id,
    v_start, v_end, p_duration_minutes, v_energy,
    v_charging, v_charger.booking_fee, v_service_fee, v_tax, 0, v_total,
    v_commission, v_earning, 'pending_payment', 'pending',
    'EVN|' || v_reference || '|' || v_start::text,
    now() + make_interval(mins => v_hold_minutes)
  )
  returning * into v_booking;

  insert into public.payments (booking_id, customer_id, reference, amount, currency, status, metadata)
  values (
    v_booking.id, v_user, 'PAY-' || v_reference, v_total, 'NGN', 'pending',
    jsonb_build_object('booking_reference', v_reference, 'charger', v_charger.name)
  );

  insert into public.booking_status_history (booking_id, status, notes, changed_by)
  values (v_booking.id, 'pending_payment', 'Charger held while payment is completed.', v_user);

  insert into public.notifications (user_id, title, message, type, link)
  values (
    v_user,
    'Charger held',
    format('We are holding %s at %s for %s minutes while you complete payment.', v_charger.name, v_station.name, v_hold_minutes),
    'booking',
    '/app/bookings/' || v_booking.id
  );

  return v_booking;
end;
$$;
