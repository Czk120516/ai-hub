/**
 * 服务端认证工具
 * Token → email 映射（进程内存，重启后需重新登录）
 */
import crypto from "crypto";
import { getUser, StoredUser } from "./data-store";

const tokenStore = new Map<string, string>();

export function registerToken(token: string, email: string) {
  tokenStore.set(token, email);
}

export function getUserFromToken(token: string): StoredUser | null {
  const email = tokenStore.get(token);
  if (!email) return null;
  return getUser(email);
}

/** 生成 6 位验证码 */
export function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** 验证码哈希 */
export function hashCode(code: string, email: string): string {
  return crypto.createHash("sha256").update(code + ":" + email + ":salt2026").digest("hex");
}

/** 生成唯一 QR 号（8 位字母数字） */
export function generateQR(): string {
  const { isQrTaken } = require("./data-store");
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  for (let attempt = 0; attempt < 100; attempt++) {
    let qr = "";
    for (let i = 0; i < 8; i++) {
      qr += chars[Math.floor(Math.random() * chars.length)];
    }
    if (!isQrTaken(qr)) return qr;
  }
  return "U" + Date.now().toString(36).slice(-7).toUpperCase();
}

/** 邮箱前缀默认昵称 */
export function defaultNickname(email: string): string {
  return email.split("@")[0].slice(0, 12);
}

/** 生成随机 token */
export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** 从请求头提取 token */
export function extractToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}
