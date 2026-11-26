-- EV Naija — row level security policies

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.vehicles enable row level security;
alter table public.operator_profiles enable row level security;
alter table public.operator_documents enable row level security;
alter table public.locations enable row level security;
alter table public.stations enable row level security;
alter table public.station_images enable row level security;
alter table public.chargers enable row level security;
alter table public.charger_connectors enable row level security;
alter table public.charger_availability enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_status_history enable row level security;
alter table public.payments enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.refunds enable row level security;
alter table public.reviews enable row level security;
alter table public.review_responses enable row level security;
alter table public.favorites enable row level security;
alter table public.notifications enable row level security;
alter table public.payout_accounts enable row level security;
alter table public.payout_requests enable row level security;
alter table public.financial_ledger enable row level security;
alter table public.commission_settings enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.operator_subscriptions enable row level security;
alter table public.promotional_listings enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.platform_settings enable row level security;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy profiles_select_admin on public.profiles
  for select to authenticated
  using (public.is_admin());

create policy profiles_select_operator_customers on public.profiles
  for select to authenticated
  using (
    public.current_operator_id() is not null
    and exists (
      select 1
        from public.bookings b
        join public.stations s on s.id = b.station_id
       where b.customer_id = profiles.id
         and s.operator_id = public.current_operator_id()
    )
  );

create policy profiles_update_own_or_admin on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------

create policy user_roles_select_own_or_admin on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy user_roles_admin_all on public.user_roles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Vehicles
-- ---------------------------------------------------------------------------

create policy vehicles_select_own_or_admin on public.vehicles
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or (
      public.current_operator_id() is not null
      and exists (
        select 1
          from public.bookings b
          join public.stations s on s.id = b.station_id
         where b.vehicle_id = vehicles.id
           and s.operator_id = public.current_operator_id()
      )
    )
  );

create policy vehicles_insert_own on public.vehicles
  for insert to authenticated
  with check (user_id = auth.uid());

create policy vehicles_update_own on public.vehicles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy vehicles_delete_own on public.vehicles
  for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Operator profiles and documents
-- ---------------------------------------------------------------------------

create policy operator_profiles_select_public on public.operator_profiles
  for select to anon, authenticated
  using (status = 'approved'::public.operator_status);

create policy operator_profiles_select_own on public.operator_profiles
  for select to authenticated
  using (user_id = auth.uid());

create policy operator_profiles_select_admin on public.operator_profiles
  for select to authenticated
  using (public.is_admin());

create policy operator_profiles_insert_own on public.operator_profiles
  for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending'::public.operator_status);

create policy operator_profiles_update_own_or_admin on public.operator_profiles
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy operator_profiles_delete_admin on public.operator_profiles
  for delete to authenticated
  using (public.is_admin());

create policy operator_documents_select_own_or_admin on public.operator_documents
  for select to authenticated
  using (operator_id = public.current_operator_id() or public.is_admin());

create policy operator_documents_insert_own on public.operator_documents
  for insert to authenticated
  with check (operator_id = public.current_operator_id());

create policy operator_documents_update_admin on public.operator_documents
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy operator_documents_delete_own_or_admin on public.operator_documents
  for delete to authenticated
  using (operator_id = public.current_operator_id() or public.is_admin());

-- Keep anonymous visitors from reading operator contact details directly.
revoke select on public.operator_profiles from anon;
grant select (
  id, business_name, owner_name, business_address, business_description,
  logo_url, status, created_at, updated_at
) on public.operator_profiles to anon;

-- ---------------------------------------------------------------------------
-- Locations
-- ---------------------------------------------------------------------------

create policy locations_select_public on public.locations
  for select to anon, authenticated
  using (is_active = true);

create policy locations_admin_all on public.locations
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Stations, images, chargers and availability
-- ---------------------------------------------------------------------------

create policy stations_select_public on public.stations
  for select to anon, authenticated
  using (status = 'approved'::public.station_status);

create policy stations_select_owner on public.stations
  for select to authenticated
  using (operator_id = public.current_operator_id());

create policy stations_select_admin on public.stations
  for select to authenticated
  using (public.is_admin());

