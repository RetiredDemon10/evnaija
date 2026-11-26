-- EV Naija — extensions and enum types
-- Run order: 20260101000000 → 20260101000800

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('customer', 'operator', 'admin');
  end if;
  if not exists (select 1 from pg_type where typname = 'operator_status') then
    create type public.operator_status as enum ('pending', 'approved', 'rejected', 'suspended');
  end if;
  if not exists (select 1 from pg_type where typname = 'station_status') then
    create type public.station_status as enum ('pending', 'approved', 'rejected', 'suspended');
  end if;
  if not exists (select 1 from pg_type where typname = 'charger_status') then
    create type public.charger_status as enum ('available', 'reserved', 'charging', 'offline', 'maintenance');
  end if;
  if not exists (select 1 from pg_type where typname = 'connector_type') then
    create type public.connector_type as enum ('type2', 'ccs2', 'chademo', 'gbt');
  end if;
  if not exists (select 1 from pg_type where typname = 'charging_speed') then
    create type public.charging_speed as enum ('slow', 'fast', 'rapid', 'ultra');
  end if;
  if not exists (select 1 from pg_type where typname = 'booking_status') then
    create type public.booking_status as enum (
      'pending_payment', 'confirmed', 'checked_in', 'in_progress',
      'completed', 'cancelled', 'expired', 'refunded'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type public.payment_status as enum ('pending', 'success', 'failed', 'abandoned', 'reversed');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_channel') then
    create type public.payment_channel as enum ('card', 'bank_transfer', 'ussd', 'mobile_money', 'wallet', 'paystack');
  end if;
  if not exists (select 1 from pg_type where typname = 'payout_status') then
    create type public.payout_status as enum ('pending', 'approved', 'processing', 'paid', 'rejected');
  end if;
  if not exists (select 1 from pg_type where typname = 'document_type') then
    create type public.document_type as enum ('business_registration', 'identification', 'proof_of_ownership', 'station_photo');
  end if;
  if not exists (select 1 from pg_type where typname = 'document_status') then
    create type public.document_status as enum ('pending', 'verified', 'rejected');
  end if;
  if not exists (select 1 from pg_type where typname = 'review_status') then
    create type public.review_status as enum ('published', 'reported', 'hidden');
  end if;
  if not exists (select 1 from pg_type where typname = 'ticket_status') then
    create type public.ticket_status as enum ('open', 'pending', 'resolved', 'closed');
  end if;
  if not exists (select 1 from pg_type where typname = 'ticket_priority') then
    create type public.ticket_priority as enum ('low', 'medium', 'high', 'urgent');
  end if;
  if not exists (select 1 from pg_type where typname = 'subscription_tier') then
    create type public.subscription_tier as enum ('starter', 'professional', 'enterprise');
  end if;
  if not exists (select 1 from pg_type where typname = 'subscription_status') then
    create type public.subscription_status as enum ('active', 'cancelled', 'expired');
  end if;
  if not exists (select 1 from pg_type where typname = 'refund_status') then
    create type public.refund_status as enum ('pending', 'processing', 'completed', 'failed');
  end if;
  if not exists (select 1 from pg_type where typname = 'ledger_entry_type') then
    create type public.ledger_entry_type as enum (
      'booking_payment', 'platform_commission', 'operator_earning',
      'service_fee', 'tax', 'refund', 'payout', 'subscription', 'promotion'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'ledger_direction') then
    create type public.ledger_direction as enum ('credit', 'debit');
  end if;
  if not exists (select 1 from pg_type where typname = 'promotion_status') then
    create type public.promotion_status as enum ('pending', 'active', 'expired', 'rejected');
  end if;
  if not exists (select 1 from pg_type where typname = 'promotion_placement') then
    create type public.promotion_placement as enum ('homepage', 'search', 'both');
  end if;
  if not exists (select 1 from pg_type where typname = 'notification_type') then
    create type public.notification_type as enum ('booking', 'payment', 'account', 'system', 'review', 'payout');
  end if;
end $$;
