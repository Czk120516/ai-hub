"use client";

import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { Send, Square } from "lucide-react";

interface InputAreaProps {
  placeholder: string;
  isStreaming: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  /** 外部填入（如点击示例）时的文本 */
  draft: string;
  onDraftChange: (text: string) => void;
}

/**
 * 底部输入区：
 * - 自适应高度的 textarea
 * - Enter 发送，Shift+Enter 换行
 * - 流式中变为"停止"按钮
 */
export default function InputArea({
  placeholder,
  isStreaming,
  onSend,
  onStop,
  draft,
  onDraftChange,
}: InputAreaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 自适应高度
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [draft]);

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const submit = () => {
    const text = draft.trim();
    if (!text || isStreaming) return;
    onSend(text);
    onDraftChange("");
  };

  return (
    <div className="border-t border-slate-200 bg-white px-3 py-2.5 sm:px-4 sm:py-3">
      <div className="mx-auto flex max-w-3xl items-end gap-1.5 sm:gap-2">
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={handleKey}
            placeholder={placeholder}
            rows={1}
            className="block w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 pr-3 text-sm leading-relaxed text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100 sm:px-4 sm:py-3"
          />
        </div>

        {isStreaming ? (
          <button
            onClick={onStop}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-800 text-white transition hover:bg-slate-700 sm:h-11 sm:w-11"
            title="停止生成"
          >
            <Square className="h-4 w-4" fill="currentColor" />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={!draft.trim()}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:h-11 sm:w-11"
            title="发送（Enter）"
          >
            <Send className="h-4 w-4" />
          </button>
        )}
      </div>
      <p className="mx-auto mt-1.5 max-w-3xl text-center text-[10px] text-slate-400 sm:mt-2 sm:text-[11px]">
        Enter 发送 · Shift+Enter 换行 · AI 生成内容仅供参考
      </p>
    </div>
  );
}