create policy stations_insert_owner on public.stations
  for insert to authenticated
  with check (
    operator_id = public.current_operator_id()
    and status = 'pending'::public.station_status
  );

create policy stations_update_owner_or_admin on public.stations
  for update to authenticated
  using (operator_id = public.current_operator_id() or public.is_admin())
  with check (operator_id = public.current_operator_id() or public.is_admin());

create policy stations_delete_admin on public.stations
  for delete to authenticated
  using (public.is_admin());

create policy station_images_select on public.station_images
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.stations s
       where s.id = station_images.station_id
         and (s.status = 'approved'::public.station_status or s.operator_id = public.current_operator_id())
    )
    or public.is_admin()
  );

create policy station_images_insert_owner on public.station_images
  for insert to authenticated
  with check (
    exists (
      select 1 from public.stations s
       where s.id = station_images.station_id
         and s.operator_id = public.current_operator_id()
    )
    or public.is_admin()
  );

create policy station_images_update_owner on public.station_images
  for update to authenticated
  using (
    exists (
      select 1 from public.stations s
       where s.id = station_images.station_id
         and s.operator_id = public.current_operator_id()
    )
    or public.is_admin()
  )
  with check (
    exists (
      select 1 from public.stations s
       where s.id = station_images.station_id
         and s.operator_id = public.current_operator_id()
    )
    or public.is_admin()
  );

create policy station_images_delete_owner on public.station_images
  for delete to authenticated
  using (
    exists (
      select 1 from public.stations s
       where s.id = station_images.station_id
         and s.operator_id = public.current_operator_id()
    )
    or public.is_admin()
  );

create policy chargers_select on public.chargers
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.stations s
       where s.id = chargers.station_id
         and (s.status = 'approved'::public.station_status or s.operator_id = public.current_operator_id())
    )
    or public.is_admin()
  );

create policy chargers_insert_owner on public.chargers
  for insert to authenticated
  with check (
    exists (
      select 1 from public.stations s
       where s.id = chargers.station_id
         and s.operator_id = public.current_operator_id()
    )
    or public.is_admin()
  );

create policy chargers_update_owner on public.chargers
  for update to authenticated
  using (
    exists (
      select 1 from public.stations s
       where s.id = chargers.station_id
         and s.operator_id = public.current_operator_id()
    )
    or public.is_admin()
  )
  with check (
    exists (
      select 1 from public.stations s
       where s.id = chargers.station_id
         and s.operator_id = public.current_operator_id()
    )
    or public.is_admin()
  );

create policy chargers_delete_owner on public.chargers
  for delete to authenticated
  using (
    exists (
      select 1 from public.stations s
       where s.id = chargers.station_id
         and s.operator_id = public.current_operator_id()
    )
    or public.is_admin()
  );

create policy charger_connectors_select on public.charger_connectors
  for select to anon, authenticated
  using (
    exists (
      select 1
        from public.chargers c
        join public.stations s on s.id = c.station_id
       where c.id = charger_connectors.charger_id
         and (s.status = 'approved'::public.station_status or s.operator_id = public.current_operator_id())
    )
    or public.is_admin()
  );

create policy charger_connectors_write_owner on public.charger_connectors
  for all to authenticated
  using (
    exists (
      select 1
        from public.chargers c
        join public.stations s on s.id = c.station_id
       where c.id = charger_connectors.charger_id
         and s.operator_id = public.current_operator_id()
    )
    or public.is_admin()
  )
  with check (
    exists (
      select 1
        from public.chargers c
        join public.stations s on s.id = c.station_id
       where c.id = charger_connectors.charger_id
         and s.operator_id = public.current_operator_id()
    )
    or public.is_admin()
  );

create policy charger_availability_select on public.charger_availability
  for select to anon, authenticated
  using (
    exists (
      select 1
        from public.chargers c
        join public.stations s on s.id = c.station_id
       where c.id = charger_availability.charger_id
         and (s.status = 'approved'::public.station_status or s.operator_id = public.current_operator_id())
    )
    or public.is_admin()
  );

