import React from "react";
import { Calendar } from "lucide-react";
import { LongitudinalDayPoint } from "../utils/healthCalculations";

export type TimeRangeKey = "7d" | "14d";
export type ChartModeKey = "exposure" | "symptoms";

interface LongitudinalExposureChartProps {
  cityName: string;
  visibleSeries: LongitudinalDayPoint[];
  timeRange: TimeRangeKey;
  onChangeTimeRange: (range: TimeRangeKey) => void;
  chartMode: ChartModeKey;
  onChangeChartMode: (mode: ChartModeKey) => void;
  onOpenCheckIn: () => void;
}

const SVG_W = 720;
const SVG_H = 240;
const PAD_L = 42;
const PAD_R = 16;
const PAD_T = 18;
const PAD_B = 34;
const PLOT_W = SVG_W - PAD_L - PAD_R;
const PLOT_H = SVG_H - PAD_T - PAD_B;

export const LongitudinalExposureChart: React.FC<LongitudinalExposureChartProps> = ({
  cityName,
  visibleSeries,
  timeRange,
  onChangeTimeRange,
  chartMode,
  onChangeChartMode,
  onOpenCheckIn,
}) => {
  const maxPmVal = Math.max(
    40,
    ...visibleSeries.map((d) => Math.max(d.outdoorPm25, d.estimatedIndoorPm25))
  );
  const yMax = Math.ceil(maxPmVal / 10) * 10;

  const xForIdx = (idx: number) => {
    if (visibleSeries.length <= 1) return PAD_L + PLOT_W / 2;
    return PAD_L + (idx / (visibleSeries.length - 1)) * PLOT_W;
  };
  const yForPm = (val: number) => PAD_T + PLOT_H - (val / yMax) * PLOT_H;
  const yForScore = (score: number) => PAD_T + PLOT_H - ((score - 1) / 4) * PLOT_H;

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
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Vertical Menu Controls for Chart Timeframe & Metric */}
        <div className="flex flex-col justify-between border-b border-slate-200 pb-5 lg:col-span-3 lg:border-r lg:border-b-0 lg:pr-6 lg:pb-0">
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Long-Term Health &amp; Local Exposure
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Compares real daily outdoor PM2.5 in {cityName} against your family's protected indoor air and logged breathing comfort.
              </p>
            </div>

            {/* Vertical Timeframe Menu */}
            <div>
              <div className="pb-1.5 text-xs font-medium text-slate-600">Time Horizon</div>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => onChangeTimeRange("14d")}
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
                  onClick={() => onChangeTimeRange("7d")}
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
                  onClick={() => onChangeChartMode("exposure")}
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
                  onClick={() => onChangeChartMode("symptoms")}
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
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            <Calendar className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />
            Log Today's Symptoms
          </button>
        </div>

        {/* Chart Viewport */}
        <div className="lg:col-span-9">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            {chartMode === "exposure" ? (
              <div className="flex items-center gap-5">
                <span className="flex items-center gap-2">
                  <span className="inline-block h-0.5 w-4 bg-slate-500" />
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
                  Daily Breathing Comfort (1 = irritated, 5 = clear &amp; rested)
                </span>
              </div>
            )}
            <span className="font-mono text-slate-600">WHO 24h Guideline: 15 µg/m³</span>
          </div>

          <div className="w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              className="h-60 w-full min-w-[520px]"
              role="img"
              aria-label="Longitudinal air exposure and family health chart"
            >
              <title>
                {chartMode === "exposure"
                  ? `Outdoor vs Protected Indoor PM2.5 in ${cityName} over ${visibleSeries.length} days`
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
                          x1={PAD_L}
                          y1={y}
                          x2={SVG_W - PAD_R}
                          y2={y}
                          stroke="#e2e8f0"
                          strokeDasharray="3 3"
                        />
                        <text
                          x={PAD_L - 8}
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
                          x1={PAD_L}
                          y1={y}
                          x2={SVG_W - PAD_R}
                          y2={y}
                          stroke="#e2e8f0"
                          strokeDasharray="3 3"
                        />
                        <text
                          x={PAD_L - 8}
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
                  x1={PAD_L}
                  y1={yForPm(15)}
                  x2={SVG_W - PAD_R}
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
                    y={SVG_H - 8}
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
  );
};
