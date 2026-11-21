import { useCallback, useState } from "react";
import { analyzeRealWorldImpact } from "../services/api";
import {
  AiImpactAnalysis,
  CityLocation,
  FamilyProfile,
  LocalAirQualityData,
} from "../types";

interface ImpactRequestItem {
  id: string;
  title: string;
  itemType: "Indoor Air Hack" | "Sustainable Swap";
  baselineImpact: string;
}

export function useImpactAnalysis(
  selectedCity: CityLocation,
  airQuality: LocalAirQualityData | null,
  familyProfile: FamilyProfile
) {
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<Record<string, AiImpactAnalysis>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const analyzeItem = useCallback(
    async (item: ImpactRequestItem) => {
      setAnalyzingId(item.id);
      setErrors((prev) => ({ ...prev, [item.id]: "" }));
      try {
        const result = await analyzeRealWorldImpact({
          itemTitle: item.title,
          itemType: item.itemType,
          baselineImpact: item.baselineImpact,
          locationName: selectedCity.name,
          currentAqi: airQuality?.current.usAqi ?? 100,
          currentPm25: airQuality?.current.pm25 ?? 35,
          currentNo2: airQuality?.current.no2 ?? 25,
          familyProfile,
        });
        setAnalyses((prev) => ({ ...prev, [item.id]: result }));
      } catch (err) {
        setErrors((prev) => ({
          ...prev,
          [item.id]: err instanceof Error ? err.message : "Could not analyze impact",
        }));
      } finally {
        setAnalyzingId(null);
      }
    },
    [selectedCity.name, airQuality, familyProfile]
  );

  return {
    analyzingId,
    analyses,
    errors,
    analyzeItem,
  };
}
