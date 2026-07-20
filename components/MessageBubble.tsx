"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { User, Sparkles } from "lucide-react";
import type { Message } from "@/lib/types";

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
}

/**
 * 单条消息气泡：
 * - 用户消息：右对齐，浅色气泡
 * - AI 消息：左对齐，Markdown 渲染（含代码高亮），流式时显示光标
 */
function MessageBubbleInner({ message, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end gap-2 sm:gap-3">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-indigo-600 px-3 py-2 text-xs leading-relaxed text-white shadow-sm sm:max-w-[78%] sm:px-4 sm:py-2.5 sm:text-sm">
          {message.content}
        </div>
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600 sm:h-8 sm:w-8">
          <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 sm:gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm sm:h-8 sm:w-8">
        <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      </div>
      <div className="min-w-0 max-w-[85%] rounded-2xl rounded-tl-sm bg-white px-3 py-2.5 text-xs leading-relaxed text-slate-800 shadow-sm ring-1 ring-slate-100 sm:max-w-[78%] sm:px-4 sm:py-3 sm:text-sm">
        {message.content ? (
          <div className="prose-chat">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        ) : isStreaming ? (
          <span className="inline-flex items-center gap-1 text-slate-400">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
          </span>
        ) : null}
        {isStreaming && message.content && (
          <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-indigo-500 align-middle" />
        )}
      </div>
    </div>
  );
}

export const MessageBubble = memo(MessageBubbleInner);
