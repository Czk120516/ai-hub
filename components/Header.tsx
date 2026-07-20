"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Trash2, Github, Menu, User, LogOut } from "lucide-react";
import type { Capability } from "@/lib/types";

interface HeaderProps {
  capability: Capability;
  onClear: () => void;
  canClear: boolean;
  isStreaming: boolean;
  /** 移动端：打开能力菜单 */
  onMenuOpen: () => void;
  userEmail?: string;
  userName?: string;
  onSignOut: () => void;
}

export default function Header({ capability, onClear, canClear, isStreaming, onMenuOpen, userEmail, userName, onSignOut }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  return (
    <header className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white/80 px-3 py-2.5 backdrop-blur sm:gap-4 sm:px-5 sm:py-3">
      <div className="flex items-center gap-2 sm:gap-3">
        {/* 移动端汉堡菜单 */}
        <button
          onClick={onMenuOpen}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 md:hidden"
          aria-label="打开能力菜单"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm sm:h-9 sm:w-9">
          <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold leading-tight text-slate-900 sm:text-base">
            AI 能力聚合站
          </h1>
          <p className="truncate text-[11px] text-slate-500 sm:text-xs">
            当前能力 · <span className="font-medium text-indigo-600">{capability.name}</span>
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <button
          onClick={onClear}
          disabled={!canClear || isStreaming}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 sm:px-3 sm:py-1.5 sm:text-sm"
          title="清空当前对话"
        >
          <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">清空</span>
        </button>
        <a
          href="https://api-docs.deepseek.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 sm:h-8 sm:w-8"
          title="DeepSeek API 文档"
        >
          <Github className="h-4 w-4" />
        </a>

        {/* 用户菜单 */}
        {userEmail && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 sm:px-2.5"
              title={userEmail}
            >
              <User className="h-3.5 w-3.5" />
              <span className="hidden max-w-[80px] truncate sm:inline">{userName || userEmail?.split("@")[0]}</span>
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                <div className="border-b border-slate-100 px-3 py-2">
                  <p className="truncate text-xs text-slate-500">{userEmail}</p>
                </div>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onSignOut();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-600 transition hover:bg-slate-50 hover:text-rose-600"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  退出登录
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
