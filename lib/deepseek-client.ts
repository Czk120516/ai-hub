import type { ChatMessage } from "./types";

const API_KEY = "sk-3dcd416fa51842adae9584befc40ebb6";
const BASE_URL = "https://api.deepseek.com/v1";
const MODEL = "deepseek-chat";

export interface DirectStreamOptions {
  messages: ChatMessage[];
  temperature?: number;
  signal?: AbortSignal;
}

/**
 * 从浏览器直接调用 DeepSeek API（流式），返回逐 token 的 ReadableStream。
 */
export async function directStreamDeepSeek(
  options: DirectStreamOptions
): Promise<ReadableStream<Uint8Array>> {
  const { messages, temperature = 0.7, signal } = options;

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ model: MODEL, messages, temperature, stream: true }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`DeepSeek API error (${res.status}): ${text || res.statusText}`);
  }

  if (!res.body) throw new Error("No response body from DeepSeek API");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (data === "[DONE]") {
              controller.close();
              return;
            }
            try {
              const json = JSON.parse(data);
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) controller.enqueue(encoder.encode(delta));
            } catch { /* skip unparseable lines */ }
          }
        }
      } catch (err: unknown) {
        if ((err as Error).name !== "AbortError") controller.error(err);
      } finally {
        controller.close();
      }
    },
  });
}
