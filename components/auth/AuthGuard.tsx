"use client";

import { type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import LoginForm from "./LoginForm";

export default function AuthGuard({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  // 未登录 → 直接显示登录页（不再转圈）
  // 如果 localStorage 里有 session，useEffect 会自动 setUser，切到主页
  if (!user) {
    return <LoginForm />;
  }

  return <>{children}</>;
}
