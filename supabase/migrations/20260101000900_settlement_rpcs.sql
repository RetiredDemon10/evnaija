-- EV Naija — atomic payment, refund and payout settlement
-- These functions are callable only by the service role from edge functions.

alter table public.financial_ledger
  add column if not exists refund_id uuid references public.refunds (id) on delete set null;

create index if not exists financial_ledger_refund_idx on public.financial_ledger (refund_id);

create or replace function public.settle_payment(
  p_reference text,
  p_paystack_reference text,
  p_amount numeric,
  p_currency text,
  p_channel public.payment_channel,
  p_gateway_response text,
  p_paid_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.payments%rowtype;
  v_booking public.bookings%rowtype;
  v_station public.stations%rowtype;
  v_confirmed boolean := false;
  v_refund_requested boolean := false;
  v_hold_valid boolean := false;
  v_overlap boolean := false;
begin
  select * into v_payment from public.payments where reference = p_reference for update;
  if not found then
    raise exception 'Payment record not found for reference %.', p_reference;
  end if;

  select * into v_booking from public.bookings where id = v_payment.booking_id for update;
  if not found then
    raise exception 'Booking not found for payment %.', p_reference;
  end if;

  if v_payment.status = 'success'::public.payment_status then
    return jsonb_build_object(
      'success', true,
      'already_settled', true,
      'message', 'Payment was already settled.',
      'payment', to_jsonb(v_payment),
      'booking', to_jsonb(v_booking)
    );
  end if;

  if p_amount is null or p_amount + 0.01 < v_payment.amount then
    raise exception 'Verified amount ₦% does not match the expected ₦%.', p_amount, v_payment.amount;
  end if;

  if upper(coalesce(p_currency, v_payment.currency)) <> upper(v_payment.currency) then
    raise exception 'Currency mismatch for payment %.', p_reference;
  end if;

  update public.payments
     set status = 'success'::public.payment_status,
         paystack_reference = coalesce(p_paystack_reference, paystack_reference),
         channel = coalesce(p_channel, channel),
         gateway_response = coalesce(p_gateway_response, gateway_response),
         paid_at = coalesce(p_paid_at, now())
   where id = v_payment.id
  returning * into v_payment;

  perform pg_advisory_xact_lock(hashtextextended(v_booking.charger_id::text, 0));

  if v_booking.status = 'pending_payment'::public.booking_status then
    v_hold_valid := v_booking.hold_expires_at is null or v_booking.hold_expires_at >= now();

    select exists (
      select 1
        from public.bookings b
       where b.charger_id = v_booking.charger_id
         and b.id <> v_booking.id
         and b.status in (
           'confirmed'::public.booking_status,
           'checked_in'::public.booking_status,
           'in_progress'::public.booking_status
         )
         and b.start_time < v_booking.end_time
         and b.end_time > v_booking.start_time
    ) into v_overlap;

    if v_hold_valid and not v_overlap then
      update public.bookings
         set status = 'confirmed'::public.booking_status,
             payment_status = 'success'::public.payment_status,
             hold_expires_at = null
       where id = v_booking.id
      returning * into v_booking;
      v_confirmed := true;
    else
      update public.bookings
         set status = 'cancelled'::public.booking_status,
             payment_status = 'success'::public.payment_status,
             cancellation_reason = 'Payment received after the charger hold expired. A refund has been requested.',
             cancelled_at = now()
       where id = v_booking.id
      returning * into v_booking;

      if not exists (
        select 1 from public.refunds r
         where r.booking_id = v_booking.id
           and r.status in ('pending'::public.refund_status, 'processing'::public.refund_status, 'completed'::public.refund_status)
      ) then
        insert into public.refunds (payment_id, booking_id, amount, reason, status, requested_by)
        values (
          v_payment.id,
          v_booking.id,
          v_payment.amount,
          'Payment received after the charger hold expired.',
          'pending',
          v_booking.customer_id
        );
      end if;
      v_refund_requested := true;
    end if;
  else
    update public.bookings
       set payment_status = 'success'::public.payment_status
     where id = v_booking.id
    returning * into v_booking;

    if v_booking.status in ('cancelled'::public.booking_status, 'expired'::public.booking_status) then
      if not exists (
        select 1 from public.refunds r
         where r.booking_id = v_booking.id
           and r.status in ('pending'::public.refund_status, 'processing'::public.refund_status, 'completed'::public.refund_status)
      ) then
        insert into public.refunds (payment_id, booking_id, amount, reason, status, requested_by)
        values (
          v_payment.id,
          v_booking.id,
          v_payment.amount,
          'Payment settled after the booking was cancelled or expired.',
          'pending',
          v_booking.customer_id
        );
      end if;
      v_refund_requested := true;
    else
      v_confirmed := true;
    end if;
  end if;

  if v_confirmed and not exists (
    select 1 from public.financial_ledger l
     where l.booking_id = v_booking.id
       and l.entry_type = 'operator_earning'::public.ledger_entry_type
  ) then
    select * into v_station from public.stations where id = v_booking.station_id;

    insert into public.financial_ledger (booking_id, operator_id, entry_type, amount, direction, description)
    values (
      v_booking.id, v_station.operator_id, 'operator_earning', v_booking.operator_earning, 'credit',
      format('Operator earning for booking %s', v_booking.booking_reference)
    );

    if v_booking.platform_commission > 0 then
      insert into public.financial_ledger (booking_id, entry_type, amount, direction, description)
      values (v_booking.id, 'platform_commission', v_booking.platform_commission, 'credit',
        format('Platform commission for booking %s', v_booking.booking_reference));
    end if;

    if v_booking.service_fee > 0 then
      insert into public.financial_ledger (booking_id, entry_type, amount, direction, description)
      values (v_booking.id, 'service_fee', v_booking.service_fee, 'credit',
        format('Service fee for booking %s', v_booking.booking_reference));
    end if;

    if v_booking.tax_amount > 0 then
      insert into public.financial_ledger (booking_id, entry_type, amount, direction, description)
      values (v_booking.id, 'tax', v_booking.tax_amount, 'credit',
        format('VAT for booking %s', v_booking.booking_reference));
    end if;
  end if;

  insert into public.notifications (user_id, title, message, type, link)
  values (
    v_booking.customer_id,
    case when v_refund_requested then 'Payment received' else 'Booking confirmed' end,
    case
      when v_refund_requested then format('We received payment for %s, but the charger hold had expired. A refund has been requested.', v_booking.booking_reference)
      else format('Payment received. Booking %s is confirmed.', v_booking.booking_reference)
    end,
    'payment',
    '/app/bookings/' || v_booking.id
  );

  return jsonb_build_object(
    'success', true,
    'already_settled', false,
    'confirmed', v_confirmed,
    'refund_requested', v_refund_requested,
    'message', case when v_refund_requested then 'Payment received. A refund has been requested.' else 'Payment confirmed.' end,
    'payment', to_jsonb(v_payment),
    'booking', to_jsonb(v_booking)
  );
end;
$$;

create or replace function public.settle_refund(
  p_refund_id uuid,
  p_paystack_reference text default null,
  p_status public.refund_status default 'completed'::public.refund_status
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_refund public.refunds%rowtype;
  v_booking public.bookings%rowtype;
  v_operator_id uuid;
begin
  select * into v_refund from public.refunds where id = p_refund_id for update;
  if not found then
    raise exception 'Refund not found.';
  end if;

  if v_refund.status = 'completed'::public.refund_status and p_status = 'completed'::public.refund_status then
    return jsonb_build_object('success', true, 'already_settled', true, 'refund', to_jsonb(v_refund));
  end if;

  update public.refunds
     set status = p_status,
         paystack_refund_reference = coalesce(p_paystack_reference, paystack_refund_reference),
         processed_at = case when p_status in ('completed'::public.refund_status, 'failed'::public.refund_status) then now() else processed_at end
   where id = v_refund.id
  returning * into v_refund;

  select * into v_booking from public.bookings where id = v_refund.booking_id;
  select operator_id into v_operator_id from public.stations where id = v_booking.station_id;

  if p_status = 'completed'::public.refund_status then
    update public.payments set status = 'reversed'::public.payment_status where id = v_refund.payment_id;
    update public.bookings
       set status = 'refunded'::public.booking_status,
           payment_status = 'reversed'::public.payment_status
     where id = v_refund.booking_id;

    if not exists (select 1 from public.financial_ledger where refund_id = v_refund.id) then
      insert into public.financial_ledger (
        booking_id, refund_id, operator_id, entry_type, amount, direction, description
      ) values (
        v_refund.booking_id, v_refund.id, v_operator_id, 'refund', v_booking.operator_earning, 'debit',
        format('Refund reversal for booking %s', v_booking.booking_reference)
      );
    end if;

    insert into public.notifications (user_id, title, message, type, link)
    values (
      v_booking.customer_id,
      'Refund processed',
      format('Your refund of ₦%s for booking %s has been processed.', to_char(v_refund.amount, 'FM999G999G999G999D99'), v_booking.booking_reference),
      'payment',
      '/app/payments'
    );
  elsif p_status = 'failed'::public.refund_status then
    insert into public.notifications (user_id, title, message, type, link)
    values (
      v_booking.customer_id,
      'Refund needs attention',
      format('We could not process the refund for booking %s. Our team is reviewing it.', v_booking.booking_reference),
      'payment',
      '/app/support'
    );
  end if;

  return jsonb_build_object('success', true, 'refund', to_jsonb(v_refund));
end;
$$;

create or replace function public.settle_payout(
  p_payout_id uuid,
  p_reference text default null,
  p_status public.payout_status default 'processing'::public.payout_status
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payout public.payout_requests%rowtype;
begin
  select * into v_payout from public.payout_requests where id = p_payout_id for update;
  if not found then
    raise exception 'Payout request not found.';
  end if;

  if v_payout.status = 'paid'::public.payout_status then
    return jsonb_build_object('success', true, 'already_settled', true, 'payout', to_jsonb(v_payout));
  end if;

  update public.payout_requests
     set status = p_status,
         paystack_transfer_reference = coalesce(p_reference, paystack_transfer_reference),
         processed_at = case when p_status in ('paid'::public.payout_status, 'rejected'::public.payout_status) then now() else processed_at end
   where id = v_payout.id
  returning * into v_payout;

  if p_status = 'paid'::public.payout_status then
    if not exists (
      select 1 from public.financial_ledger
       where payout_id = v_payout.id
         and entry_type = 'payout'::public.ledger_entry_type
    ) then
      insert into public.financial_ledger (payout_id, operator_id, entry_type, amount, direction, description)
      values (
        v_payout.id, v_payout.operator_id, 'payout', v_payout.amount, 'debit',
        format('Payout transfer %s', coalesce(p_reference, v_payout.id::text))
      );
    end if;

    insert into public.notifications (user_id, title, message, type, link)
    select op.user_id,
           'Payout sent',
           format('Your payout of ₦%s has been sent to your bank account.', to_char(v_payout.amount, 'FM999G999G999G999D99')),
           'payout',
           '/operator/payouts'
      from public.operator_profiles op
     where op.id = v_payout.operator_id;
  end if;

  return jsonb_build_object('success', true, 'payout', to_jsonb(v_payout));
end;
$$;

revoke all on function public.settle_payment(text, text, numeric, text, public.payment_channel, text, timestamptz) from public;
revoke all on function public.settle_refund(uuid, text, public.refund_status) from public;
revoke all on function public.settle_payout(uuid, text, public.payout_status) from public;

grant execute on function public.settle_payment(text, text, numeric, text, public.payment_channel, text, timestamptz) to service_role;
grant execute on function public.settle_refund(uuid, text, public.refund_status) to service_role;
grant execute on function public.settle_payout(uuid, text, public.payout_status) to service_role;
