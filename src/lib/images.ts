const u = (id: string, w = 1600) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`

// Pexels CDN. Every vehicle-bearing hero/station image on the site uses a
// photograph of a real electric car (Tesla Model 3 / Model X / Model Y, or an
// EV at a charging bay) so the heroes never show petrol sports or muscle cars.
const p = (id: string, w = 1600) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`

export const IMAGES = {
  heroCharging: u('1593941707882-a5bba14938c7', 2000),
  teslaCharging: p('110844'),
  stationNight: u('1615906655593-ad0386982a0f'),
  connector: u('1620714223084-8fcacc6dfd8d'),
  evDetail: p('12554294'),
  evOwner: u('1592833159155-c62df1b65634'),
  premiumCar: p('7985573'),
  evChargingBay: p('9800006'),
  evCloseup: p('9799730'),
  solar: u('1509391366360-2e959784a276'),
  solarFarm: u('1497435334941-8c899ee9e8e9'),
  evFleet: p('10029873'),
  motorway: u('1563720223185-11003d516935'),
  interior: p('32560104'),
  cityLagos:
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/25/Lagos_Island_City_Scape.jpg/1280px-Lagos_Island_City_Scape.jpg',
  cityAbuja:
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/08/Central_Business_District_Abuja.jpg/1280px-Central_Business_District_Abuja.jpg',
  cityPh:
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0b/Port_Harcourt_Banner.jpg/1280px-Port_Harcourt_Banner.jpg',
  nigerianRoad:
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0b/Dan_Flore_Lagos-Nigeria-3rd-Mainland-Bridge-2006.jpg/1280px-Dan_Flore_Lagos-Nigeria-3rd-Mainland-Bridge-2006.jpg',
}

export const STATION_IMAGE_POOL = [
  IMAGES.stationNight,
  IMAGES.teslaCharging,
  IMAGES.evChargingBay,
  IMAGES.connector,
  IMAGES.evDetail,
  IMAGES.evOwner,
  IMAGES.premiumCar,
  IMAGES.evCloseup,
  IMAGES.solar,
]

export const AVATARS = [
  'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
]
