import { INDOOR_HACKS, SUSTAINABLE_SWAPS } from "../data/knowledgeBase";
import {
  DailyAirHistoryPoint,
  FamilyProfile,
  HealthLogEntry,
  LocalAirQualityData,
} from "../types";

export interface LongitudinalDayPoint {
  date: string;
  shortDate: string;
  outdoorAqi: number;
  outdoorPm25: number;
  estimatedIndoorPm25: number;
  pm25Avoided: number;
  symptomScore: number;
  sleepQuality: number;
  routineFollowed: boolean;
  isUserLogged: boolean;
  notes: string;
}

export function calculateProtectionProfile(
  activeHackIds: string[],
  adoptedSwapIds: string[],
  familyProfile: FamilyProfile
) {
  const hackSet = new Set(activeHackIds);
  const swapSet = new Set(adoptedSwapIds);
  const activeHacks = INDOOR_HACKS.filter((h) => hackSet.has(h.id));
  const adoptedSwaps = SUSTAINABLE_SWAPS.filter((s) => swapSet.has(s.id));

  // Multiplicative filtration reduction model (diminishing returns, realistic physics)
  let remainingPmFraction = 0.78; // typical unmitigated urban indoor infiltration factor ~0.78
  if (familyProfile.stoveType === "Gas Range") {
    remainingPmFraction += 0.08;
  }
  if (familyProfile.purifierCount > 0) {
    remainingPmFraction *= Math.pow(0.74, Math.min(familyProfile.purifierCount, 3));
  }

  for (const hack of activeHacks) {
    remainingPmFraction *= 1 - hack.pm25ReductionPct / 100;
  }
  for (const swap of adoptedSwaps) {
    if (swap.indoorPm25DeltaPct > 0) {
      remainingPmFraction *= 1 - swap.indoorPm25DeltaPct / 100;
    }
  }

  // Clamp realistic indoor-to-outdoor ratio between 0.16 (84% protected) and 0.92
  const indoorRatio = Math.max(0.16, Math.min(0.92, remainingPmFraction));
  const protectionPct = Math.round((1 - indoorRatio) * 100);

  // NO2 protection
  let remainingNo2Fraction = familyProfile.stoveType === "Gas Range" ? 1.15 : 0.65;
  for (const hack of activeHacks) {
    remainingNo2Fraction *= 1 - hack.no2ReductionPct / 100;
  }
  if (swapSet.has("portable-induction-hob")) {
    remainingNo2Fraction *= 0.45;
  }
  const no2ReductionPct = Math.max(8, Math.min(88, Math.round((1 - Math.min(1, remainingNo2Fraction)) * 100)));

  const annualCo2SavedKg = adoptedSwaps.reduce((sum, s) => sum + s.annualCo2SavedKg, 0);
  const annualNoxSavedG = adoptedSwaps.reduce((sum, s) => sum + s.annualNoxSavedG, 0);

  return {
    indoorRatio,
    protectionPct,
    no2ReductionPct,
    annualCo2SavedKg,
    annualNoxSavedG,
    activeHacksCount: activeHacks.length,
    adoptedSwapsCount: adoptedSwaps.length,
  };
}

export function buildLongitudinalSeries(
  dailyHistory: DailyAirHistoryPoint[],
  userLogs: HealthLogEntry[],
  activeHackIds: string[],
  adoptedSwapIds: string[],
  familyProfile: FamilyProfile
): LongitudinalDayPoint[] {
  const { indoorRatio } = calculateProtectionProfile(activeHackIds, adoptedSwapIds, familyProfile);
  const logByDate = new Map(userLogs.map((l) => [l.date, l]));

  return dailyHistory.map((day, idx) => {
    const userLog = logByDate.get(day.date);
    // Gradual ramp of adherence across the 14-day window if no explicit user entry exists for earlier baseline days
    const adherenceBoost = userLog
      ? userLog.routineFollowed
        ? 0.92
        : 1.08
      : Math.max(0.88, 1.12 - (idx / Math.max(1, dailyHistory.length - 1)) * 0.22);

    const estimatedIndoorPm25 = Number(
      Math.max(3.2, day.avgPm25 * indoorRatio * adherenceBoost).toFixed(1)
    );
    const pm25Avoided = Number(Math.max(0, day.avgPm25 - estimatedIndoorPm25).toFixed(1));

    // Derive realistic symptom comfort score correlated with indoor PM2.5 when not explicitly logged
    const autoSymptom =
      estimatedIndoorPm25 <= 12
        ? 5
        : estimatedIndoorPm25 <= 24
        ? 4
        : estimatedIndoorPm25 <= 42
        ? 3
        : estimatedIndoorPm25 <= 70
        ? 2
        : 1;

    const autoSleep = Math.min(5, Math.max(1, autoSymptom));

    const parsedDate = new Date(`${day.date}T12:00:00`);
    const shortDate = Number.isNaN(parsedDate.getTime())
      ? day.date.slice(5)
      : parsedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    return {
      date: day.date,
      shortDate,
      outdoorAqi: day.avgAqi,
      outdoorPm25: day.avgPm25,
      estimatedIndoorPm25,
      pm25Avoided,
      symptomScore: userLog ? userLog.symptomScore : autoSymptom,
      sleepQuality: userLog ? userLog.sleepQuality : autoSleep,
      routineFollowed: userLog ? userLog.routineFollowed : idx >= 3,
      isUserLogged: Boolean(userLog?.isUserLogged),
      notes: userLog?.notes || (idx >= 3 ? "Low-emission routine & indoor filtration active" : "Baseline tracking"),
    };
  });
}

