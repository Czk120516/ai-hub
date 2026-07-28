"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchServerStatus,
  type ServerStatus,
} from "@/lib/auth-api";
import {
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  Server,
  Cpu,
  Clock,
  ShieldAlert,
  Users as UsersIcon,
  MessageSquare,
  Activity,
} from "lucide-react";

function fmtUptime(total: number): string {
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const parts: string[] = [];
  if (d) parts.push(`${d} 天`);
  if (h) parts.push(`${h} 小时`);
  if (m) parts.push(`${m} 分`);
  parts.push(`${s} 秒`);
  return parts.join(" ");
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 text-slate-400">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-lg font-semibold text-slate-800">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

export default function ServerStatusPanel() {
  const { user, token } = useAuth();
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    setError("");
    const data = await fetchServerStatus(token);
    if (!data) {
      setError("无法获取服务器状态（可能无开发者权限或网络异常）");
      setStatus(null);
    } else {
      setStatus(data);
    }
    setLoading(false);
    setRefreshing(false);
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const isDeveloper = user?.role === "developer";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/60 p-5">
      {/* 顶部状态条 */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-indigo-500" />
          <div>
            <h3 className="text-base font-semibold text-slate-800">服务器运行状况</h3>
            <p className="text-xs text-slate-400">实时查看服务运行状态与资源占用</p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={refreshing || loading}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          刷新
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-12 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          正在加载服务器状态…
        </div>
      )}

      {!loading && error && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-6 py-10 text-center">
          <ShieldAlert className="h-8 w-8 text-amber-500" />
          <p className="text-sm text-amber-700">{error}</p>
          {!isDeveloper && (
            <p className="text-xs text-amber-500">
              当前账号角色为「{user?.role === "banned" ? "已封禁" : "普通用户"}」，仅开发者可访问此功能。
            </p>
          )}
        </div>
      )}

      {!loading && status && (
        <>
          {/* 总体状态 */}
          <div
            className={[
              "mb-5 flex items-center gap-3 rounded-xl border p-4",
              status.status === "healthy"
                ? "border-emerald-200 bg-emerald-50"
                : "border-amber-200 bg-amber-50",
            ].join(" ")}
          >
            {status.status === "healthy" ? (
              <CheckCircle2 className="h-7 w-7 text-emerald-500" />
            ) : (
              <ShieldAlert className="h-7 w-7 text-amber-500" />
            )}
            <div>
              <p
                className={[
                  "text-base font-semibold",
                  status.status === "healthy" ? "text-emerald-700" : "text-amber-700",
                ].join(" ")}
              >
                {status.status === "healthy" ? "运行正常" : "部分服务异常"}
              </p>
              <p className="text-xs text-slate-500">
                数据更新时间：{new Date(status.timestamp).toLocaleString("zh-CN")}
              </p>
            </div>
          </div>

          {/* 健康检查项 */}
          <section className="mb-5">
            <h4 className="mb-2 text-sm font-semibold text-slate-700">健康检查</h4>
            <div className="space-y-2">
              {status.checks.map((c) => (
                <div
                  key={c.name}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3"
                >
                  <div className="flex items-center gap-2">
                    {c.ok ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-rose-500" />
                    )}
                    <span className="text-sm text-slate-700">{c.name}</span>
                  </div>
                  <span
                    className={[
                      "text-xs",
                      c.ok ? "text-slate-500" : "text-rose-500",
                    ].join(" ")}
                  >
                    {c.detail}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* 运行指标 */}
          <section className="mb-5">
            <h4 className="mb-2 text-sm font-semibold text-slate-700">运行指标</h4>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <MetricCard
                icon={Clock}
                label="运行时长"
                value={fmtUptime(status.uptimeSec)}
                sub="当前实例自启动"
              />
              <MetricCard
                icon={Cpu}
                label="Node 版本"
                value={status.runtime.node}
                sub={`${status.runtime.platform} · ${status.runtime.arch}`}
              />
              <MetricCard
                icon={Server}
                label="部署环境"
                value={status.environment.vercel ? "Vercel" : "自托管"}
                sub={`${status.environment.vercelEnv} · ${status.environment.region}`}
              />
            </div>
          </section>

          {/* 内存占用 */}
          <section className="mb-5">
            <h4 className="mb-2 text-sm font-semibold text-slate-700">内存占用</h4>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-slate-600">堆内存</span>
                <span className="font-medium text-slate-700">
                  {status.memory.heapUsedMb} MB / {status.memory.heapTotalMb} MB（{status.memory.heapPercent}%）
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={[
                    "h-full rounded-full transition-all",
                    status.memory.heapPercent < 85 ? "bg-emerald-500" : "bg-amber-500",
                  ].join(" ")}
                  style={{ width: `${Math.min(status.memory.heapPercent, 100)}%` }}
                />
              </div>
              <div className="mt-3 flex justify-between text-xs text-slate-400">
                <span>常驻内存（RSS）：{status.memory.rssMb} MB</span>
                <span>外部内存：{status.memory.externalMb} MB</span>
              </div>
            </div>
          </section>

          {/* 数据统计 */}
          <section>
            <h4 className="mb-2 text-sm font-semibold text-slate-700">数据统计</h4>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <MetricCard icon={UsersIcon} label="用户总数" value={String(status.stats.users)} />
              <MetricCard icon={ShieldAlert} label="开发者" value={String(status.stats.developers)} />
              <MetricCard icon={XCircle} label="已封禁" value={String(status.stats.banned)} />
              <MetricCard icon={MessageSquare} label="帖子" value={String(status.stats.posts)} />
              <MetricCard icon={Activity} label="评论" value={String(status.stats.comments)} />
            </div>
            <p className="mt-3 text-xs text-slate-400">
              数据存储路径：<span className="break-all">{status.storage.path}</span>
              （{status.storage.exists ? (status.storage.writable ? "可读写" : "只读") : "不存在"}）
            </p>
          </section>
        </>
      )}
    </div>
  );
}
