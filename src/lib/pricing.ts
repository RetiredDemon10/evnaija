import type { Charger, Vehicle } from '@/types'
import { SITE_FEES } from './fees'

export interface BookingQuote {
  energyKwh: number
  chargingFee: number
  bookingFee: number
  serviceFee: number
  taxAmount: number
  totalAmount: number
  platformCommission: number
  operatorEarning: number
  pricePerKwh: number
}

/**
 * Mirrors the server-side pricing function. The database remains the source of
 * truth — this is used for live display before a booking is created.
 */
export function quoteBooking(
  charger: Pick<Charger, 'capacity_kw' | 'price_per_kwh' | 'booking_fee'>,
  durationMinutes: number,
  vehicle?: Pick<Vehicle, 'battery_capacity_kwh'> | null,
): BookingQuote {
  const maxEnergy = (charger.capacity_kw * durationMinutes) / 60
  const round2 = (value: number) => Math.round(value * 100) / 100
  const energyKwh = round2(Math.min(maxEnergy, vehicle?.battery_capacity_kwh ?? maxEnergy))
  const chargingFee = round2(energyKwh * charger.price_per_kwh)
  const bookingFee = charger.booking_fee
  const serviceFee = SITE_FEES.serviceFee
  const taxAmount = round2(serviceFee * (SITE_FEES.vatPercent / 100))
  const totalAmount = round2(chargingFee + bookingFee + serviceFee + taxAmount)
  const platformCommission = round2(chargingFee * (SITE_FEES.commissionPercent / 100))
  const operatorEarning = round2(chargingFee - platformCommission + bookingFee)
  return {
    energyKwh,
    chargingFee,
    bookingFee,
    serviceFee,
    taxAmount,
    totalAmount,
    platformCommission,
    operatorEarning,
    pricePerKwh: charger.price_per_kwh,
  }
}
