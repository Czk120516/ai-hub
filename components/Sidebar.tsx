"use client";

import { useEffect } from "react";
import {
  MessageCircle,
  PenLine,
  Languages,
  Code2,
  FileText,
  Sparkles,
  X,
  Users,
  User,
  type LucideIcon,
} from "lucide-react";
import { CAPABILITIES } from "@/lib/capabilities";
import type { Capability } from "@/lib/types";

const ICONS: Record<string, LucideIcon> = {
  MessageCircle,
  PenLine,
  Languages,
  Code2,
  FileText,
  Sparkles,
};

interface SidebarProps {
  activeId: string;
  onSelect: (cap: Capability) => void;
  /** 移动端：抽屉是否打开 */
  mobileOpen: boolean;
  /** 移动端：关闭抽屉 */
  onClose: () => void;
}

export default function Sidebar({ activeId, onSelect, mobileOpen, onClose }: SidebarProps) {
  // 选中能力后自动关闭移动抽屉
  const handleSelect = (cap: Capability) => {
    onSelect(cap);
    onClose();
  };

  // 移动端打开时禁止背景滚动；关闭时恢复
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const navContent = (
    <>
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          AI 能力
        </p>
        {/* 移动端关闭按钮 */}
        <button
          onClick={onClose}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 md:hidden"
          aria-label="关闭菜单"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 pb-4">
        {CAPABILITIES.map((cap) => {
          const Icon = ICONS[cap.icon] ?? Sparkles;
          const active = cap.id === activeId;
          return (
            <button
              key={cap.id}
              onClick={() => handleSelect(cap)}
              className={[
                "group flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition",
                active
                  ? "bg-white shadow-sm ring-1 ring-indigo-100"
                  : "hover:bg-white/70",
              ].join(" ")}
            >
              <span
                className={[
                  "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition",
                  active
                    ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white"
                    : "bg-slate-200/70 text-slate-500 group-hover:text-slate-700",
                ].join(" ")}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span
                  className={[
                    "block text-sm font-medium leading-tight",
                    active ? "text-slate-900" : "text-slate-700",
                  ].join(" ")}
                >
                  {cap.name}
                </span>
                <span className="mt-0.5 block truncate text-xs text-slate-400">
                  {cap.description}
                </span>
              </span>
            </button>
          );
        })}
      </nav>

      {/* 社区 & 个人入口 */}
      <div className="border-t border-slate-200 px-2 pb-2 pt-2">
        <a
          href="/community"
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-white/70 hover:text-slate-800"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-200/70 text-slate-500">
            <Users className="h-4 w-4" />
          </span>
          <span className="font-medium">讨论社区</span>
        </a>
        <a
          href="/profile"
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-white/70 hover:text-slate-800"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-200/70 text-slate-500">
            <User className="h-4 w-4" />
          </span>
          <span className="font-medium">个人主页</span>
        </a>
      </div>

      <div className="border-t border-slate-200 px-4 py-3">
        <p className="text-[11px] leading-relaxed text-slate-400">
          由 DeepSeek 驱动 · 共用一模型，多能力切换
        </p>
      </div>
    </>
  );

  return (
    <>
      {/* ===== 桌面端：固定侧栏 ===== */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-slate-50/60 md:flex">
        {navContent}
      </aside>

      {/* ===== 移动端：遮罩层 ===== */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      {/* ===== 移动端：侧滑抽屉 ===== */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-slate-50 shadow-2xl transition-transform duration-300 ease-in-out md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        {navContent}
      </aside>
    </>
  );
}
