"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  verifyCode as apiVerifyCode,
  fetchProfile,
  updateProfile as apiUpdateProfile,
  type UserProfile,
} from "@/lib/auth-api";
import { localLogout } from "@/lib/local-store";

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  /** 校验验证码并登录 */
  verifyCode: (
    email: string,
    code: string
  ) => Promise<{ success: boolean; error?: string }>;
  /** 刷新用户资料 */
  refreshProfile: () => Promise<void>;
  /** 更新用户资料 */
  updateProfile: (
    updates: { nickname?: string; qrNumber?: string; avatar?: string | null }
  ) => Promise<{ error?: string }>;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

const STORAGE_KEY = "aihub_auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // 启动时从 localStorage 恢复 session
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const { user: savedUser, token: savedToken, expiresAt } = JSON.parse(stored);
        if (expiresAt && Date.now() / 1000 < expiresAt) {
          setUser(savedUser);
          setToken(savedToken);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    // 同步到 local-store 的 session（供社区/资料 API 降级使用）
    try {
      const authData = localStorage.getItem(STORAGE_KEY);
      if (authData) {
        const { user: savedUser, token: savedToken, expiresAt } = JSON.parse(authData);
        if (expiresAt && Date.now() / 1000 < expiresAt && savedUser) {
          localStorage.setItem("aihub_session", JSON.stringify({
            email: savedUser.email,
            token: savedToken,
            expiresAt,
          }));
        }
      }
    } catch { /* ignore */ }
    setReady(true);
  }, []);

  /** 保存到 localStorage，同时同步到 local-store 的 session */
  const persist = useCallback((u: UserProfile, t: string, exp: number) => {
    const data = { user: u, token: t, expiresAt: exp };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    // 同步到 local-store session（供社区/资料降级使用）
    localStorage.setItem("aihub_session", JSON.stringify({
      email: u.email,
      token: t,
      expiresAt: exp,
    }));
    setUser(u);
    setToken(t);
  }, []);

  const loginVerifyCode = useCallback(
    async (email: string, code: string) => {
      const result = await apiVerifyCode(email, code);

      if (result.success && result.token && result.user) {
        persist(result.user, result.token, result.expiresAt || 0);
        return { success: true };
      }

      return { success: false, error: result.error || "验证失败" };
    },
    [persist]
  );

  const refreshProfile = useCallback(async () => {
    if (!token) return;
    const profile = await fetchProfile(token);
    if (profile) {
      setUser(profile);
      // 更新 localStorage 中的 user
      try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        stored.user = profile;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      } catch { /* ignore */ }
    }
  }, [token]);

  const handleUpdateProfile = useCallback(
    async (updates: { nickname?: string; qrNumber?: string; avatar?: string | null }) => {
      if (!token) return { error: "未登录" };
      const result = await apiUpdateProfile(token, updates);
      if (result.profile) {
        setUser(result.profile);
        try {
          const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
          stored.user = result.profile;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
        } catch { /* ignore */ }
        // 如果更新了 QR 号（比如设成了 888888），需要重新登录以获得新 role
        if (updates.qrNumber) {
          return { error: undefined, needRelogin: true };
        }
        return {};
      }
      return { error: result.error || "更新失败" };
    },
    [token]
  );

  const signOut = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localLogout(); // 清除 local-store session
    setUser(null);
    setToken(null);
  }, []);

  if (!ready) return null;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        verifyCode: loginVerifyCode,
        refreshProfile,
        updateProfile: handleUpdateProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
