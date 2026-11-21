import React, { useState } from "react";
import { Check, Sparkles, Wind } from "lucide-react";
import { INDOOR_HACKS } from "../data/knowledgeBase";
import { analyzeRealWorldImpact } from "../services/api";
import {
  AiImpactAnalysis,
  CityLocation,
  FamilyProfile,
  HackCategory,
  LocalAirQualityData,
} from "../types";

interface IndoorHacksViewProps {
  selectedCity: CityLocation;
  airQuality: LocalAirQualityData | null;
  familyProfile: FamilyProfile;
  activeHackIds: string[];
  onToggleHack: (hackId: string) => void;
}

const HACK_CATEGORIES: HackCategory[] = [
  "All Playbooks",
  "Filtration & DIY",
  "Bedroom Sanctuary",
  "Kitchen & Cooking",
  "Sealing & Ventilation",
];

export const IndoorHacksView: React.FC<IndoorHacksViewProps> = ({
  selectedCity,
  airQuality,
  familyProfile,
  activeHackIds,
  onToggleHack,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<HackCategory>("All Playbooks");
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<Record<string, AiImpactAnalysis>>({});
  const [analysisErrors, setAnalysisErrors] = useState<Record<string, string>>({});

  const filteredHacks =
    selectedCategory === "All Playbooks"
      ? INDOOR_HACKS
      : INDOOR_HACKS.filter((h) => h.category === selectedCategory);

  const handleAnalyze = async (hackId: string) => {
    const hack = INDOOR_HACKS.find((h) => h.id === hackId);
    if (!hack) return;
    setAnalyzingId(hackId);
    setAnalysisErrors((prev) => ({ ...prev, [hackId]: "" }));
    try {
      const result = await analyzeRealWorldImpact({
        itemTitle: hack.title,
        itemType: "Indoor Air Hack",
        baselineImpact: hack.realWorldImpact,
        locationName: selectedCity.name,
        currentAqi: airQuality?.current.usAqi ?? 100,
        currentPm25: airQuality?.current.pm25 ?? 35,
        currentNo2: airQuality?.current.no2 ?? 25,
        familyProfile,
      });
      setAnalyses((prev) => ({ ...prev, [hackId]: result }));
    } catch (err) {
      setAnalysisErrors((prev) => ({
        ...prev,
        [hackId]: err instanceof Error ? err.message : "Could not analyze impact",
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
            Indoor Hack Categories
          </div>
          <ul className="flex flex-col gap-1">
            {HACK_CATEGORIES.map((cat) => {
              const count =
                cat === "All Playbooks"
                  ? INDOOR_HACKS.length
                  : INDOOR_HACKS.filter((h) => h.category === cat).length;
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

          <div className="mt-5 border-t border-slate-200 pt-4 px-2">
            <div className="text-xs font-medium text-slate-500">Active in Home</div>
            <div className="mt-1 font-mono text-xl font-semibold text-teal-800 tabular-nums">
              {activeHackIds.length} / {INDOOR_HACKS.length}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Toggling protections active automatically updates your indoor exposure curve on the dashboard.
            </p>
          </div>
        </div>
      </aside>

      {/* Main Indoor Hacks Grid */}
      <div className="space-y-5 lg:col-span-9">
        {filteredHacks.map((hack) => {
          const isActive = activeHackIds.includes(hack.id);
          const aiAnalysis = analyses[hack.id];
          const aiError = analysisErrors[hack.id];

          return (
            <article
              key={hack.id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white"
            >
              <div className="grid grid-cols-1 md:grid-cols-12">
                {hack.imageUrl && (
                  <div className="relative min-h-[200px] bg-slate-100 md:col-span-4">
                    <img
                      src={hack.imageUrl}
                      alt={hack.title}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center -z-10 bg-slate-100 text-slate-500">
                      <Wind className="h-8 w-8" />
                    </div>
                  </div>
                )}

                <div className={`p-6 ${hack.imageUrl ? "md:col-span-8" : "md:col-span-12"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        <span>{hack.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{hack.difficulty}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{hack.estimatedCost}</span>
                      </div>
                      <h2 className="mt-1 font-display text-lg font-semibold text-slate-900">
                        {hack.title}
                      </h2>
                    </div>

                    <button
                      type="button"
                      onClick={() => onToggleHack(hack.id)}
                      aria-pressed={isActive}
                      className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-teal-700 whitespace-nowrap shrink-0 ${
                        isActive
                          ? "bg-teal-700 text-white hover:bg-teal-800"
                          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {isActive && <Check className="h-3.5 w-3.5" />}
                      {isActive ? "Active in Home" : "Activate Protection"}
                    </button>
                  </div>

                  <p className="mt-2.5 text-sm leading-relaxed text-slate-600">{hack.summary}</p>

                  {/* Real-World Impact & Physics */}
                  <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
                    <div>
                      <div className="text-xs font-medium text-slate-500">Real-World Impact</div>
                      <p className="mt-1 text-xs leading-relaxed text-teal-900">
                        {hack.realWorldImpact}
                      </p>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-500">Filtration Mechanism</div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        {hack.scienceMechanism}
                      </p>
                    </div>
                  </div>

                  {/* Step Checklist */}
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <div className="text-xs font-medium text-slate-500">Setup Steps</div>
                    <ol className="mt-1.5 space-y-1 text-xs text-slate-700">
                      {hack.steps.map((step, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="font-mono font-semibold text-slate-500">
                            0{idx + 1}.
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* GenAI Custom Home Analysis */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    <div className="font-mono text-xs text-slate-600 tabular-nums">
                      Baseline Effect: -{hack.pm25ReductionPct}% PM2.5 · -{hack.no2ReductionPct}% NO₂
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAnalyze(hack.id)}
                      disabled={analyzingId === hack.id}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-teal-700" />
                      {analyzingId === hack.id ? "Analyzing Home..." : "Analyze for My Home"}
                    </button>
                  </div>

                  {aiError && (
                    <p className="mt-3 text-xs text-red-600">{aiError}</p>
                  )}

                  {aiAnalysis && (
                    <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50/60 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-teal-900">
                        <span>Tailored Analysis for {selectedCity.name} ({familyProfile.homeType})</span>
                        <span className="font-mono">
                          -{aiAnalysis.estimatedIndoorDropUgM3} µg/m³ est. indoor drop
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-700">
                        {aiAnalysis.tailoredSummary}
                      </p>
                      <div className="mt-2 text-xs text-slate-600">
                        <span className="font-medium text-slate-800">Health Payoff:</span>{" "}
                        {aiAnalysis.healthPayoffTimeline}
                      </div>
                      <ul className="mt-2 space-y-1 text-xs text-slate-700">
                        {aiAnalysis.customSteps.map((s, i) => (
                          <li key={i}>• {s}</li>
                        ))}
                      </ul>
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
