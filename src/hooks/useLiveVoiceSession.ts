import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChatMessage,
  CityLocation,
  FamilyProfile,
  LocalAirQualityData,
} from "../types";
import { buildAssistantContext } from "../utils/chatHelpers";
import { float32ToPcm16Base64, Pcm24kPlayer } from "../utils/liveAudio";

interface UseLiveVoiceSessionOptions {
  selectedCity: CityLocation;
  airQuality: LocalAirQualityData | null;
  familyProfile: FamilyProfile;
  activeHackIds: string[];
  adoptedSwapIds: string[];
  onAddMessages: (newMsgs: ChatMessage[]) => void;
  onUpdateMessage: (id: string, text: string) => void;
  onError: (msg: string | null) => void;
}

type VoiceServerMessage = {
  type: string;
  audio?: string;
  text?: string;
  error?: string;
};

export function useLiveVoiceSession({
  selectedCity,
  airQuality,
  familyProfile,
  activeHackIds,
  adoptedSwapIds,
  onAddMessages,
  onUpdateMessage,
  onError,
}: UseLiveVoiceSessionOptions) {
  const [voiceState, setVoiceState] = useState<"idle" | "connecting" | "live">("idle");

  const wsRef = useRef<WebSocket | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const playerRef = useRef<Pcm24kPlayer | null>(null);
  const isMountedRef = useRef(true);

  const liveInputMsgIdRef = useRef<string | null>(null);
  const liveInputTextRef = useRef<string>("");
  const liveOutputMsgIdRef = useRef<string | null>(null);
  const liveOutputTextRef = useRef<string>("");

  const stopVoiceSession = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (micCtxRef.current && micCtxRef.current.state !== "closed") {
      try {
        void micCtxRef.current.close();
      } catch {
        // Ignore teardown close errors
      }
      micCtxRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (playerRef.current) {
      playerRef.current.close();
      playerRef.current = null;
    }
    liveInputMsgIdRef.current = null;
    liveInputTextRef.current = "";
    liveOutputMsgIdRef.current = null;
    liveOutputTextRef.current = "";
    if (isMountedRef.current) {
      setVoiceState("idle");
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopVoiceSession();
    };
  }, [stopVoiceSession]);

  const sendLiveText = useCallback((text: string): boolean => {
    if (voiceState === "live" && wsRef.current?.readyState === WebSocket.OPEN) {
      onError(null);
      const nowTime = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      onAddMessages([
        {
          id: `u-${Date.now()}`,
          role: "user",
          text,
          timestamp: nowTime,
        },
      ]);
      wsRef.current.send(JSON.stringify({ type: "text", text }));
      return true;
    }
    return false;
  }, [voiceState, onAddMessages, onError]);

  const startVoiceSession = useCallback(async () => {
    if (voiceState !== "idle") return;

    if (!navigator.mediaDevices?.getUserMedia) {
      onError(
        "Live voice requires microphone access in a secure browser context. You can still chat via real-time text below."
      );
      return;
    }

    const context = buildAssistantContext({
      selectedCity,
      airQuality,
      familyProfile,
      activeHackIds,
      adoptedSwapIds,
    });

    onError(null);
    setVoiceState("connecting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      let micCtx: AudioContext;
      try {
        micCtx = new AudioContext({ sampleRate: 16000 });
      } catch {
        micCtx = new AudioContext();
      }
      if (micCtx.state === "suspended") {
        await micCtx.resume();
      }
      micCtxRef.current = micCtx;

      const player = new Pcm24kPlayer();
      playerRef.current = player;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/api/assistant/live`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "init", context }));
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data as string) as VoiceServerMessage;

        if (msg.type === "ready") {
          setVoiceState("live");
          const source = micCtx.createMediaStreamSource(stream);
          const processor = micCtx.createScriptProcessor(4096, 1, 1);
          processorRef.current = processor;

          processor.onaudioprocess = (e) => {
            if (ws.readyState === WebSocket.OPEN) {
              const base64 = float32ToPcm16Base64(
                e.inputBuffer.getChannelData(0),
                micCtx.sampleRate,
                16000
              );
              ws.send(JSON.stringify({ type: "audio", audio: base64 }));
            }
          };

          source.connect(processor);
          processor.connect(micCtx.destination);
          return;
        }

        if (msg.type === "audio" && msg.audio) {
          player.enqueue(msg.audio);
          return;
        }

        if (msg.type === "interrupted") {
          player.interrupt();
          liveOutputMsgIdRef.current = null;
          liveOutputTextRef.current = "";
          return;
        }

        if (msg.type === "inputTranscript" && msg.text) {
          if (!liveInputMsgIdRef.current) {
            const newId = `vu-${Date.now()}`;
            liveInputMsgIdRef.current = newId;
            liveInputTextRef.current = msg.text;
            onAddMessages([
              {
                id: newId,
                role: "user",
                text: msg.text,
                timestamp: new Date().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              },
            ]);
          } else {
            liveInputTextRef.current += msg.text;
            onUpdateMessage(liveInputMsgIdRef.current, liveInputTextRef.current);
          }
          return;
        }

        if (msg.type === "outputTranscript" && msg.text) {
          liveInputMsgIdRef.current = null;
          liveInputTextRef.current = "";
          if (!liveOutputMsgIdRef.current) {
            const newId = `va-${Date.now()}`;
            liveOutputMsgIdRef.current = newId;
            liveOutputTextRef.current = msg.text;
            onAddMessages([
              {
                id: newId,
                role: "assistant",
                text: msg.text,
                timestamp: new Date().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              },
            ]);
          } else {
            liveOutputTextRef.current += msg.text;
            onUpdateMessage(liveOutputMsgIdRef.current, liveOutputTextRef.current);
          }
          return;
        }

        if (msg.type === "turnComplete") {
          liveInputMsgIdRef.current = null;
          liveInputTextRef.current = "";
          liveOutputMsgIdRef.current = null;
          liveOutputTextRef.current = "";
          return;
        }

        if (msg.type === "error") {
          onError(msg.error || "Live voice connection error.");
          stopVoiceSession();
        }
      };

      ws.onerror = () => {
        onError("WebSocket connection to live voice advisor failed.");
        stopVoiceSession();
      };

      ws.onclose = () => {
        stopVoiceSession();
      };
    } catch (err) {
      onError(
        err instanceof Error
          ? `Microphone unavailable: ${err.message}`
          : "Could not access microphone for live voice."
      );
      stopVoiceSession();
    }
  }, [
    voiceState,
    selectedCity,
    airQuality,
    familyProfile,
    activeHackIds,
    adoptedSwapIds,
    onAddMessages,
    onUpdateMessage,
    onError,
    stopVoiceSession,
  ]);

  return {
    voiceState,
    startVoiceSession,
    stopVoiceSession,
    sendLiveText,
  };
}
