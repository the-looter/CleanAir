import React, { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Circle, RefreshCw, Shield, Wind } from "lucide-react";
import { generateTailoredRoutine } from "../services/api";
import {
  CityLocation,
  FamilyProfile,
  LocalAirQualityData,
  RoutinePlan,
} from "../types";

interface RoutinesViewProps {
  selectedCity: CityLocation;
  airQuality: LocalAirQualityData | null;
  familyProfile: FamilyProfile;
  activeHackIds: string[];
  adoptedSwapIds: string[];
  routinePlan: RoutinePlan | null;
  onUpdateRoutinePlan: (plan: RoutinePlan) => void;
  completedStepKeys: string[];
  onToggleStep: (stepKey: string) => void;
}

export const RoutinesView: React.FC<RoutinesViewProps> = ({
  selectedCity,
  airQuality,
  familyProfile,
  activeHackIds,
  adoptedSwapIds,
  routinePlan,
  onUpdateRoutinePlan,
  completedStepKeys,
  onToggleStep,
}) => {
  const [selectedDaypart, setSelectedDaypart] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!airQuality) return;
    setLoading(true);
    setError(null);
    try {
      const plan = await generateTailoredRoutine({
        locationName: `${selectedCity.name}, ${selectedCity.country}`,
        airQuality,
        familyProfile,
        activeHacks: activeHackIds,
        adoptedSwaps: adoptedSwapIds,
      });
      onUpdateRoutinePlan({
        ...plan,
        generatedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        locationName: selectedCity.name,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate tailored routine.");
    } finally {
      setLoading(false);
    }
  };

  // Auto-generate once when air quality is available and no routine exists yet for this city
  useEffect(() => {
    if (airQuality && (!routinePlan || routinePlan.locationName !== selectedCity.name) && !loading) {
      void handleGenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [airQuality, selectedCity.name]);

  const next24 = airQuality?.hourlyForecast.slice(0, 24) || [];
  const maxHourPm = Math.max(25, ...next24.map((h) => h.pm25));
  const ventStartPrefix = airQuality?.ventilationWindow.startTime.slice(0, 13);
  const ventEndPrefix = airQuality?.ventilationWindow.endTime.slice(0, 13);

  const dayparts = routinePlan?.dayparts || [];
  const filteredDayparts =
    selectedDaypart === "all"
      ? dayparts
      : dayparts.filter((d) => d.id === selectedDaypart || d.label === selectedDaypart);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left Vertical Daypart Menu Rail */}
      <nav aria-label="Routine schedule menu" className="lg:col-span-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="px-2 pb-2 text-xs font-medium text-slate-600">
            Routine Schedule Menu
          </div>
          <ul className="flex flex-col gap-1">
            <li>
              <button
                type="button"
                onClick={() => setSelectedDaypart("all")}
                aria-pressed={selectedDaypart === "all"}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-teal-700 ${
                  selectedDaypart === "all"
                    ? "bg-teal-50 font-semibold text-teal-900"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span>Full Day Schedule</span>
                <span className="font-mono text-xs text-slate-600">{dayparts.length}</span>
              </button>
            </li>
            {dayparts.map((dp) => (
              <li key={dp.id}>
                <button
                  type="button"
                  onClick={() => setSelectedDaypart(dp.id)}
                  aria-pressed={selectedDaypart === dp.id}
                  className={`flex w-full flex-col rounded-lg px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-teal-700 ${
                    selectedDaypart === dp.id
                      ? "bg-teal-50 text-teal-900"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <span className={`text-sm ${selectedDaypart === dp.id ? "font-semibold" : "font-medium"}`}>
                    {dp.label}
                  </span>
                  <span className="mt-0.5 font-mono text-xs text-slate-600">
                    {dp.timeRange}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-4 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading || !airQuality}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-3 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:opacity-50"
            >
              <RefreshCw aria-hidden="true" className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Synthesizing Routine..." : "Regenerate AI Routine"}
            </button>
          </div>
        </div>
      </nav>

      {/* Main Routine Workspace */}
      <div className="space-y-6 lg:col-span-9">
        {/* 24-Hour Local Forecast Strip */}
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs text-slate-600">
                {selectedCity.name} · Next 24-Hour PM2.5 Forecast
              </div>
              <h1 className="mt-1 font-display text-xl font-bold text-slate-900">
                Low-Emission Timing & Ventilation Window
              </h1>
            </div>
            {airQuality && (
              <div className="text-right text-xs text-slate-600">
                <div className="flex items-center justify-end gap-1.5 font-medium text-teal-800">
                  <Wind className="h-3.5 w-3.5" />
                  Best Open-Window Slot:{" "}
                  <span className="font-mono font-semibold">
                    {airQuality.ventilationWindow.startTime.slice(11, 16)}–
                    {airQuality.ventilationWindow.endTime.slice(11, 16)}
                  </span>
                </div>
                <div className="mt-0.5 font-mono text-slate-600">
                  Peak AQI {airQuality.peakNext24h.usAqi} around{" "}
                  {airQuality.peakNext24h.time.slice(11, 16)}
                </div>
              </div>
            )}
          </div>

          <div
            role="img"
            aria-label={`Next 24-hour PM2.5 forecast chart for ${selectedCity.name}`}
            className="mt-5 flex h-28 items-end gap-1 border-b border-slate-200 pb-2"
          >
            {next24.map((h) => {
              const heightPct = Math.max(10, Math.round((h.pm25 / maxHourPm) * 100));
              const prefix = h.time.slice(0, 13);
              const isVentWindow =
                ventStartPrefix &&
                ventEndPrefix &&
                prefix >= ventStartPrefix &&
                prefix <= ventEndPrefix;
              const barColor = isVentWindow
                ? "bg-teal-600"
                : h.usAqi > 150
                ? "bg-red-500"
                : h.usAqi > 100
                ? "bg-amber-500"
                : "bg-slate-300";

              return (
                <div
                  key={h.time}
                  className="group relative flex flex-1 flex-col items-center justify-end h-full"
                  title={`${h.time.slice(11, 16)} — US AQI ${h.usAqi}, PM2.5 ${h.pm25} µg/m³`}
                >
                  <div
                    className={`w-full rounded-t-sm transition-opacity group-hover:opacity-80 ${barColor}`}
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between font-mono text-[11px] text-slate-600">
            <span>{next24[0]?.time.slice(11, 16) || "Now"}</span>
            <span>+6h</span>
            <span>+12h</span>
            <span>+18h</span>
            <span>{next24[next24.length - 1]?.time.slice(11, 16) || "+24h"}</span>
          </div>
        </section>

        {error && (
          <div className="rounded-xl border border-red-200 bg-white p-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-slate-900">
                  Could not generate AI routine
                </h3>
                <p className="mt-1 text-xs text-slate-600">{error}</p>
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="mt-3 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}

        {loading && !routinePlan && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-36 animate-pulse rounded-xl border border-slate-200 bg-white" />
            ))}
          </div>
        )}

        {routinePlan && (
          <>
            {/* Executive Summary & Mask/Ventilation Guidance */}
            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                <span>
                  Tailored for {familyProfile.householdName} · {familyProfile.members.length} members · {familyProfile.homeType}
                </span>
                {routinePlan.generatedAt && (
                  <span className="font-mono">Updated {routinePlan.generatedAt}</span>
                )}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-800">{routinePlan.summary}</p>

              <div className="mt-4 grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3">
                <div>
                  <div className="text-xs font-medium text-slate-600">Mask & Transit Guidance</div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-700">
                    {routinePlan.maskGuidance}
                  </p>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-600">Ventilation Strategy</div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-700">
                    {routinePlan.ventilationAdvice}
                  </p>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-600">Estimated Routine Payoff</div>
                  <div className="mt-1 font-mono text-sm font-semibold text-teal-800 tabular-nums">
                    -{routinePlan.estimatedExposureReductionPct}% exposure ·{" "}
                    {routinePlan.estimatedDailyCo2SavedKg} kg CO₂e saved
                  </div>
                </div>
              </div>
            </section>

            {/* Daypart Routine Cards */}
            <div className="space-y-4">
              {filteredDayparts.map((dp) => (
                <section key={dp.id} className="rounded-xl border border-slate-200 bg-white p-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <span className="font-mono font-medium text-slate-700">{dp.timeRange}</span>
                        <span aria-hidden="true">·</span>
                        <span>Risk Level: {dp.riskLevel}</span>
                      </div>
                      <h2 className="mt-1 font-display text-base font-semibold text-slate-900">
                        {dp.label} — {dp.headline}
                      </h2>
                    </div>
                  </div>

                  <ul className="mt-4 divide-y divide-slate-100">
                    {dp.steps.map((step, idx) => {
                      const stepKey = `${dp.id}-${idx}`;
                      const checked = completedStepKeys.includes(stepKey);
                      return (
                        <li key={stepKey} className="py-3 first:pt-0 last:pb-0">
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              onClick={() => onToggleStep(stepKey)}
                              aria-pressed={checked}
                              aria-label={`Mark ${step.title} complete`}
                              className="mt-0.5 min-h-[36px] min-w-[36px] flex items-center justify-center shrink-0 text-slate-600 hover:text-teal-700 focus-visible:outline-2 focus-visible:outline-teal-700 rounded"
                            >
                              {checked ? (
                                <CheckCircle2 aria-hidden="true" className="h-5 w-5 text-teal-700" />
                              ) : (
                                <Circle aria-hidden="true" className="h-5 w-5" />
                              )}
                            </button>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`text-sm font-semibold ${
                                    checked ? "line-through text-slate-600" : "text-slate-900"
                                  }`}
                                >
                                  {step.title}
                                </span>
                                <span className="text-xs text-slate-600">· {step.category}</span>
                              </div>
                              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                                {step.detail}
                              </p>
                              <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-teal-800">
                                <Shield aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                                <span>Real-World Impact: {step.realWorldImpact}</span>
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