create policy charger_availability_write_owner on public.charger_availability
  for all to authenticated
  using (
    exists (
      select 1
        from public.chargers c
        join public.stations s on s.id = c.station_id
       where c.id = charger_availability.charger_id
         and s.operator_id = public.current_operator_id()
    )
    or public.is_admin()
  )
  with check (
    exists (
      select 1
        from public.chargers c
        join public.stations s on s.id = c.station_id
       where c.id = charger_availability.charger_id
         and s.operator_id = public.current_operator_id()
    )
    or public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- Bookings and payment records
-- ---------------------------------------------------------------------------

create policy bookings_select_customer on public.bookings
  for select to authenticated
  using (customer_id = auth.uid());

create policy bookings_select_operator on public.bookings
  for select to authenticated
  using (
    exists (
      select 1 from public.stations s
       where s.id = bookings.station_id
         and s.operator_id = public.current_operator_id()
    )
  );

create policy bookings_select_admin on public.bookings
  for select to authenticated
  using (public.is_admin());

create policy booking_history_select on public.booking_status_history
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.bookings b
       where b.id = booking_status_history.booking_id
         and (
           b.customer_id = auth.uid()
           or exists (
             select 1 from public.stations s
              where s.id = b.station_id
                and s.operator_id = public.current_operator_id()
           )
         )
    )
  );

create policy payments_select_customer on public.payments
  for select to authenticated
  using (customer_id = auth.uid());

create policy payments_select_operator on public.payments
  for select to authenticated
  using (
    exists (
      select 1
        from public.bookings b
        join public.stations s on s.id = b.station_id
       where b.id = payments.booking_id
         and s.operator_id = public.current_operator_id()
    )
  );

create policy payments_select_admin on public.payments
  for select to authenticated
  using (public.is_admin());

create policy payment_webhook_events_select_admin on public.payment_webhook_events
  for select to authenticated
  using (public.is_admin());

create policy refunds_select_customer on public.refunds
  for select to authenticated
  using (
    exists (
      select 1 from public.bookings b
       where b.id = refunds.booking_id
         and b.customer_id = auth.uid()
    )
  );

create policy refunds_select_operator on public.refunds
  for select to authenticated
  using (
    exists (
      select 1
        from public.bookings b
        join public.stations s on s.id = b.station_id
       where b.id = refunds.booking_id
         and s.operator_id = public.current_operator_id()
    )
  );

create policy refunds_select_admin on public.refunds
  for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Reviews, favourites and notifications
-- ---------------------------------------------------------------------------

create policy reviews_select_own on public.reviews
  for select to authenticated
  using (customer_id = auth.uid());

create policy reviews_select_operator on public.reviews
  for select to authenticated
  using (
    exists (
      select 1 from public.stations s
       where s.id = reviews.station_id
         and s.operator_id = public.current_operator_id()
    )
  );

create policy reviews_select_admin on public.reviews
  for select to authenticated
  using (public.is_admin());

create policy reviews_insert_own_booking on public.reviews
  for insert to authenticated
  with check (
    customer_id = auth.uid()
    and exists (
      select 1
        from public.bookings b
       where b.id = reviews.booking_id
         and b.customer_id = auth.uid()
         and b.station_id = reviews.station_id
         and b.status = 'completed'::public.booking_status
    )
  );

create policy reviews_update_admin on public.reviews
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy reviews_delete_admin on public.reviews
  for delete to authenticated
  using (public.is_admin());

create policy review_responses_select_operator on public.review_responses
  for select to authenticated
  using (operator_id = public.current_operator_id() or public.is_admin());

create policy review_responses_select_customer on public.review_responses
  for select to authenticated
  using (
    exists (
      select 1 from public.reviews r
       where r.id = review_responses.review_id
         and r.customer_id = auth.uid()
    )
  );

create policy review_responses_insert_operator on public.review_responses
  for insert to authenticated
  with check (
    public.is_admin()
    or (
      operator_id = public.current_operator_id()
      and exists (
        select 1
          from public.reviews r
          join public.stations s on s.id = r.station_id
         where r.id = review_responses.review_id
           and s.operator_id = public.current_operator_id()
      )
    )
  );

create policy review_responses_update_operator on public.review_responses
  for update to authenticated
  using (operator_id = public.current_operator_id() or public.is_admin())
  with check (operator_id = public.current_operator_id() or public.is_admin());

create policy review_responses_delete_operator on public.review_responses
  for delete to authenticated
  using (operator_id = public.current_operator_id() or public.is_admin());

