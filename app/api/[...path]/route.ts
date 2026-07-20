/**
 * 统一 API 路由 — 所有接口通过 [...path] 进入同一个 serverless 函数
 * 确保内存 OTP store 和 /tmp 文件存储在同一实例内共享
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { signToken, verifyToken, type JWTPayload } from "@/lib/jwt";
import {
  getUser, upsertUser, isQrTaken, getPosts, addPost, getPost, addComment, otpStore,
  type StoredPost, type StoredComment,
} from "@/lib/server-store";

// ===== 常量 =====

const OTP_EXPIRE_MINUTES = 5;
const RATE_LIMIT_SECONDS = 60;

// ===== SMTP =====

let transporter: nodemailer.Transporter | null = null;
function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.163.com",
    port: parseInt(process.env.SMTP_PORT || "465"),
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
}

// ===== 工具 =====

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashCode(code: string, email: string) {
  return crypto.createHash("sha256").update(code + ":" + email + ":salt2026").digest("hex");
}

function generateQR() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  for (let i = 0; i < 100; i++) {
    let qr = "";
    for (let j = 0; j < 8; j++) qr += chars[Math.floor(Math.random() * chars.length)];
    if (!isQrTaken(qr)) return qr;
  }
  return "U" + Date.now().toString(36).slice(-7).toUpperCase();
}

function defaultNickname(email: string) {
  return email.split("@")[0].slice(0, 12);
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function error(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

// ===== 认证 =====

function getAuthUser(req: NextRequest): JWTPayload | null {
  const auth = req.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return verifyToken(auth.slice(7));
}

function authRequired(req: NextRequest) {
  const user = getAuthUser(req);
  if (!user) throw new AuthError("请先登录", 401);
  return user;
}

class AuthError extends Error {
  status: number;
  constructor(msg: string, status: number) { super(msg); this.status = status; }
}

// ===== 主处理器 =====

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  return handle(req, "GET", params.path);
}

export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  return handle(req, "POST", params.path);
}

export async function PUT(req: NextRequest, { params }: { params: { path: string[] } }) {
  return handle(req, "PUT", params.path);
}

async function handle(req: NextRequest, method: string, path: string[]): Promise<NextResponse> {
  const route = "/" + path.join("/");
  const body = method !== "GET" ? await req.json().catch(() => ({})) : {};

  try {
    // ---- 健康检查 ----
    if (route === "/health" && method === "GET") return json({ ok: true });

    // ---- 发送验证码 ----
    if (route === "/send-code" && method === "POST") return handleSendCode(body);

    // ---- 验证码校验 ----
    if (route === "/verify-code" && method === "POST") return handleVerifyCode(body);

    // ---- 用户资料 ----
    if (route === "/user/profile" && method === "GET") return handleGetProfile(req);
    if (route === "/user/profile" && method === "PUT") return handleUpdateProfile(req, body);

    // ---- 检查 QR ----
    if (path[0] === "user" && path[1] === "check-qr" && method === "GET") {
      return handleCheckQR(req, path[2]);
    }

    // ---- 帖子列表/发帖 ----
    if (route === "/community/posts" && method === "GET") return handleGetPosts(req);
    if (route === "/community/posts" && method === "POST") return handleCreatePost(req, body);

    // ---- 帖子详情 ----
    if (path[0] === "community" && path[1] === "posts" && path.length === 3 && method === "GET") {
      return handleGetPost(path[2]);
    }

    // ---- 添加评论 ----
    if (path[0] === "community" && path[1] === "posts" && path[3] === "comments" && method === "POST") {
      return handleAddComment(req, body, path[2]);
    }

    return error("Not found", 404);

  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.status);
    console.error("API Error:", e);
    return error("服务器内部错误", 500);
  }
}

// ===== 处理函数 =====

async function handleSendCode(body: { email?: string }) {
  const { email } = body;
  if (!email || !email.includes("@")) return error("请输入有效的邮箱地址");

  // 频率限制
  const existing = otpStore.get(email);
  if (existing && Date.now() - existing.lastSentAt < RATE_LIMIT_SECONDS * 1000) {
    const wait = Math.ceil((RATE_LIMIT_SECONDS * 1000 - (Date.now() - existing.lastSentAt)) / 1000);
    return error(`请 ${wait} 秒后再试`, 429);
  }

  const code = generateCode();
  otpStore.set(email, {
    codeHash: hashCode(code, email),
    expiresAt: Date.now() + OTP_EXPIRE_MINUTES * 60 * 1000,
    lastSentAt: Date.now(),
  });

  try {
    await getTransporter().sendMail({
      from: `"AI Hub" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `AI Hub 验证码：${code}`,
      html: `<div style="max-width:480px;margin:0 auto;font-family:system-ui,sans-serif">
<div style="background:#4f46e5;color:#fff;padding:24px;border-radius:12px 12px 0 0;text-align:center">
<h1 style="margin:0;font-size:22px">AI Hub</h1></div>
<div style="background:#fff;padding:32px 24px;border:1px solid #e2e8f0;border-radius:0 0 12px 12px">
<p style="color:#475569;font-size:15px">您的验证码：</p>
<div style="background:#f1f5f9;padding:16px;border-radius:8px;text-align:center;margin-bottom:16px">
<span style="font-size:32px;font-weight:700;letter-spacing:6px;color:#1e293b">${code}</span></div>
<p style="color:#94a3b8;font-size:13px">${OTP_EXPIRE_MINUTES} 分钟内有效</p></div></div>`,
    });
    return json({ success: true, message: "验证码已发送" });
  } catch (err: unknown) {
    otpStore.delete(email);
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Send email failed:", msg);
    return error("邮件发送失败，请稍后重试", 500);
  }
}

function handleVerifyCode(body: { email?: string; code?: string }) {
  const { email, code } = body;
  if (!email || !code) return error("请输入邮箱和验证码");

  const stored = otpStore.get(email);
  if (!stored) return error("请先获取验证码");
  if (Date.now() > stored.expiresAt) { otpStore.delete(email); return error("验证码已过期，请重新获取"); }
  if (hashCode(code, email) !== stored.codeHash) return error("验证码错误");

  otpStore.delete(email);

  const existing = getUser(email);
  const user = upsertUser(email, {
    nickname: existing?.nickname || defaultNickname(email),
    qrNumber: existing?.qrNumber || generateQR(),
    avatar: existing?.avatar || null,
  });

  const token = signToken({
    email: user.email,
    nickname: user.nickname,
    qrNumber: user.qrNumber,
  });

  return json({
    success: true,
    token,
    expiresAt: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
    user: { email: user.email, nickname: user.nickname, qrNumber: user.qrNumber, avatar: user.avatar },
  });
}

function handleGetProfile(req: NextRequest) {
  const u = authRequired(req);
  const user = getUser(u.email);
  return json(user || u);
}

function handleUpdateProfile(req: NextRequest, body: { nickname?: string; qrNumber?: string; avatar?: string | null }) {
  const u = authRequired(req);

  if (body.nickname !== undefined) {
    if (typeof body.nickname !== "string" || body.nickname.trim().length < 1 || body.nickname.trim().length > 20)
      return error("昵称 1-20 个字符");
  }
  if (body.qrNumber !== undefined) {
    if (!/^[A-Z0-9]{6,12}$/i.test(body.qrNumber))
      return error("QR 号需为 6-12 位字母或数字");
    if (isQrTaken(body.qrNumber.toUpperCase(), u.email))
      return error("该 QR 号已被占用");
  }

  const updates: Record<string, unknown> = {};
  if (body.nickname !== undefined) updates.nickname = body.nickname.trim();
  if (body.qrNumber !== undefined) updates.qrNumber = body.qrNumber.toUpperCase();
  if (body.avatar !== undefined) updates.avatar = body.avatar;

  const updated = upsertUser(u.email, updates);
  return json(updated);
}

function handleCheckQR(req: NextRequest, qr: string | undefined) {
  const u = authRequired(req);
  if (!qr) return error("缺少 QR 号");
  const q = qr.toUpperCase();
  if (!/^[A-Z0-9]{6,12}$/.test(q)) return json({ available: false, error: "格式不正确" });
  return json({ available: !isQrTaken(q, u.email) });
}

function handleGetPosts(req: NextRequest) {
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const size = Math.min(parseInt(url.searchParams.get("size") || "20"), 50);
  const all = getPosts();
  const start = (page - 1) * size;

  return json({
    items: all.slice(start, start + size).map((p) => ({
      id: p.id, title: p.title, content: p.content,
      authorNickname: p.authorNickname, authorQr: p.authorQr, authorAvatar: p.authorAvatar,
      createdAt: p.createdAt, commentCount: p.comments.length,
    })),
    total: all.length, page, size,
  });
}

function handleCreatePost(req: NextRequest, body: { title?: string; content?: string }) {
  const u = authRequired(req);
  const { title, content } = body;

  if (!title || typeof title !== "string" || title.trim().length < 1 || title.trim().length > 100)
    return error("标题 1-100 个字符");
  if (!content || typeof content !== "string" || content.trim().length < 1 || content.trim().length > 5000)
    return error("内容 1-5000 个字符");

  const post: StoredPost = {
    id: crypto.randomBytes(12).toString("hex"),
    title: title.trim(),
    content: content.trim(),
    authorEmail: u.email,
    authorNickname: u.nickname,
    authorQr: u.qrNumber,
    authorAvatar: null, // will be retrieved from user store
    createdAt: new Date().toISOString(),
    comments: [],
  };

  addPost(post);
  return json(post);
}

function handleGetPost(id: string) {
  const post = getPost(id);
  if (!post) return error("帖子不存在", 404);
  return json(post);
}

function handleAddComment(req: NextRequest, body: { content?: string }, postId: string) {
  const u = authRequired(req);
  const { content } = body;

  if (!content || typeof content !== "string" || content.trim().length < 1 || content.trim().length > 2000)
    return error("评论 1-2000 个字符");

  const comment: StoredComment = {
    id: crypto.randomBytes(8).toString("hex"),
    content: content.trim(),
    authorEmail: u.email,
    authorNickname: u.nickname,
    authorQr: u.qrNumber,
    authorAvatar: null,
    createdAt: new Date().toISOString(),
  };

  const result = addComment(postId, comment);
  if (!result) return error("帖子不存在", 404);
  return json(comment);
}
