-- EV Naija — waitlist automation and recurring booking plans

-- ---------------------------------------------------------------------------
-- Recurring booking plans
-- ---------------------------------------------------------------------------

create table if not exists public.booking_series (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  station_id uuid not null references public.stations (id) on delete restrict,
  charger_id uuid not null references public.chargers (id) on delete restrict,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  frequency text not null check (frequency in ('weekly', 'biweekly', 'monthly')),
  duration_minutes integer not null check (duration_minutes between 15 and 720),
  start_time timestamptz not null,
  next_start_time timestamptz not null,
  occurrences integer not null check (occurrences between 2 and 12),
  bookings_created integer not null default 1 check (bookings_created between 1 and occurrences),
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booking_series_customer_idx
  on public.booking_series (customer_id, created_at desc);
create index if not exists booking_series_station_idx
  on public.booking_series (station_id, status);

alter table public.bookings
  add column if not exists series_id uuid references public.booking_series (id) on delete set null;

create index if not exists bookings_series_idx
  on public.bookings (series_id, start_time)
  where series_id is not null;

-- ---------------------------------------------------------------------------
-- Station waitlist
-- ---------------------------------------------------------------------------

create table if not exists public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  station_id uuid not null references public.stations (id) on delete cascade,
  charger_id uuid references public.chargers (id) on delete set null,
  desired_date date not null,
  preferred_start time,
  status text not null default 'pending' check (status in ('pending', 'notified', 'converted', 'cancelled')),
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists waitlist_entries_user_idx
  on public.waitlist_entries (user_id, created_at desc);
create index if not exists waitlist_entries_station_idx
  on public.waitlist_entries (station_id, desired_date, status);
create unique index if not exists waitlist_entries_active_unique
  on public.waitlist_entries (
    user_id,
    station_id,
    coalesce(charger_id, '00000000-0000-0000-0000-000000000000'::uuid),
    desired_date
  )
  where status in ('pending', 'notified');

drop trigger if exists booking_series_set_updated_at on public.booking_series;
create trigger booking_series_set_updated_at before update on public.booking_series
  for each row execute function public.set_updated_at();

drop trigger if exists waitlist_entries_set_updated_at on public.waitlist_entries;
create trigger waitlist_entries_set_updated_at before update on public.waitlist_entries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.booking_series enable row level security;
alter table public.waitlist_entries enable row level security;

create policy booking_series_select_own on public.booking_series
  for select to authenticated
  using (customer_id = auth.uid());

create policy booking_series_select_operator on public.booking_series
  for select to authenticated
  using (
    public.current_operator_id() is not null
    and exists (
      select 1 from public.stations s
       where s.id = booking_series.station_id
         and s.operator_id = public.current_operator_id()
    )
  );

create policy booking_series_select_admin on public.booking_series
  for select to authenticated
  using (public.is_admin());

create policy waitlist_entries_select_own on public.waitlist_entries
  for select to authenticated
  using (user_id = auth.uid());

create policy waitlist_entries_select_operator on public.waitlist_entries
  for select to authenticated
  using (
    public.current_operator_id() is not null
    and exists (
      select 1 from public.stations s
       where s.id = waitlist_entries.station_id
         and s.operator_id = public.current_operator_id()
    )
  );

create policy waitlist_entries_select_admin on public.waitlist_entries
  for select to authenticated
  using (public.is_admin());

grant select on public.booking_series to authenticated;
grant select on public.waitlist_entries to authenticated;
grant all on public.booking_series to service_role;
grant all on public.waitlist_entries to service_role;

-- ---------------------------------------------------------------------------
-- Recurrence helper
-- ---------------------------------------------------------------------------

create or replace function public.next_booking_series_time(
  p_start timestamptz,
  p_frequency text,
  p_offset integer
)
returns timestamptz
language sql
immutable
as $$
  select case p_frequency
    when 'weekly' then p_start + make_interval(days => 7 * greatest(p_offset, 0))
    when 'biweekly' then p_start + make_interval(days => 14 * greatest(p_offset, 0))
    when 'monthly' then p_start + make_interval(months => greatest(p_offset, 0))
    else p_start
  end;
$$;

-- ---------------------------------------------------------------------------
-- Create a recurring plan plus its first held booking
-- ---------------------------------------------------------------------------

create or replace function public.create_booking_series(
  p_station_id uuid,
  p_charger_id uuid,
  p_vehicle_id uuid,
  p_start_time timestamptz,
  p_duration_minutes integer,
  p_frequency text,
  p_occurrences integer
)
returns public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_series public.booking_series%rowtype;
begin
  if v_user is null then
    raise exception 'You must be signed in to create a recurring plan.';
  end if;

  if p_frequency not in ('weekly', 'biweekly', 'monthly') then
    raise exception 'Choose a valid recurring frequency.';
  end if;

  if p_occurrences is null or p_occurrences < 2 or p_occurrences > 12 then
    raise exception 'A recurring plan must include between 2 and 12 sessions.';
  end if;

  if (
    select count(*)
      from public.booking_series
     where customer_id = v_user
       and status = 'active'
  ) >= 10 then
    raise exception 'You already have 10 active recurring plans. Stop one before creating another.';
  end if;

  -- create_booking enforces station approval, availability, conflicts, account
  -- suspension, operating hours and the maximum active booking rule.
  v_booking := public.create_booking(
    p_station_id,
    p_charger_id,
    p_vehicle_id,
    p_start_time,
    p_duration_minutes
  );

  insert into public.booking_series (
    customer_id, station_id, charger_id, vehicle_id, frequency,
    duration_minutes, start_time, next_start_time, occurrences,
    bookings_created, status
  ) values (
    v_user, p_station_id, p_charger_id, p_vehicle_id, p_frequency,
    p_duration_minutes, v_booking.start_time,
    public.next_booking_series_time(v_booking.start_time, p_frequency, 1),
    p_occurrences, 1, 'active'
  )
  returning * into v_series;

  update public.bookings
     set series_id = v_series.id
   where id = v_booking.id
  returning * into v_booking;

  insert into public.notifications (user_id, title, message, type, link)
  values (
    v_user,
    'Recurring plan created',
    format(
      'Your %s plan is ready. We created the first booking; reserve each next session from My bookings.',
      p_frequency
    ),
    'booking',
    '/app/bookings'
  );

  return v_booking;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reserve the next session in an active recurring plan
-- ---------------------------------------------------------------------------

create or replace function public.book_next_series_occurrence(p_series_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_series public.booking_series%rowtype;
  v_booking public.bookings%rowtype;
  v_next timestamptz;
  v_created integer;
  v_index integer := 0;
begin
  if v_user is null then
    raise exception 'You must be signed in to reserve a recurring session.';
  end if;

  select * into v_series
    from public.booking_series
   where id = p_series_id
     and customer_id = v_user
   for update;

  if not found then
    raise exception 'Recurring plan not found.';
  end if;

  if v_series.status <> 'active' then
    raise exception 'This recurring plan is not active.';
  end if;

  if v_series.bookings_created >= v_series.occurrences then
    update public.booking_series
       set status = 'completed', updated_at = now()
     where id = v_series.id;
    raise exception 'All sessions in this recurring plan have been created.';
  end if;

  v_created := v_series.bookings_created;

  -- Recover the occurrence index from the stored next timestamp, then skip
  -- past slots if the customer waited. This keeps bookings_created an honest
  -- count of real bookings even when occurrences are skipped.
  while v_index < v_series.occurrences - 1
        and public.next_booking_series_time(v_series.start_time, v_series.frequency, v_index) < v_series.next_start_time loop
    v_index := v_index + 1;
  end loop;

  while v_index < v_series.occurrences - 1
        and public.next_booking_series_time(v_series.start_time, v_series.frequency, v_index) < now() - interval '1 minute' loop
    v_index := v_index + 1;
  end loop;

  v_next := public.next_booking_series_time(v_series.start_time, v_series.frequency, v_index);

  if v_next < now() - interval '1 minute' then
    update public.booking_series
       set status = 'completed', updated_at = now()
     where id = v_series.id;
    raise exception 'All sessions in this recurring plan have passed.';
  end if;

  v_booking := public.create_booking(
    v_series.station_id,
    v_series.charger_id,
    v_series.vehicle_id,
    v_next,
    v_series.duration_minutes
  );

  update public.bookings
     set series_id = v_series.id
   where id = v_booking.id
  returning * into v_booking;

  v_created := v_created + 1;

  update public.booking_series
     set bookings_created = v_created,
         next_start_time = public.next_booking_series_time(v_series.start_time, v_series.frequency, v_index + 1),
         status = case
           when v_created >= v_series.occurrences or v_index + 1 >= v_series.occurrences then 'completed'
           else v_series.status
         end,
         updated_at = now()
   where id = v_series.id;

  insert into public.notifications (user_id, title, message, type, link)
  values (
    v_user,
    'Next recurring session booked',
    format('We created your next session at %s. Complete payment to confirm it.', 
      (select s.name from public.stations s where s.id = v_series.station_id)
    ),
    'booking',
    '/app/bookings/' || v_booking.id
  );

  return v_booking;
end;
$$;

create or replace function public.cancel_booking_series(p_series_id uuid)
returns public.booking_series
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_series public.booking_series%rowtype;
begin
  if v_user is null then
    raise exception 'You must be signed in to stop a recurring plan.';
  end if;

  select * into v_series
    from public.booking_series
   where id = p_series_id
     and (customer_id = v_user or public.is_admin())
   for update;

  if not found then
    raise exception 'Recurring plan not found.';
  end if;

  update public.booking_series
     set status = 'cancelled', updated_at = now()
   where id = v_series.id
  returning * into v_series;

  -- Release unpaid holds that belong to the plan. Confirmed or paid bookings
  -- are intentionally left untouched and must be cancelled by the customer.
  update public.bookings
     set status = 'cancelled',
         cancellation_reason = 'Recurring plan stopped by customer.',
         cancelled_at = now()
   where series_id = v_series.id
     and status = 'pending_payment';

  return v_series;
end;
$$;

-- ---------------------------------------------------------------------------
-- Join / leave waitlist
-- ---------------------------------------------------------------------------

create or replace function public.join_waitlist(
  p_station_id uuid,
  p_charger_id uuid,
  p_desired_date date,
  p_preferred_start time default null
)
returns public.waitlist_entries
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_entry public.waitlist_entries%rowtype;
begin
  if v_user is null then
    raise exception 'You must be signed in to join a waitlist.';
  end if;

  if p_desired_date is null or p_desired_date < current_date then
    raise exception 'Choose today or a future date for the waitlist.';
  end if;

  if not exists (
    select 1 from public.stations
     where id = p_station_id
       and status = 'approved'
  ) then
    raise exception 'This station is not accepting waitlist requests.';
  end if;

  if p_charger_id is not null and not exists (
    select 1 from public.chargers
     where id = p_charger_id
       and station_id = p_station_id
       and is_active = true
  ) then
    raise exception 'That charger does not belong to this station.';
  end if;

  select * into v_entry
    from public.waitlist_entries
   where user_id = v_user
     and station_id = p_station_id
     and coalesce(charger_id, '00000000-0000-0000-0000-000000000000'::uuid)
         = coalesce(p_charger_id, '00000000-0000-0000-0000-000000000000'::uuid)
     and desired_date = p_desired_date
     and status in ('pending', 'notified')
   limit 1;

  if found then
    return v_entry;
  end if;

  if (
    select count(*)
      from public.waitlist_entries
     where user_id = v_user
       and status in ('pending', 'notified')
  ) >= 25 then
    raise exception 'You already have 25 active waitlist requests. Leave one before adding another.';
  end if;

  insert into public.waitlist_entries (
    user_id, station_id, charger_id, desired_date, preferred_start
  ) values (
    v_user, p_station_id, p_charger_id, p_desired_date, p_preferred_start
  )
  returning * into v_entry;

  return v_entry;
end;
$$;

create or replace function public.leave_waitlist(p_waitlist_id uuid)
returns public.waitlist_entries
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_entry public.waitlist_entries%rowtype;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to leave a waitlist.';
  end if;

  update public.waitlist_entries
     set status = 'cancelled', updated_at = now()
   where id = p_waitlist_id
     and (user_id = auth.uid() or public.is_admin())
     and status in ('pending', 'notified')
  returning * into v_entry;

  if not found then
    raise exception 'Waitlist entry not found or already closed.';
  end if;

  return v_entry;
end;
$$;

-- ---------------------------------------------------------------------------
-- Convert a waitlist entry when the customer books the matching slot
-- ---------------------------------------------------------------------------

create or replace function public.mark_waitlist_converted()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.waitlist_entries
     set status = 'converted', updated_at = now()
   where user_id = new.customer_id
     and station_id = new.station_id
     and desired_date = (new.start_time at time zone 'Africa/Lagos')::date
     and status in ('pending', 'notified')
     and (charger_id is null or charger_id = new.charger_id);
  return new;
end;
$$;

drop trigger if exists bookings_mark_waitlist_converted on public.bookings;
create trigger bookings_mark_waitlist_converted
  after insert on public.bookings
  for each row execute function public.mark_waitlist_converted();

-- ---------------------------------------------------------------------------
-- Notify waitlisted drivers when a held or confirmed slot is released
-- ---------------------------------------------------------------------------

create or replace function public.notify_waitlist_on_release()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_station public.stations%rowtype;
  v_date date;
  v_entry public.waitlist_entries%rowtype;
begin
  if new.status = old.status then
    return new;
  end if;

  if new.status not in ('cancelled', 'expired') then
    return new;
  end if;

  v_date := (new.start_time at time zone 'Africa/Lagos')::date;
  if v_date < current_date then
    return new;
  end if;

  select * into v_station from public.stations where id = new.station_id;
  if not found then
    return new;
  end if;

  for v_entry in
    select *
      from public.waitlist_entries
     where station_id = new.station_id
       and status = 'pending'
       and desired_date = v_date
       and (charger_id is null or charger_id = new.charger_id)
     for update skip locked
  loop
    update public.waitlist_entries
       set status = 'notified', notified_at = now(), updated_at = now()
     where id = v_entry.id;

    insert into public.notifications (user_id, title, message, type, link)
    values (
      v_entry.user_id,
      'A charger just opened up',
      format('%s now has an opening on %s. Book before another driver takes it.',
        v_station.name, to_char(v_date, 'DD Mon YYYY')),
      'booking',
      '/app/bookings/new/' || new.station_id
        || '?charger=' || coalesce(v_entry.charger_id::text, new.charger_id::text)
        || '&date=' || to_char(v_date, 'YYYY-MM-DD')
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists bookings_notify_waitlist on public.bookings;
create trigger bookings_notify_waitlist
  after update of status on public.bookings
  for each row execute function public.notify_waitlist_on_release();

-- ---------------------------------------------------------------------------
-- RPC grants
-- ---------------------------------------------------------------------------

revoke all on function public.create_booking_series(uuid, uuid, uuid, timestamptz, integer, text, integer) from public;
revoke all on function public.book_next_series_occurrence(uuid) from public;
revoke all on function public.cancel_booking_series(uuid) from public;
revoke all on function public.join_waitlist(uuid, uuid, date, time) from public;
revoke all on function public.leave_waitlist(uuid) from public;
revoke all on function public.next_booking_series_time(timestamptz, text, integer) from public;

grant execute on function public.create_booking_series(uuid, uuid, uuid, timestamptz, integer, text, integer) to authenticated, service_role;
grant execute on function public.book_next_series_occurrence(uuid) to authenticated, service_role;
grant execute on function public.cancel_booking_series(uuid) to authenticated, service_role;
grant execute on function public.join_waitlist(uuid, uuid, date, time) to authenticated, service_role;
grant execute on function public.leave_waitlist(uuid) to authenticated, service_role;
grant execute on function public.next_booking_series_time(timestamptz, text, integer) to authenticated, service_role;
