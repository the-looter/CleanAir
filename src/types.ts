export type NavSection =
  | "overview"
  | "routines"
  | "hacks"
  | "swaps"
  | "assistant"
  | "family";

export interface CityLocation {
  id: string;
  name: string;
  region: string;
  country: string;
  lat: number;
  lon: number;
  timezone?: string;
}

export interface HourlyAirPoint {
  time: string;
  usAqi: number;
  pm25: number;
  pm10: number;
  no2: number;
  o3: number;
  windSpeed: number;
}

export interface DailyAirHistoryPoint {
  date: string;
  avgAqi: number;
  peakAqi: number;
  avgPm25: number;
  peakPm25: number;
  avgNo2: number;
  avgO3: number;
}

export interface LocalAirQualityData {
  timezone: string;
  observedAt: string;
  current: {
    usAqi: number;
    europeanAqi: number;
    category: string;
    severity: "good" | "moderate" | "unhealthy" | "severe";
    pm25: number;
    pm10: number;
    no2: number;
    o3: number;
    so2: number;
    co: number;
    temperatureC: number;
    humidityPct: number;
    windSpeedKmh: number;
  };
  ventilationWindow: {
    startTime: string;
    endTime: string;
    expectedPm25: number;
  };
  peakNext24h: {
    time: string;
    usAqi: number;
    pm25: number;
  };
  hourlyForecast: HourlyAirPoint[];
  dailyHistory: DailyAirHistoryPoint[];
}

export interface FamilyMember {
  id: string;
  name: string;
  ageGroup: "Toddler (0–4)" | "Child (5–12)" | "Teen (13–17)" | "Adult" | "Older Adult (65+)";
  sensitivities: string[];
}

export interface FamilyProfile {
  householdName: string;
  homeType: "High-Rise Apartment" | "Walk-Up Apartment" | "Townhouse" | "Detached Home";
  stoveType: "Gas Range" | "Induction / Electric" | "Propane / Wood";
  purifierCount: number;
  primaryCommute: "Car (Gasoline)" | "Public Transit" | "Walk / Bike" | "EV / Hybrid";
  members: FamilyMember[];
}

export type HackCategory =
  | "All Playbooks"
  | "Filtration & DIY"
  | "Kitchen & Cooking"
  | "Sealing & Ventilation"
  | "Bedroom Sanctuary";

export interface IndoorHack {
  id: string;
  title: string;
  category: Exclude<HackCategory, "All Playbooks">;
  difficulty: "15-min DIY" | "Daily Habit" | "Weekend Setup";
  estimatedCost: string;
  pm25ReductionPct: number;
  no2ReductionPct: number;
  summary: string;
  scienceMechanism: string;
  realWorldImpact: string;
  steps: string[];
  imageUrl?: string;
}

export type SwapCategory =
  | "All Swaps"
  | "Daily Mobility"
  | "Cooking & Heating"
  | "Cleaning & Materials"
  | "Energy & Habits";

export interface SustainableSwap {
  id: string;
  title: string;
  category: Exclude<SwapCategory, "All Swaps">;
  replacingHabit: string;
  swapAction: string;
  annualCo2SavedKg: number;
  annualNoxSavedG: number;
  indoorPm25DeltaPct: number;
  monthlyCostDelta: string;
  realWorldProof: string;
  healthPayoff: string;
  imageUrl?: string;
}

export interface RoutineStep {
  title: string;
  detail: string;
  realWorldImpact: string;
  category: string;
}

export interface RoutineDaypart {
  id: string;
  label: string;
  timeRange: string;
  riskLevel: string;
  headline: string;
  steps: RoutineStep[];
}

export interface RoutinePlan {
  summary: string;
  maskGuidance: string;
  ventilationAdvice: string;
  estimatedExposureReductionPct: number;
  estimatedDailyCo2SavedKg: number;
  dayparts: RoutineDaypart[];
  generatedAt?: string;
  locationName?: string;
}

export interface HealthLogEntry {
  date: string;
  symptomScore: number; // 1 = severe irritation/cough, 5 = clear breathing & rested
  sleepQuality: number; // 1-5
  outdoorMinutes: number;
  routineFollowed: boolean;
  notes: string;
  isUserLogged?: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  keyActions?: string[];
  realWorldImpact?: string;
  timestamp: string;
}

export interface AiImpactAnalysis {
  tailoredSummary: string;
  estimatedIndoorDropUgM3: number;
  healthPayoffTimeline: string;
  annualEmissionsImpact: string;
  customSteps: string[];
}
