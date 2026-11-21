import "dotenv/config";
import express, { type Request, type Response } from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import {
  fetchLocalAirQualityTelemetry,
  getAqiCategory,
  searchCityLocations,
} from "./server/airQuality.ts";
import {
  buildChatPromptWithHistory,
  buildTelemetryContextBlock,
  CHAT_JSON_RESPONSE_SCHEMA,
  formatReadableGeminiError,
  generateWithFallback,
  getGeminiClient,
  IMPACT_RESPONSE_SCHEMA,
  parseJsonSafe,
  ROUTINE_RESPONSE_SCHEMA,
  streamWithFallback,
} from "./server/gemini.ts";
import { attachLiveVoiceServer } from "./server/liveVoice.ts";

export { getAqiCategory };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);

function handleGeminiError(err: unknown, res: Response) {
  const message = err instanceof Error ? err.message : "Unknown Gemini API error";
  const statusMatch = message.match(/\b(400|403|404|429|500|503)\b/);
  const statusCode = statusMatch ? Number(statusMatch[1]) : 500;
  return res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
    error: formatReadableGeminiError(err),
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

    try {
      const payload = await searchCityLocations(query);
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
      return res
        .status(400)
        .json({ error: "Valid lat (-90..90) and lon (-180..180) query parameters are required." });
    }

    try {
      const data = await fetchLocalAirQualityTelemetry(lat, lon);
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
        .map(
          (h: { time: string; usAqi: number; pm25: number; no2: number }) =>
            `${h.time.slice(11, 16)}: AQI ${h.usAqi}, PM2.5 ${h.pm25}`
        )
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

      const response = await generateWithFallback(ai, {
        contents: prompt,
        systemInstruction:
          "You are an environmental health physician and urban air quality engineer advising families. Ground every time window and precaution in the exact hourly AQI/PM2.5/NO2 numbers supplied. Never fabricate sensor readings or use generic fluff.",
        responseMimeType: "application/json",
        responseSchema: ROUTINE_RESPONSE_SCHEMA,
      });

      return res.json(parseJsonSafe(response.text));
    } catch (err) {
      return handleGeminiError(err, res);
    }
  });

  // 4. GenAI Real-World Impact Analysis for a Hack or Swap
  app.post("/api/assistant/impact", async (req: Request, res: Response) => {
    try {
      const {
        itemTitle,
        itemType,
        baselineImpact,
        locationName,
        currentAqi,
        currentPm25,
        currentNo2,
        familyProfile,
      } = req.body;
      if (!itemTitle || !familyProfile) {
        return res.status(400).json({ error: "itemTitle and familyProfile are required." });
      }

      const ai = getGeminiClient();
      const prompt = `
Analyze the real-world health and emissions impact of implementing "${itemTitle}" (${itemType}) for this specific family.
Location: ${locationName || "City"} (Current US AQI: ${currentAqi ?? "unknown"}, Outdoor PM2.5: ${currentPm25 ?? "unknown"} µg/m³, Outdoor NO2: ${currentNo2 ?? "unknown"} µg/m³).
Family: ${familyProfile.homeType}, ${familyProfile.stoveType} stove, ${familyProfile.purifierCount} purifiers, ${familyProfile.members?.length || 1} members (${(familyProfile.members || []).map((m: { ageGroup: string; sensitivities: string[] }) => `${m.ageGroup}: ${m.sensitivities.join("/") || "general"}`).join(", ")}).
Reference Baseline: ${baselineImpact}

Provide:
1. Tailored indoor or personal PM2.5/NO2 reduction in µg/m³ for their current local conditions.
2. Specific respiratory health benefit for the family members listed.
3. Annual environmental impact (CO2e and urban tailpipe/indoor emissions avoided).
4. Three concise setup steps tailored to their home type and stove.
`;

      const response = await generateWithFallback(ai, {
        contents: prompt,
        systemInstruction:
          "You are an indoor environmental quality engineer. Output concise, realistic, quantitative engineering guidance in JSON.",
        responseMimeType: "application/json",
        responseSchema: IMPACT_RESPONSE_SCHEMA,
      });

      return res.json(parseJsonSafe(response.text));
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
${buildTelemetryContextBlock(context)}

Always ground recommendations in their exact local numbers above, state concrete real-world health/emission impacts, and keep answers concise and immediately actionable.`;

      const response = await generateWithFallback(ai, {
        contents: buildChatPromptWithHistory(message, history, 6),
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: CHAT_JSON_RESPONSE_SCHEMA,
      });

      return res.json(parseJsonSafe(response.text));
    } catch (err) {
      return handleGeminiError(err, res);
    }
  });

  // 6. Real-Time SSE Streaming Chat Endpoint
  app.post("/api/assistant/chat/stream", async (req: Request, res: Response) => {
    const { message, history, context } = req.body;
    if (!message || typeof message !== "string") {
      res.status(400).json({ error: "A message string is required." });
      return;
    }

    res.socket?.setNoDelay?.(true);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();
    res.write(": stream-open\n\n");

    const keepalive = setInterval(() => {
      if (!res.writableEnded) {
        res.write(": ping\n\n");
      }
    }, 2000);

    try {
      const ai = getGeminiClient();
      const systemInstruction = `You are ClearAir Family Assistant, a grounded urban air quality and family respiratory health advisor.
${buildTelemetryContextBlock(context)}

Respond in plain, concise prose (no markdown bolding ** or headers #). Give immediate guidance grounded in these exact local readings, followed by 2-3 short action lines starting with "- " and a brief "Real-World Impact:" line at the end.`;

      await streamWithFallback(
        ai,
        { contents: buildChatPromptWithHistory(message, history, 8), systemInstruction },
        (text) => {
          if (!res.writableEnded) {
            res.write(`data: ${JSON.stringify({ chunk: text })}\n\n`);
          }
        }
      );

      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
      }
    } catch (err) {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: formatReadableGeminiError(err) })}\n\n`);
        res.end();
      }
    } finally {
      clearInterval(keepalive);
    }
  });

  return app;
}

async function startServer(): Promise<void> {
  const app = createApiApp();

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
  attachLiveVoiceServer(server);

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
