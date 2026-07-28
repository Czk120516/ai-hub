"use client";

import { useState } from "react";
import { MapPin, X, Loader2, Trash2 } from "lucide-react";
import { useLocation } from "@/contexts/LocationContext";

/**
 * 输入框旁的「📍定位」按钮：
 * - 展示当前位置（📍城市 / 📍已定位 / 定位）
 * - 点击打开位置管理弹窗：设备精确定位 / 手动设置城市 / 清除
 * 位置仅保存在本机浏览器，不持续追踪。
 */
export default function LocationButton() {
  const { label, hasLocation, requestDeviceLocation, setManualCity, clear } = useLocation();
  const [open, setOpen] = useState(false);
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" | "info" } | null>(null);

  const handleDevice = async () => {
    setLoading(true);
    setMsg(null);
    const res = await requestDeviceLocation();
    setLoading(false);
    if (res.ok) {
      setMsg({ text: "已获取设备定位", type: "ok" });
      setTimeout(() => setOpen(false), 700);
    } else {
      setMsg({ text: res.error || "设备定位失败", type: "err" });
    }
  };

  const handleManual = async () => {
    const name = city.trim();
    if (!name) {
      setMsg({ text: "请输入城市名", type: "err" });
      return;
    }
    setLoading(true);
    setMsg(null);
    const res = await setManualCity(name);
    setLoading(false);
    if (res.ok) {
      setMsg({ text: "已设置位置", type: "ok" });
      setTimeout(() => setOpen(false), 700);
    } else {
      setMsg({ text: res.error || "设置失败", type: "err" });
    }
  };

  const handleClear = () => {
    clear();
    setCity("");
    setMsg({ text: "已清除保存的位置", type: "info" });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setMsg(null);
          setOpen(true);
        }}
        title="设置我的位置（用于天气、本地信息等）"
        className={`inline-flex h-10 w-auto shrink-0 items-center gap-1 rounded-2xl border px-2.5 text-xs font-medium transition sm:h-11 ${
          hasLocation
            ? "border-indigo-200 bg-indigo-50 text-indigo-600"
            : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100"
        }`}
      >
        <MapPin className="h-4 w-4" />
        <span className="max-w-[7rem] truncate">{label}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <MapPin className="h-4 w-4 text-indigo-500" />
                我的位置
              </h3>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mb-4 text-xs leading-relaxed text-slate-500">
              授权设备定位可获得最精准的天气与本地信息；若定位有偏差，直接输入城市名手动纠正（手动城市优先级最高）。位置仅保存在本机浏览器。
            </p>

            <button
              onClick={handleDevice}
              disabled={loading}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
              使用设备精确定位
            </button>

            <div className="mb-3 flex gap-2">
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleManual()}
                placeholder="手动输入城市名，如：杭州"
                className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              />
              <button
                onClick={handleManual}
                disabled={loading}
                className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
              >
                保存
              </button>
            </div>

            {msg && (
              <p
                className={`mb-3 text-xs ${
                  msg.type === "err"
                    ? "text-rose-500"
                    : msg.type === "ok"
                    ? "text-emerald-600"
                    : "text-slate-500"
                }`}
              >
                {msg.text}
              </p>
            )}

            {hasLocation && (
              <button
                onClick={handleClear}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2 text-xs text-slate-500 transition hover:bg-slate-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                清除保存的位置
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
