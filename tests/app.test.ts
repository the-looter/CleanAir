import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, it } from "node:test";
import { createApiApp, getAqiCategory } from "../server";
import { DEFAULT_FAMILY_PROFILE } from "../src/data/knowledgeBase";
import { DailyAirHistoryPoint, HealthLogEntry } from "../src/types";
import {
  buildLongitudinalSeries,
  calculateProtectionProfile,
  getSeverityStyle,
  summarizeLongTermHealth,
} from "../src/utils/healthCalculations";

describe("Environmental Health & Longitudinal Exposure Calculations", () => {
  it("computes stronger PM2.5 and NO2 protection as hacks and swaps are enabled", () => {
    const baseline = calculateProtectionProfile([], [], {
      ...DEFAULT_FAMILY_PROFILE,
      purifierCount: 0,
      stoveType: "Gas Range",
    });
    const protectedProfile = calculateProtectionProfile(
      ["corsi-rosenthal-diy", "bedroom-clean-zone", "kitchen-capture-hood"],
      ["portable-induction-hob", "cargo-ebike-school"],
      {
        ...DEFAULT_FAMILY_PROFILE,
        purifierCount: 2,
      }
    );

    assert.ok(protectedProfile.indoorRatio < baseline.indoorRatio);
    assert.ok(protectedProfile.protectionPct > baseline.protectionPct);
    assert.ok(protectedProfile.indoorRatio >= 0.16 && protectedProfile.indoorRatio <= 0.92);
    assert.equal(protectedProfile.annualCo2SavedKg, 990);
    assert.equal(protectedProfile.annualNoxSavedG, 3550);
  });

  it("maps 14-day local air history and applies explicit user check-ins cleanly", () => {
    const mockHistory: DailyAirHistoryPoint[] = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-11-${String(i + 1).padStart(2, "0")}`,
      avgAqi: 165,
      peakAqi: 210,
      avgPm25: 85,
      peakPm25: 120,
      avgNo2: 38,
      avgO3: 65,
    }));

    const userLogs: HealthLogEntry[] = [
      {
        date: "2026-11-14",
        symptomScore: 5,
        sleepQuality: 5,
        outdoorMinutes: 20,
        routineFollowed: true,
        notes: "Clear breathing indoors all day",
        isUserLogged: true,
      },
    ];

    const series = buildLongitudinalSeries(
      mockHistory,
      userLogs,
      ["corsi-rosenthal-diy", "bedroom-clean-zone"],
      ["portable-induction-hob"],
      DEFAULT_FAMILY_PROFILE
    );

    assert.equal(series.length, 14);
    for (const point of series) {
      assert.ok(point.estimatedIndoorPm25 < point.outdoorPm25);
      assert.ok(point.pm25Avoided > 0);
    }

    const latest = series[13];
    assert.equal(latest.isUserLogged, true);
    assert.equal(latest.symptomScore, 5);
    assert.equal(latest.notes, "Clear breathing indoors all day");

    const summary = summarizeLongTermHealth(
      series,
      null,
      ["corsi-rosenthal-diy", "bedroom-clean-zone"],
      ["portable-induction-hob"],
      DEFAULT_FAMILY_PROFILE
    );
    assert.ok(summary.totalPm25DoseAvoided > 0);
    assert.ok(summary.symptomFreeDays >= 1);
  });

  it("handles empty history gracefully and maps severity styles accurately", () => {
    const emptySummary = summarizeLongTermHealth([], null, [], [], DEFAULT_FAMILY_PROFILE);
    assert.equal(emptySummary.avgOutdoorPm25, 0);
    assert.equal(emptySummary.cleanAirDaysGained, 0);

    assert.equal(getAqiCategory(35).severity, "good");
    assert.equal(getAqiCategory(85).severity, "moderate");
    assert.equal(getAqiCategory(165).severity, "unhealthy");
    assert.equal(getAqiCategory(240).severity, "severe");
    assert.equal(getSeverityStyle("severe").label, "Severe Pollution");
  });
});

describe("API Route Validation, Caching & Efficiency", () => {
  let server: http.Server;
  let baseUrl: string;

  before(async () => {
    const app = createApiApp();
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = server.address() as { port: number };
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("rejects invalid coordinates on /api/air-quality with 400", async () => {
    const res1 = await fetch(`${baseUrl}/api/air-quality`);
    assert.equal(res1.status, 400);

    const res2 = await fetch(`${baseUrl}/api/air-quality?lat=120&lon=40`);
    assert.equal(res2.status, 400);
  });

  it("returns empty array for short queries on /api/locations/search", async () => {
    const res = await fetch(`${baseUrl}/api/locations/search?q=a`);
    assert.equal(res.status, 200);
    const data = (await res.json()) as { results: unknown[] };
    assert.deepEqual(data.results, []);
  });

  it("validates required payloads on AI endpoints cleanly", async () => {
    const routineRes = await fetch(`${baseUrl}/api/assistant/routine`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(routineRes.status, 400);

    const chatRes = await fetch(`${baseUrl}/api/assistant/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(chatRes.status, 400);

    const streamRes = await fetch(`${baseUrl}/api/assistant/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(streamRes.status, 400);
  });

  it("fetches live Open-Meteo telemetry and serves cached hits efficiently", async () => {
    const res1 = await fetch(`${baseUrl}/api/air-quality?lat=28.6139&lon=77.209`);
    assert.equal(res1.status, 200);
    const data = (await res1.json()) as {
      current: { usAqi: number; pm25: number };
      ventilationWindow: { startTime: string; endTime: string };
      hourlyForecast: unknown[];
      dailyHistory: unknown[];
    };
    assert.equal(typeof data.current.usAqi, "number");
    assert.ok(data.hourlyForecast.length >= 24);
    assert.ok(data.dailyHistory.length >= 10);
    assert.ok(data.ventilationWindow.startTime.length > 0);

    const start = performance.now();
    const res2 = await fetch(`${baseUrl}/api/air-quality?lat=28.6139&lon=77.209`);
    const elapsedMs = performance.now() - start;
    assert.equal(res2.status, 200);
    assert.ok(elapsedMs < 100, `Expected cached response <100ms, got ${elapsedMs.toFixed(1)}ms`);
  });
});
