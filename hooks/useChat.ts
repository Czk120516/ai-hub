"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Message, ChatMessage, Capability } from "@/lib/types";
import { useLocation, type BestLocation } from "@/contexts/LocationContext";
import { useAuth } from "@/contexts/AuthContext";
import { fetchServerStatus, type ServerStatus } from "@/lib/auth-api";

/**
 * 通过服务端 API 代理调用 DeepSeek（API Key 仅服务端，前端不接触）
 */
async function fetchChatStream(
  apiMessages: ChatMessage[],
  temperature: number,
  signal: AbortSignal,
  loc: BestLocation | null,
  capabilityId?: string,
  serverStatus?: ServerStatus | null,
): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: apiMessages,
      temperature,
      ...(loc ? { lat: loc.lat, lng: loc.lng, locName: loc.city, locSource: loc.source } : {}),
      ...(capabilityId ? { capabilityId } : {}),
      ...(serverStatus ? { serverStatus } : {}),
    }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI 服务错误 (${res.status}): ${text || res.statusText}`);
  }

  if (!res.body) throw new Error("AI 服务未返回响应");
  return res.body;
}

export function useChat(capability: Capability) {
  const { getBest } = useLocation();
  const { token } = useAuth();
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

      // 构造系统提示词；开发者专属能力会先拉取实时服务器指标注入
      let systemPrompt = capability.systemPrompt;
      let serverStatusData: Awaited<ReturnType<typeof fetchServerStatus>> | null = null;
      if (capability.developerOnly) {
        if (!token) {
          setError("该能力仅开发者可用，请先以开发者账号登录");
          return;
        }
        try {
          serverStatusData = await fetchServerStatus(token);
        } catch {
          serverStatusData = null;
        }
        if (status) {
          const metrics = JSON.stringify(serverStatusData, null, 2);
          systemPrompt =
            systemPrompt +
            "\n\n【服务器实时运行指标（最新）】\n" +
            metrics +
            "\n\n请严格基于以上真实数据作答，不要编造数据以外的内容。";
        } else {
          // 放宽：拉取失败不阻断对话，让模型如实说明未能获取实时指标
          systemPrompt =
            systemPrompt +
            "\n\n（注：本次请求未能实时连接服务器获取运行指标，可能是网络或部署原因。" +
            "请如实告诉用户「暂时未能获取到服务器实时指标，请稍后重试」，不要编造数据，" +
            "也不要声称自己能/不能访问服务器——只需说明当前数据缺失即可。）";
        }
      }

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
        const loc = getBest();
        const stream = await fetchChatStream(
          apiMessages,
          capability.temperature ?? 0.7,
          controller.signal,
          loc,
          capability.id,
          capability.id === "server-health" ? serverStatusData : undefined,
        );

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
    [messages, isStreaming, capability, getBest, token]
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
