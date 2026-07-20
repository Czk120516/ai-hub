"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Message, ChatMessage, Capability } from "@/lib/types";
import { directStreamDeepSeek } from "@/lib/deepseek-client";

export function useChat(capability: Capability) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const prevCapId = useRef(capability.id);

  useEffect(() => {
    if (prevCapId.current !== capability.id) {
      prevCapId.current = capability.id;
      abortRef.current?.abort();
      setMessages([]);
      setError(null);
      setIsStreaming(false);
      setStreamingId(null);
    }
  }, [capability.id]);

  const send = useCallback(
    async (input: string) => {
      const text = input.trim();
      if (!text || isStreaming) return;

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        createdAt: Date.now(),
      };
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        createdAt: Date.now(),
      };

      const systemPrompt = capability.systemPrompt;
      const apiMessages: ChatMessage[] = [
        ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: text },
      ];

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setError(null);
      setIsStreaming(true);
      setStreamingId(assistantMsg.id);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const stream = await directStreamDeepSeek({
          messages: apiMessages,
          temperature: capability.temperature ?? 0.7,
          signal: controller.signal,
        });

        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let acc = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id ? { ...m, content: acc } : m
            )
          );
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        setIsStreaming(false);
        setStreamingId(null);
        abortRef.current = null;
      }
    },
    [messages, isStreaming, capability]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setIsStreaming(false);
    setStreamingId(null);
  }, []);

  return { messages, isStreaming, streamingId, error, send, stop, clear };
}
