import { CityLocation, FamilyProfile, IndoorHack, SustainableSwap } from "../types";

export const PRESET_CITIES: CityLocation[] = [
  {
    id: "delhi",
    name: "New Delhi",
    region: "Delhi NCR, India",
    country: "India",
    lat: 28.6139,
    lon: 77.209,
    timezone: "Asia/Kolkata",
  },
  {
    id: "lahore",
    name: "Lahore",
    region: "Punjab, Pakistan",
    country: "Pakistan",
    lat: 31.5204,
    lon: 74.3587,
    timezone: "Asia/Karachi",
  },
  {
    id: "los-angeles",
    name: "Los Angeles",
    region: "California, United States",
    country: "United States",
    lat: 34.0522,
    lon: -118.2437,
    timezone: "America/Los_Angeles",
  },
  {
    id: "mexico-city",
    name: "Mexico City",
    region: "CDMX, Mexico",
    country: "Mexico",
    lat: 19.4326,
    lon: -99.1332,
    timezone: "America/Mexico_City",
  },
  {
    id: "beijing",
    name: "Beijing",
    region: "Beijing Municipality, China",
    country: "China",
    lat: 39.9042,
    lon: 116.4074,
    timezone: "Asia/Shanghai",
  },
  {
    id: "london",
    name: "London",
    region: "Greater London, United Kingdom",
    country: "United Kingdom",
    lat: 51.5074,
    lon: -0.1278,
    timezone: "Europe/London",
  },
  {
    id: "jakarta",
    name: "Jakarta",
    region: "DKI Jakarta, Indonesia",
    country: "Indonesia",
    lat: -6.2088,
    lon: 106.8456,
    timezone: "Asia/Jakarta",
  },
];

export const DEFAULT_FAMILY_PROFILE: FamilyProfile = {
  householdName: "Mehta-Chen Household",
  homeType: "High-Rise Apartment",
  stoveType: "Gas Range",
  purifierCount: 1,
  primaryCommute: "Car (Gasoline)",
  members: [
    {
      id: "m-1",
      name: "Aarav",
      ageGroup: "Child (5–12)",
      sensitivities: ["Mild Childhood Asthma", "Outdoor Sports"],
    },
    {
      id: "m-2",
      name: "Maya",
      ageGroup: "Adult",
      sensitivities: ["Seasonal Allergic Rhinitis"],
    },
    {
      id: "m-3",
      name: "Nani",
      ageGroup: "Older Adult (65+)",
      sensitivities: ["Cardiorespiratory Sensitivity"],
    },
  ],
};

