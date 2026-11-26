import { describe, expect, it } from 'vitest'
import { quoteBooking } from '@/lib/pricing'
import { SITE_FEES } from '@/lib/fees'

const charger = {
  capacity_kw: 22,
  price_per_kwh: 250,
  booking_fee: 1000,
}

describe('quoteBooking', () => {
  it('prices a one-hour session from charger output', () => {
    const quote = quoteBooking(charger, 60, { battery_capacity_kwh: 60 })

    expect(quote.energyKwh).toBe(22)
    expect(quote.chargingFee).toBe(5500)
    expect(quote.bookingFee).toBe(1000)
    expect(quote.serviceFee).toBe(500)
    expect(quote.taxAmount).toBe(37.5)
    expect(quote.totalAmount).toBe(7037.5)
    expect(quote.platformCommission).toBe(825)
    expect(quote.operatorEarning).toBe(5675)
  })

  it('caps energy at the vehicle battery size', () => {
    const quote = quoteBooking(
      { capacity_kw: 50, price_per_kwh: 200, booking_fee: 0 },
      180,
      { battery_capacity_kwh: 40 },
    )
    expect(quote.energyKwh).toBe(40)
    expect(quote.chargingFee).toBe(8000)
  })

  it('rounds consistently to two decimal places', () => {
    const quote = quoteBooking(
      { capacity_kw: 11, price_per_kwh: 215, booking_fee: 0 },
      45,
      null,
    )
    expect(quote.energyKwh).toBe(8.25)
    expect(quote.chargingFee).toBe(1773.75)
    expect(quote.taxAmount).toBe(37.5)
    expect(quote.totalAmount).toBe(2311.25)
  })

  it('uses the seeded default fee schedule', () => {
    expect(SITE_FEES.serviceFee).toBe(500)
    expect(SITE_FEES.vatPercent).toBe(7.5)
    expect(SITE_FEES.commissionPercent).toBe(15)
    expect(SITE_FEES.minimumPayout).toBe(10_000)
  })
})
