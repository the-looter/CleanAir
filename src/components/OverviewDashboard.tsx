import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  Wind,
} from "lucide-react";
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

type TimeRangeKey = "7d" | "14d";
type ChartModeKey = "exposure" | "symptoms";

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

  // SVG chart geometry
  const svgW = 720;
  const svgH = 240;
  const padL = 42;
  const padR = 16;
  const padT = 18;
  const padB = 34;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const maxPmVal = Math.max(
    40,
    ...visibleSeries.map((d) => Math.max(d.outdoorPm25, d.estimatedIndoorPm25))
  );
  const yMax = Math.ceil(maxPmVal / 10) * 10;

  const xForIdx = (idx: number) => {
    if (visibleSeries.length <= 1) return padL + plotW / 2;
    return padL + (idx / (visibleSeries.length - 1)) * plotW;
  };
  const yForPm = (val: number) => padT + plotH - (val / yMax) * plotH;
  const yForScore = (score: number) => padT + plotH - ((score - 1) / 4) * plotH;

  const outdoorPath = visibleSeries
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xForIdx(i).toFixed(1)} ${yForPm(d.outdoorPm25).toFixed(1)}`)
    .join(" ");
  const indoorPath = visibleSeries
    .map(
      (d, i) =>
        `${i === 0 ? "M" : "L"} ${xForIdx(i).toFixed(1)} ${yForPm(d.estimatedIndoorPm25).toFixed(1)}`
    )
    .join(" ");
  const symptomPath = visibleSeries
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xForIdx(i).toFixed(1)} ${yForScore(d.symptomScore).toFixed(1)}`)
    .join(" ");

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
                <Wind className="h-3.5 w-3.5 text-teal-700" />
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
            <ArrowDownRight className="h-3.5 w-3.5" />
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
            <ArrowUpRight className="h-3.5 w-3.5" />
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
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Vertical Menu Controls for Chart Timeframe & Metric */}
          <div className="flex flex-col justify-between border-b border-slate-200 pb-5 lg:col-span-3 lg:border-r lg:border-b-0 lg:pr-6 lg:pb-0">
            <div className="space-y-5">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Long-Term Health & Local Exposure
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Compares real daily outdoor PM2.5 in {selectedCity.name} against your family's protected indoor air and logged breathing comfort.
                </p>
              </div>

              {/* Vertical Timeframe Menu */}
              <div>
                <div className="pb-1.5 text-xs font-medium text-slate-600">Time Horizon</div>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => setTimeRange("14d")}
                    aria-pressed={timeRange === "14d"}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-teal-700 ${
                      timeRange === "14d"
                        ? "bg-teal-50 text-teal-900 font-semibold"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span>14-Day Local Window</span>
                    <span className="font-mono text-slate-600">14d</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimeRange("7d")}
                    aria-pressed={timeRange === "7d"}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-teal-700 ${
                      timeRange === "7d"
                        ? "bg-teal-50 text-teal-900 font-semibold"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span>Past 7 Days Focus</span>
                    <span className="font-mono text-slate-600">7d</span>
                  </button>
                </div>
              </div>

              {/* Vertical Chart Series Menu */}
              <div>
                <div className="pb-1.5 text-xs font-medium text-slate-600">Chart View</div>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => setChartMode("exposure")}
                    aria-pressed={chartMode === "exposure"}
                    className={`w-full rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-teal-700 ${
                      chartMode === "exposure"
                        ? "bg-teal-50 text-teal-900 font-semibold"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    Outdoor vs. Indoor PM2.5
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartMode("symptoms")}
                    aria-pressed={chartMode === "symptoms"}
                    className={`w-full rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-teal-700 ${
                      chartMode === "symptoms"
                        ? "bg-teal-50 text-teal-900 font-semibold"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    Respiratory Comfort Score (1–5)
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenCheckIn}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
            >
              <Calendar className="h-3.5 w-3.5 text-teal-700" />
              Log Today's Symptoms
            </button>
          </div>

          {/* Chart Viewport */}
          <div className="lg:col-span-9">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
              {chartMode === "exposure" ? (
                <div className="flex items-center gap-5">
                  <span className="flex items-center gap-2">
                    <span className="inline-block h-0.5 w-4 bg-slate-400" />
                    Outdoor Local PM2.5 (µg/m³)
                  </span>
                  <span className="flex items-center gap-2 font-medium text-teal-800">
                    <span className="inline-block h-0.5 w-4 bg-teal-700" />
                    Protected Indoor PM2.5 (µg/m³)
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-5">
                  <span className="flex items-center gap-2 font-medium text-emerald-800">
                    <span className="inline-block h-0.5 w-4 bg-emerald-600" />
                    Daily Breathing Comfort (1 = irritated, 5 = clear & rested)
                  </span>
                </div>
              )}
              <span className="font-mono text-slate-600">WHO 24h Guideline: 15 µg/m³</span>
            </div>

            <div className="w-full overflow-x-auto">
              <svg
                viewBox={`0 0 ${svgW} ${svgH}`}
                className="h-60 w-full min-w-[520px]"
                role="img"
                aria-label="Longitudinal air exposure and family health chart"
              >
                <title>
                  {chartMode === "exposure"
                    ? `Outdoor vs Protected Indoor PM2.5 in ${selectedCity.name} over ${visibleSeries.length} days`
                    : `Daily respiratory comfort scores over ${visibleSeries.length} days`}
                </title>
                {/* Horizontal gridlines */}
                {chartMode === "exposure"
                  ? [0, 0.25, 0.5, 0.75, 1].map((t) => {
                      const val = Math.round(yMax * t);
                      const y = yForPm(val);
                      return (
                        <g key={t}>
                          <line
                            x1={padL}
                            y1={y}
                            x2={svgW - padR}
                            y2={y}
                            stroke="#e2e8f0"
                            strokeDasharray="3 3"
                          />
                          <text
                            x={padL - 8}
                            y={y + 4}
                            textAnchor="end"
                            className="fill-slate-600 font-mono text-[10px]"
                          >
                            {val}
                          </text>
                        </g>
                      );
                    })
                  : [1, 2, 3, 4, 5].map((score) => {
                      const y = yForScore(score);
                      return (
                        <g key={score}>
                          <line
                            x1={padL}
                            y1={y}
                            x2={svgW - padR}
                            y2={y}
                            stroke="#e2e8f0"
                            strokeDasharray="3 3"
                          />
                          <text
                            x={padL - 8}
                            y={y + 4}
                            textAnchor="end"
                            className="fill-slate-600 font-mono text-[10px]"
                          >
                            {score}/5
                          </text>
                        </g>
                      );
                    })}

                {/* WHO 15 ug/m3 threshold line in exposure mode */}
                {chartMode === "exposure" && yMax >= 15 && (
                  <line
                    x1={padL}
                    y1={yForPm(15)}
                    x2={svgW - padR}
                    y2={yForPm(15)}
                    stroke="#0f766e"
                    strokeOpacity={0.35}
                    strokeDasharray="5 4"
                  />
                )}

                {chartMode === "exposure" ? (
                  <>
                    <path
                      d={outdoorPath}
                      fill="none"
                      stroke="#64748b"
                      strokeWidth="2"
                      strokeLinejoin="round"
                    />
                    <path
                      d={indoorPath}
                      fill="none"
                      stroke="#0f766e"
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                    />
                    {visibleSeries.map((d, i) => (
                      <g key={d.date}>
                        <circle
                          cx={xForIdx(i)}
                          cy={yForPm(d.outdoorPm25)}
                          r="3"
                          className="fill-slate-500"
                        />
                        <circle
                          cx={xForIdx(i)}
                          cy={yForPm(d.estimatedIndoorPm25)}
                          r="3.5"
                          className="fill-teal-700"
                        />
                      </g>
                    ))}
                  </>
                ) : (
                  <>
                    <path
                      d={symptomPath}
                      fill="none"
                      stroke="#16a34a"
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                    />
                    {visibleSeries.map((d, i) => (
                      <circle
                        key={d.date}
                        cx={xForIdx(i)}
                        cy={yForScore(d.symptomScore)}
                        r={d.isUserLogged ? "4.5" : "3.5"}
                        className={d.isUserLogged ? "fill-teal-700" : "fill-emerald-600"}
                      />
                    ))}
                  </>
                )}

                {/* X-axis labels */}
                {visibleSeries.map((d, i) => {
                  const showLabel =
                    visibleSeries.length <= 8 || i % 2 === 0 || i === visibleSeries.length - 1;
                  if (!showLabel) return null;
                  return (
                    <text
                      key={d.date}
                      x={xForIdx(i)}
                      y={svgH - 8}
                      textAnchor="middle"
                      className="fill-slate-600 font-mono text-[10px]"
                    >
                      {d.shortDate}
                    </text>
                  );
                })}
              </svg>
            </div>
          </div>
        </div>
      </section>

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
