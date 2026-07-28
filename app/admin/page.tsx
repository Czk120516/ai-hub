"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AuthGuard from "@/components/auth/AuthGuard";
import AppShell from "@/components/AppShell";
import ServerStatusPanel from "@/components/ServerStatusPanel";
import {
  adminListUsers,
  adminBanUser,
  adminUnbanUser,
  type UserProfile,
} from "@/lib/auth-api";
import {
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Ban,
  UserCheck,
  Users as UsersIcon,
} from "lucide-react";

function RoleBadge({ role }: { role: UserProfile["role"] }) {
  if (role === "developer") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
        <ShieldCheck className="h-3 w-3" /> 开发者
      </span>
    );
  }
  if (role === "banned") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-600">
        <Ban className="h-3 w-3" /> 已封禁
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
      普通用户
    </span>
  );
}

function UserManagement() {
  const { token, user } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [busyEmail, setBusyEmail] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setMsg("");
    const res = await adminListUsers(token);
    if (res.users) setUsers(res.users);
    else setMsg(res.error || "加载用户失败");
    setLoading(false);
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggleBan = async (email: string, currentlyBanned: boolean) => {
    if (!token) return;
    setBusyEmail(email);
    setMsg("");
    const res = currentlyBanned
      ? await adminUnbanUser(token, email)
      : await adminBanUser(token, email);
    setBusyEmail("");
    if (res.error) {
      setMsg(res.error);
    } else {
      setMsg(res.message || "操作成功");
      load();
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/60 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UsersIcon className="h-5 w-5 text-indigo-500" />
          <div>
            <h3 className="text-base font-semibold text-slate-800">用户管理</h3>
            <p className="text-xs text-slate-400">封禁 / 解封用户（开发者专属）</p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
        >
          刷新列表
        </button>
      </div>

      {msg && (
        <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{msg}</p>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          加载中…
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => {
            const banned = u.role === "banned";
            const isSelf = u.email === user?.email;
            const isDev = u.role === "developer";
            return (
              <div
                key={u.email}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-slate-700">
                      {u.nickname || u.email}
                    </span>
                    <RoleBadge role={u.role} />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-400">
                    {u.email} · QR: {u.qrNumber || "-"}
                  </p>
                </div>
                {!isSelf && !isDev && (
                  <button
                    onClick={() => handleToggleBan(u.email, banned)}
                    disabled={busyEmail === u.email}
                    className={[
                      "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-60",
                      banned
                        ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                        : "bg-rose-50 text-rose-600 hover:bg-rose-100",
                    ].join(" ")}
                  >
                    {busyEmail === u.email ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : banned ? (
                      <UserCheck className="h-3.5 w-3.5" />
                    ) : (
                      <Ban className="h-3.5 w-3.5" />
                    )}
                    {banned ? "解封" : "封禁"}
                  </button>
                )}
                {(isSelf || isDev) && (
                  <span className="text-xs text-slate-300">
                    {isSelf ? "当前账号" : "受保护"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AdminPage() {
  const { user } = useAuth();
  return (
    <AppShell title="管理面板" activeNav="admin">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        {user?.role !== "developer" ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-6 py-16 text-center">
            <ShieldAlert className="h-9 w-9 text-amber-500" />
            <p className="text-sm font-medium text-amber-700">无访问权限</p>
            <p className="text-xs text-amber-500">
              管理面板仅开发者账号可访问。将账号 QR 设置为 88888888 即可成为开发者。
            </p>
          </div>
        ) : (
          <>
            <ServerStatusPanel />
            <UserManagement />
          </>
        )}
      </div>
    </AppShell>
  );
}

export default function Page() {
  return (
    <AuthGuard>
      <AdminPage />
    </AuthGuard>
  );
}