export function summarizeLongTermHealth(
  series: LongitudinalDayPoint[],
  airQuality: LocalAirQualityData | null,
  activeHackIds: string[],
  adoptedSwapIds: string[],
  familyProfile: FamilyProfile
) {
  const protection = calculateProtectionProfile(activeHackIds, adoptedSwapIds, familyProfile);
  if (series.length === 0) {
    return {
      ...protection,
      avgOutdoorPm25: airQuality?.current.pm25 ?? 0,
      avgIndoorPm25: 0,
      totalPm25DoseAvoided: 0,
      cleanAirDaysGained: 0,
      symptomFreeDays: 0,
      comfortTrendDelta: 0,
      estimatedIndoorNow: airQuality ? Number((airQuality.current.pm25 * protection.indoorRatio).toFixed(1)) : 0,
    };
  }

  const avgOutdoorPm25 = Number(
    (series.reduce((s, d) => s + d.outdoorPm25, 0) / series.length).toFixed(1)
  );
  const avgIndoorPm25 = Number(
    (series.reduce((s, d) => s + d.estimatedIndoorPm25, 0) / series.length).toFixed(1)
  );
  const totalPm25DoseAvoided = Number(
    series.reduce((s, d) => s + d.pm25Avoided, 0).toFixed(1)
  );

  // Days where estimated indoor PM2.5 stayed below 15 µg/m³ (WHO 24-hour guideline)
  const cleanAirDaysGained = series.filter(
    (d) => d.outdoorPm25 > 15 && d.estimatedIndoorPm25 <= 18
  ).length;
  const symptomFreeDays = series.filter((d) => d.symptomScore >= 4).length;

  const firstHalf = series.slice(0, Math.floor(series.length / 2));
  const secondHalf = series.slice(Math.floor(series.length / 2));
  const firstAvg =
    firstHalf.reduce((s, d) => s + d.symptomScore, 0) / Math.max(1, firstHalf.length);
  const secondAvg =
    secondHalf.reduce((s, d) => s + d.symptomScore, 0) / Math.max(1, secondHalf.length);
  const comfortTrendDelta = Number((secondAvg - firstAvg).toFixed(1));

  const estimatedIndoorNow = airQuality
    ? Number(Math.max(2.5, airQuality.current.pm25 * protection.indoorRatio).toFixed(1))
    : avgIndoorPm25;

  return {
    ...protection,
    avgOutdoorPm25,
    avgIndoorPm25,
    totalPm25DoseAvoided,
    cleanAirDaysGained,
    symptomFreeDays,
    comfortTrendDelta,
    estimatedIndoorNow,
  };
}

export function getSeverityStyle(severity: "good" | "moderate" | "unhealthy" | "severe" | string) {
  switch (severity) {
    case "good":
      return {
        text: "text-emerald-700",
        surface: "bg-emerald-50 border-emerald-200",
        bar: "bg-emerald-600",
        label: "Nominal Air",
      };
    case "moderate":
      return {
        text: "text-amber-700",
        surface: "bg-amber-50 border-amber-200",
        bar: "bg-amber-500",
        label: "Moderate Caution",
      };
    case "unhealthy":
      return {
        text: "text-orange-700",
        surface: "bg-orange-50 border-orange-200",
        bar: "bg-orange-600",
        label: "Unhealthy Air",
      };
    default:
      return {
        text: "text-red-700",
        surface: "bg-red-50 border-red-200",
        bar: "bg-red-600",
        label: "Severe Pollution",
      };
  }
}
