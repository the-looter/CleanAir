import type http from "http";
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { WebSocketServer } from "ws";
import {
  formatReadableGeminiError,
  getGeminiClient,
  TelemetryContextPayload,
} from "./gemini.ts";

interface LiveClientPayload {
  type?: string;
  audio?: string;
  text?: string;
  context?: TelemetryContextPayload;
}

export function attachLiveVoiceServer(server: http.Server): void {
  const wss = new WebSocketServer({ server, path: "/api/assistant/live" });

  wss.on("connection", (clientWs) => {
    let session: Awaited<ReturnType<GoogleGenAI["live"]["connect"]>> | null = null;
    let isClosing = false;

    const safeSend = (data: Record<string, unknown>) => {
      if (clientWs.readyState === 1) {
        clientWs.send(JSON.stringify(data));
      }
    };

    clientWs.on("message", async (rawData) => {
      try {
        const payload = JSON.parse(rawData.toString()) as LiveClientPayload;

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
                  safeSend({ type: "inputTranscript", text: content.inputTranscription.text });
                }
                if (content?.outputTranscription?.text) {
                  safeSend({ type: "outputTranscript", text: content.outputTranscription.text });
                }
                for (const part of content?.modelTurn?.parts ?? []) {
                  if (part.inlineData?.data) {
                    safeSend({ type: "audio", audio: part.inlineData.data });
                  }
                }
                if (content?.interrupted) {
                  safeSend({ type: "interrupted" });
                }
                if (content?.turnComplete) {
                  safeSend({ type: "turnComplete" });
                }
              },
              onerror: (err) => {
                safeSend({ type: "error", error: formatReadableGeminiError(err) });
              },
              onclose: () => {
                safeSend({ type: "closed" });
              },
            },
          });

          safeSend({ type: "ready" });
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
        safeSend({ type: "error", error: formatReadableGeminiError(err) });
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
}
