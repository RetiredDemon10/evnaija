-- EV Naija — allow trusted triggers to update denormalised station stats
--
-- Station counts and rating columns are protected from client updates by
-- protect_station_fields(). The internal trigger functions recalculate those
-- columns while running as the authenticated actor, so they need an explicit
-- transaction-local marker to bypass the protection for their own UPDATE.

create or replace function public.protect_station_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin()
     and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and coalesce(current_setting('evnaija.internal_station_stats', true), 'off') <> 'on' then
    new.operator_id := old.operator_id;
    new.is_featured := old.is_featured;
    new.rating_average := old.rating_average;
    new.rating_count := old.rating_count;
    new.total_chargers := old.total_chargers;
    new.available_chargers := old.available_chargers;
    if new.status is distinct from old.status
       and not (old.status = 'rejected'::public.station_status and new.status = 'pending'::public.station_status) then
      new.status := old.status;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.refresh_station_charger_counts(p_station_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform set_config('evnaija.internal_station_stats', 'on', true);

  update public.stations s
     set total_chargers = (
           select count(*)::integer from public.chargers c where c.station_id = s.id
         ),
         available_chargers = (
           select count(*)::integer
             from public.chargers c
            where c.station_id = s.id
              and c.is_active = true
              and c.status = 'available'::public.charger_status
         )
   where s.id = p_station_id;

  perform set_config('evnaija.internal_station_stats', 'off', true);
end;
$$;

create or replace function public.refresh_station_rating(p_station_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform set_config('evnaija.internal_station_stats', 'on', true);

  update public.stations s
     set rating_average = coalesce((
           select round(avg(r.overall_rating)::numeric, 2)
             from public.reviews r
            where r.station_id = s.id
              and r.status = 'published'::public.review_status
         ), 0),
         rating_count = (
           select count(*)::integer
             from public.reviews r
            where r.station_id = s.id
              and r.status = 'published'::public.review_status
         )
   where s.id = p_station_id;

  perform set_config('evnaija.internal_station_stats', 'off', true);
end;
$$;
