import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

export interface TelemetryContextPayload {
  locationName?: string;
  current?: {
    usAqi?: number;
    category?: string;
    pm25?: number;
    pm10?: number;
    no2?: number;
    o3?: number;
    windSpeedKmh?: number;
    humidityPct?: number;
    temperatureC?: number;
  };
  ventilationWindow?: { startTime?: string; endTime?: string; expectedPm25?: number };
  familySummary?: string;
  activeHacks?: string[];
  adoptedSwaps?: string[];
}

const TEXT_MODEL_CHAIN = ["gemini-4-hydrogen", "gemini-3.1-flash-lite"] as const;
const HYDROGEN_COOLDOWN_MS = 3 * 60 * 1000;
let hydrogenCooldownUntil = 0;

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in environment secrets.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: 12000,
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function getActiveTextModels(): Array<(typeof TEXT_MODEL_CHAIN)[number]> {
  if (Date.now() < hydrogenCooldownUntil) {
    return ["gemini-3.1-flash-lite"];
  }
  return [...TEXT_MODEL_CHAIN];
}

export function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const obj = err as { message?: unknown; error?: { message?: unknown } };
    if (typeof obj.message === "string" && obj.message) return obj.message;
    if (typeof obj.error?.message === "string" && obj.error.message) return obj.error.message;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

function isTransientCapacityError(err: unknown): boolean {
  const msg = extractErrorMessage(err);
  const name = err instanceof Error ? err.name : "";
  return (
    name === "AbortError" ||
    name === "TimeoutError" ||
    msg.includes("503") ||
    msg.includes("429") ||
    msg.includes("UNAVAILABLE") ||
    msg.includes("high demand") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.toLowerCase().includes("timeout") ||
    msg.toLowerCase().includes("aborted")
  );
}

export function formatReadableGeminiError(err: unknown): string {
  const raw = extractErrorMessage(err);
  if (raw.includes("GEMINI_API_KEY is not configured")) {
    return "AI service key is not configured. Please verify GEMINI_API_KEY in Settings > Secrets.";
  }
  if (raw.includes("PERMISSION_DENIED") || raw.includes("403")) {
    return "Gemini API permission denied. Please verify your API key in Settings > Secrets.";
  }
  if (raw.includes("503") || raw.includes("UNAVAILABLE") || raw.includes("high demand")) {
    return "The AI service is experiencing temporary high demand. Please try again in a few seconds.";
  }
  if (raw.includes("429") || raw.includes("RESOURCE_EXHAUSTED")) {
    return "AI rate limit reached. Please wait a moment and try again.";
  }
  return `Unable to reach AI advisor: ${raw}`;
}

export function parseJsonSafe(rawText: string | undefined): unknown {
  const cleaned = (rawText || "{}")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return JSON.parse(cleaned || "{}");
}

function buildModelConfig(
  model: (typeof TEXT_MODEL_CHAIN)[number],
  systemInstruction: string,
  timeoutMs: number,
  extras?: { responseMimeType?: string; responseSchema?: Record<string, unknown> }
): Record<string, unknown> {
  const config: Record<string, unknown> = {
    systemInstruction,
    abortSignal: AbortSignal.timeout(timeoutMs),
  };
  if (model === "gemini-4-hydrogen") {
    config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
  }
  if (extras?.responseMimeType) {
    config.responseMimeType = extras.responseMimeType;
  }
  if (extras?.responseSchema) {
    config.responseSchema = extras.responseSchema;
  }
  return config;
}