create policy favorites_select_own on public.favorites
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy favorites_insert_own on public.favorites
  for insert to authenticated
  with check (user_id = auth.uid());

create policy favorites_update_own on public.favorites
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy favorites_delete_own on public.favorites
  for delete to authenticated
  using (user_id = auth.uid());

create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Payouts and finance
-- ---------------------------------------------------------------------------

create policy payout_accounts_select on public.payout_accounts
  for select to authenticated
  using (operator_id = public.current_operator_id() or public.is_admin());

create policy payout_accounts_insert_own on public.payout_accounts
  for insert to authenticated
  with check (operator_id = public.current_operator_id());

create policy payout_accounts_update_own on public.payout_accounts
  for update to authenticated
  using (operator_id = public.current_operator_id() or public.is_admin())
  with check (operator_id = public.current_operator_id() or public.is_admin());

create policy payout_accounts_delete_own on public.payout_accounts
  for delete to authenticated
  using (operator_id = public.current_operator_id() or public.is_admin());

create policy payout_requests_select on public.payout_requests
  for select to authenticated
  using (operator_id = public.current_operator_id() or public.is_admin());

create policy financial_ledger_select on public.financial_ledger
  for select to authenticated
  using (operator_id = public.current_operator_id() or public.is_admin());

create policy commission_settings_admin_all on public.commission_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Subscriptions and promotions
-- ---------------------------------------------------------------------------

create policy subscription_plans_select_public on public.subscription_plans
  for select to anon, authenticated
  using (is_active = true);

create policy subscription_plans_admin_all on public.subscription_plans
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy operator_subscriptions_select on public.operator_subscriptions
  for select to authenticated
  using (operator_id = public.current_operator_id() or public.is_admin());

create policy operator_subscriptions_admin_all on public.operator_subscriptions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy promotional_listings_select_public on public.promotional_listings
  for select to anon, authenticated
  using (status = 'active'::public.promotion_status);

create policy promotional_listings_select_operator on public.promotional_listings
  for select to authenticated
  using (operator_id = public.current_operator_id());

create policy promotional_listings_select_admin on public.promotional_listings
  for select to authenticated
  using (public.is_admin());

create policy promotional_listings_insert_operator on public.promotional_listings
  for insert to authenticated
  with check (operator_id = public.current_operator_id() and status = 'pending'::public.promotion_status);

create policy promotional_listings_admin_all on public.promotional_listings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Support
-- ---------------------------------------------------------------------------

create policy support_tickets_select on public.support_tickets
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy support_tickets_insert_own on public.support_tickets
  for insert to authenticated
  with check (user_id = auth.uid());

create policy support_tickets_update_admin on public.support_tickets
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy support_tickets_delete_admin on public.support_tickets
  for delete to authenticated
  using (public.is_admin());

create policy support_messages_select on public.support_messages
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.support_tickets t
       where t.id = support_messages.ticket_id
         and t.user_id = auth.uid()
    )
  );

create policy support_messages_insert on public.support_messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and (
      (
        is_staff = false
        and exists (
          select 1 from public.support_tickets t
           where t.id = support_messages.ticket_id
             and t.user_id = auth.uid()
        )
      )
      or (is_staff = true and public.is_admin())
    )
  );

create policy support_messages_update_admin on public.support_messages
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy support_messages_delete_admin on public.support_messages
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Audit and settings
-- ---------------------------------------------------------------------------

create policy admin_audit_logs_select_admin on public.admin_audit_logs
  for select to authenticated
  using (public.is_admin());

create policy admin_audit_logs_insert_admin on public.admin_audit_logs
  for insert to authenticated
  with check (public.is_admin() and admin_id = auth.uid());

create policy platform_settings_select_content on public.platform_settings
  for select to anon, authenticated
  using (
    key in (
      'hero_headline', 'hero_subheadline', 'homepage_announcement',
      'footer_tagline', 'support_email', 'support_phone',
      'social_instagram', 'social_x', 'social_linkedin'
    )
  );

create policy platform_settings_select_admin on public.platform_settings
  for select to authenticated
  using (public.is_admin());

create policy platform_settings_admin_all on public.platform_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
