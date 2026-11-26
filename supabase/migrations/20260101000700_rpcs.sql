-- EV Naija — transactional RPCs used by the apps

-- ---------------------------------------------------------------------------
-- Availability
-- ---------------------------------------------------------------------------

create or replace function public.get_charger_slots(p_charger_id uuid, p_date date)
returns table (slot_start timestamptz, slot_end timestamptz, is_available boolean)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_charger public.chargers%rowtype;
  v_station public.stations%rowtype;
  v_open time := '06:00';
  v_close time := '22:00';
  v_closed boolean := false;
  v_day smallint;
begin
  select * into v_charger from public.chargers where id = p_charger_id;
  if not found then
    return;
  end if;

  select * into v_station from public.stations where id = v_charger.station_id;

  v_day := extract(dow from (p_date::timestamp))::smallint;
  select opens_at, closes_at, is_closed
    into v_open, v_close, v_closed
    from public.charger_availability
   where charger_id = p_charger_id
     and day_of_week = v_day;

  if not found then
    v_open := '06:00';
    v_close := '22:00';
    v_closed := false;
  end if;

  if v_closed
     or v_station.status <> 'approved'::public.station_status
     or not v_charger.is_active
     or v_charger.status in ('offline'::public.charger_status, 'maintenance'::public.charger_status) then
    return query
      select (p_date::timestamp + v_open) at time zone 'Africa/Lagos' + (n * interval '30 minutes'),
             (p_date::timestamp + v_open) at time zone 'Africa/Lagos' + ((n + 1) * interval '30 minutes'),
             false
        from generate_series(0, greatest(floor(extract(epoch from (v_close - v_open)) / 1800)::integer, 0) - 1) as n;
    return;
  end if;

  return query
    with slots as (
      select (p_date::timestamp + v_open) at time zone 'Africa/Lagos' + (n * interval '30 minutes') as starts
        from generate_series(0, greatest(floor(extract(epoch from (v_close - v_open)) / 1800)::integer, 0) - 1) as n
    )
    select slots.starts,
           slots.starts + interval '30 minutes',
           slots.starts > now()
             and not exists (
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
                  and b.start_time < slots.starts + interval '30 minutes'
                  and b.end_time > slots.starts
             )
      from slots
     order by slots.starts;
end;
$$;

-- ---------------------------------------------------------------------------
-- Booking lifecycle
-- ---------------------------------------------------------------------------

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

create or replace function public.cancel_booking(p_booking_id uuid, p_reason text)
returns public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_payment public.payments%rowtype;
  v_is_operator boolean := false;
  v_window_hours integer := 24;
  v_refund_created boolean := false;
  v_payment_found boolean := false;
begin
  if v_user is null then
    raise exception 'You must be signed in to cancel a booking.';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found.';
  end if;

  select exists (
    select 1 from public.stations s
     where s.id = v_booking.station_id
       and s.operator_id = public.current_operator_id()
  ) into v_is_operator;

  if v_booking.customer_id <> v_user and not v_is_operator and not public.is_admin() then
    raise exception 'You do not have permission to cancel this booking.';
  end if;

  if v_booking.status not in ('pending_payment'::public.booking_status, 'confirmed'::public.booking_status) then
    raise exception 'This booking can no longer be cancelled.';
  end if;

  if v_booking.payment_status = 'success'::public.payment_status then
    select * into v_payment
      from public.payments
     where booking_id = v_booking.id
       and status = 'success'::public.payment_status
     order by created_at desc
     limit 1;

    v_payment_found := found;
    v_window_hours := public.setting_int('cancellation_window_hours', 24);

    if v_payment_found and v_booking.start_time - now() >= make_interval(hours => v_window_hours) then
      insert into public.refunds (payment_id, booking_id, amount, reason, status, requested_by)
      values (v_payment.id, v_booking.id, v_payment.amount, p_reason, 'pending', v_user);
      v_refund_created := true;
    end if;
  end if;

  update public.bookings
     set status = 'cancelled'::public.booking_status,
         cancellation_reason = p_reason,
         cancelled_at = now()
   where id = v_booking.id
  returning * into v_booking;

  update public.payments
     set status = 'abandoned'::public.payment_status
   where booking_id = v_booking.id
     and status = 'pending'::public.payment_status;

  insert into public.booking_status_history (booking_id, status, notes, changed_by)
  values (
    v_booking.id,
    'cancelled',
    case when v_refund_created then p_reason || ' (refund requested)' else p_reason end,
    v_user
  );

  insert into public.notifications (user_id, title, message, type, link)
  values (
    v_booking.customer_id,
    'Booking cancelled',
    case
      when v_refund_created then format('Booking %s has been cancelled. Your refund is pending review.', v_booking.booking_reference)
      else format('Booking %s has been cancelled. Any applicable refund will appear in your payment history.', v_booking.booking_reference)
    end,
    'booking',
    '/app/bookings/' || v_booking.id
  );

  return v_booking;
