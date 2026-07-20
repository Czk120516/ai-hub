"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { sendCode } from "@/lib/auth-api";
import { Mail, ArrowRight, Sparkles, Hash } from "lucide-react";

export default function LoginForm() {
  const { verifyCode } = useAuth();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [codeSent, setCodeSent] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // 倒计时
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleSendCode = async () => {
    setError("");
    if (!email.includes("@") || !email.includes(".")) {
      setError("请输入有效的邮箱地址");
      return;
    }

    setSending(true);
    const result = await sendCode(email.trim());
    setSending(false);

    if (result.success) {
      setCodeSent(true);
      setCooldown(60);
      // 聚焦第一个验证码输入框
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } else {
      setError(result.error || "发送失败，请稍后重试");
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // 只允许数字
    const newCode = [...code];
    newCode[index] = value.slice(-1); // 只取最后一位
    setCode(newCode);

    // 自动跳到下一个输入框
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    // 粘贴处理
    if (e.key === "v" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      navigator.clipboard.readText().then((text) => {
        const digits = text.replace(/\D/g, "").slice(0, 6).split("");
        const newCode = [...code];
        digits.forEach((d, i) => {
          if (i < 6) newCode[i] = d;
        });
        setCode(newCode);
        // 聚焦最后一个输入位
        inputRefs.current[Math.min(digits.length, 5)]?.focus();
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const fullCode = code.join("");
    if (fullCode.length !== 6) {
      setError("请输入完整的 6 位验证码");
      return;
    }

    setLoading(true);
    const result = await verifyCode(email.trim(), fullCode);
    setLoading(false);

    if (!result.success && result.error) {
      setError(result.error);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-200">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">AI 能力聚合站</h1>
          <p className="mt-1 text-sm text-slate-500">
            邮箱验证码登录
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6"
        >
          {/* 邮箱 */}
          <label className="mb-1.5 block text-sm font-medium text-slate-600">
            邮箱地址
          </label>
          <div className="relative mb-3">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setCodeSent(false);
                setCode(["", "", "", "", "", ""]);
              }}
              placeholder="your@email.com"
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              autoFocus
              autoComplete="email"
            />
          </div>

          {/* 发送验证码按钮 */}
          {!codeSent && (
            <button
              type="button"
              onClick={handleSendCode}
              disabled={sending || !email}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-50 px-4 py-2.5 text-sm font-medium text-indigo-600 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
                  发送中...
                </>
              ) : cooldown > 0 ? (
                `${cooldown} 秒后可重发`
              ) : (
                "获取验证码"
              )}
            </button>
          )}

          {/* 验证码输入 */}
          {codeSent && (
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-slate-600">
                验证码 <span className="font-normal text-slate-400">（已发送至 {email}）</span>
              </label>
              <div className="flex justify-center gap-2">
                {code.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleCodeChange(i, e.target.value)}
                    onKeyDown={(e) => handleCodeKeyDown(i, e)}
                    className="h-12 w-11 rounded-lg border border-slate-300 text-center text-lg font-semibold text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    autoComplete="one-time-code"
                  />
                ))}
              </div>
              <div className="mt-3 text-center">
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={sending || cooldown > 0}
                  className="text-xs text-indigo-500 hover:text-indigo-600 disabled:text-slate-300"
                >
                  {cooldown > 0 ? `${cooldown}s 后重发` : "重新发送"}
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="mb-3 text-xs text-rose-500">{error}</p>
          )}

          {codeSent && (
            <button
              type="submit"
              disabled={loading || code.join("").length < 6}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              验证并登录
            </button>
          )}
        </form>

        <p className="mt-4 text-center text-xs text-slate-400">
          验证码 5 分钟内有效，请勿转发给他人
        </p>
      </div>
    </div>
  );
}
