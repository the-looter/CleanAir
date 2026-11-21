import { useCallback, useEffect, useRef, useState } from "react";
import { sendAssistantMessage, streamAssistantChat } from "../services/api";
import {
  ChatMessage,
  CityLocation,
  FamilyProfile,
  LocalAirQualityData,
} from "../types";
import { buildAssistantContext, formatAssistantJsonReply } from "../utils/chatHelpers";

interface UseStreamingChatOptions {
  selectedCity: CityLocation;
  airQuality: LocalAirQualityData | null;
  familyProfile: FamilyProfile;
  activeHackIds: string[];
  adoptedSwapIds: string[];
  messages: ChatMessage[];
  onAddMessages: (newMsgs: ChatMessage[]) => void;
  onUpdateMessage: (id: string, text: string) => void;
  onRemoveMessage?: (id: string) => void;
  idPrefix?: string;
}

export function useStreamingChat({
  selectedCity,
  airQuality,
  familyProfile,
  activeHackIds,
  adoptedSwapIds,
  messages,
  onAddMessages,
  onUpdateMessage,
  onRemoveMessage,
  idPrefix = "msg",
}: UseStreamingChatOptions) {
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
  }, []);

  const sendMessage = useCallback(
    async (promptText: string) => {
      const trimmed = promptText.trim();
      if (!trimmed || streaming) return;

      const context = buildAssistantContext({
        selectedCity,
        airQuality,
        familyProfile,
        activeHackIds,
        adoptedSwapIds,
      });

      setError(null);
      const nowTime = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      const stamp = Date.now();
      const userMsg: ChatMessage = {
        id: `${idPrefix}-u-${stamp}`,
        role: "user",
        text: trimmed,
        timestamp: nowTime,
      };
      const assistantMsgId = `${idPrefix}-a-${stamp + 1}`;
      const placeholderMsg: ChatMessage = {
        id: assistantMsgId,
        role: "assistant",
        text: "",
        timestamp: nowTime,
      };

      const historySnapshot = messages
        .filter((m) => m.text.trim().length > 0)
        .map((m) => ({ role: m.role, text: m.text }));

      onAddMessages([userMsg, placeholderMsg]);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;
      let accumulated = "";
      let streamErrorMsg: string | null = null;

      const tryJsonFallback = async (): Promise<boolean> => {
        try {
          const reply = await sendAssistantMessage({
            message: trimmed,
            history: historySnapshot,
            context,
          });
          const formatted = formatAssistantJsonReply(reply);
          if (formatted.trim()) {
            onUpdateMessage(assistantMsgId, formatted);
            setError(null);
            return true;
          }
        } catch (fallbackErr) {
          streamErrorMsg =
            fallbackErr instanceof Error ? fallbackErr.message : streamErrorMsg;
        }
        return false;
      };

      try {
        await streamAssistantChat(
          {
            message: trimmed,
            history: historySnapshot,
            context,
          },
          {
            onChunk: (chunk) => {
              accumulated += chunk;
              onUpdateMessage(assistantMsgId, accumulated);
            },
            onDone: () => {
              // Handled after stream promise resolves
            },
            onError: (errMsg) => {
              streamErrorMsg = errMsg;
            },
          },
          controller.signal
        );

        if (!accumulated.trim()) {
          const recovered = controller.signal.aborted ? false : await tryJsonFallback();
          if (!recovered) {
            onRemoveMessage?.(assistantMsgId);
            setError(
              streamErrorMsg || "The AI advisor returned an empty response. Please try again."
            );
          }
        } else if (streamErrorMsg) {
          setError(streamErrorMsg);
        }
      } catch (err) {
        if ((err as Error)?.name === "AbortError") {
          if (!accumulated.trim()) {
            onRemoveMessage?.(assistantMsgId);
          }
        } else {
          const recovered = accumulated.trim() ? true : await tryJsonFallback();
          if (!recovered) {
            onRemoveMessage?.(assistantMsgId);
            setError(
              streamErrorMsg ||
                (err instanceof Error ? err.message : "Real-time chat request failed.")
            );
          }
        }
      } finally {
        setStreaming(false);
      }
    },
    [
      streaming,
      selectedCity,
      airQuality,
      familyProfile,
      activeHackIds,
      adoptedSwapIds,
      idPrefix,
      messages,
      onAddMessages,
      onUpdateMessage,
      onRemoveMessage,
    ]
  );

  return {
    streaming,
    error,
    setError,
    sendMessage,
    stopStreaming,
  };
}
