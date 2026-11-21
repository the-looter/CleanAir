import {
  AiImpactAnalysis,
  AssistantChatContext,
  AssistantJsonReply,
  CityLocation,
  FamilyProfile,
  LocalAirQualityData,
  RoutinePlan,
} from "../types";

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed with HTTP ${res.status}`);
  }
  return data as T;
}

export async function searchCities(query: string): Promise<CityLocation[]> {
  const res = await fetch(`/api/locations/search?q=${encodeURIComponent(query)}`);
  const data = await parseJsonOrThrow<{ results: CityLocation[] }>(res);
  return data.results || [];
}

export async function fetchLocalAirQuality(lat: number, lon: number): Promise<LocalAirQualityData> {
  const res = await fetch(`/api/air-quality?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
  return parseJsonOrThrow<LocalAirQualityData>(res);
}

export async function generateTailoredRoutine(payload: {
  locationName: string;
  airQuality: LocalAirQualityData;
  familyProfile: FamilyProfile;
  activeHacks: string[];
  adoptedSwaps: string[];
}): Promise<RoutinePlan> {
  const res = await fetch("/api/assistant/routine", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow<RoutinePlan>(res);
}

export async function analyzeRealWorldImpact(payload: {
  itemTitle: string;
  itemType: "Indoor Air Hack" | "Sustainable Swap";
  baselineImpact: string;
  locationName: string;
  currentAqi: number;
  currentPm25: number;
  currentNo2: number;
  familyProfile: FamilyProfile;
}): Promise<AiImpactAnalysis> {
  const res = await fetch("/api/assistant/impact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow<AiImpactAnalysis>(res);
}

export async function sendAssistantMessage(payload: {
  message: string;
  history: Array<{ role: "user" | "assistant"; text: string }>;
  context: AssistantChatContext;
}): Promise<AssistantJsonReply> {
  const res = await fetch("/api/assistant/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow<AssistantJsonReply>(res);
}

export async function streamAssistantChat(
  payload: {
    message: string;
    history: Array<{ role: "user" | "assistant"; text: string }>;
    context: AssistantChatContext;
  },
  callbacks: {
    onChunk: (chunk: string) => void;
    onDone: () => void;
    onError: (error: string) => void;
  },
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch("/api/assistant/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok || !res.body) {
    const errData = await res.json().catch(() => ({}));
    throw new Error((errData as { error?: string }).error || `Stream failed with HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed = false;

  const processBlock = (block: string) => {
    for (const line of block.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr) continue;
      try {
        const parsed = JSON.parse(jsonStr) as {
          chunk?: string;
          done?: boolean;
          error?: string;
        };
        if (parsed.error) {
          completed = true;
          callbacks.onError(parsed.error);
          return;
        }
        if (parsed.chunk) {
          callbacks.onChunk(parsed.chunk);
        }
        if (parsed.done) {
          completed = true;
          callbacks.onDone();
          return;
        }
      } catch {
        // Ignore partial or non-JSON comment lines
      }
    }
  };

  while (!completed) {
    const { value, done } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, "\n");
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";
      for (const block of blocks) {
        processBlock(block);
        if (completed) return;
      }
    }
    if (done) {
      if (buffer.trim()) {
        processBlock(buffer);
      }
      if (!completed) {
        callbacks.onDone();
      }
      return;
    }
  }
}