export const INDOOR_HACKS: IndoorHack[] = [
  {
    id: "corsi-rosenthal-diy",
    title: "Corsi-Rosenthal MERV-13 Box Fan Cube",
    category: "Filtration & DIY",
    difficulty: "15-min DIY",
    estimatedCost: "$55–$75",
    pm25ReductionPct: 48,
    no2ReductionPct: 0,
    summary:
      "Tape four 20x20x1 MERV-13 furnace filters into a cube topped by a standard 20-inch box fan (blowing upward) to create a high-CADR clean-air machine.",
    scienceMechanism:
      "Delivers 500–750 CFM of Clean Air Delivery Rate (CADR) — 2× to 3× the particulate clearance of many mid-range HEPA towers at a fraction of the price.",
    realWorldImpact:
      "Cuts indoor PM2.5 by up to 48% in 30 minutes across living rooms and study spaces, matching the aerosol protection of a $450 commercial purifier.",
    steps: [
      "Tape four MERV-13 filters arrows-inward to form a square box.",
      "Seal the bottom square with a 20x20 cardboard base using duct tape.",
      "Mount the box fan on top with airflow pointing upward and tape all seam gaps airtight.",
    ],
    imageUrl: "/src/assets/images/diy_air_filter_1795240479089.jpg",
  },
  {
    id: "bedroom-clean-zone",
    title: "Positive-Pressure Bedroom Sanctuary",
    category: "Bedroom Sanctuary",
    difficulty: "Weekend Setup",
    estimatedCost: "$18",
    pm25ReductionPct: 26,
    no2ReductionPct: 12,
    summary:
      "Designate sleeping rooms as low-infiltration safe zones by sealing door sweeps, closing bedroom vents during smoke/smog spikes, and running continuous quiet filtration.",
    scienceMechanism:
      "Children spend 9–11 hours nightly asleep. Reducing nighttime PM2.5 below 10 µg/m³ gives inflamed bronchial airways uninterrupted nocturnal recovery.",
    realWorldImpact:
      "Lowers 24-hour cumulative inhaled PM2.5 dose by ~26% and reduces morning wheeze and nasal congestion within 5–7 nights.",
    steps: [
      "Install adhesive silicone door-sweep strips and foam weatherstripping on window sashes.",
      "Run bedside HEPA or MERV-13 unit on medium speed 45 minutes prior to bedtime.",
      "Keep outdoor coats, school shoes, and backpacks in an entryway bin outside bedrooms.",
    ],
    imageUrl: "/src/assets/images/indoor_air_sanctuary_1795240479237.jpg",
  },
  {
    id: "kitchen-capture-hood",
    title: "Back-Burner + Range Hood Capture Protocol",
    category: "Kitchen & Cooking",
    difficulty: "Daily Habit",
    estimatedCost: "$0",
    pm25ReductionPct: 18,
    no2ReductionPct: 42,
    summary:
      "Always cook on rear stove burners, run an externally vented exhaust fan 5 minutes before lighting gas, and keep it running 15 minutes afterward.",
    scienceMechanism:
      "Gas cooking and high-heat frying generate ultrafine particles (<0.1 µm) and NO2 spikes exceeding outdoor rush-hour highways. Rear burners sit directly beneath the hood capture plume.",
    realWorldImpact:
      "Reduces peak indoor NO2 exposure by 42% and prevents cooking-generated PM2.5 plumes from drifting into children's bedrooms.",
    steps: [
      "Turn on kitchen exhaust fan before igniting any burner or preheating oil.",
      "Place high-heat searing or boiling pots strictly on the two back burners.",
      "If hood is recirculating-only, crack a nearby kitchen window slightly and place a portable HEPA unit 2 meters away.",
    ],
  },
  {
    id: "weatherstrip-spike-seal",
    title: "Weatherstrip & Damp-Mop Particulate Lock",
    category: "Sealing & Ventilation",
    difficulty: "Weekend Setup",
    estimatedCost: "$14",
    pm25ReductionPct: 20,
    no2ReductionPct: 8,
    summary:
      "Replace dry sweeping and vacuuming without HEPA with damp microfiber mopping, plus V-seal tape on leaky window frames.",
    scienceMechanism:
      "Dry brooms re-suspend settled lead, brake-dust, and soot particles (PM2.5–PM10) into breathing height (0.8m–1.2m, child height) for hours.",
    realWorldImpact:
      "Cuts indoor coarse and fine particulate re-suspension by 20% and blocks outdoor smog infiltration when ambient AQI exceeds 150.",
    steps: [
      "Apply EPDM foam tape around sliding window tracks and balcony door thresholds.",
      "Switch from dry sweeping to damp microfiber flat-mopping 3× per week.",
      "Open windows strictly during the local lowest-PM2.5 ventilation window (typically 20–30 min cross-breeze).",
    ],
  },
  {
    id: "carbon-pre-filter-layer",
    title: "Activated Carbon + HEPA Dual-Stage Upgrade",
    category: "Filtration & DIY",
    difficulty: "15-min DIY",
    estimatedCost: "$24",
    pm25ReductionPct: 12,
    no2ReductionPct: 35,
    summary:
      "Wrap an activated carbon pre-filter sheet around your existing purifier intake or DIY cube to adsorb traffic NO2, ozone, and VOCs that standard HEPA fibers cannot trap.",
    scienceMechanism:
      "HEPA media captures solid/liquid particles (PM2.5) via interception and diffusion, whereas gaseous pollutants (NO2, O3, benzene) pass right through unless adsorbed by microporous activated carbon.",
    realWorldImpact:
      "Adds 35% gaseous NO2/ozone capture for apartments located within 300 meters of arterial roads.",
    steps: [
      "Measure purifier intake perimeter and cut cut-to-fit pelletized carbon fleece.",
      "Secure loosely over the outer pre-filter grille (avoid restricting airflow excessively).",
      "Replace carbon layer every 60–90 days when outdoor smog is severe.",
    ],
  },
];

