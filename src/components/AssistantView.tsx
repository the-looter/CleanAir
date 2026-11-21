import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, Mic, MicOff, Send, Square } from "lucide-react";
import { ASSISTANT_TOPICS } from "../data/knowledgeBase";
import { streamAssistantChat } from "../services/api";
import {
  ChatMessage,
  CityLocation,
  FamilyProfile,
  LocalAirQualityData,
} from "../types";
import { float32ToPcm16Base64, Pcm24kPlayer } from "../utils/liveAudio";

interface AssistantViewProps {
  selectedCity: CityLocation;
  airQuality: LocalAirQualityData | null;
  familyProfile: FamilyProfile;
  activeHackIds: string[];
  adoptedSwapIds: string[];
  messages: ChatMessage[];
  onAddMessages: (newMsgs: ChatMessage[]) => void;
  onUpdateMessage: (id: string, text: string) => void;
  onClearMessages: () => void;
}

export const AssistantView: React.FC<AssistantViewProps> = ({
  selectedCity,
  airQuality,
  familyProfile,
  activeHackIds,
  adoptedSwapIds,
  messages,
  onAddMessages,
  onUpdateMessage,
  onClearMessages,
}) => {
  const [input, setInput] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState<string>(ASSISTANT_TOPICS[0].id);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Real-Time Voice Live API state
  const [voiceState, setVoiceState] = useState<"idle" | "connecting" | "live">("idle");
  const wsRef = useRef<WebSocket | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const playerRef = useRef<Pcm24kPlayer | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const feedEndRef = useRef<HTMLDivElement | null>(null);

  const liveInputMsgIdRef = useRef<string | null>(null);
  const liveInputTextRef = useRef<string>("");
  const liveOutputMsgIdRef = useRef<string | null>(null);
  const liveOutputTextRef = useRef<string>("");

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streaming]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      stopVoiceSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buildContext = () => {
    if (!airQuality) return null;
    const familySummary = `${familyProfile.householdName} (${familyProfile.homeType}, ${
      familyProfile.stoveType
    }, ${familyProfile.purifierCount} purifiers, ${familyProfile.primaryCommute}). Members: ${familyProfile.members
      .map((m) => `${m.name} (${m.ageGroup}: ${m.sensitivities.join(", ") || "none"})`)
      .join("; ")}`;

    return {
      locationName: `${selectedCity.name}, ${selectedCity.country}`,
      current: airQuality.current,
      ventilationWindow: airQuality.ventilationWindow,
      familySummary,
      activeHacks: activeHackIds,
      adoptedSwaps: adoptedSwapIds,
    };
  };

  const handleStreamSend = async (promptText: string) => {
    const trimmed = promptText.trim();
    const context = buildContext();
    if (!trimmed || streaming || !context) return;

    setError(null);
    const nowTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text: trimmed,
      timestamp: nowTime,
    };
    const assistantMsgId = `a-${Date.now() + 1}`;
    const placeholderMsg: ChatMessage = {
      id: assistantMsgId,
      role: "assistant",
      text: "",
      timestamp: nowTime,
    };

    const historySnapshot = [...messages, userMsg].map((m) => ({
      role: m.role,
      text: m.text,
    }));

    onAddMessages([userMsg, placeholderMsg]);
    setInput("");
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;
    let accumulated = "";

    try {
      await streamAssistantChat(
        {
          message: trimmed,
          history: historySnapshot.slice(0, -1),
          context,
        },
        {
          onChunk: (chunk) => {
            accumulated += chunk;
            onUpdateMessage(assistantMsgId, accumulated);
          },
          onDone: () => {
            setStreaming(false);
          },
          onError: (errMsg) => {
            setError(errMsg);
            setStreaming(false);
          },
        },
        controller.signal
      );
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        setError(err instanceof Error ? err.message : "Real-time chat stream failed.");
      }
      setStreaming(false);
    }
  };

  const stopVoiceSession = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (micCtxRef.current && micCtxRef.current.state !== "closed") {
      void micCtxRef.current.close();
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
    setVoiceState("idle");
  };

  const startVoiceSession = async () => {
    const context = buildContext();
    if (!context || voiceState !== "idle") return;

    setError(null);
    setVoiceState("connecting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const micCtx = new AudioContext({ sampleRate: 16000 });
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
        const msg = JSON.parse(event.data) as {
          type: string;
          audio?: string;
          text?: string;
          error?: string;
        };

        if (msg.type === "ready") {
          setVoiceState("live");
          const source = micCtx.createMediaStreamSource(stream);
          const processor = micCtx.createScriptProcessor(4096, 1, 1);
          processorRef.current = processor;

          processor.onaudioprocess = (e) => {
            if (ws.readyState === WebSocket.OPEN) {
              const base64 = float32ToPcm16Base64(e.inputBuffer.getChannelData(0));
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
                timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
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
                timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
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
          setError(msg.error || "Live voice connection error.");
          stopVoiceSession();
        }
      };

      ws.onerror = () => {
        setError("WebSocket connection to live voice advisor failed.");
        stopVoiceSession();
      };

      ws.onclose = () => {
        stopVoiceSession();
      };
    } catch (err) {
      setError(
        err instanceof Error
          ? `Microphone unavailable: ${err.message}`
          : "Could not access microphone for live voice."
      );
      stopVoiceSession();
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left Vertical Scenario & Live Voice Control Menu */}
      <aside className="lg:col-span-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-5">
          <div>
            <div className="px-2 pb-2 text-xs font-medium text-slate-500">
              Real-Time Voice Advisor
            </div>
            <div className="flex flex-col gap-1">
              {voiceState === "idle" ? (
                <button
                  type="button"
                  disabled={!airQuality}
                  onClick={() => void startVoiceSession()}
                  className="flex w-full items-center gap-2 rounded-lg bg-teal-700 px-3 py-2.5 text-left text-xs font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-50"
                >
                  <Mic className="h-4 w-4 shrink-0" />
                  <span>Start Live Voice Chat</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopVoiceSession}
                  className="flex w-full items-center gap-2 rounded-lg bg-red-600 px-3 py-2.5 text-left text-xs font-semibold text-white transition-colors hover:bg-red-700"
                >
                  <MicOff className="h-4 w-4 shrink-0" />
                  <span>
                    {voiceState === "connecting" ? "Connecting Voice..." : "End Live Voice"}
                  </span>
                </button>
              )}
              <p className="px-1 pt-1 text-[11px] leading-relaxed text-slate-500">
                Speak hands-free or stream text questions below; both use live {selectedCity.name} telemetry.
              </p>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <div className="px-2 pb-2 text-xs font-medium text-slate-500">
              Quick Scenario Prompts
            </div>
            <ul className="flex flex-col gap-1">
              {ASSISTANT_TOPICS.map((topic) => {
                const isSelected = selectedTopicId === topic.id;
                return (
                  <li key={topic.id}>
                    <button
                      type="button"
                      disabled={streaming || !airQuality}
                      aria-pressed={isSelected}
                      onClick={() => {
                        setSelectedTopicId(topic.id);
                        void handleStreamSend(topic.prompt);
                      }}
                      className={`w-full rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-teal-700 disabled:opacity-50 ${
                        isSelected
                          ? "bg-teal-50 text-teal-900 font-semibold"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {topic.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {messages.length > 0 && (
            <div className="border-t border-slate-200 pt-3">
              <button
                type="button"
                onClick={onClearMessages}
                className="w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                Clear Conversation
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Real-Time Streaming Conversational Interface */}
      <div className="flex min-h-[580px] flex-col rounded-xl border border-slate-200 bg-white lg:col-span-9">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Real-Time Urban Air Quality Advisor
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>{selectedCity.name}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                AQI {airQuality?.current.usAqi ?? "—"}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                PM2.5 {airQuality?.current.pm25 ?? "—"} µg/m³
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {voiceState === "live"
                  ? "Voice session active"
                  : streaming
                  ? "Streaming response"
                  : "Real-time text & voice ready"}
              </span>
            </div>
          </div>
        </div>

        {/* Live Message Feed */}
        <div
          role="log"
          aria-live="polite"
          aria-busy={streaming}
          aria-label="Real-time advisor conversation"
          className="flex-1 space-y-5 overflow-y-auto p-6"
        >
          {messages.length === 0 ? (
            <div className="py-12 text-center">
              <p className="font-display text-base font-semibold text-slate-800">
                Chat in real time about {selectedCity.name}'s air quality
              </p>
              <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-slate-600">
                Type a question below for instant token-by-token streaming advice, pick a scenario from the vertical menu, or start a live hands-free voice conversation.
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isLastStreaming =
                streaming && idx === messages.length - 1 && msg.role === "assistant";
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`max-w-2xl rounded-xl border p-4 ${
                      msg.role === "user"
                        ? "border-teal-700 bg-teal-700 text-white"
                        : "border-slate-200 bg-slate-50 text-slate-900"
                    }`}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-line">
                      {msg.text || (isLastStreaming ? "Thinking..." : "")}
                      {isLastStreaming && msg.text && (
                        <span className="ml-1 inline-block h-3.5 w-1.5 animate-pulse bg-teal-700 align-middle" />
                      )}
                    </p>
                  </div>
                  <span className="mt-1 font-mono text-[11px] text-slate-500">
                    {msg.role === "user" ? "You" : "ClearAir Advisor"} · {msg.timestamp}
                  </span>
                </div>
              );
            })
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div ref={feedEndRef} />
        </div>

        {/* Real-Time Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleStreamSend(input);
          }}
          className="flex items-center gap-3 border-t border-slate-200 p-4"
        >
          <label htmlFor="assistant-chat-input" className="sr-only">
            Message ClearAir Advisor
          </label>
          <input
            id="assistant-chat-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Message ClearAir Advisor in real time about ${selectedCity.name}...`}
            disabled={!airQuality}
            className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:border-teal-700 focus:outline-none disabled:bg-slate-50"
          />

          {streaming ? (
            <button
              type="button"
              onClick={() => {
                abortRef.current?.abort();
                setStreaming(false);
              }}
              className="flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-200 whitespace-nowrap shrink-0"
            >
              <Square className="h-3.5 w-3.5 fill-slate-700" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || !airQuality}
              className="flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-800 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Send className="h-4 w-4" />
              <span>Send</span>
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