export async function generateWithFallback(
  ai: GoogleGenAI,
  params: {
    contents: string;
    systemInstruction: string;
    responseMimeType?: string;
    responseSchema?: Record<string, unknown>;
  }
) {
  let lastError: unknown;
  for (const model of getActiveTextModels()) {
    try {
      const timeoutMs = model === "gemini-4-hydrogen" ? 4500 : 15000;
      const config = buildModelConfig(model, params.systemInstruction, timeoutMs, params);
      return await ai.models.generateContent({
        model,
        contents: params.contents,
        config: config as Parameters<GoogleGenAI["models"]["generateContent"]>[0]["config"],
      });
    } catch (err) {
      lastError = err;
      console.warn(`[Gemini generateWithFallback] ${model} failed:`, extractErrorMessage(err));
      if (model === "gemini-4-hydrogen" && isTransientCapacityError(err)) {
        hydrogenCooldownUntil = Date.now() + HYDROGEN_COOLDOWN_MS;
      }
      if (isTransientCapacityError(err)) {
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

export async function streamWithFallback(
  ai: GoogleGenAI,
  params: {
    contents: string;
    systemInstruction: string;
  },
  onChunk: (text: string) => void
): Promise<void> {
  let lastError: unknown;
  for (const model of getActiveTextModels()) {
    let emittedAny = false;
    try {
      const timeoutMs = model === "gemini-4-hydrogen" ? 3500 : 15000;
      const config = buildModelConfig(model, params.systemInstruction, timeoutMs);
      const stream = await ai.models.generateContentStream({
        model,
        contents: params.contents,
        config: config as Parameters<GoogleGenAI["models"]["generateContentStream"]>[0]["config"],
      });
      for await (const chunk of stream) {
        if (chunk.text) {
          emittedAny = true;
          onChunk(chunk.text);
        }
      }
      if (!emittedAny) {
        throw new Error(`Empty response stream from ${model}`);
      }
      return;
    } catch (err) {
      lastError = err;
      console.warn(`[Gemini streamWithFallback] ${model} failed:`, extractErrorMessage(err));
      if (model === "gemini-4-hydrogen" && !emittedAny) {
        hydrogenCooldownUntil = Date.now() + HYDROGEN_COOLDOWN_MS;
      }
      if (!emittedAny && (isTransientCapacityError(err) || extractErrorMessage(err).includes("Empty response stream"))) {
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

export function buildTelemetryContextBlock(context: TelemetryContextPayload | undefined): string {
  return `Active Local Telemetry (${context?.locationName || "City"}):
- US AQI: ${context?.current?.usAqi ?? "unknown"} (${context?.current?.category ?? ""})
- PM2.5: ${context?.current?.pm25 ?? "unknown"} µg/m³ | PM10: ${context?.current?.pm10 ?? "unknown"} µg/m³ | NO2: ${context?.current?.no2 ?? "unknown"} µg/m³ | O3: ${context?.current?.o3 ?? "unknown"} µg/m³
- Wind: ${context?.current?.windSpeedKmh ?? "unknown"} km/h | Humidity: ${context?.current?.humidityPct ?? "unknown"}% | Temp: ${context?.current?.temperatureC ?? "unknown"}°C
- Optimal Ventilation Window: ${context?.ventilationWindow?.startTime?.slice(11, 16) || "N/A"} - ${context?.ventilationWindow?.endTime?.slice(11, 16) || "N/A"} (~${context?.ventilationWindow?.expectedPm25 ?? "N/A"} µg/m³)
- Family Profile: ${context?.familySummary || "Urban household"}
- Active Indoor Hacks: ${(context?.activeHacks || []).join(", ") || "None"}
- Adopted Swaps: ${(context?.adoptedSwaps || []).join(", ") || "None"}`;
}

export function buildChatPromptWithHistory(
  message: string,
  history: unknown,
  maxTurns: number
): string {
  const recentHistory = Array.isArray(history)
    ? history
        .filter((h: { text?: string }) => Boolean(h?.text?.trim()))
        .slice(-maxTurns)
        .map(
          (h: { role: string; text: string }) =>
            `${h.role === "user" ? "Parent" : "Advisor"}: ${h.text}`
        )
        .join("\n")
    : "";
  return recentHistory
    ? `Previous Conversation:\n${recentHistory}\n\nParent's Question: ${message}`
    : message;
}

export const ROUTINE_RESPONSE_SCHEMA = {
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
};

export const IMPACT_RESPONSE_SCHEMA = {
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
};

export const CHAT_JSON_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    answer: { type: Type.STRING },
    keyActions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    realWorldImpact: { type: Type.STRING },
  },
};
