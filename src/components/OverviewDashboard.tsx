import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Wind,
} from "lucide-react";
import {
  ChartModeKey,
  LongitudinalExposureChart,
  TimeRangeKey,
} from "./LongitudinalExposureChart";
import {
  CityLocation,
  FamilyProfile,
  HealthLogEntry,
  LocalAirQualityData,
  NavSection,
} from "../types";
import {
  buildLongitudinalSeries,
  getSeverityStyle,
  summarizeLongTermHealth,
} from "../utils/healthCalculations";

interface OverviewDashboardProps {
  selectedCity: CityLocation;
  airQuality: LocalAirQualityData | null;
  loadingAq: boolean;
  aqError: string | null;
  onRetryAq: () => void;
  familyProfile: FamilyProfile;
  activeHackIds: string[];
  adoptedSwapIds: string[];
  healthLogs: HealthLogEntry[];
  onOpenCheckIn: () => void;
  onNavigate: (section: NavSection) => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  selectedCity,
  airQuality,
  loadingAq,
  aqError,
  onRetryAq,
  familyProfile,
  activeHackIds,
  adoptedSwapIds,
  healthLogs,
  onOpenCheckIn,
  onNavigate,
}) => {
  const [timeRange, setTimeRange] = useState<TimeRangeKey>("14d");
  const [chartMode, setChartMode] = useState<ChartModeKey>("exposure");

  const fullSeries = useMemo(() => {
    if (!airQuality?.dailyHistory) return [];
    return buildLongitudinalSeries(
      airQuality.dailyHistory,
      healthLogs,
      activeHackIds,
      adoptedSwapIds,
      familyProfile
    );
  }, [airQuality, healthLogs, activeHackIds, adoptedSwapIds, familyProfile]);

  const visibleSeries = useMemo(() => {
    return timeRange === "7d" ? fullSeries.slice(-7) : fullSeries;
  }, [fullSeries, timeRange]);

  const summary = useMemo(
    () =>
      summarizeLongTermHealth(
        visibleSeries,
        airQuality,
        activeHackIds,
        adoptedSwapIds,
        familyProfile
      ),
    [visibleSeries, airQuality, activeHackIds, adoptedSwapIds, familyProfile]
  );

  if (aqError) {
    return (
      <div className="rounded-xl border border-red-200 bg-white p-8">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Unable to load local air quality telemetry
            </h2>
            <p className="mt-1 text-sm text-slate-600">{aqError}</p>
            <button
              type="button"
              onClick={onRetryAq}
              className="mt-4 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 whitespace-nowrap"
            >
              Retry Telemetry Fetch
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loadingAq && !airQuality) {
    return (
      <div className="space-y-6">
        <div className="h-44 animate-pulse rounded-xl border border-slate-200 bg-white" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white" />
          ))}
        </div>
        <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white" />
      </div>
    );
  }

  const severity = airQuality ? getSeverityStyle(airQuality.current.severity) : getSeverityStyle("moderate");

  return (
    <div className="space-y-6">
      {/* Focal Anchor: Live Local Telemetry vs Family Protected Indoor Exposure */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-7">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span>{selectedCity.name}, {selectedCity.country}</span>
              <span aria-hidden="true">·</span>
              <span>{familyProfile.householdName}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                Observed {airQuality?.observedAt ? airQuality.observedAt.replace("T", " ") : "Live"}
              </span>
            </div>

            <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl [text-wrap:balance]">
              {airQuality
                ? `Local air is ${airQuality.current.category.toLowerCase()} at ${airQuality.current.usAqi} US AQI`
                : "Local Air Quality Overview"}
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
              With {summary.activeHacksCount} indoor air protections and {summary.adoptedSwapsCount} sustainable swaps active, your estimated indoor PM2.5 is{" "}
              <span className="font-mono font-semibold text-teal-800">
                {summary.estimatedIndoorNow} µg/m³
              </span>{" "}
              compared to{" "}
              <span className="font-mono font-semibold text-slate-900">
                {airQuality?.current.pm25 ?? 0} µg/m³
              </span>{" "}
              outdoors ({summary.protectionPct}% infiltration reduction).
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate("routines")}
                className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-800 whitespace-nowrap shrink-0"
              >
                Open Today's Routine
              </button>
              <button
                type="button"
                onClick={() => onNavigate("assistant")}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                Ask Air Quality Advisor
              </button>
            </div>
          </div>

          {/* Right Live Environmental Telemetry Grid */}
          <div className="grid grid-cols-2 gap-3 lg:col-span-5">
            <div className={`rounded-lg border p-4 ${severity.surface}`}>
              <div className="text-xs font-medium text-slate-600">Outdoor US AQI</div>
              <div className={`mt-1 font-mono text-3xl font-semibold tabular-nums ${severity.text}`}>
                {airQuality?.current.usAqi ?? "—"}
              </div>
              <div className={`mt-1 text-xs font-medium ${severity.text}`}>
                {airQuality?.current.category ?? "—"}
              </div>
            </div>

            <div className="rounded-lg border border-teal-200 bg-teal-50/70 p-4">
              <div className="text-xs font-medium text-slate-600">Est. Indoor PM2.5</div>
              <div className="mt-1 font-mono text-3xl font-semibold text-teal-800 tabular-nums">
                {summary.estimatedIndoorNow}
              </div>
              <div className="mt-1 text-xs font-medium text-teal-700">
                µg/m³ · WHO target ≤15
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
              <div className="text-xs text-slate-600">NO₂ / Ozone (O₃)</div>
              <div className="mt-1 font-mono text-base font-semibold text-slate-900 tabular-nums">
                {airQuality?.current.no2 ?? 0} / {airQuality?.current.o3 ?? 0} µg/m³
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
              <div className="text-xs text-slate-600">Ventilation Window</div>
              <div className="mt-1 flex items-center gap-1.5 font-mono text-base font-semibold text-slate-900 tabular-nums">
                <Wind className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />
                {airQuality
                  ? `${airQuality.ventilationWindow.startTime.slice(11, 16)}–${airQuality.ventilationWindow.endTime.slice(11, 16)}`
                  : "—"}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4-Column Longitudinal Health & Real-World Impact KPI Strip */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-600">
            {timeRange === "7d" ? "7-Day" : "14-Day"} Avg Outdoor vs Indoor
          </div>
          <div className="mt-2 flex items-baseline gap-2 font-mono tabular-nums">
            <span className="text-2xl font-semibold text-slate-900">
              {summary.avgIndoorPm25}
            </span>
            <span className="text-xs text-slate-600">
              vs {summary.avgOutdoorPm25} µg/m³ out
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-xs font-medium text-teal-700">
            <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{summary.protectionPct}% particulate infiltration blocked</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-600">Symptom-Free Comfort Days</div>
          <div className="mt-2 flex items-baseline gap-2 font-mono tabular-nums">
            <span className="text-2xl font-semibold text-slate-900">
              {summary.symptomFreeDays} / {visibleSeries.length}
            </span>
            <span className="text-xs text-slate-600">days scored ≥ 4/5</span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-700">
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {summary.comfortTrendDelta >= 0 ? `+${summary.comfortTrendDelta}` : summary.comfortTrendDelta} pt respiratory comfort trend
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-600">Clean-Air Days Reclaimed</div>
          <div className="mt-2 flex items-baseline gap-2 font-mono tabular-nums">
            <span className="text-2xl font-semibold text-slate-900">
              {summary.cleanAirDaysGained}
            </span>
            <span className="text-xs text-slate-600">polluted days neutralized indoors</span>
          </div>
          <div className="mt-2 text-xs text-slate-600 tabular-nums">
            {summary.totalPm25DoseAvoided} µg/m³·days cumulative PM2.5 avoided
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-600">Annual Household Impact</div>
          <div className="mt-2 flex items-baseline gap-2 font-mono tabular-nums">
            <span className="text-2xl font-semibold text-slate-900">
              {summary.annualCo2SavedKg.toLocaleString()} kg
            </span>
            <span className="text-xs text-slate-600">CO₂e / yr</span>
          </div>
          <div className="mt-2 text-xs text-slate-600 tabular-nums">
            {summary.annualNoxSavedG.toLocaleString()} g NOₓ avoided · {summary.no2ReductionPct}% indoor NO₂ drop
          </div>
        </div>
      </section>

      {/* Longitudinal Chart + Vertical Control Rail */}
      <LongitudinalExposureChart
        cityName={selectedCity.name}
        visibleSeries={visibleSeries}
        timeRange={timeRange}
        onChangeTimeRange={setTimeRange}
        chartMode={chartMode}
        onChangeChartMode={setChartMode}
        onOpenCheckIn={onOpenCheckIn}
      />

      {/* Daily Health & Exposure Ledger Table */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Daily Local Exposure & Health Log
            </h2>
            <p className="text-xs text-slate-600">
              Real local daily AQI paired with your household's indoor exposure reduction and check-ins.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenCheckIn}
            className="text-xs font-semibold text-teal-700 hover:text-teal-800 whitespace-nowrap"
          >
            + Add / Update Entry
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-600">
                <th className="px-6 py-3">Date</th>
                <th className="px-4 py-3 text-right">Local AQI</th>
                <th className="px-4 py-3 text-right">Outdoor PM2.5</th>
                <th className="px-4 py-3 text-right">Protected Indoor</th>
                <th className="px-4 py-3 text-right">Breathing Score</th>
                <th className="px-6 py-3">Daily Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...visibleSeries].reverse().map((row) => (
                <tr key={row.date} className="hover:bg-slate-50/80">
                  <td className="px-6 py-3 font-mono text-xs text-slate-700 whitespace-nowrap">
                    {row.shortDate}
                    {row.isUserLogged ? " · Logged" : ""}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs font-medium text-slate-900 tabular-nums">
                    {row.outdoorAqi}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-slate-600 tabular-nums">
                    {row.outdoorPm25} µg/m³
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-teal-800 tabular-nums">
                    {row.estimatedIndoorPm25} µg/m³
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs font-medium text-slate-800 tabular-nums">
                    {row.symptomScore} / 5
                  </td>
                  <td className="px-6 py-3 text-xs text-slate-600 max-w-xs truncate">
                    {row.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
