-- EV Naija — multi-channel notification delivery log and defaults
--
-- The `send-notification` edge function writes one row per channel per
-- recipient here. Channels whose provider secrets are not configured are
-- recorded with status 'skipped' so operators can see exactly what was and was
-- not delivered — we never report a message as sent when it was not.

do $$ begin
  create type public.notification_channel as enum ('email', 'sms', 'whatsapp');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_delivery_status as enum ('sent', 'skipped', 'failed');
exception when duplicate_object then null; end $$;

create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  channel public.notification_channel not null,
  title text not null default '',
  status public.notification_delivery_status not null,
  provider text,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists notification_log_user_idx on public.notification_log (user_id, created_at desc);
create index if not exists notification_log_status_idx on public.notification_log (status, created_at desc);

alter table public.notification_log enable row level security;

create policy notification_log_select_own on public.notification_log
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Sender identities and per-channel switches, editable from Admin → Settings.
insert into public.platform_settings (key, value, description) values
  ('notification_email_enabled', '{"value": true}'::jsonb, 'Send transactional email through Resend'),
  ('notification_sms_enabled', '{"value": true}'::jsonb, 'Send transactional SMS through Termii'),
  ('notification_whatsapp_enabled', '{"value": false}'::jsonb, 'Send transactional WhatsApp messages through Meta Cloud API'),
  ('notification_email_from_name', '{"value": "EV Naija"}'::jsonb, 'Display name on outbound email'),
  ('notification_email_from_address', '{"value": "notifications@evnaija.ng"}'::jsonb, 'From address on outbound email'),
  ('notification_sms_sender_id', '{"value": "EVNaija"}'::jsonb, 'Alphanumeric sender ID for SMS'),
  ('notification_whatsapp_sender', '{"value": ""}'::jsonb, 'WhatsApp Cloud API phone number ID')
on conflict (key) do nothing;