end;
$$;

create or replace function public.update_booking_status(
  p_booking_id uuid,
  p_status public.booking_status,
  p_notes text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_booking public.bookings%rowtype;
  v_is_operator boolean := false;
  v_allowed boolean := false;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found.';
  end if;

  select exists (
    select 1 from public.stations s
     where s.id = v_booking.station_id
       and s.operator_id = public.current_operator_id()
  ) into v_is_operator;

  if not public.is_admin() and not v_is_operator then
    raise exception 'Only the station operator or an administrator can update this booking.';
  end if;

  if p_status = v_booking.status then
    return v_booking;
  end if;

  if v_booking.status = 'confirmed'::public.booking_status and p_status in ('checked_in'::public.booking_status, 'cancelled'::public.booking_status) then
    v_allowed := true;
  elsif v_booking.status = 'checked_in'::public.booking_status and p_status = 'in_progress'::public.booking_status then
    v_allowed := true;
  elsif v_booking.status = 'in_progress'::public.booking_status and p_status = 'completed'::public.booking_status then
    v_allowed := true;
  elsif v_booking.status = 'pending_payment'::public.booking_status and p_status in ('cancelled'::public.booking_status, 'expired'::public.booking_status) then
    v_allowed := true;
  end if;

  if not v_allowed and not public.is_admin() then
    raise exception 'That status transition is not allowed.';
  end if;

  update public.bookings
     set status = p_status,
         checked_in_at = case when p_status = 'checked_in' then now() else checked_in_at end,
         started_at = case when p_status = 'in_progress' then now() else started_at end,
         completed_at = case when p_status = 'completed' then now() else completed_at end,
         cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end,
         cancellation_reason = case when p_status = 'cancelled' then coalesce(p_notes, cancellation_reason) else cancellation_reason end
   where id = v_booking.id
  returning * into v_booking;

  insert into public.booking_status_history (booking_id, status, notes, changed_by)
  values (v_booking.id, p_status, p_notes, auth.uid());

  insert into public.notifications (user_id, title, message, type, link)
  values (
    v_booking.customer_id,
    case
      when p_status = 'checked_in' then 'Checked in'
      when p_status = 'in_progress' then 'Charging started'
      when p_status = 'completed' then 'Charging complete'
      when p_status = 'cancelled' then 'Booking cancelled'
      when p_status = 'expired' then 'Booking expired'
      else 'Booking updated'
    end,
    format('Booking %s at your reserved station is now %s.', v_booking.booking_reference, replace(p_status::text, '_', ' ')),
    'booking',
    '/app/bookings/' || v_booking.id
  );

  return v_booking;
end;
$$;

create or replace function public.validate_booking_qr(p_qr_code text)
returns public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_booking public.bookings%rowtype;
  v_reference text;
  v_is_operator boolean := false;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to scan a booking.';
  end if;

  v_reference := case
    when position('|' in p_qr_code) > 0 then split_part(p_qr_code, '|', 2)
    else p_qr_code
  end;

  select * into v_booking
    from public.bookings
   where qr_code = p_qr_code
      or booking_reference = v_reference
   order by created_at desc
   limit 1;

  if not found then
    raise exception 'Invalid QR code — no booking found.';
  end if;

  select exists (
    select 1 from public.stations s
     where s.id = v_booking.station_id
       and s.operator_id = public.current_operator_id()
  ) into v_is_operator;

  if not v_is_operator and not public.is_admin() then
    raise exception 'This booking belongs to a different station.';
  end if;

  if v_booking.status <> 'confirmed'::public.booking_status then
    raise exception 'This booking is % and cannot be checked in.', replace(v_booking.status::text, '_', ' ');
  end if;

  update public.bookings
     set status = 'checked_in'::public.booking_status,
         checked_in_at = now()
   where id = v_booking.id
  returning * into v_booking;

  insert into public.booking_status_history (booking_id, status, notes, changed_by)
  values (v_booking.id, 'checked_in', 'QR code validated at station.', auth.uid());

  insert into public.notifications (user_id, title, message, type, link)
  values (
    v_booking.customer_id,
    'Checked in',
    format('Booking %s has been checked in. Enjoy your charge.', v_booking.booking_reference),
    'booking',
    '/app/bookings/' || v_booking.id
  );

  return v_booking;
end;
$$;

-- ---------------------------------------------------------------------------
-- Operator payouts
-- ---------------------------------------------------------------------------

create or replace function public.request_payout(p_amount numeric, p_payout_account_id uuid)
returns public.payout_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_operator_id uuid := public.current_operator_id();
  v_account public.payout_accounts%rowtype;
  v_payout public.payout_requests%rowtype;
  v_balance numeric(12, 2) := 0;
  v_pending numeric(12, 2) := 0;
  v_minimum numeric(12, 2) := 10000;
begin
  if v_operator_id is null then
    raise exception 'Only approved operators can request payouts.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter a valid payout amount.';
  end if;

  select * into v_account
    from public.payout_accounts
   where id = p_payout_account_id
     and operator_id = v_operator_id;
  if not found then
    raise exception 'Select a payout account that belongs to your business.';
  end if;

  select coalesce(sum(case when direction = 'credit' then amount else -amount end), 0)
    into v_balance
    from public.financial_ledger
   where operator_id = v_operator_id;

  select coalesce(sum(amount), 0)
    into v_pending
    from public.payout_requests
   where operator_id = v_operator_id
     and status in ('pending'::public.payout_status, 'approved'::public.payout_status, 'processing'::public.payout_status);

  select minimum_payout_amount into v_minimum
    from public.commission_settings
   order by updated_at desc
   limit 1;
  v_minimum := coalesce(v_minimum, 10000);

  if p_amount < v_minimum then
    raise exception 'The minimum payout is ₦%.', to_char(v_minimum, 'FM999G999G999G999');
  end if;

  if p_amount > (v_balance - v_pending) then
    raise exception 'Your available balance is ₦%.', to_char(greatest(v_balance - v_pending, 0), 'FM999G999G999G999');
  end if;

  insert into public.payout_requests (operator_id, payout_account_id, amount, status)
  values (v_operator_id, p_payout_account_id, p_amount, 'pending')
  returning * into v_payout;

  insert into public.notifications (user_id, title, message, type, link)
  select p.id,
         'Payout requested',
         format('%s requested a payout of ₦%s.', op.business_name, to_char(p_amount, 'FM999G999G999G999')),
         'payout',
         '/admin/payouts'
    from public.profiles p
    join public.user_roles ur on ur.user_id = p.id and ur.role = 'admin'::public.app_role
    join public.operator_profiles op on op.id = v_operator_id;

  return v_payout;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin actions
-- ---------------------------------------------------------------------------

create or replace function public.admin_set_user_suspended(
  p_user_id uuid,
  p_suspended boolean,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required.';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot suspend your own administrator account.';
  end if;

  update public.profiles
     set is_suspended = p_suspended,
         suspended_reason = case when p_suspended then p_reason else null end
   where id = p_user_id;

  insert into public.notifications (user_id, title, message, type, link)
  values (
    p_user_id,
    case when p_suspended then 'Account suspended' else 'Account restored' end,
    case when p_suspended then coalesce(p_reason, 'Your account has been suspended. Contact support for help.') else 'Your EV Naija account has been restored.' end,
    'account',
    '/app/support'
  );
end;
$$;

create or replace function public.admin_set_operator_status(
  p_operator_id uuid,
  p_status public.operator_status,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_operator public.operator_profiles%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required.';
  end if;

  select * into v_operator from public.operator_profiles where id = p_operator_id;
  if not found then
    raise exception 'Operator not found.';
  end if;

  update public.operator_profiles
     set status = p_status,
         rejection_reason = case when p_status = 'rejected' then p_reason else null end,
         reviewed_at = now()
   where id = p_operator_id;

  insert into public.notifications (user_id, title, message, type, link)
  values (
    v_operator.user_id,
    case
      when p_status = 'approved' then 'Operator account approved'
      when p_status = 'rejected' then 'Operator application update'
      when p_status = 'suspended' then 'Operator account suspended'
      else 'Operator account updated'
    end,
    case
      when p_status = 'approved' then 'Your operator account is approved. You can now submit stations for review.'
      when p_status = 'rejected' then coalesce(p_reason, 'Your operator application was not approved.')
      when p_status = 'suspended' then coalesce(p_reason, 'Your operator account has been suspended.')
      else format('Your operator account status is now %s.', p_status::text)
    end,
    'account',
    '/operator/profile'
  );
end;
$$;

create or replace function public.admin_set_station_status(
  p_station_id uuid,
  p_status public.station_status,
  p_featured boolean default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_station public.stations%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required.';
  end if;

  select * into v_station from public.stations where id = p_station_id;
  if not found then
    raise exception 'Station not found.';
  end if;

  update public.stations
     set status = p_status,
         is_featured = coalesce(p_featured, is_featured)
   where id = p_station_id;

  insert into public.notifications (user_id, title, message, type, link)
  select op.user_id,
         case when p_status = 'approved' then 'Station approved' else 'Station status updated' end,
         case
           when p_status = 'approved' then format('%s is now live on EV Naija.', v_station.name)
           when p_status = 'rejected' then format('%s was not approved. Check your station notes.', v_station.name)
           when p_status = 'suspended' then format('%s has been suspended.', v_station.name)
           else format('%s status is now %s.', v_station.name, p_status::text)
         end,
         'system',
         '/operator/stations'
    from public.operator_profiles op
   where op.id = v_station.operator_id;
end;
$$;

create or replace function public.admin_set_payout_status(
  p_payout_id uuid,
  p_status public.payout_status,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payout public.payout_requests%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required.';
  end if;

  select * into v_payout from public.payout_requests where id = p_payout_id for update;
  if not found then
    raise exception 'Payout request not found.';
  end if;

  if v_payout.status = 'paid'::public.payout_status then
    raise exception 'This payout has already been completed.';
  end if;

  update public.payout_requests
     set status = p_status,
         admin_notes = coalesce(p_notes, admin_notes),
         processed_at = case when p_status in ('paid'::public.payout_status, 'rejected'::public.payout_status) then now() else processed_at end
   where id = p_payout_id;

  insert into public.notifications (user_id, title, message, type, link)
  select op.user_id,
         case
           when p_status = 'approved' then 'Payout approved'
           when p_status = 'processing' then 'Payout processing'
           when p_status = 'paid' then 'Payout sent'
           when p_status = 'rejected' then 'Payout request rejected'
           else 'Payout updated'
         end,
         case
           when p_status = 'approved' then format('Your payout of ₦%s has been approved.', to_char(v_payout.amount, 'FM999G999G999G999'))
           when p_status = 'processing' then format('Your payout of ₦%s is being processed.', to_char(v_payout.amount, 'FM999G999G999G999'))
           when p_status = 'paid' then format('Your payout of ₦%s has been sent.', to_char(v_payout.amount, 'FM999G999G999G999'))
           when p_status = 'rejected' then coalesce(p_notes, 'Your payout request was rejected.')
           else format('Your payout status is now %s.', p_status::text)
         end,
         'payout',
         '/operator/payouts'
    from public.operator_profiles op
   where op.id = v_payout.operator_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------

create or replace function public.report_review(p_review_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to report a review.';
  end if;
  if p_reason is null or length(trim(p_reason)) < 4 then
    raise exception 'Tell us why this review should be reviewed.';
  end if;

  update public.reviews
     set status = 'reported'::public.review_status,
         report_reason = p_reason
   where id = p_review_id
     and status = 'published'::public.review_status;

  if not found then
    raise exception 'Review not found or already under moderation.';
  end if;
end;
$$;

create or replace function public.moderate_review(p_review_id uuid, p_status public.review_status)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_review public.reviews%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required.';
  end if;

  update public.reviews
     set status = p_status,
         report_reason = case when p_status = 'published' then null else report_reason end
   where id = p_review_id
  returning * into v_review;

  if not found then
    raise exception 'Review not found.';
  end if;

  insert into public.notifications (user_id, title, message, type, link)
  values (
    v_review.customer_id,
    'Review moderation update',
    case
      when p_status = 'published' then 'Your review is published.'
      when p_status = 'hidden' then 'Your review was hidden after moderation.'
      else 'Your review is under review.'
    end,
    'review',
    '/app/reviews'
  );
end;
$$;

create or replace function public.get_station_reviews(p_station_id uuid)
returns setof jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', r.id,
    'booking_id', r.booking_id,
    'station_id', r.station_id,
    'customer_id', r.customer_id,
    'overall_rating', r.overall_rating,
    'charging_experience', r.charging_experience,
    'equipment_condition', r.equipment_condition,
    'customer_service', r.customer_service,
    'location_accessibility', r.location_accessibility,
    'comment', r.comment,
    'photos', to_jsonb(r.photos),
    'status', r.status,
    'is_verified', r.is_verified,
    'report_reason', r.report_reason,
    'created_at', r.created_at,
    'customer', jsonb_build_object(
      'id', p.id,
      'full_name', p.full_name,
      'avatar_url', p.avatar_url
    ),
    'response', case when rr.id is null then null else jsonb_build_object(
      'id', rr.id,
      'review_id', rr.review_id,
      'operator_id', rr.operator_id,
      'response', rr.response,
      'created_at', rr.created_at
    ) end
  )
  from public.reviews r
  join public.profiles p on p.id = r.customer_id
  left join public.review_responses rr on rr.review_id = r.id
  where r.station_id = p_station_id
    and r.status = 'published'::public.review_status
  order by r.created_at desc;
$$;

create or replace function public.get_testimonials(p_limit integer default 3)
returns setof jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', r.id,
    'booking_id', r.booking_id,
    'station_id', r.station_id,
    'customer_id', r.customer_id,
    'overall_rating', r.overall_rating,
    'charging_experience', r.charging_experience,
    'equipment_condition', r.equipment_condition,
    'customer_service', r.customer_service,
    'location_accessibility', r.location_accessibility,
    'comment', r.comment,
    'photos', to_jsonb(r.photos),
    'status', r.status,
    'is_verified', r.is_verified,
    'report_reason', r.report_reason,
    'created_at', r.created_at,
    'customer', jsonb_build_object(
      'id', p.id,
      'full_name', p.full_name,
      'avatar_url', p.avatar_url
    ),
    'station', jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'city', s.city,
      'slug', s.slug
    ),
    'response', case when rr.id is null then null else jsonb_build_object(
      'id', rr.id,
      'review_id', rr.review_id,
      'operator_id', rr.operator_id,
      'response', rr.response,
      'created_at', rr.created_at
    ) end
  )
  from public.reviews r
  join public.profiles p on p.id = r.customer_id
  join public.stations s on s.id = r.station_id
  left join public.review_responses rr on rr.review_id = r.id
  where r.status = 'published'::public.review_status
    and r.overall_rating >= 4
    and s.status = 'approved'::public.station_status
  order by r.created_at desc
  limit greatest(least(coalesce(p_limit, 3), 12), 1);
$$;

-- ---------------------------------------------------------------------------
-- Housekeeping (schedule with pg_cron in production if available)
-- ---------------------------------------------------------------------------

create or replace function public.expire_stale_bookings()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer := 0;
begin
  with expired as (
    update public.bookings
       set status = 'expired'::public.booking_status,
           cancellation_reason = 'Payment hold expired.'
     where status = 'pending_payment'::public.booking_status
       and hold_expires_at is not null
       and hold_expires_at < now()
    returning id
  )
  select count(*) into v_count from expired;

  update public.payments p
     set status = 'abandoned'::public.payment_status
   where p.status = 'pending'::public.payment_status
     and exists (
       select 1 from public.bookings b
        where b.id = p.booking_id
          and b.status = 'expired'::public.booking_status
     );

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function permissions
-- ---------------------------------------------------------------------------

revoke all on function public.handle_new_user() from public;

grant execute on function public.has_role(public.app_role) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_operator() to anon, authenticated;
grant execute on function public.current_operator_id() to anon, authenticated;

grant execute on function public.get_charger_slots(uuid, date) to anon, authenticated;
grant execute on function public.get_station_reviews(uuid) to anon, authenticated;
grant execute on function public.get_testimonials(integer) to anon, authenticated;

grant execute on function public.create_booking(uuid, uuid, uuid, timestamptz, integer) to authenticated;
grant execute on function public.cancel_booking(uuid, text) to authenticated;
grant execute on function public.update_booking_status(uuid, public.booking_status, text) to authenticated;
grant execute on function public.validate_booking_qr(text) to authenticated;
grant execute on function public.request_payout(numeric, uuid) to authenticated;
grant execute on function public.admin_set_user_suspended(uuid, boolean, text) to authenticated;
grant execute on function public.admin_set_operator_status(uuid, public.operator_status, text) to authenticated;
grant execute on function public.admin_set_station_status(uuid, public.station_status, boolean) to authenticated;
grant execute on function public.admin_set_payout_status(uuid, public.payout_status, text) to authenticated;
grant execute on function public.report_review(uuid, text) to authenticated;
grant execute on function public.moderate_review(uuid, public.review_status) to authenticated;

revoke all on function public.create_booking(uuid, uuid, uuid, timestamptz, integer) from public;
revoke all on function public.cancel_booking(uuid, text) from public;
revoke all on function public.update_booking_status(uuid, public.booking_status, text) from public;
revoke all on function public.validate_booking_qr(text) from public;
revoke all on function public.request_payout(numeric, uuid) from public;
revoke all on function public.admin_set_user_suspended(uuid, boolean, text) from public;
revoke all on function public.admin_set_operator_status(uuid, public.operator_status, text) from public;
revoke all on function public.admin_set_station_status(uuid, public.station_status, boolean) from public;
revoke all on function public.admin_set_payout_status(uuid, public.payout_status, text) from public;
revoke all on function public.report_review(uuid, text) from public;
revoke all on function public.moderate_review(uuid, public.review_status) from public;

grant execute on function public.create_booking(uuid, uuid, uuid, timestamptz, integer) to authenticated;
grant execute on function public.cancel_booking(uuid, text) to authenticated;
grant execute on function public.update_booking_status(uuid, public.booking_status, text) to authenticated;
grant execute on function public.validate_booking_qr(text) to authenticated;
grant execute on function public.request_payout(numeric, uuid) to authenticated;
grant execute on function public.admin_set_user_suspended(uuid, boolean, text) to authenticated;
grant execute on function public.admin_set_operator_status(uuid, public.operator_status, text) to authenticated;
grant execute on function public.admin_set_station_status(uuid, public.station_status, boolean) to authenticated;
grant execute on function public.admin_set_payout_status(uuid, public.payout_status, text) to authenticated;
grant execute on function public.report_review(uuid, text) to authenticated;
grant execute on function public.moderate_review(uuid, public.review_status) to authenticated;
