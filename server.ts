import "dotenv/config";
import express, { type Request, type Response } from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, LiveServerMessage, Modality, ThinkingLevel, Type } from "@google/genai";
import { WebSocketServer } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in environment secrets.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

const aqCache = new Map<string, { data: unknown; expiresAt: number }>();
const aqInflight = new Map<string, Promise<unknown>>();
const geoCache = new Map<string, { data: unknown; expiresAt: number }>();

const AQ_TTL_MS = 5 * 60 * 1000;
const GEO_TTL_MS = 30 * 60 * 1000;

export function getAqiCategory(aqi: number): { label: string; severity: "good" | "moderate" | "unhealthy" | "severe" } {
  if (aqi <= 50) return { label: "Good", severity: "good" };
  if (aqi <= 100) return { label: "Moderate", severity: "moderate" };
  if (aqi <= 150) return { label: "Unhealthy for Sensitive Groups", severity: "unhealthy" };
  if (aqi <= 200) return { label: "Unhealthy", severity: "unhealthy" };
  if (aqi <= 300) return { label: "Very Unhealthy", severity: "severe" };
  return { label: "Hazardous", severity: "severe" };
}

function handleGeminiError(err: unknown, res: Response) {
  const message = err instanceof Error ? err.message : "Unknown Gemini API error";
  const statusMatch = message.match(/\b(400|403|404|429|500|503)\b/);
  const statusCode = statusMatch ? Number(statusMatch[1]) : 500;

  if (message.includes("GEMINI_API_KEY is not configured")) {
    return res.status(500).json({
      error: "AI service key is not configured. Please verify GEMINI_API_KEY in Settings > Secrets.",
    });
  }
  if (statusCode === 403 || message.includes("PERMISSION_DENIED")) {
    return res.status(403).json({
      error: "Gemini API permission denied. Please verify your API key in Settings > Secrets.",
    });
  }
  if (statusCode === 429 || message.includes("RESOURCE_EXHAUSTED")) {
    return res.status(429).json({
      error: "Rate limit reached on the AI service. Please wait a moment and try again.",
    });
  }
  if (statusCode === 404 || message.includes("NOT_FOUND")) {
    return res.status(404).json({
      error: "Requested Gemini model could not be found.",
    });
  }
  return res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
    error: `Unable to generate AI guidance: ${message}`,
  });
}

