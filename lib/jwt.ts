/**
 * 简易 JWT 工具（不依赖外部库）
 * HS256 签名，服务端签发、校验
 */
import crypto from "crypto";

// 优先级：JWT_SECRET > JWT_KEY (Netlify) > 默认值
const SECRET = process.env.JWT_SECRET || process.env.JWT_KEY || "aihub-jwt-secret-prod-2026";
const TOKEN_EXPIRE = 7 * 24 * 3600; // 7 天

// 旧版 secret 列表 — 新版本仍能验证旧版本签发的 token
const LEGACY_SECRETS: string[] = [
  "aihub-default-secret-change-me",
];

function base64url(str: string) {
  return Buffer.from(str).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64urlDecode(str: string) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Buffer.from(str, "base64").toString("utf-8");
}

export interface JWTPayload {
  email: string;
  nickname: string;
  qrNumber: string;
  role: "user" | "developer" | "banned";
  exp: number;
  iat: number;
}

/** 使用指定 secret 尝试验证 token */
function verifyWithSecret(token: string, secret: string): JWTPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const signature = crypto.createHmac("sha256", secret)
      .update(`${parts[0]}.${parts[1]}`)
      .digest("base64")
      .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

    if (signature !== parts[2]) return null;

    const payload = JSON.parse(base64urlDecode(parts[1])) as JWTPayload;
    if (payload.exp * 1000 < Date.now()) return null;

    return payload;
  } catch {
    return null;
  }
}

export function signToken(payload: Omit<JWTPayload, "iat" | "exp">): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JWTPayload = { ...payload, iat: now, exp: now + TOKEN_EXPIRE };

  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(fullPayload));
  const signature = crypto.createHmac("sha256", SECRET).update(`${header}.${body}`).digest("base64")
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string): JWTPayload | null {
  // 先用当前 secret 验证
  const result = verifyWithSecret(token, SECRET);
  if (result) return result;

  // 再用旧版 secret 逐一尝试（兼容升级前的 token）
  for (const legacySecret of LEGACY_SECRETS) {
    const legacyResult = verifyWithSecret(token, legacySecret);
    if (legacyResult) return legacyResult;
  }

  return null;
}