export const SUSTAINABLE_SWAPS: SustainableSwap[] = [
  {
    id: "cargo-ebike-school",
    title: "Electric Cargo Bike for Short School & Errand Trips",
    category: "Daily Mobility",
    replacingHabit: "Short (<5 km) cold-start gasoline car trips",
    swapAction: "Replace 4 weekly short car runs with an e-cargo bike or walking school bus along side streets",
    annualCo2SavedKg: 680,
    annualNoxSavedG: 1450,
    indoorPm25DeltaPct: 0,
    monthlyCostDelta: "-$95/mo fuel & parking",
    realWorldProof:
      "Cold-start catalytic converters emit 60–80% of urban tailpipe NOx and hydrocarbons in the first 3 km. Shifting 18 km/week off arterial car lanes removes 680 kg CO2e/year and cuts child in-cabin traffic soot exposure by ~45% when routing via residential streets.",
    healthPayoff: "Boosts parent-child moderate cardiovascular activity while halving roadside NO2 inhalation.",
    imageUrl: "/src/assets/images/low_emission_commute_1795240480044.jpg",
  },
  {
    id: "portable-induction-hob",
    title: "Countertop Induction Hob for Daily Gas Cooking",
    category: "Cooking & Heating",
    replacingHabit: "Boiling, simmering & weekday stir-frying on open gas burners",
    swapAction: "Shift 80% of weekday cooking to a $65 single-zone induction burner",
    annualCo2SavedKg: 310,
    annualNoxSavedG: 2100,
    indoorPm25DeltaPct: 14,
    monthlyCostDelta: "-$12/mo energy",
    realWorldProof:
      "Eliminates direct indoor combustion of methane/LPG, cutting kitchen NO2 peaks by 70–85% and lowering pediatric asthma exacerbation risk linked to gas stove exposure (estimated 12.7% attributable childhood asthma fraction).",
    healthPayoff: "Immediate elimination of indoor combustion NO2, CO, and formaldehyde bursts during dinner prep.",
  },
  {
    id: "fragrance-free-castile",
    title: "Fragrance-Free Castile & Vinegar Cleaning Refills",
    category: "Cleaning & Materials",
    replacingHabit: "Aerosol sprays, scented bleach, and plug-in air fresheners",
    swapAction: "Swap to liquid castile soap, citric acid, and unscented hydrogen peroxide in refillable glass sprayers",
    annualCo2SavedKg: 85,
    annualNoxSavedG: 120,
    indoorPm25DeltaPct: 11,
    monthlyCostDelta: "-$18/mo household supplies",
    realWorldProof:
      "Terpenes (limonene/pinene) in scented cleaners react indoors with ambient urban ozone to form secondary organic aerosol (indoor ultrafine PM2.5) and formaldehyde. Eliminating aerosols prevents self-inflicted indoor smog.",
    healthPayoff: "Reduces airway hyper-reactivity and secondary indoor PM2.5 formation during high-ozone afternoons.",
  },
  {
    id: "beeswax-led-no-incense",
    title: "Warm LED Ambient Lighting & Electric Kettle Habit",
    category: "Energy & Habits",
    replacingHabit: "Burning paraffin candles, incense sticks, or mosquito coils indoors",
    swapAction: "Use flameless warm LEDs and sealed ultrasonic/net barriers instead of indoor combustion sticks",
    annualCo2SavedKg: 110,
    annualNoxSavedG: 480,
    indoorPm25DeltaPct: 22,
    monthlyCostDelta: "-$9/mo",
    realWorldProof:
      "A single burning incense stick or paraffin candle in a closed apartment can spike room PM2.5 above 180 µg/m³ (hazardous levels) for 2+ hours, erasing the benefit of running a HEPA purifier.",
    healthPayoff: "Prevents acute indoor black-carbon and PAH soot spikes in sealed winter or smog-season apartments.",
  },
  {
    id: "transit-route-timing",
    title: "Off-Peak Rail / Metro + N95 Commute Swap",
    category: "Daily Mobility",
    replacingHabit: "Idling in rush-hour surface traffic with windows cracked",
    swapAction: "Combine off-peak transit/metro trips with recirculate-air mode when car travel is unavoidable",
    annualCo2SavedKg: 540,
    annualNoxSavedG: 980,
    indoorPm25DeltaPct: 4,
    monthlyCostDelta: "-$60/mo",
    realWorldProof:
      "Switching vehicle cabin HVAC from 'Fresh Air' to 'Recirculate' during gridlock cuts in-cabin ultrafine particles by 75%; shifting 2 commutes/week to electric rail removes 540 kg CO2e/yr.",
    healthPayoff: "Shields commuters from the highest daily micro-environment PM2.5 dose (rush-hour roadside tunnels and intersections).",
  },
];

export const ASSISTANT_TOPICS = [
  {
    id: "outdoor-play",
    label: "Outdoor Play Safety",
    prompt:
      "Based on today's local AQI and hourly forecast, when is it safest for our children to play or exercise outdoors, and what precautions should we take?",
  },
  {
    id: "ventilation-window",
    label: "Ventilation Window",
    prompt:
      "When should we open windows for fresh air exchange today without pulling severe PM2.5 or ozone inside?",
  },
  {
    id: "cooking-fumes",
    label: "Kitchen & Cooking Impact",
    prompt:
      "How does cooking on our stove affect indoor PM2.5 and NO2 tonight given today's outdoor air quality, and what swap makes the biggest difference?",
  },
  {
    id: "commute-route",
    label: "School Commute Exposure",
    prompt:
      "What is the lowest-emission and lowest-exposure way to handle tomorrow morning's school commute under our local pollution levels?",
  },
  {
    id: "filter-sizing",
    label: "Purifier & DIY Sizing",
    prompt:
      "Given our home type and purifier count, how should we position and run our filtration units today to cut indoor PM2.5 below WHO guidelines?",
  },
  {
    id: "asthma-flare",
    label: "Sensitive Airway Protection",
    prompt:
      "What early warning signs and nighttime indoor air steps should we follow for our family members with respiratory sensitivities this week?",
  },
];
