import type { ChatMessage } from "./types";

const DEFAULT_BASE_URL = "https://api.deepseek.com/v1";
const DEFAULT_MODEL = "deepseek-chat";

export interface DeepSeekStreamOptions {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  /** 服务端传入；默认读环境变量 DEEPSEEK_API_KEY */
  apiKey?: string;
  signal?: AbortSignal;
}

/**
 * 调用 DeepSeek Chat Completions（流式）。
 * DeepSeek API 兼容 OpenAI 格式：POST /v1/chat/completions，stream=true。
 *
 * 返回一个 ReadableStream<Uint8Array>，逐 token 产出纯文本内容，
 * 前端可直接拼接到消息气泡，实现"打字机"效果。
 */
export async function streamDeepSeekChat(
  options: DeepSeekStreamOptions
): Promise<ReadableStream<Uint8Array>> {
  const {
    messages,
    model = process.env.DEEPSEEK_MODEL || DEFAULT_MODEL,
    temperature = 0.7,
    apiKey = process.env.DEEPSEEK_API_KEY,
    signal,
  } = options;

  if (!apiKey) {
    throw new Error("缺少 DEEPSEEK_API_KEY，请在 .env.local 中配置后重启服务。");
  }

  const baseUrl = process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      stream: true,
    }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`DeepSeek API 错误 (${res.status}): ${text || res.statusText}`);
  }

  if (!res.body) {
    throw new Error("DeepSeek API 未返回响应体。");
  }

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  // 把 SSE 原始流解析为「纯文本 delta」流
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = res.body!.getReader();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          // 按行拆分，最后一行可能不完整，留到下次
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
              const delta: string | undefined = json.choices?.[0]?.delta?.content;
              if (delta) {
                controller.enqueue(encoder.encode(delta));
              }
            } catch {
              // 忽略无法解析的行（心跳、注释等）
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          controller.error(err);
          return;
        }
      } finally {
        controller.close();
      }
    },
  });

  return stream;
}