export function createApiApp() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  // 1. Search locations via Open-Meteo Geocoding API (cached 30 min)
  app.get("/api/locations/search", async (req: Request, res: Response) => {
    const query = String(req.query.q || "").trim();
    if (query.length < 2) {
      return res.json({ results: [] });
    }
    const cacheKey = query.toLowerCase();
    const cached = geoCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      res.setHeader("Cache-Control", "public, max-age=300");
      return res.json(cached.data);
    }

    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        query
      )}&count=6&language=en&format=json`;
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) {
        throw new Error(`Geocoding service returned HTTP ${response.status}`);
      }
      const data = (await response.json()) as {
        results?: Array<{
          id: number;
          name: string;
          country: string;
          admin1?: string;
          latitude: number;
          longitude: number;
          timezone?: string;
        }>;
      };
      const results = (data.results || []).map((r) => ({
        id: String(r.id),
        name: r.name,
        region: [r.admin1, r.country].filter(Boolean).join(", "),
        country: r.country,
        lat: r.latitude,
        lon: r.longitude,
        timezone: r.timezone || "auto",
      }));
      const payload = { results };
      geoCache.set(cacheKey, { data: payload, expiresAt: Date.now() + GEO_TTL_MS });
      res.setHeader("Cache-Control", "public, max-age=300");
      return res.json(payload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Geocoding request failed";
      return res.status(502).json({ error: `Location search failed: ${msg}` });
    }
  });

  // 2. Fetch live + 14-day historical + 48h forecast air quality and weather (cached 5 min + deduped)
  app.get("/api/air-quality", async (req: Request, res: Response) => {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    if (
      req.query.lat === undefined ||
      req.query.lon === undefined ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180
    ) {
      return res.status(400).json({ error: "Valid lat (-90..90) and lon (-180..180) query parameters are required." });
    }

    const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)}`;
    const cached = aqCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      res.setHeader("Cache-Control", "public, max-age=60");
      return res.json(cached.data);
    }

    try {
      let pending = aqInflight.get(cacheKey);
      if (!pending) {
        pending = (async () => {
          const aqUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,european_aqi&hourly=us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone&past_days=14&forecast_days=3&timezone=auto`;
          const wxUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m&hourly=temperature_2m,wind_speed_10m&past_days=14&forecast_days=3&timezone=auto`;

          const [aqRes, wxRes] = await Promise.all([
            fetch(aqUrl, { signal: AbortSignal.timeout(8000) }),
            fetch(wxUrl, { signal: AbortSignal.timeout(8000) }),
          ]);
          if (!aqRes.ok) {
            throw new Error(`Air Quality API returned HTTP ${aqRes.status}`);
          }

      const aq = (await aqRes.json()) as {
        timezone: string;
        current: {
          time: string;
          us_aqi: number;
          european_aqi: number;
          pm2_5: number;
          pm10: number;
          nitrogen_dioxide: number;
          ozone: number;
          sulphur_dioxide: number;
          carbon_monoxide: number;
        };
        hourly: {
          time: string[];
          us_aqi: (number | null)[];
          pm2_5: (number | null)[];
          pm10: (number | null)[];
          nitrogen_dioxide: (number | null)[];
          ozone: (number | null)[];
        };
      };

      let wxCurrent = { temperature_2m: 22, relative_humidity_2m: 50, wind_speed_10m: 8 };
      let wxHourlyWind: (number | null)[] = [];
      if (wxRes.ok) {
        const wx = (await wxRes.json()) as {
          current?: {
            temperature_2m?: number;
            relative_humidity_2m?: number;
            wind_speed_10m?: number;
          };
          hourly?: {
            wind_speed_10m?: (number | null)[];
          };
        };
        if (wx.current) {
          wxCurrent = {
            temperature_2m: wx.current.temperature_2m ?? 22,
            relative_humidity_2m: wx.current.relative_humidity_2m ?? 50,
            wind_speed_10m: wx.current.wind_speed_10m ?? 8,
          };
        }
        wxHourlyWind = wx.hourly?.wind_speed_10m || [];
      }

      const times = aq.hourly.time || [];
      const currentTimeStr = aq.current.time;
      const currentDatePrefix = currentTimeStr.slice(0, 13);
      let nowIdx = times.findIndex((t) => t.startsWith(currentDatePrefix));
      if (nowIdx === -1) {
        nowIdx = Math.max(0, times.length - 72);
      }

      // Build next 24h and 48h forecast slices
      const hourlyForecast = [];
      for (let i = nowIdx; i < Math.min(times.length, nowIdx + 48); i++) {
        hourlyForecast.push({
          time: times[i],
          usAqi: Math.round(aq.hourly.us_aqi[i] ?? aq.current.us_aqi ?? 0),
          pm25: Number((aq.hourly.pm2_5[i] ?? aq.current.pm2_5 ?? 0).toFixed(1)),
          pm10: Number((aq.hourly.pm10[i] ?? aq.current.pm10 ?? 0).toFixed(1)),
          no2: Number((aq.hourly.nitrogen_dioxide[i] ?? aq.current.nitrogen_dioxide ?? 0).toFixed(1)),
          o3: Number((aq.hourly.ozone[i] ?? aq.current.ozone ?? 0).toFixed(1)),
          windSpeed: Number((wxHourlyWind[i] ?? wxCurrent.wind_speed_10m ?? 6).toFixed(1)),
        });
      }

      // Find best 2-hour ventilation window in next 24h
      const next24 = hourlyForecast.slice(0, 24);
      let bestStartIdx = 0;
      let lowestAvgPm25 = Infinity;
      for (let i = 0; i < Math.max(1, next24.length - 1); i++) {
        const pairAvg = (next24[i].pm25 + (next24[i + 1]?.pm25 ?? next24[i].pm25)) / 2;
        if (pairAvg < lowestAvgPm25) {
          lowestAvgPm25 = pairAvg;
          bestStartIdx = i;
        }
      }
      const bestWindowStart = next24[bestStartIdx]?.time || currentTimeStr;
      const bestWindowEnd = next24[Math.min(bestStartIdx + 2, next24.length - 1)]?.time || currentTimeStr;
      const peak24h = next24.reduce(
        (max, h) => (h.usAqi > max.usAqi ? h : max),
        next24[0] || { time: currentTimeStr, usAqi: aq.current.us_aqi, pm25: aq.current.pm2_5 }
      );

      // Aggregate 14-day daily history up to today
      const dailyMap = new Map<
        string,
        { aqiSum: number; aqiMax: number; pm25Sum: number; pm25Max: number; no2Sum: number; o3Sum: number; count: number }
      >();
      const todayDate = currentTimeStr.slice(0, 10);
      for (let i = 0; i <= Math.min(nowIdx, times.length - 1); i++) {
        const date = times[i].slice(0, 10);
        if (date > todayDate) continue;
        const aqiVal = aq.hourly.us_aqi[i];
        const pm25Val = aq.hourly.pm2_5[i];
        if (aqiVal === null || pm25Val === null) continue;
        const entry = dailyMap.get(date) || {
          aqiSum: 0,
          aqiMax: 0,
          pm25Sum: 0,
          pm25Max: 0,
          no2Sum: 0,
          o3Sum: 0,
          count: 0,
        };
        entry.aqiSum += aqiVal;
        entry.aqiMax = Math.max(entry.aqiMax, aqiVal);
        entry.pm25Sum += pm25Val;
        entry.pm25Max = Math.max(entry.pm25Max, pm25Val);
        entry.no2Sum += aq.hourly.nitrogen_dioxide[i] ?? 0;
        entry.o3Sum += aq.hourly.ozone[i] ?? 0;
        entry.count += 1;
        dailyMap.set(date, entry);
      }

      const dailyHistory = Array.from(dailyMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-14)
        .map(([date, agg]) => ({
          date,
          avgAqi: Math.round(agg.aqiSum / agg.count),
          peakAqi: Math.round(agg.aqiMax),
          avgPm25: Number((agg.pm25Sum / agg.count).toFixed(1)),
          peakPm25: Number(agg.pm25Max.toFixed(1)),
          avgNo2: Number((agg.no2Sum / agg.count).toFixed(1)),
          avgO3: Number((agg.o3Sum / agg.count).toFixed(1)),
        }));

      const usAqi = Math.round(aq.current.us_aqi ?? 0);
      const category = getAqiCategory(usAqi);

          const payload = {
            timezone: aq.timezone,
            observedAt: aq.current.time,
            current: {
              usAqi,
              europeanAqi: Math.round(aq.current.european_aqi ?? 0),
              category: category.label,
              severity: category.severity,
              pm25: Number((aq.current.pm2_5 ?? 0).toFixed(1)),
              pm10: Number((aq.current.pm10 ?? 0).toFixed(1)),
              no2: Number((aq.current.nitrogen_dioxide ?? 0).toFixed(1)),
              o3: Number((aq.current.ozone ?? 0).toFixed(1)),
              so2: Number((aq.current.sulphur_dioxide ?? 0).toFixed(1)),
              co: Number((aq.current.carbon_monoxide ?? 0).toFixed(0)),
              temperatureC: Number(wxCurrent.temperature_2m.toFixed(1)),
              humidityPct: Math.round(wxCurrent.relative_humidity_2m),
              windSpeedKmh: Number(wxCurrent.wind_speed_10m.toFixed(1)),
            },
            ventilationWindow: {
              startTime: bestWindowStart,
              endTime: bestWindowEnd,
              expectedPm25: Number(lowestAvgPm25.toFixed(1)),
            },
            peakNext24h: {
              time: peak24h.time,
              usAqi: peak24h.usAqi,
              pm25: peak24h.pm25,
            },
            hourlyForecast,
            dailyHistory,
          };

          aqCache.set(cacheKey, { data: payload, expiresAt: Date.now() + AQ_TTL_MS });
          return payload;
        })().finally(() => {
          aqInflight.delete(cacheKey);
        });
        aqInflight.set(cacheKey, pending);
      }

      const data = await pending;
      res.setHeader("Cache-Control", "public, max-age=60");
      return res.json(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch air quality telemetry";
      return res.status(502).json({ error: msg });
    }
  });

  // 3. GenAI Tailored Low-Emission Family Routine
  app.post("/api/assistant/routine", async (req: Request, res: Response) => {
    try {
      const { locationName, airQuality, familyProfile, activeHacks, adoptedSwaps } = req.body;
      if (!airQuality || !familyProfile) {
        return res.status(400).json({ error: "airQuality and familyProfile are required." });
      }

      const ai = getGeminiClient();
      const next12Hours = (airQuality.hourlyForecast || [])
        .slice(0, 18)
        .map((h: { time: string; usAqi: number; pm25: number; no2: number }) => `${h.time.slice(11, 16)}: AQI ${h.usAqi}, PM2.5 ${h.pm25}`)
        .join(" | ");

      const prompt = `
Create a practical, tailored daily low-emission and low-exposure routine for this family based on today's real local air quality telemetry.

Location: ${locationName}
Current Conditions: US AQI ${airQuality.current.usAqi} (${airQuality.current.category}), PM2.5 ${airQuality.current.pm25} µg/m³, PM10 ${airQuality.current.pm10} µg/m³, NO2 ${airQuality.current.no2} µg/m³, O3 ${airQuality.current.o3} µg/m³, Wind ${airQuality.current.windSpeedKmh} km/h, Temp ${airQuality.current.temperatureC}°C, Humidity ${airQuality.current.humidityPct}%.
Best Ventilation Window Today: ${airQuality.ventilationWindow.startTime.slice(11, 16)} to ${airQuality.ventilationWindow.endTime.slice(11, 16)} (PM2.5 ~${airQuality.ventilationWindow.expectedPm25} µg/m³).
Peak Next 24h: AQI ${airQuality.peakNext24h.usAqi} at ${airQuality.peakNext24h.time.slice(11, 16)}.
Hourly Forecast Curve: ${next12Hours}

Family Profile:
- Household: ${familyProfile.homeType}, Stove: ${familyProfile.stoveType}, Purifiers: ${familyProfile.purifierCount}, Commute: ${familyProfile.primaryCommute}
- Members: ${(familyProfile.members || []).map((m: { name: string; ageGroup: string; sensitivities: string[] }) => `${m.name} (${m.ageGroup}, sensitivities: ${m.sensitivities.join(", ") || "none"})`).join("; ")}
- Active Indoor Hacks: ${(activeHacks || []).join(", ") || "None yet"}
- Adopted Sustainable Swaps: ${(adoptedSwaps || []).join(", ") || "None yet"}

Return a crisp JSON plan with 4 dayparts (morning, midday, afternoon, evening), specific clock windows synced to the hourly forecast, concrete low-emission actions, respiratory mask/filtration guidance, and quantitative real-world exposure/emission impact. Keep prose concise and evidence-based.
`;

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: prompt,
        config: {
          systemInstruction:
            "You are an environmental health physician and urban air quality engineer advising families. Ground every time window and precaution in the exact hourly AQI/PM2.5/NO2 numbers supplied. Never fabricate sensor readings or use generic fluff.",
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              maskGuidance: { type: Type.STRING },
              ventilationAdvice: { type: Type.STRING },
              estimatedExposureReductionPct: { type: Type.INTEGER },
              estimatedDailyCo2SavedKg: { type: Type.NUMBER },
              dayparts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    label: { type: Type.STRING },
                    timeRange: { type: Type.STRING },
                    riskLevel: { type: Type.STRING },
                    headline: { type: Type.STRING },
                    steps: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          title: { type: Type.STRING },
                          detail: { type: Type.STRING },
                          realWorldImpact: { type: Type.STRING },
                          category: { type: Type.STRING },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text || "{}").trim());
      return res.json(parsed);
    } catch (err) {
      return handleGeminiError(err, res);
    }
  });

  // 4. GenAI Real-World Impact Analysis for a Hack or Swap
  app.post("/api/assistant/impact", async (req: Request, res: Response) => {
    try {
      const { itemTitle, itemType, baselineImpact, locationName, currentAqi, currentPm25, currentNo2, familyProfile } =
        req.body;

      const ai = getGeminiClient();
      const prompt = `
Analyze the real-world health and emissions impact of implementing "${itemTitle}" (${itemType}) for this specific family.
Location: ${locationName} (Current US AQI: ${currentAqi}, Outdoor PM2.5: ${currentPm25} µg/m³, Outdoor NO2: ${currentNo2} µg/m³).
Family: ${familyProfile.homeType}, ${familyProfile.stoveType} stove, ${familyProfile.purifierCount} purifiers, ${familyProfile.members?.length || 1} members (${(familyProfile.members || []).map((m: { ageGroup: string; sensitivities: string[] }) => `${m.ageGroup}: ${m.sensitivities.join("/") || "general"}`).join(", ")}).
Reference Baseline: ${baselineImpact}

Provide:
1. Tailored indoor or personal PM2.5/NO2 reduction in µg/m³ for their current local conditions.
2. Specific respiratory health benefit for the family members listed.
3. Annual environmental impact (CO2e and urban tailpipe/indoor emissions avoided).
4. Three concise setup steps tailored to their home type and stove.
`;

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: prompt,
        config: {
          systemInstruction:
            "You are an indoor environmental quality engineer. Output concise, realistic, quantitative engineering guidance in JSON.",
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              tailoredSummary: { type: Type.STRING },
              estimatedIndoorDropUgM3: { type: Type.NUMBER },
              healthPayoffTimeline: { type: Type.STRING },
              annualEmissionsImpact: { type: Type.STRING },
              customSteps: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text || "{}").trim());
      return res.json(parsed);
    } catch (err) {
      return handleGeminiError(err, res);
    }
  });

  // 5. GenAI Conversational Urban Air Quality Assistant
  app.post("/api/assistant/chat", async (req: Request, res: Response) => {
    try {
      const { message, history, context } = req.body;
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "A message string is required." });
      }

      const ai = getGeminiClient();
      const systemInstruction = `You are ClearAir Family Assistant, a grounded urban air quality and pediatric/family respiratory health advisor.
Active Local Telemetry (${context?.locationName || "City"}):
- US AQI: ${context?.current?.usAqi ?? "unknown"} (${context?.current?.category ?? ""})
- PM2.5: ${context?.current?.pm25 ?? "unknown"} µg/m³ | PM10: ${context?.current?.pm10 ?? "unknown"} µg/m³ | NO2: ${context?.current?.no2 ?? "unknown"} µg/m³ | O3: ${context?.current?.o3 ?? "unknown"} µg/m³
- Wind: ${context?.current?.windSpeedKmh ?? "unknown"} km/h | Humidity: ${context?.current?.humidityPct ?? "unknown"}% | Temp: ${context?.current?.temperatureC ?? "unknown"}°C
- Optimal Ventilation Window: ${context?.ventilationWindow?.startTime?.slice(11, 16) || "N/A"} - ${context?.ventilationWindow?.endTime?.slice(11, 16) || "N/A"} (~${context?.ventilationWindow?.expectedPm25 ?? "N/A"} µg/m³)
- Family Profile: ${context?.familySummary || "Urban household"}
- Active Indoor Hacks: ${(context?.activeHacks || []).join(", ") || "None"}
- Adopted Swaps: ${(context?.adoptedSwaps || []).join(", ") || "None"}

Always ground recommendations in their exact local numbers above, state concrete real-world health/emission impacts, and keep answers concise and immediately actionable.`;

      const recentHistory = Array.isArray(history)
        ? history
            .slice(-6)
            .map((h: { role: string; text: string }) => `${h.role === "user" ? "Parent" : "Advisor"}: ${h.text}`)
            .join("\n")
        : "";

      const fullPrompt = recentHistory
        ? `Previous Conversation:\n${recentHistory}\n\nParent's Question: ${message}`
        : message;

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: fullPrompt,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              answer: { type: Type.STRING },
              keyActions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              realWorldImpact: { type: Type.STRING },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text || "{}").trim());
      return res.json(parsed);
    } catch (err) {
      return handleGeminiError(err, res);
    }
  });

  // 6. Real-Time SSE Streaming Chat Endpoint
  app.post("/api/assistant/chat/stream", async (req: Request, res: Response) => {
    const { message, history, context } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "A message string is required." });
    }

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    try {
      const ai = getGeminiClient();
      const systemInstruction = `You are ClearAir Family Assistant, a grounded urban air quality and family respiratory health advisor.
Active Local Telemetry (${context?.locationName || "City"}):
- US AQI: ${context?.current?.usAqi ?? "unknown"} (${context?.current?.category ?? ""})
- PM2.5: ${context?.current?.pm25 ?? "unknown"} µg/m³ | PM10: ${context?.current?.pm10 ?? "unknown"} µg/m³ | NO2: ${context?.current?.no2 ?? "unknown"} µg/m³ | O3: ${context?.current?.o3 ?? "unknown"} µg/m³
- Wind: ${context?.current?.windSpeedKmh ?? "unknown"} km/h | Humidity: ${context?.current?.humidityPct ?? "unknown"}% | Temp: ${context?.current?.temperatureC ?? "unknown"}°C
- Optimal Ventilation Window: ${context?.ventilationWindow?.startTime?.slice(11, 16) || "N/A"} - ${context?.ventilationWindow?.endTime?.slice(11, 16) || "N/A"} (~${context?.ventilationWindow?.expectedPm25 ?? "N/A"} µg/m³)
- Family Profile: ${context?.familySummary || "Urban household"}
- Active Indoor Hacks: ${(context?.activeHacks || []).join(", ") || "None"}
- Adopted Swaps: ${(context?.adoptedSwaps || []).join(", ") || "None"}

Respond in plain, concise prose (no markdown bolding ** or headers #). Give immediate guidance grounded in these exact local readings, followed by 2-3 short action lines starting with "- " and a brief "Real-World Impact:" line at the end.`;

      const recentHistory = Array.isArray(history)
        ? history
            .slice(-8)
            .map((h: { role: string; text: string }) => `${h.role === "user" ? "Parent" : "Advisor"}: ${h.text}`)
            .join("\n")
        : "";

      const fullPrompt = recentHistory
        ? `Previous Conversation:\n${recentHistory}\n\nParent's Question: ${message}`
        : message;

      const stream = await ai.models.generateContentStream({
        model: "gemini-4-hydrogen",
        contents: fullPrompt,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      for await (const chunk of stream) {
        const text = chunk.text;
        if (text) {
          res.write(`data: ${JSON.stringify({ chunk: text })}\n\n`);
        }
      }
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Streaming chat failed";
      res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
      res.end();
    }
  });

  return app;
}

