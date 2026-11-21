import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, Mic, MicOff, Send, Square } from "lucide-react";
import { ASSISTANT_TOPICS } from "../data/knowledgeBase";
import { useLiveVoiceSession } from "../hooks/useLiveVoiceSession";
import { useStreamingChat } from "../hooks/useStreamingChat";
import {
  ChatMessage,
  CityLocation,
  FamilyProfile,
  LocalAirQualityData,
} from "../types";

interface AssistantViewProps {
  selectedCity: CityLocation;
  airQuality: LocalAirQualityData | null;
  familyProfile: FamilyProfile;
  activeHackIds: string[];
  adoptedSwapIds: string[];
  messages: ChatMessage[];
  onAddMessages: (newMsgs: ChatMessage[]) => void;
  onUpdateMessage: (id: string, text: string) => void;
  onRemoveMessage?: (id: string) => void;
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
  onRemoveMessage,
  onClearMessages,
}) => {
  const [input, setInput] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState<string>(ASSISTANT_TOPICS[0].id);

  const { streaming, error, setError, sendMessage, stopStreaming } = useStreamingChat({
    selectedCity,
    airQuality,
    familyProfile,
    activeHackIds,
    adoptedSwapIds,
    messages,
    onAddMessages,
    onUpdateMessage,
    onRemoveMessage,
    idPrefix: "chat",
  });

  const { voiceState, startVoiceSession, stopVoiceSession, sendLiveText } =
    useLiveVoiceSession({
      selectedCity,
      airQuality,
      familyProfile,
      activeHackIds,
      adoptedSwapIds,
      onAddMessages,
      onUpdateMessage,
      onError: setError,
    });

  const feedEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streaming]);

  const handleSend = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || streaming) return;

    if (sendLiveText(trimmed)) {
      setInput("");
      return;
    }

    setInput("");
    await sendMessage(trimmed);
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left Vertical Scenario & Live Voice Control Menu */}
      <nav aria-label="Advisor scenarios and voice controls" className="lg:col-span-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-5">
          <div>
            <div className="px-2 pb-2 text-xs font-medium text-slate-600">
              Real-Time Voice Advisor
            </div>
            <div className="flex flex-col gap-1">
              {voiceState === "idle" ? (
                <button
                  type="button"
                  onClick={() => void startVoiceSession()}
                  className="min-h-[40px] flex w-full items-center gap-2 rounded-lg bg-teal-700 px-3 py-2.5 text-left text-xs font-semibold text-white transition-colors hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                >
                  <Mic className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Start Live Voice Chat</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopVoiceSession}
                  className="min-h-[40px] flex w-full items-center gap-2 rounded-lg bg-red-600 px-3 py-2.5 text-left text-xs font-semibold text-white transition-colors hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                >
                  <MicOff className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    {voiceState === "connecting" ? "Connecting Voice..." : "End Live Voice"}
                  </span>
                </button>
              )}
              <p className="px-1 pt-1 text-[11px] leading-relaxed text-slate-600">
                Speak hands-free or stream text questions below; both use live {selectedCity.name} telemetry.
              </p>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <div className="px-2 pb-2 text-xs font-medium text-slate-600">
              Quick Scenario Prompts
            </div>
            <ul className="flex flex-col gap-1">
              {ASSISTANT_TOPICS.map((topic) => {
                const isSelected = selectedTopicId === topic.id;
                return (
                  <li key={topic.id}>
                    <button
                      type="button"
                      disabled={streaming}
                      aria-pressed={isSelected}
                      onClick={() => {
                        setSelectedTopicId(topic.id);
                        void handleSend(topic.prompt);
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
                className="min-h-[36px] w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-teal-700"
              >
                Clear Conversation
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Main Real-Time Streaming Conversational Interface */}
      <div className="flex min-h-[580px] flex-col rounded-xl border border-slate-200 bg-white lg:col-span-9">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <h1 className="font-display text-xl font-bold text-slate-900">
              Real-Time Urban Air Quality Advisor
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
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
              if (!msg.text.trim() && !isLastStreaming) {
                return null;
              }
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
                        <span
                          aria-hidden="true"
                          className="ml-1 inline-block h-3.5 w-1.5 animate-pulse bg-teal-700 align-middle"
                        />
                      )}
                    </p>
                  </div>
                  <span className="mt-1 font-mono text-[11px] text-slate-600">
                    {msg.role === "user" ? "You" : "ClearAir Advisor"} · {msg.timestamp}
                  </span>
                </div>
              );
            })
          )}

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
          <div ref={feedEndRef} />
        </div>

        {/* Real-Time Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSend(input);
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
            className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-600 focus:border-teal-700 focus:outline-none"
          />

          {streaming ? (
            <button
              type="button"
              onClick={stopStreaming}
              className="min-h-[40px] flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 whitespace-nowrap shrink-0"
            >
              <Square className="h-3.5 w-3.5 fill-slate-700" aria-hidden="true" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="min-h-[40px] flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              <span>Send</span>
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
