import React, { useState } from "react";
import { ArrowRight, Check, Leaf, Sparkles } from "lucide-react";
import { SUSTAINABLE_SWAPS } from "../data/knowledgeBase";
import { analyzeRealWorldImpact } from "../services/api";
import {
  AiImpactAnalysis,
  CityLocation,
  FamilyProfile,
  LocalAirQualityData,
  SwapCategory,
} from "../types";

interface SustainableSwapsViewProps {
  selectedCity: CityLocation;
  airQuality: LocalAirQualityData | null;
  familyProfile: FamilyProfile;
  adoptedSwapIds: string[];
  onToggleSwap: (swapId: string) => void;
}

const SWAP_CATEGORIES: SwapCategory[] = [
  "All Swaps",
  "Daily Mobility",
  "Cooking & Heating",
  "Cleaning & Materials",
  "Energy & Habits",
];

export const SustainableSwapsView: React.FC<SustainableSwapsViewProps> = ({
  selectedCity,
  airQuality,
  familyProfile,
  adoptedSwapIds,
  onToggleSwap,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<SwapCategory>("All Swaps");
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<Record<string, AiImpactAnalysis>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const adoptedSwaps = SUSTAINABLE_SWAPS.filter((s) => adoptedSwapIds.includes(s.id));
  const totalCo2Kg = adoptedSwaps.reduce((sum, s) => sum + s.annualCo2SavedKg, 0);
  const totalNoxG = adoptedSwaps.reduce((sum, s) => sum + s.annualNoxSavedG, 0);
  const equivalentTrees = Math.round(totalCo2Kg / 21.7);

  const filteredSwaps =
    selectedCategory === "All Swaps"
      ? SUSTAINABLE_SWAPS
      : SUSTAINABLE_SWAPS.filter((s) => s.category === selectedCategory);

  const handleAnalyze = async (swapId: string) => {
    const swap = SUSTAINABLE_SWAPS.find((s) => s.id === swapId);
    if (!swap) return;
    setAnalyzingId(swapId);
    setErrors((prev) => ({ ...prev, [swapId]: "" }));
    try {
      const res = await analyzeRealWorldImpact({
        itemTitle: swap.title,
        itemType: "Sustainable Swap",
        baselineImpact: swap.realWorldProof,
        locationName: selectedCity.name,
        currentAqi: airQuality?.current.usAqi ?? 100,
        currentPm25: airQuality?.current.pm25 ?? 35,
        currentNo2: airQuality?.current.no2 ?? 25,
        familyProfile,
      });
      setAnalyses((prev) => ({ ...prev, [swapId]: res }));
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [swapId]: err instanceof Error ? err.message : "Could not analyze swap impact",
      }));
    } finally {
      setAnalyzingId(null);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left Vertical Category Menu */}
      <aside className="lg:col-span-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="px-2 pb-2 text-xs font-medium text-slate-500">
            Sustainable Swap Menu
          </div>
          <ul className="flex flex-col gap-1">
            {SWAP_CATEGORIES.map((cat) => {
              const count =
                cat === "All Swaps"
                  ? SUSTAINABLE_SWAPS.length
                  : SUSTAINABLE_SWAPS.filter((s) => s.category === cat).length;
              const isSelected = selectedCategory === cat;
              return (
                <li key={cat}>
                  <button
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    aria-pressed={isSelected}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-teal-700 ${
                      isSelected
                        ? "bg-teal-50 font-semibold text-teal-900"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span className="truncate">{cat}</span>
                    <span className="font-mono text-xs text-slate-500">{count}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-5 border-t border-slate-200 pt-4 px-2 space-y-3">
            <div>
              <div className="text-xs font-medium text-slate-500">Annual CO₂e Avoided</div>
              <div className="mt-0.5 font-mono text-lg font-semibold text-teal-800 tabular-nums">
                {totalCo2Kg.toLocaleString()} kg/yr
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">Urban NOₓ Prevented</div>
              <div className="mt-0.5 font-mono text-base font-semibold text-slate-900 tabular-nums">
                {totalNoxG.toLocaleString()} g/yr
              </div>
            </div>
            <div className="text-xs text-slate-500">
              Equivalent to ~{equivalentTrees} mature urban trees absorbing carbon annually.
            </div>
          </div>
        </div>
      </aside>

      {/* Main Swaps Ledger */}
      <div className="space-y-5 lg:col-span-9">
        {filteredSwaps.map((swap) => {
          const isAdopted = adoptedSwapIds.includes(swap.id);
          const aiAnalysis = analyses[swap.id];
          const err = errors[swap.id];

          return (
            <article
              key={swap.id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white"
            >
              <div className="grid grid-cols-1 md:grid-cols-12">
                {swap.imageUrl && (
                  <div className="relative min-h-[200px] bg-slate-100 md:col-span-4">
                    <img
                      src={swap.imageUrl}
                      alt={swap.title}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center -z-10 bg-slate-100 text-slate-500">
                      <Leaf className="h-8 w-8" />
                    </div>
                  </div>
                )}

                <div className={`p-6 ${swap.imageUrl ? "md:col-span-8" : "md:col-span-12"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        <span>{swap.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{swap.monthlyCostDelta}</span>
                      </div>
                      <h2 className="mt-1 font-display text-lg font-semibold text-slate-900">
                        {swap.title}
                      </h2>
                    </div>

                    <button
                      type="button"
                      onClick={() => onToggleSwap(swap.id)}
                      aria-pressed={isAdopted}
                      className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-teal-700 whitespace-nowrap shrink-0 ${
                        isAdopted
                          ? "bg-teal-700 text-white hover:bg-teal-800"
                          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {isAdopted && <Check className="h-3.5 w-3.5" />}
                      {isAdopted ? "Swap Adopted" : "Adopt Swap"}
                    </button>
                  </div>

                  {/* Habit Replacement Chain */}
                  <div className="mt-3 flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs sm:flex-row sm:items-center">
                    <span className="text-slate-500 line-through">{swap.replacingHabit}</span>
                    <ArrowRight className="hidden h-3.5 w-3.5 shrink-0 text-teal-700 sm:block" />
                    <span className="font-medium text-slate-900">{swap.swapAction}</span>
                  </div>

                  {/* Real-World Proof & Family Health Payoff */}
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <div className="text-xs font-medium text-slate-500">
                        Real-World Emissions & Exposure Proof
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-700">
                        {swap.realWorldProof}
                      </p>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-500">Family Health Payoff</div>
                      <p className="mt-1 text-xs leading-relaxed text-teal-900">
                        {swap.healthPayoff}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    <div className="font-mono text-xs text-slate-600 tabular-nums">
                      -{swap.annualCo2SavedKg} kg CO₂e/yr · -{swap.annualNoxSavedG} g NOₓ/yr
                      {swap.indoorPm25DeltaPct > 0 ? ` · -${swap.indoorPm25DeltaPct}% indoor PM2.5` : ""}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAnalyze(swap.id)}
                      disabled={analyzingId === swap.id}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-teal-700" />
                      {analyzingId === swap.id ? "Calculating..." : "Calculate Family Impact"}
                    </button>
                  </div>

                  {err && <p className="mt-3 text-xs text-red-600">{err}</p>}

                  {aiAnalysis && (
                    <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50/60 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-teal-900">
                        <span>Household Impact in {selectedCity.name}</span>
                        <span className="font-mono">{aiAnalysis.annualEmissionsImpact}</span>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-700">
                        {aiAnalysis.tailoredSummary}
                      </p>
                      <div className="mt-2 text-xs text-slate-600">
                        <span className="font-medium text-slate-800">Timeline:</span>{" "}
                        {aiAnalysis.healthPayoffTimeline}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};