async function startServer() {
  const app = createApiApp();

  // Vite dev middleware or production static assets
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = http.createServer(app);

  // Real-Time Gemini Live Voice & Text WebSocket Bridge
  const wss = new WebSocketServer({ server, path: "/api/assistant/live" });
  wss.on("connection", (clientWs) => {
    let session: Awaited<ReturnType<GoogleGenAI["live"]["connect"]>> | null = null;
    let isClosing = false;

    clientWs.on("message", async (rawData) => {
      try {
        const payload = JSON.parse(rawData.toString()) as {
          type?: string;
          audio?: string;
          text?: string;
          context?: {
            locationName?: string;
            current?: { usAqi?: number; category?: string; pm25?: number; no2?: number; o3?: number };
            ventilationWindow?: { startTime?: string; endTime?: string; expectedPm25?: number };
            familySummary?: string;
            activeHacks?: string[];
            adoptedSwaps?: string[];
          };
        };

        if (payload.type === "init" && !session) {
          const ai = getGeminiClient();
          const ctx = payload.context;
          const systemInstruction = `You are ClearAir Family Live Advisor, speaking concisely and warmly with parents in real time about urban air quality and family protection.
Current Local Telemetry (${ctx?.locationName || "City"}): US AQI ${ctx?.current?.usAqi ?? "unknown"} (${ctx?.current?.category ?? ""}), PM2.5 ${ctx?.current?.pm25 ?? "unknown"} µg/m³, NO2 ${ctx?.current?.no2 ?? "unknown"} µg/m³, O3 ${ctx?.current?.o3 ?? "unknown"} µg/m³.
Best Ventilation Window: ${ctx?.ventilationWindow?.startTime?.slice(11, 16) || "N/A"} to ${ctx?.ventilationWindow?.endTime?.slice(11, 16) || "N/A"}.
Household: ${ctx?.familySummary || "Urban family"}. Active protections: ${(ctx?.activeHacks || []).join(", ") || "none"}. Adopted swaps: ${(ctx?.adoptedSwaps || []).join(", ") || "none"}.
Keep spoken answers clear, practical, under 3 sentences per turn, and always reference their real local air numbers and real-world health impact.`;

          session = await ai.live.connect({
            model: "gemini-3.8-live",
            config: {
              responseModalities: [Modality.AUDIO],
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
              },
              systemInstruction,
            },
            callbacks: {
              onmessage: (message: LiveServerMessage) => {
                if (isClosing || clientWs.readyState !== 1) return;
                const content = message.serverContent;
                if (content?.inputTranscription?.text) {
                  clientWs.send(
                    JSON.stringify({ type: "inputTranscript", text: content.inputTranscription.text })
                  );
                }
                if (content?.outputTranscription?.text) {
                  clientWs.send(
                    JSON.stringify({ type: "outputTranscript", text: content.outputTranscription.text })
                  );
                }
                for (const part of content?.modelTurn?.parts ?? []) {
                  if (part.inlineData?.data) {
                    clientWs.send(JSON.stringify({ type: "audio", audio: part.inlineData.data }));
                  }
                }
                if (content?.interrupted) {
                  clientWs.send(JSON.stringify({ type: "interrupted" }));
                }
                if (content?.turnComplete) {
                  clientWs.send(JSON.stringify({ type: "turnComplete" }));
                }
              },
              onerror: (err) => {
                if (clientWs.readyState === 1) {
                  clientWs.send(
                    JSON.stringify({
                      type: "error",
                      error: err instanceof Error ? err.message : "Live voice session error",
                    })
                  );
                }
              },
              onclose: () => {
                if (clientWs.readyState === 1) {
                  clientWs.send(JSON.stringify({ type: "closed" }));
                }
              },
            },
          });

          if (clientWs.readyState === 1) {
            clientWs.send(JSON.stringify({ type: "ready" }));
          }
          return;
        }

        if (payload.type === "audio" && payload.audio && session) {
          session.sendRealtimeInput({
            audio: { data: payload.audio, mimeType: "audio/pcm;rate=16000" },
          });
          return;
        }

        if (payload.type === "text" && payload.text && session) {
          session.sendRealtimeInput({ text: payload.text });
        }
      } catch (err) {
        if (clientWs.readyState === 1) {
          clientWs.send(
            JSON.stringify({
              type: "error",
              error: err instanceof Error ? err.message : "Failed to initialize live AI session",
            })
          );
        }
      }
    });

    clientWs.on("close", () => {
      isClosing = true;
      try {
        session?.close();
      } catch {
        // Ignore teardown errors
      }
    });
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`ClearAir Family server running at http://0.0.0.0:${PORT}`);
  });
}

const isEntryPoint =
  typeof process !== "undefined" &&
  process.argv[1] &&
  path.resolve(process.argv[1]) === __filename;

if (isEntryPoint) {
  startServer().catch((err) => {
    console.error("Failed to start ClearAir server:", err);
    process.exit(1);
  });
}
