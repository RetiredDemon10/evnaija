export const BRAND = {
  name: 'EV Naija',
  tagline: 'Power your journey.',
  email: 'hello@evnaija.ng',
  supportEmail: 'support@evnaija.ng',
  phone: '+234 700 382 6245',
  address: '14 Adeola Odeku Street, Victoria Island, Lagos',
  hours: 'Mon – Fri, 08:00 – 18:00 WAT',
}

/**
 * Registered operator identity. These values must be set with real CAC/TIN
 * details before production. See docs/LEGAL_COMPLIANCE.md and run
 * `npm run legal:check` in the deployment pipeline.
 */
export const LEGAL_ENTITY = {
  name: import.meta.env.VITE_LEGAL_ENTITY_NAME || BRAND.name,
  registrationNumber: import.meta.env.VITE_LEGAL_RC_NUMBER || '',
  taxId: import.meta.env.VITE_LEGAL_TIN || '',
  dpoEmail: import.meta.env.VITE_LEGAL_DPO_EMAIL || BRAND.supportEmail,
}

export const NIGERIAN_STATES = [
  'Abia',
  'Adamawa',
  'Akwa Ibom',
  'Anambra',
  'Bauchi',
  'Bayelsa',
  'Benue',
  'Borno',
  'Cross River',
  'Delta',
  'Ebonyi',
  'Edo',
  'Ekiti',
  'Enugu',
  'FCT',
  'Gombe',
  'Imo',
  'Jigawa',
  'Kaduna',
  'Kano',
  'Katsina',
  'Kebbi',
  'Kogi',
  'Kwara',
  'Lagos',
  'Nasarawa',
  'Niger',
  'Ogun',
  'Ondo',
  'Osun',
  'Oyo',
  'Plateau',
  'Rivers',
  'Sokoto',
  'Taraba',
  'Yobe',
  'Zamfara',
]

export const LAUNCH_LOCATIONS = [
  {
    state: 'Lagos',
    city: 'Lagos',
    slug: 'lagos',
    areas: ['Victoria Island', 'Lekki', 'Ikoyi', 'Ikeja', 'Yaba', 'Ikate'],
    latitude: 6.4541,
    longitude: 3.3947,
  },
  {
    state: 'FCT',
    city: 'Abuja',
    slug: 'abuja',
    areas: ['Wuse II', 'Maitama', 'Asokoro', 'Garki', 'Central Business District'],
    latitude: 9.0765,
    longitude: 7.3986,
  },
  {
    state: 'Rivers',
    city: 'Port Harcourt',
    slug: 'port-harcourt',
    areas: ['GRA Phase 2', 'Trans-Amadi', 'Rumuola', 'Peter Odili Road'],
    latitude: 4.8156,
    longitude: 7.0498,
  },
]

export const CONNECTOR_OPTIONS = [
  { value: 'type2', label: 'Type 2' },
  { value: 'ccs2', label: 'CCS2' },
  { value: 'chademo', label: 'CHAdeMO' },
  { value: 'gbt', label: 'GB/T' },
] as const

export const AMENITIES = [
  'Restrooms',
  'Café',
  'Wi-Fi',
  '24/7 Security',
  'Covered Parking',
  'Retail',
  'Lounge',
  'Solar Powered',
  'Car Wash',
  'ATM',
  'Wheelchair Access',
  'Kids Area',
]

export const EV_BRANDS = [
  'Tesla',
  'BYD',
  'Hyundai',
  'Kia',
  'Nissan',
  'BMW',
  'Mercedes-Benz',
  'Audi',
  'Volkswagen',
  'Ford',
  'Chevrolet',
  'JAC',
  'GAC',
  'Other',
]

export const NIGERIAN_BANKS = [
  'Access Bank',
  'Citibank Nigeria',
  'Ecobank Nigeria',
  'Fidelity Bank',
  'First Bank of Nigeria',
  'First City Monument Bank',
  'Guaranty Trust Bank',
  'Heritage Bank',
  'Keystone Bank',
  'Kuda Bank',
  'Moniepoint MFB',
  'Opay',
  'Palmpay',
  'Polaris Bank',
  'Providus Bank',
  'Stanbic IBTC Bank',
  'Standard Chartered',
  'Sterling Bank',
  'Union Bank',
  'United Bank for Africa',
  'Unity Bank',
  'Wema Bank',
  'Zenith Bank',
]

export const CANCELLATION_POLICY = {
  freeCancellationHours: 2,
  partialRefundPercent: 50,
}

export const SERVICE_FEE = 200
export const VAT_PERCENT = 7.5

export const BOOKING_DURATIONS = [30, 60, 90, 120] as const

export const FAQS = [
  {
    q: 'How do I reserve a charging slot?',
    a: 'Search for a station, choose a charger and date, pick an available time slot, add your vehicle and pay securely with Paystack. Your charger is held for you the moment payment begins.',
  },
  {
    q: 'Which connectors are supported?',
    a: 'Our network supports Type 2, CCS2, CHAdeMO and GB/T connectors. Filter by connector type when searching and we will only show chargers compatible with your vehicle.',
  },
  {
    q: 'What happens if I arrive late?',
    a: 'Your reservation is held for 15 minutes after your start time. After that, the charger may be released so other drivers can use it. Contact the station if you are running late.',
  },
  {
    q: 'Can I cancel a booking?',
    a: 'Yes. Cancel free of charge up to 2 hours before your session. Cancellations inside 2 hours may receive a 50% refund, excluding the platform service fee.',
  },
  {
    q: 'How do operators get paid?',
    a: 'Session revenue is split automatically. The platform commission is deducted and the operator share is recorded in the financial ledger. Operators can request payouts to any Nigerian bank account once they pass the minimum threshold.',
  },
  {
    q: 'How are stations verified?',
    a: 'Every operator submits business registration, identification and proof of ownership. Our team reviews each station before it becomes visible, and re-verifies equipment on an ongoing basis.',
  },
]
