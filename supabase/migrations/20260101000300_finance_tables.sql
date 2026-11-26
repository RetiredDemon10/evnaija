-- EV Naija — payments, refunds, payouts and financial ledger

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete restrict,
  reference text not null unique,
  paystack_reference text unique,
  amount numeric(12, 2) not null check (amount >= 0),
  currency char(3) not null default 'NGN',
  status public.payment_status not null default 'pending',
  channel public.payment_channel,
  gateway_response text,
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_booking_idx on public.payments (booking_id, created_at desc);
create index if not exists payments_customer_idx on public.payments (customer_id, created_at desc);
create index if not exists payments_status_idx on public.payments (status, created_at desc);

create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_type text not null,
  payload jsonb not null,
  processed boolean not null default false,
  error text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists payment_webhook_events_processed_idx on public.payment_webhook_events (processed, created_at);

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete restrict,
  booking_id uuid not null references public.bookings (id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  reason text not null,
  status public.refund_status not null default 'pending',
  paystack_refund_reference text,
  requested_by uuid references public.profiles (id) on delete set null,
  processed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists refunds_payment_idx on public.refunds (payment_id, created_at desc);
create index if not exists refunds_booking_idx on public.refunds (booking_id, created_at desc);
create index if not exists refunds_status_idx on public.refunds (status, created_at desc);

create table if not exists public.payout_accounts (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operator_profiles (id) on delete cascade,
  bank_name text not null,
  account_name text not null,
  account_number text not null,
  recipient_code text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists payout_accounts_operator_idx on public.payout_accounts (operator_id, created_at desc);
create unique index if not exists payout_accounts_one_default_idx on public.payout_accounts (operator_id) where is_default = true;

create table if not exists public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operator_profiles (id) on delete restrict,
  payout_account_id uuid not null references public.payout_accounts (id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  status public.payout_status not null default 'pending',
  notes text,
  admin_notes text,
  paystack_transfer_reference text,
  requested_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists payout_requests_operator_idx on public.payout_requests (operator_id, requested_at desc);
create index if not exists payout_requests_status_idx on public.payout_requests (status, requested_at);

create table if not exists public.financial_ledger (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings (id) on delete set null,
  payout_id uuid references public.payout_requests (id) on delete set null,
  operator_id uuid references public.operator_profiles (id) on delete set null,
  entry_type public.ledger_entry_type not null,
  amount numeric(12, 2) not null check (amount > 0),
  direction public.ledger_direction not null,
  description text not null,
  created_at timestamptz not null default now()
);

create index if not exists financial_ledger_operator_idx on public.financial_ledger (operator_id, created_at desc);
create index if not exists financial_ledger_booking_idx on public.financial_ledger (booking_id);
create index if not exists financial_ledger_payout_idx on public.financial_ledger (payout_id);

create table if not exists public.commission_settings (
  id uuid primary key default gen_random_uuid(),
  global_commission_percent numeric(5, 2) not null default 15 check (global_commission_percent between 0 and 100),
  service_fee_amount numeric(12, 2) not null default 500 check (service_fee_amount >= 0),
  vat_percent numeric(5, 2) not null default 7.5 check (vat_percent between 0 and 100),
  minimum_payout_amount numeric(12, 2) not null default 10000 check (minimum_payout_amount >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  tier public.subscription_tier not null unique,
  name text not null,
  price_monthly numeric(12, 2) not null check (price_monthly >= 0),
  max_stations integer not null check (max_stations > 0),
  features text[] not null default '{}'::text[],
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.operator_subscriptions (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operator_profiles (id) on delete cascade,
  plan_id uuid not null references public.subscription_plans (id) on delete restrict,
  status public.subscription_status not null default 'active',
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists operator_subscriptions_operator_idx on public.operator_subscriptions (operator_id, created_at desc);

create table if not exists public.promotional_listings (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references public.stations (id) on delete cascade,
  operator_id uuid not null references public.operator_profiles (id) on delete cascade,
  amount numeric(12, 2) not null check (amount >= 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.promotion_status not null default 'pending',
  placement public.promotion_placement not null default 'both',
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists promotional_listings_status_idx on public.promotional_listings (status, starts_at, ends_at);
create index if not exists promotional_listings_operator_idx on public.promotional_listings (operator_id, created_at desc);
