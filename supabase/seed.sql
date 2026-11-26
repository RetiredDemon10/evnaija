-- EV Naija — baseline configuration seed
-- Safe to re-run: existing rows are left untouched.

insert into public.platform_settings (key, value, description)
values
  ('hero_headline', '{"value": "Power your journey. Charge without limits."}'::jsonb, 'Homepage hero headline'),
  ('hero_subheadline', '{"value": "Discover reliable EV charging stations across Nigeria. Find a charger, reserve your spot and get back on the road with confidence."}'::jsonb, 'Homepage hero supporting copy'),
  ('homepage_announcement', '{"value": ""}'::jsonb, 'Optional homepage announcement (leave blank to hide)'),
  ('footer_tagline', '{"value": "Nigeria’s premium EV charging marketplace. Discover verified stations, reserve your charger and pay securely — from Lagos to Abuja and Port Harcourt."}'::jsonb, 'Footer brand description'),
  ('support_email', '{"value": "support@evnaija.ng"}'::jsonb, 'Public support email'),
  ('support_phone', '{"value": "+234 800 000 0000"}'::jsonb, 'Public support phone'),
  ('social_instagram', '{"value": "https://instagram.com/evnaija"}'::jsonb, 'Instagram profile URL'),
  ('social_x', '{"value": "https://x.com/evnaija"}'::jsonb, 'X profile URL'),
  ('social_linkedin', '{"value": "https://linkedin.com/company/evnaija"}'::jsonb, 'LinkedIn company URL'),
  ('booking_hold_minutes', '{"value": 15}'::jsonb, 'Minutes a pending-payment booking holds a charger'),
  ('cancellation_window_hours', '{"value": 24}'::jsonb, 'Free cancellation window before the booking starts'),
  ('max_active_bookings_per_user', '{"value": 3}'::jsonb, 'Maximum concurrent bookings per customer'),
  ('review_moderation_required', '{"value": false}'::jsonb, 'Hide new reviews until an admin approves them'),
  ('maintenance_mode', '{"value": false}'::jsonb, 'Pause new bookings while maintenance is carried out')
on conflict (key) do nothing;

insert into public.commission_settings (
  global_commission_percent, service_fee_amount, vat_percent, minimum_payout_amount
)
select 15, 500, 7.5, 10000
where not exists (select 1 from public.commission_settings);

insert into public.locations (state, city, slug, latitude, longitude, is_active)
values
  ('Lagos', 'Lekki', 'lekki', 6.4698, 3.5852, true),
  ('Lagos', 'Victoria Island', 'victoria-island', 6.4281, 3.4219, true),
  ('Lagos', 'Ikeja', 'ikeja', 6.6018, 3.3515, true),
  ('FCT', 'Abuja', 'abuja', 9.0765, 7.3986, true),
  ('Rivers', 'Port Harcourt', 'port-harcourt', 4.8156, 7.0498, true)
on conflict (slug) do nothing;

insert into public.subscription_plans (tier, name, price_monthly, max_stations, features, is_active)
values
  ('starter', 'Starter', 0, 1, array['1 station', 'Standard marketplace listing', 'Email support'], true),
  ('professional', 'Professional', 25000, 5, array['5 stations', 'Priority search placement', 'Advanced analytics', 'Priority support'], true),
  ('enterprise', 'Enterprise', 75000, 25, array['25 stations', 'Featured placement credits', 'Dedicated account manager', 'Custom reporting'], true)
on conflict (tier) do nothing;
