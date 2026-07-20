/**
 * 全局 OTP 存储（进程内存，5 分钟过期）
 */
import { hashCode } from "./auth-server";

const OTP_EXPIRE_MINUTES = 5;
const RATE_LIMIT_SECONDS = 60;

interface OtpEntry {
  codeHash: string;
  expiresAt: number;
  lastSentAt: number;
}

const store = new Map<string, OtpEntry>();

/** 定期清理过期 OTP */
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [email, data] of store) {
      if (data.expiresAt < now) store.delete(email);
    }
  }, 60_000);
}

export function canResend(email: string): { ok: true } | { ok: false; waitSeconds: number } {
  const existing = store.get(email);
  if (existing && Date.now() - existing.lastSentAt < RATE_LIMIT_SECONDS * 1000) {
    const waitSeconds = Math.ceil(
      (RATE_LIMIT_SECONDS * 1000 - (Date.now() - existing.lastSentAt)) / 1000
    );
    return { ok: false, waitSeconds };
  }
  return { ok: true };
}

export function storeOtp(email: string, code: string) {
  store.set(email, {
    codeHash: hashCode(code, email),
    expiresAt: Date.now() + OTP_EXPIRE_MINUTES * 60 * 1000,
    lastSentAt: Date.now(),
  });
}

export function verifyOtp(email: string, code: string): boolean {
  const stored = store.get(email);
  if (!stored) return false;
  if (Date.now() > stored.expiresAt) {
    store.delete(email);
    return false;
  }
  return stored.codeHash === hashCode(code, email);
}

export function clearOtp(email: string) {
  store.delete(email);
}

export function hasOtp(email: string): boolean {
  const stored = store.get(email);
  if (!stored) return false;
  if (Date.now() > stored.expiresAt) {
    store.delete(email);
    return false;
  }
  return true;
}
