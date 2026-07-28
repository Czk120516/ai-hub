"use client";

import { useAuth } from "@/contexts/AuthContext";
import AuthGuard from "@/components/auth/AuthGuard";
import AppShell from "@/components/AppShell";
import ServerStatusPanel from "@/components/ServerStatusPanel";

function ServerStatusPage() {
  const { user } = useAuth();
  return (
    <AppShell title="服务器运行状况" activeNav="server">
      <div className="mx-auto max-w-4xl px-4 py-6">
        <ServerStatusPanel />
        {user?.role !== "developer" && (
          <p className="mt-4 text-center text-xs text-slate-400">
            提示：此功能已整合进「管理面板」，开发者可在左侧菜单进入。
          </p>
        )}
      </div>
    </AppShell>
  );
}

export default function Page() {
  return (
    <AuthGuard>
      <ServerStatusPage />
    </AuthGuard>
  );
}
