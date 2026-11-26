-- EV Naija — stations, chargers, bookings, reviews and notifications

create table if not exists public.stations (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operator_profiles (id) on delete cascade,
  name text not null,
  slug text not null unique,
  description text,
  state text not null,
  city text not null,
  address text not null,
  latitude numeric(9, 6) not null check (latitude between -90 and 90),
  longitude numeric(9, 6) not null check (longitude between -180 and 180),
  google_maps_url text,
  contact_phone text,
  contact_email text,
  operating_hours text not null default '06:00 – 22:00',
  amenities text[] not null default '{}'::text[],
  status public.station_status not null default 'pending',
  is_featured boolean not null default false,
  rating_average numeric(3, 2) not null default 0 check (rating_average between 0 and 5),
  rating_count integer not null default 0 check (rating_count >= 0),
  total_chargers integer not null default 0 check (total_chargers >= 0),
  available_chargers integer not null default 0 check (available_chargers >= 0),
  cover_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stations_operator_idx on public.stations (operator_id, created_at desc);
create index if not exists stations_status_idx on public.stations (status, is_featured desc);
create index if not exists stations_city_idx on public.stations (state, city);
create index if not exists stations_name_trgm_idx on public.stations using gin (name gin_trgm_ops);
create index if not exists stations_location_idx on public.stations (latitude, longitude);

create table if not exists public.station_images (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references public.stations (id) on delete cascade,
  image_url text not null,
  alt_text text,
  is_cover boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists station_images_station_idx on public.station_images (station_id, sort_order);
create unique index if not exists station_images_one_cover_idx on public.station_images (station_id) where is_cover = true;

create table if not exists public.chargers (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references public.stations (id) on delete cascade,
  name text not null,
  charger_code text not null,
  connector_type public.connector_type not null,
  capacity_kw numeric(8, 2) not null check (capacity_kw > 0),
  speed_category public.charging_speed not null,
  connector_count integer not null default 1 check (connector_count between 1 and 20),
  price_per_kwh numeric(12, 2) not null check (price_per_kwh >= 0),
  booking_fee numeric(12, 2) not null default 0 check (booking_fee >= 0),
  status public.charger_status not null default 'available',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (station_id, charger_code)
);

create index if not exists chargers_station_idx on public.chargers (station_id, is_active);
create index if not exists chargers_status_idx on public.chargers (status) where is_active = true;

create table if not exists public.charger_connectors (
  id uuid primary key default gen_random_uuid(),
  charger_id uuid not null references public.chargers (id) on delete cascade,
  connector_number integer not null check (connector_number > 0),
  connector_type public.connector_type not null,
  status public.charger_status not null default 'available',
  created_at timestamptz not null default now(),
  unique (charger_id, connector_number)
);

create index if not exists charger_connectors_charger_idx on public.charger_connectors (charger_id);

create table if not exists public.charger_availability (
  id uuid primary key default gen_random_uuid(),
  charger_id uuid not null references public.chargers (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  opens_at time not null,
  closes_at time not null,
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (charger_id, day_of_week),
  check (is_closed or opens_at < closes_at)
);

create index if not exists charger_availability_charger_idx on public.charger_availability (charger_id);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_reference text not null unique,
  customer_id uuid not null references public.profiles (id) on delete restrict,
  station_id uuid not null references public.stations (id) on delete restrict,
  charger_id uuid not null references public.chargers (id) on delete restrict,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  duration_minutes integer not null check (duration_minutes between 15 and 720),
  energy_kwh numeric(10, 2) not null check (energy_kwh > 0),
  charging_fee numeric(12, 2) not null check (charging_fee >= 0),
  booking_fee numeric(12, 2) not null default 0 check (booking_fee >= 0),
  service_fee numeric(12, 2) not null default 0 check (service_fee >= 0),
  tax_amount numeric(12, 2) not null default 0 check (tax_amount >= 0),
  discount_amount numeric(12, 2) not null default 0 check (discount_amount >= 0),
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  platform_commission numeric(12, 2) not null default 0 check (platform_commission >= 0),
  operator_earning numeric(12, 2) not null default 0 check (operator_earning >= 0),
  status public.booking_status not null default 'pending_payment',
  payment_status public.payment_status not null default 'pending',
  qr_code text not null unique,
  hold_expires_at timestamptz,
  cancellation_reason text,
  cancelled_at timestamptz,
  checked_in_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

create index if not exists bookings_customer_idx on public.bookings (customer_id, start_time desc);
create index if not exists bookings_station_idx on public.bookings (station_id, start_time desc);
create index if not exists bookings_charger_window_idx on public.bookings (charger_id, start_time, end_time);
create index if not exists bookings_status_idx on public.bookings (status, start_time);
create index if not exists bookings_payment_idx on public.bookings (payment_status, created_at desc);
create index if not exists bookings_hold_idx on public.bookings (hold_expires_at) where status = 'pending_payment';

create table if not exists public.booking_status_history (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  status public.booking_status not null,
  notes text,
  changed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists booking_status_history_booking_idx on public.booking_status_history (booking_id, created_at);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete cascade,
  station_id uuid not null references public.stations (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  overall_rating smallint not null check (overall_rating between 1 and 5),
  charging_experience smallint not null check (charging_experience between 1 and 5),
  equipment_condition smallint not null check (equipment_condition between 1 and 5),
  customer_service smallint not null check (customer_service between 1 and 5),
  location_accessibility smallint not null check (location_accessibility between 1 and 5),
  comment text,
  photos text[] not null default '{}'::text[],
  status public.review_status not null default 'published',
  is_verified boolean not null default false,
  report_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reviews_station_idx on public.reviews (station_id, status, created_at desc);
create index if not exists reviews_customer_idx on public.reviews (customer_id, created_at desc);

create table if not exists public.review_responses (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null unique references public.reviews (id) on delete cascade,
  operator_id uuid not null references public.operator_profiles (id) on delete cascade,
  response text not null,
  created_at timestamptz not null default now()
);

create index if not exists review_responses_operator_idx on public.review_responses (operator_id);

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  station_id uuid not null references public.stations (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, station_id)
);

create index if not exists favorites_user_idx on public.favorites (user_id, created_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  message text not null,
  type public.notification_type not null default 'system',
  is_read boolean not null default false,
  link text,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, is_read, created_at desc);
