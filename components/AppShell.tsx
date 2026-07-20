"use client";

import { useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sparkles,
  Menu,
  X,
  MessageCircle,
  Users,
  User,
} from "lucide-react";
import Link from "next/link";

interface AppShellProps {
  children: ReactNode;
  title: string;
  activeNav: "chat" | "community" | "profile";
}

export default function AppShell({ children, title, activeNav }: AppShellProps) {
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { id: "chat", label: "AI 对话", icon: MessageCircle, href: "/" },
    { id: "community", label: "讨论社区", icon: Users, href: "/community" },
    { id: "profile", label: "个人主页", icon: User, href: "/profile" },
  ];

  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="flex h-dvh w-screen overflow-hidden bg-slate-50">
      {/* ===== 遮罩层（移动端）===== */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={closeMobile}
        />
      )}

      {/* ===== Sidebar ===== */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-white shadow-lg transition-transform duration-300
          md:relative md:z-auto md:translate-x-0 md:shadow-none md:ring-1 md:ring-slate-200
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-slate-700">AI Hub</span>
          </div>
          <button
            className="rounded p-1 text-slate-400 hover:bg-slate-100 md:hidden"
            onClick={closeMobile}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 导航 */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === activeNav;
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={closeMobile}
                className={`
                  flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition
                  ${isActive
                    ? "bg-indigo-50 font-medium text-indigo-600"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                  }
                `}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* 底部用户信息 */}
        <div className="border-t border-slate-100 px-3 py-3">
          <p className="text-xs text-slate-400">
            {user?.nickname || user?.email}
          </p>
          <p className="text-[10px] text-slate-300">
            QR: {user?.qrNumber || "-"}
          </p>
        </div>
      </aside>

      {/* ===== 主区域 ===== */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5">
          <div className="flex items-center gap-2">
            <button
              className="rounded p-1 text-slate-500 hover:bg-slate-100 md:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-sm font-semibold text-slate-700">{title}</h1>
          </div>
          {user && (
            <button
              onClick={signOut}
              className="rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              退出
            </button>
          )}
        </header>

        {/* 内容 */}
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
