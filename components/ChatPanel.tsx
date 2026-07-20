"use client";

import { useEffect, useRef } from "react";
import { MessageBubble } from "./MessageBubble";
import type { Message, Capability } from "@/lib/types";
import { CAPABILITIES } from "@/lib/capabilities";
import {
  MessageCircle,
  PenLine,
  Languages,
  Code2,
  FileText,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  MessageCircle,
  PenLine,
  Languages,
  Code2,
  FileText,
  Sparkles,
};

interface ChatPanelProps {
  messages: Message[];
  streamingId: string | null;
  capability: Capability;
  onExample: (text: string) => void;
}

/**
 * 消息列表区：
 * - 有消息时纵向滚动渲染对话
 * - 无消息时展示能力简介 + 示例（点击即填）
 */
export default function ChatPanel({
  messages,
  streamingId,
  capability,
  onExample,
}: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // 新消息或流式更新时自动滚动到底
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  if (messages.length === 0) {
    const Icon = ICONS[capability.icon] ?? Sparkles;
    return (
      <div className="flex h-full items-center justify-center overflow-y-auto px-4 py-8 sm:p-6">
        <div className="w-full max-w-xl text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md">
            <Icon className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
            {capability.name}
          </h2>
          <p className="mt-1.5 text-xs text-slate-500 sm:text-sm">
            {capability.description}
          </p>

          <div className="mt-6 sm:mt-7">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">
              试试这些示例
            </p>
            <div className="space-y-2">
              {capability.examples.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => onExample(ex)}
                  className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-xs text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-700 sm:px-4 sm:text-sm"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          <p className="mt-6 text-[11px] text-slate-400 sm:mt-8 sm:text-xs">
            提示：左侧可切换其他 AI 能力，对话历史各自独立。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-4 px-3 py-4 sm:space-y-5 sm:px-4 sm:py-6">
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            isStreaming={m.id === streamingId}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// 防止未使用导入告警（CAPABILITIES 备用）
void CAPABILITIES;
