-- EV Naija — loyalty, referrals and price/availability alerts
--
-- Points are issued automatically when a booking is paid (see
-- `award_booking_loyalty`) and can be redeemed for account credit that is
-- applied to a future booking's platform fees via `apply_credit_to_booking`.
-- Reward credit is intentionally capped at the service fee + VAT so operator
-- earnings and platform commission on the charging fee are never reduced.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.loyalty_tier as enum ('bronze', 'silver', 'gold');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.loyalty_entry_type as enum ('earn', 'redeem', 'bonus', 'referral');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.referral_status as enum ('invited', 'joined', 'rewarded', 'expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.price_alert_kind as enum ('price_drop', 'availability');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.price_alert_status as enum ('active', 'triggered', 'cancelled');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Profile referral columns
-- ---------------------------------------------------------------------------

alter table public.profiles add column if not exists referral_code text;
alter table public.profiles add column if not exists referred_by uuid references public.profiles (id) on delete set null;

create unique index if not exists profiles_referral_code_key on public.profiles (upper(referral_code));

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.loyalty_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  points integer not null default 0 check (points >= 0),
  lifetime_points integer not null default 0 check (lifetime_points >= 0),
  tier public.loyalty_tier not null default 'bronze',
  credit_balance numeric(12, 2) not null default 0 check (credit_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  points integer not null,
  type public.loyalty_entry_type not null,
  description text not null default '',
  booking_id uuid references public.bookings (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists loyalty_transactions_user_idx on public.loyalty_transactions (user_id, created_at desc);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  referee_id uuid references public.profiles (id) on delete set null,
  code text not null,
  status public.referral_status not null default 'invited',
  referrer_points integer not null default 500,
  referee_points integer not null default 250,
  created_at timestamptz not null default now(),
  converted_at timestamptz
);

create index if not exists referrals_referrer_idx on public.referrals (referrer_id, created_at desc);
create unique index if not exists referrals_referee_unique on public.referrals (referee_id) where referee_id is not null;

create table if not exists public.price_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  station_id uuid not null references public.stations (id) on delete cascade,
  charger_id uuid references public.chargers (id) on delete cascade,
  kind public.price_alert_kind not null default 'price_drop',
  target_price numeric(12, 2),
  status public.price_alert_status not null default 'active',
  last_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists price_alerts_user_idx on public.price_alerts (user_id, created_at desc);
create unique index if not exists price_alerts_unique on public.price_alerts (
  user_id,
  station_id,
  coalesce(charger_id, '00000000-0000-0000-0000-000000000000'::uuid),
  kind
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.compute_loyalty_tier(p_lifetime integer)
returns public.loyalty_tier
language sql
immutable
as $$
  select case
    when coalesce(p_lifetime, 0) >= 2000 then 'gold'::public.loyalty_tier
    when coalesce(p_lifetime, 0) >= 500 then 'silver'::public.loyalty_tier
    else 'bronze'::public.loyalty_tier
  end;
$$;

-- Generate a referral code on signup and link the inviter captured at sign-up.
create or replace function public.prepare_profile_referral()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code text;
  v_referrer uuid;
begin
  if new.referral_code is null or new.referral_code = '' then
    new.referral_code := 'EVN' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  end if;

  if new.referred_by is null then
    begin
      select nullif(u.raw_user_meta_data ->> 'referral_code', '')
        into v_code
        from auth.users u
       where u.id = new.id;
    exception when others then
      v_code := null;
    end;

    if v_code is not null then
      select p.id into v_referrer
        from public.profiles p
       where upper(p.referral_code) = upper(v_code)
         and p.id <> new.id
       limit 1;
      if v_referrer is not null then
        new.referred_by := v_referrer;
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_prepare_referral on public.profiles;
create trigger profiles_prepare_referral
  before insert on public.profiles
  for each row execute function public.prepare_profile_referral();

-- Record the referral edge once the referee profile exists.
create or replace function public.record_referral()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code text;
begin
  if new.referred_by is null then
    return new;
  end if;
  select referral_code into v_code from public.profiles where id = new.referred_by;
  insert into public.referrals (referrer_id, referee_id, code, status)
  values (new.referred_by, new.id, coalesce(v_code, ''), 'joined')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists profiles_record_referral on public.profiles;
create trigger profiles_record_referral
  after insert on public.profiles
  for each row execute function public.record_referral();

-- Award loyalty points (and any pending referral bonus) when a booking is paid.
create or replace function public.award_booking_loyalty()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_points integer;
  v_referral public.referrals%rowtype;
  v_first boolean;
begin
  if new.payment_status = 'success' and old.payment_status is distinct from 'success' then
    v_points := floor(new.total_amount / 100)::integer;

    if v_points > 0 then
      insert into public.loyalty_accounts (user_id) values (new.customer_id)
        on conflict (user_id) do nothing;

      update public.loyalty_accounts
         set points = points + v_points,
             lifetime_points = lifetime_points + v_points,
             tier = public.compute_loyalty_tier(lifetime_points + v_points),
             updated_at = now()
       where user_id = new.customer_id;

      insert into public.loyalty_transactions (user_id, points, type, description, booking_id)
      values (new.customer_id, v_points, 'earn', 'Points for booking ' || coalesce(new.booking_reference, ''), new.id);
    end if;

    select count(*) = 1 into v_first
      from public.bookings b
     where b.customer_id = new.customer_id
       and b.payment_status = 'success';

    if v_first then
      select * into v_referral
        from public.referrals
       where referee_id = new.customer_id
         and status = 'joined'
       order by created_at
       limit 1;

      if found then
        insert into public.loyalty_accounts (user_id) values (v_referral.referrer_id)
          on conflict (user_id) do nothing;
        update public.loyalty_accounts
           set points = points + v_referral.referrer_points,
               lifetime_points = lifetime_points + v_referral.referrer_points,
               tier = public.compute_loyalty_tier(lifetime_points + v_referral.referrer_points),
               updated_at = now()
         where user_id = v_referral.referrer_id;
        insert into public.loyalty_transactions (user_id, points, type, description)
        values (v_referral.referrer_id, v_referral.referrer_points, 'referral', 'Referral bonus — your invite completed their first charge');

        insert into public.loyalty_accounts (user_id) values (new.customer_id)
          on conflict (user_id) do nothing;
        update public.loyalty_accounts
           set points = points + v_referral.referee_points,
               lifetime_points = lifetime_points + v_referral.referee_points,
               tier = public.compute_loyalty_tier(lifetime_points + v_referral.referee_points),
               updated_at = now()
         where user_id = new.customer_id;
        insert into public.loyalty_transactions (user_id, points, type, description)
        values (new.customer_id, v_referral.referee_points, 'referral', 'Welcome bonus — thanks for joining through a friend');

        update public.referrals set status = 'rewarded', converted_at = now() where id = v_referral.id;
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_award_loyalty on public.bookings;
create trigger bookings_award_loyalty
  after update on public.bookings
  for each row execute function public.award_booking_loyalty();

drop trigger if exists loyalty_accounts_set_updated_at on public.loyalty_accounts;
create trigger loyalty_accounts_set_updated_at
  before update on public.loyalty_accounts
  for each row execute function public.set_updated_at();

drop trigger if exists price_alerts_set_updated_at on public.price_alerts;
create trigger price_alerts_set_updated_at
  before update on public.price_alerts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Client-callable RPCs
-- ---------------------------------------------------------------------------

create or replace function public.ensure_referral_code()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_code text;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select referral_code into v_code from public.profiles where id = v_user;
  if v_code is not null and v_code <> '' then
    return v_code;
  end if;

  loop
    v_code := 'EVN' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    begin
      update public.profiles set referral_code = v_code, updated_at = now() where id = v_user;
      exit;
    exception when unique_violation then
      v_code := null;
    end;
  end loop;

  return v_code;
end;
$$;

create or replace function public.claim_referral(p_code text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_referrer uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;
  if p_code is null or p_code = '' then
    return;
  end if;

  select id into v_referrer
    from public.profiles
   where upper(referral_code) = upper(p_code)
     and id <> v_user
   limit 1;

  if v_referrer is null then
    return;
  end if;

  update public.profiles
     set referred_by = v_referrer, updated_at = now()
   where id = v_user and referred_by is null;

  insert into public.referrals (referrer_id, referee_id, code, status)
  select v_referrer, v_user, p.referral_code, 'joined'
    from public.profiles p
   where p.id = v_referrer
  on conflict do nothing;
end;
$$;

create or replace function public.redeem_loyalty_points(p_points integer)
returns public.loyalty_accounts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_account public.loyalty_accounts%rowtype;
  v_credit numeric(12, 2);
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;
  if p_points is null or p_points < 100 then
    raise exception 'Redeem at least 100 points';
  end if;

  select * into v_account from public.loyalty_accounts where user_id = v_user for update;
  if not found then
    raise exception 'No loyalty account found';
  end if;
  if v_account.points < p_points then
    raise exception 'Not enough points';
  end if;

  v_credit := p_points;

  update public.loyalty_accounts
     set points = points - p_points,
         credit_balance = credit_balance + v_credit,
         updated_at = now()
   where user_id = v_user
   returning * into v_account;

  insert into public.loyalty_transactions (user_id, points, type, description)
  values (v_user, -p_points, 'redeem', 'Redeemed ' || p_points || ' points for ₦' || to_char(v_credit, 'FM999999990') || ' booking credit');

  return v_account;
end;
$$;

create or replace function public.apply_credit_to_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_account public.loyalty_accounts%rowtype;
  v_apply numeric(12, 2);
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found';
  end if;
  if v_booking.customer_id <> v_user then
    raise exception 'This booking does not belong to you';
  end if;
  if v_booking.status <> 'pending_payment' then
    raise exception 'Reward credit can only be applied before payment';
  end if;

  select * into v_account from public.loyalty_accounts where user_id = v_user for update;
  if not found or v_account.credit_balance <= 0 then
    raise exception 'No reward credit available';
  end if;

  v_apply := least(v_account.credit_balance, v_booking.service_fee + v_booking.tax_amount, v_booking.total_amount);
  if v_apply <= 0 then
    raise exception 'No reward credit can be applied to this booking';
  end if;

  update public.bookings
     set discount_amount = coalesce(discount_amount, 0) + v_apply,
         total_amount = total_amount - v_apply,
         updated_at = now()
   where id = p_booking_id
   returning * into v_booking;

  update public.payments
     set amount = greatest(amount - v_apply, 0), updated_at = now()
   where booking_id = p_booking_id and status = 'pending';

  update public.loyalty_accounts
     set credit_balance = credit_balance - v_apply, updated_at = now()
   where user_id = v_user;

  insert into public.loyalty_transactions (user_id, points, type, description, booking_id)
  values (v_user, 0, 'redeem', 'Applied ₦' || to_char(v_apply, 'FM999999990.00') || ' reward credit to booking ' || coalesce(v_booking.booking_reference, ''), p_booking_id);

  return v_booking;
end;
$$;

grant execute on function public.ensure_referral_code() to authenticated;
grant execute on function public.claim_referral(text) to authenticated;
grant execute on function public.redeem_loyalty_points(integer) to authenticated;
grant execute on function public.apply_credit_to_booking(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.loyalty_accounts enable row level security;
alter table public.loyalty_transactions enable row level security;
alter table public.referrals enable row level security;
alter table public.price_alerts enable row level security;

create policy loyalty_accounts_select_own on public.loyalty_accounts
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy loyalty_transactions_select_own on public.loyalty_transactions
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy referrals_select_own on public.referrals
  for select to authenticated
  using (referrer_id = auth.uid() or referee_id = auth.uid() or public.is_admin());

create policy price_alerts_select_own on public.price_alerts
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy price_alerts_insert_own on public.price_alerts
  for insert to authenticated
  with check (user_id = auth.uid());

create policy price_alerts_update_own on public.price_alerts
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy price_alerts_delete_own on public.price_alerts
  for delete to authenticated
  using (user_id = auth.uid());
