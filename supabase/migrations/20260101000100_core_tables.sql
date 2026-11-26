-- EV Naija — identity, operator and location tables

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null unique,
  phone text,
  avatar_url text,
  home_address text,
  preferred_city text,
  preferred_state text,
  is_suspended boolean not null default false,
  suspended_reason text,
  notification_preferences jsonb not null default '{"email": true, "sms": false, "push": true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_created_at_idx on public.profiles (created_at desc);
create index if not exists profiles_suspended_idx on public.profiles (is_suspended) where is_suspended = true;
create index if not exists profiles_name_trgm_idx on public.profiles using gin (full_name gin_trgm_ops);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create index if not exists user_roles_role_idx on public.user_roles (role);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  manufacturer text not null,
  model text not null,
  year integer not null check (year between 1990 and 2100),
  registration_number text,
  battery_capacity_kwh numeric(8, 2) not null check (battery_capacity_kwh > 0),
  connector_type public.connector_type not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vehicles_user_idx on public.vehicles (user_id, created_at desc);
create unique index if not exists vehicles_one_primary_idx on public.vehicles (user_id) where is_primary = true;

create table if not exists public.operator_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  business_name text not null,
  owner_name text not null,
  email text not null,
  phone text not null,
  business_address text not null default '',
  business_registration_number text,
  business_description text,
  logo_url text,
  status public.operator_status not null default 'pending',
  rejection_reason text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists operator_profiles_status_idx on public.operator_profiles (status);
create index if not exists operator_profiles_created_idx on public.operator_profiles (created_at desc);

create table if not exists public.operator_documents (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operator_profiles (id) on delete cascade,
  document_type public.document_type not null,
  file_url text not null,
  file_name text not null,
  status public.document_status not null default 'pending',
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists operator_documents_operator_idx on public.operator_documents (operator_id, created_at desc);

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  state text not null,
  city text not null,
  slug text not null unique,
  latitude numeric(9, 6) not null check (latitude between -90 and 90),
  longitude numeric(9, 6) not null check (longitude between -180 and 180),
  is_active boolean not null default true,
  hero_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (state, city)
);

create index if not exists locations_active_idx on public.locations (is_active, state, city);
