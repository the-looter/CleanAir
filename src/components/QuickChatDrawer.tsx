import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, Send, Square, X } from "lucide-react";
import { useStreamingChat } from "../hooks/useStreamingChat";
import {
  ChatMessage,
  CityLocation,
  FamilyProfile,
  LocalAirQualityData,
} from "../types";

interface QuickChatDrawerProps {
  open: boolean;
  onClose: () => void;
  selectedCity: CityLocation;
  airQuality: LocalAirQualityData | null;
  familyProfile: FamilyProfile;
  activeHackIds: string[];
  adoptedSwapIds: string[];
  messages: ChatMessage[];
  onAddMessages: (newMsgs: ChatMessage[]) => void;
  onUpdateMessage: (id: string, text: string) => void;
  onRemoveMessage?: (id: string) => void;
}

const QUICK_PROMPTS = [
  "Is outdoor play safe right now?",
  "Best time to open windows today?",
  "How much does our purifier help today?",
];

export const QuickChatDrawer: React.FC<QuickChatDrawerProps> = ({
  open,
  onClose,
  selectedCity,
  airQuality,
  familyProfile,
  activeHackIds,
  adoptedSwapIds,
  messages,
  onAddMessages,
  onUpdateMessage,
  onRemoveMessage,
}) => {
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { streaming, error, sendMessage, stopStreaming } = useStreamingChat({
    selectedCity,
    airQuality,
    familyProfile,
    activeHackIds,
    adoptedSwapIds,
    messages,
    onAddMessages,
    onUpdateMessage,
    onRemoveMessage,
    idPrefix: "quick",
  });

  useEffect(() => {
    if (open) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [open, messages.length, streaming]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSend = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || streaming) return;
    setInput("");
    await sendMessage(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/35"
      role="dialog"
      aria-modal="true"
      aria-label="Real-time AI chat drawer"
    >
      <div className="flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Live AI Chat
            </h2>
            <p className="text-xs text-slate-600">
              {selectedCity.name} · AQI {airQuality?.current.usAqi ?? "—"} · PM2.5{" "}
              {airQuality?.current.pm25 ?? "—"} µg/m³
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close live AI chat"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-teal-700"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Vertical Quick Questions */}
        {messages.length === 0 && (
          <div className="border-b border-slate-100 bg-slate-50/70 p-4">
            <div className="pb-2 text-xs font-medium text-slate-600">Ask in real time</div>
            <div className="flex flex-col gap-1.5">
              {QUICK_PROMPTS.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={streaming}
                  onClick={() => void handleSend(q)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-teal-700 disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <div
          role="log"
          aria-live="polite"
          aria-busy={streaming}
          aria-label="Live AI chat messages"
          className="flex-1 space-y-4 overflow-y-auto p-5"
        >
          {messages.map((msg, idx) => {
            const isLastStreaming =
              streaming && idx === messages.length - 1 && msg.role === "assistant";
            if (!msg.text.trim() && !isLastStreaming) {
              return null;
            }
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[88%] rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-line ${
                    msg.role === "user"
                      ? "border-teal-700 bg-teal-700 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-900"
                  }`}
                >
                  {msg.text || (isLastStreaming ? "Thinking..." : "")}
                  {isLastStreaming && msg.text && (
                    <span
                      aria-hidden="true"
                      className="ml-1 inline-block h-3 w-1 animate-pulse bg-teal-700 align-middle"
                    />
                  )}
                </div>
                <span className="mt-1 font-mono text-[10px] text-slate-600">
                  {msg.role === "user" ? "You" : "ClearAir AI"} · {msg.timestamp}
                </span>
              </div>
            );
          })}

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSend(input);
          }}
          className="flex items-center gap-2 border-t border-slate-200 p-4"
        >
          <label htmlFor="quick-chat-input" className="sr-only">
            Message ClearAir AI
          </label>
          <input
            ref={inputRef}
            id="quick-chat-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask ClearAir AI..."
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-600 focus:border-teal-700 focus:outline-none"
          />
          {streaming ? (
            <button
              type="button"
              onClick={stopStreaming}
              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg bg-slate-200 p-2 text-slate-800 hover:bg-slate-300 focus-visible:outline-2 focus-visible:outline-teal-700"
              aria-label="Stop streaming"
            >
              <Square className="h-3.5 w-3.5 fill-slate-700" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg bg-teal-700 p-2 text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-teal-700 disabled:opacity-50"
              aria-label="Send message"
            >
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
