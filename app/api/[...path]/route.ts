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
  deletePost, deleteComment, banUser, unbanUser, getAllUsers, isDeveloperQrClaimed,
  getDataStoreHealth,
  type StoredPost, type StoredComment,
} from "@/lib/server-store";
import { rateLimit, getClientIP } from "@/lib/rate-limit";
import { streamDeepSeekChat } from "@/lib/deepseek";

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

// ===== 定位与工具插件 =====

const TIMEWORDS = ['今天', '明天', '昨天', '现在', '当前', '今晚', '早晨', '早上', '上午', '下午', '晚上', '这会儿', '此刻', '这阵子', '白天', '夜里'];
const WCODE: Record<number, string> = { 0: '晴', 1: '大致晴朗', 2: '局部多云', 3: '阴', 45: '雾', 48: '雾凇', 51: '小毛毛雨', 53: '毛毛雨', 55: '大毛毛雨', 61: '小雨', 63: '中雨', 65: '大雨', 71: '小雪', 73: '中雪', 75: '大雪', 80: '阵雨', 81: '强阵雨', 82: '暴雨', 95: '雷阵雨', 96: '雷阵雨伴冰雹' };
const CITY_STOP = new Set(['查查', '看看', '问问', '帮我', '我想', '我要', '怎么', '什么', '这', '那', '你', '它', '他', '她', '我们', '你们', '他们', '请问', '麻烦', '可以', '能', '能否', '告诉', '知道', '看下', '查下', '搜下', '搜搜', '我想看', '想看', '了解', '了解下', '说说', '讲讲', '查询', '查询下', '给我', '我要看', '我要查', '想查', '查天气', '看天气']);

// 按经纬度查天气（Open-Meteo + bigdatacloud 反向地理编码）
async function weatherByCoords(lat: number, lng: number, locName?: string): Promise<string> {
  try {
    const fc = await fetch('https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lng + '&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1');
    const d = await fc.json() as any;
    const cur = d.current;
    if (!cur) return '获取天气失败，请稍后再试。';
    const code = cur.weather_code;
    let name = locName || '你的当前位置';
    if (!locName) {
      try {
        const rg = await fetch('https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=' + lat + '&longitude=' + lng + '&localityLanguage=zh');
        const rgData = await rg.json() as any;
        name = rgData.city || rgData.locality || rgData.principalSubdivision || name;
      } catch { /* ignore */ }
    }
    let txt = name + '当前：' + (WCODE[code] || '未知天气') + '，' + Math.round(cur.temperature_2m) + '°C，湿度' + cur.relative_humidity_2m + '%，风速' + Math.round(cur.wind_speed_10m) + 'km/h。';
    if (d.daily) txt += ' 今日气温 ' + Math.round(d.daily.temperature_2m_min[0]) + '°C ~ ' + Math.round(d.daily.temperature_2m_max[0]) + '°C。';
    return txt;
  } catch (e: any) { return '天气获取失败：' + (e?.message || '网络错误'); }
}

async function reverseGeo(lat: number, lng: number): Promise<{ country: string; province: string; city: string; locality: string } | null> {
  try {
    const rg = await fetch('https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=' + lat + '&longitude=' + lng + '&localityLanguage=zh');
    const d = await rg.json() as any;
    return { country: d.countryName || '', province: d.principalSubdivision || '', city: d.city || d.locality || '', locality: d.locality || '' };
  } catch { return null; }
}

const SRC_LABEL: Record<string, string> = { browser: '设备定位', manual: '手动设置', network: '网络IP定位（近似值，可能不准）' };

// 网络定位兜底：从 Cloudflare 反代转发的 x-cf-* 头读取（Vercel 无 request.cf）
function getNetworkLoc(req: NextRequest): { lat: number | null; lng: number | null; city: string | null; source: 'network' } | null {
  const lat = req.headers.get('x-cf-lat');
  const lng = req.headers.get('x-cf-lng');
  const city = req.headers.get('x-cf-city');
  if (lat != null && lng != null) {
    const la = parseFloat(lat), ln = parseFloat(lng);
    if (!isNaN(la) && !isNaN(ln)) return { lat: la, lng: ln, city: city || null, source: 'network' };
  }
  if (city) return { lat: null, lng: null, city, source: 'network' };
  return null;
}

async function runTool(tool: string, args: any, req: NextRequest): Promise<string | null> {
  try {
    if (tool === 'time') {
      const now = new Date();
      const beijing = now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
      const week = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
      let txt = '当前北京时间为 ' + beijing + '（星期' + week + '）。';
      let locLat = args && args.lat != null ? args.lat : null;
      let locLng = args && args.lng != null ? args.lng : null;
      let locName = (args && args.locName) || null;
      if (locLat == null && req) {
        const net = getNetworkLoc(req);
        if (net) { locLat = net.lat; locLng = net.lng; locName = locName || net.city; }
      }
      if (locLat != null && locLng != null) {
        try {
          const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=' + locLat + '&longitude=' + locLng + '&forecast_days=1&timezone=auto');
          const d = await r.json() as any;
          if (d.timezone && d.timezone !== 'Asia/Shanghai') {
            const local = now.toLocaleString('zh-CN', { timeZone: d.timezone });
            txt += ' 你所在位置（' + (locName || d.timezone) + '）的当地时间为 ' + local + '。';
          } else if (locName) {
            txt += ' 你所在的' + locName + '与北京同时区。';
          }
        } catch { /* ignore */ }
      }
      return txt;
    }
    if (tool === 'location') {
      if (args == null || args.lat == null || args.lng == null) {
        const net = getNetworkLoc(req);
        if (net && net.lat != null) {
          args = { ...(args || {}), lat: net.lat, lng: net.lng, locName: (args && args.locName) || net.city, locSource: net.source };
        } else if (net && net.city) {
          return '根据你的网络IP估算，你大概位于「' + net.city + '」（这是近似值，可能不准）。如需精准位置，请点击输入框旁的「📍定位」按钮手动设置城市。';
        } else {
          return '暂未获取到你的位置。请点击输入框旁的「📍定位」按钮授权设备定位，或手动设置所在城市。';
        }
      }
      const g = await reverseGeo(args.lat, args.lng);
      const src = SRC_LABEL[args.locSource] || '定位';
      let place = args.locName || '';
      if (g) {
        const parts = [g.country, g.province, g.city].filter(Boolean);
        const uniq = [...new Set(parts)];
        if (uniq.length) place = uniq.join(' ');
        if (g.locality && g.locality !== g.city) place += ' ' + g.locality;
      }
      if (!place) place = '纬度 ' + Number(args.lat).toFixed(4) + '，经度 ' + Number(args.lng).toFixed(4);
      return '你当前的位置是：' + place + '（坐标 ' + Number(args.lat).toFixed(4) + ', ' + Number(args.lng).toFixed(4) + '，来源：' + src + '）。若定位不准，可点击「📍定位」按钮重新定位或手动设置城市。';
    }
    if (tool === 'weather') {
      if (args && args.lat != null && args.lng != null) {
        return await weatherByCoords(args.lat, args.lng, args.locName);
      }
      const city = (args && args.city || '').trim();
      if (!city) return '未能获取查询天气所需的城市或位置信息。你可以直接说出城市名（例如「北京天气」），或在浏览器允许定位后查询当前位置的天气。';
      const geo = await fetch('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(city) + '&language=zh&count=1');
      const geoData = await geo.json() as any;
      const loc = geoData.results && geoData.results[0];
      if (!loc) return '未找到城市「' + city + '」的天气信息，请确认城市名称。';
      const fc = await fetch('https://api.open-meteo.com/v1/forecast?latitude=' + loc.latitude + '&longitude=' + loc.longitude + '&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1');
      const d = await fc.json() as any;
      const cur = d.current;
      const code = cur.weather_code;
      const name = loc.name + (loc.country ? '（' + loc.country + '）' : '');
      let txt = name + '当前：' + (WCODE[code] || '未知天气') + '，' + Math.round(cur.temperature_2m) + '°C，湿度' + cur.relative_humidity_2m + '%，风速' + Math.round(cur.wind_speed_10m) + 'km/h。';
      if (d.daily) txt += ' 今日气温 ' + Math.round(d.daily.temperature_2m_min[0]) + '°C ~ ' + Math.round(d.daily.temperature_2m_max[0]) + '°C。';
      return txt;
    }
    if (tool === 'history') {
      let topic = (args && args.topic || '').trim();
      if (!topic && args && args.localTopic) {
        if (args.locName) topic = args.locName;
        else if (args.lat != null && args.lng != null) {
          const g = await reverseGeo(args.lat, args.lng);
          if (g && (g.city || g.province)) topic = g.city || g.province;
        }
        if (!topic && req) {
          const net = getNetworkLoc(req);
          if (net && net.city) topic = net.city;
        }
        if (!topic) return '想给你讲当地历史，但暂未获取到你的位置。请点击「📍定位」按钮授权定位或手动设置城市，也可以直接说城市名（如「讲讲西安的历史」）。';
      }
      if (!topic) return null;
      const r = await fetch('https://zh.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(topic), { headers: { 'Accept': 'application/json', 'User-Agent': 'AI-Hub/1.0' } });
      if (!r.ok) return '未找到「' + topic + '」的相关资料，换个说法试试。';
      const data = await r.json() as any;
      let extract = data.extract || '';
      if (extract.length > 700) extract = extract.slice(0, 700) + '…';
      return '【' + (data.title || topic) + '】' + extract;
    }
  } catch (e: any) {
    return '工具调用失败：' + (e?.message || '网络错误');
  }
  return null;
}

function detectToolIntent(message: string): { tool: string; args: any } | null {
  if (!message) return null;
  const m = message;
  const wHas = /(?:天气|气温|温度|多少度|冷不冷|热不冷|热不热|下雨|下雪|降温|升温)/.test(m);
  if (wHas) {
    const wMatch = m.match(/([\u4e00-\u9fa5]{2,8}?)(?:的)?\s*(?:天气|气温|温度|多少度|冷不冷|热不冷|热不热|下雨|下雪|降温|升温)/);
    let city = wMatch ? wMatch[1] : '';
    if (city) {
      for (const tw of TIMEWORDS) { const i = city.indexOf(tw); if (i >= 0) city = city.slice(0, i); }
      for (const p of ['帮我', '我想', '我要', '请', '麻烦', '可以', '能', '能否', '帮我看看', '帮我查查', '查查看', '我想看', '想看', '看下', '查下', '查询下']) {
        if (city.startsWith(p)) city = city.slice(p.length).trim();
      }
      if (/[看查问帮听想]$/.test(city)) city = '';
      city = city.trim();
    }
    if (city && !CITY_STOP.has(city)) return { tool: 'weather', args: { city } };
    return { tool: 'weather', args: { useLocation: true } };
  }
  if (/(?:我(?:现在)?在哪(?:里|儿)?|我的(?:当前)?位置|当前位置|定位(?:一下|下)?我?|我在什么(?:地方|城市)|这里是哪(?:里|儿)?)/.test(m)) {
    return { tool: 'location', args: { useLocation: true } };
  }
  if (/(?:现在|当前|今天|此刻|当地|本地).{0,4}(?:几点|时间|日期|星期几|周几)|现在几点|现在什么时间/.test(m)) {
    return { tool: 'time', args: { useLocation: true } };
  }
  if (/(?:当地|本地|这里|这座城市|我们这(?:里|儿)?|我所在(?:的)?城市)(?:的)?(?:历史|人文|来历|典故|故事)/.test(m)) {
    return { tool: 'history', args: { localTopic: true, useLocation: true } };
  }
  const hMatch = m.match(/(?:讲讲|讲述|讲一讲|讲下|讲个|说说|聊聊|介绍(?:一下)?|科普一下|简述|讲一下)\s*([\u4e00-\u9fa5A-Za-z0-9]{2,12})/);
  if (hMatch) return { tool: 'history', args: { topic: hMatch[1] } };
  return null;
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

class BanError extends Error {
  status: number;
  constructor(msg: string) { super(msg); this.status = 403; }
}

function requireAdmin(req: NextRequest): JWTPayload {
  const user = authRequired(req);
  // 实时查库获取最新 role
  const stored = getUser(user.email);
  const role = stored?.role || "user";
  if (role !== "developer") throw new AuthError("需要开发者权限", 403);
  return { ...user, role };
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

  // ===== DDoS 防护：全局限流 =====
  const clientIP = getClientIP(req);
  const globalLimit = rateLimit(`global:${clientIP}`, 120, 60_000); // 每 IP 每分钟 120 请求
  if (!globalLimit.allowed) {
    return NextResponse.json(
      { error: "请求过于频繁，请稍后再试" },
      { status: 429, headers: { "Retry-After": String(Math.ceil((globalLimit.resetAt - Date.now()) / 1000)) } }
    );
  }

  try {
    // ---- 健康检查 ----
    if (route === "/health" && method === "GET") return json({ ok: true });

    // ---- Chat 代理（服务端代理 DeepSeek，保护 API Key） ----
    if (route === "/chat" && method === "POST") return handleChat(req, body);

    // ---- 发送验证码（严格限流） ----
    if (route === "/send-code" && method === "POST") {
      const codeLimit = rateLimit(`send-code:${clientIP}`, 5, 60_000); // 每 IP 每分钟 5 次
      if (!codeLimit.allowed) return error("请求过于频繁，请稍后再试", 429);
      return handleSendCode(body);
    }

    // ---- 验证码校验 ----
    if (route === "/verify-code" && method === "POST") {
      const verifyLimit = rateLimit(`verify:${clientIP}`, 10, 60_000);
      if (!verifyLimit.allowed) return error("请求过于频繁，请稍后再试", 429);
      return handleVerifyCode(body);
    }

    // ---- 用户资料 ----
    if (route === "/user/profile" && method === "GET") return handleGetProfile(req);
    if (route === "/user/profile" && method === "PUT") return handleUpdateProfile(req, body);

    // ---- 检查 QR ----
    if (path[0] === "user" && path[1] === "check-qr" && method === "GET") {
      return handleCheckQR(req, path[2]);
    }

    // ---- 帖子列表/发帖 ----
    if (route === "/community/posts" && method === "GET") return handleGetPosts(req);
    if (route === "/community/posts" && method === "POST") {
      const postLimit = rateLimit(`post:${clientIP}`, 10, 60_000); // 每 IP 每分钟 10 篇帖子
      if (!postLimit.allowed) return error("发帖过于频繁，请稍后再试", 429);
      return handleCreatePost(req, body);
    }

    // ---- 帖子详情 ----
    if (path[0] === "community" && path[1] === "posts" && path.length === 3 && method === "GET") {
      return handleGetPost(path[2]);
    }

    // ---- 删除帖子（管理员） ----
    if (path[0] === "community" && path[1] === "posts" && path.length === 3 && method === "DELETE") {
      return handleDeletePost(req, path[2]);
    }

    // ---- 添加评论 ----
    if (path[0] === "community" && path[1] === "posts" && path[3] === "comments" && method === "POST") {
      const commentLimit = rateLimit(`comment:${clientIP}`, 20, 60_000); // 每 IP 每分钟 20 条评论
      if (!commentLimit.allowed) return error("评论过于频繁，请稍后再试", 429);
      return handleAddComment(req, body, path[2]);
    }

    // ---- 删除评论（管理员） ----
    if (path[0] === "community" && path[1] === "posts" && path[3] === "comments" && path.length === 5 && method === "DELETE") {
      return handleDeleteComment(req, path[2], path[4]);
    }

    // ---- 管理员：封禁/解封用户 ----
    if (path[0] === "admin" && path[1] === "ban" && method === "POST") return handleBanUser(req, body);
    if (path[0] === "admin" && path[1] === "unban" && method === "POST") return handleUnbanUser(req, body);
    if (path[0] === "admin" && path[1] === "users" && method === "GET") return handleListUsers(req);
    if (path[0] === "admin" && path[1] === "server-status" && method === "GET") return handleServerStatus(req);

    return error("Not found", 404);

  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.status);
    if (e instanceof BanError) return error(e.message, e.status);
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
    const stack = err instanceof Error ? (err.stack || "").slice(0, 500) : "";
    console.error("Send email failed:", msg, stack);
    return error(`邮件发送失败: ${msg}`, 500);
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
  if (existing?.role === "banned") return error("您的账号已被封禁", 403);

  // 确定角色：QR=88888888 的自动成为开发者，被禁用户不能登录
  let role: "user" | "developer" = existing?.role === "developer" ? "developer" : "user";
  // 如果用户当前 QR 是 88888888，自动提升为开发者
  if (existing?.qrNumber === "88888888") role = "developer";

  const user = upsertUser(email, {
    nickname: existing?.nickname || defaultNickname(email),
    qrNumber: existing?.qrNumber || generateQR(),
    avatar: existing?.avatar || null,
    role,
  });

  const token = signToken({
    email: user.email,
    nickname: user.nickname,
    qrNumber: user.qrNumber,
    role: user.role,
  });

  return json({
    success: true,
    token,
    expiresAt: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
    user: { email: user.email, nickname: user.nickname, qrNumber: user.qrNumber, avatar: user.avatar, role: user.role },
  });
}

function handleGetProfile(req: NextRequest) {
  const u = authRequired(req);
  const user = getUser(u.email);
  if (!user) return json(u);
  return json({ email: user.email, nickname: user.nickname, qrNumber: user.qrNumber, avatar: user.avatar, role: user.role });
}

function handleUpdateProfile(req: NextRequest, body: { nickname?: string; qrNumber?: string; avatar?: string | null }) {
  const u = authRequired(req);
  const stored = getUser(u.email);
  if (stored?.role === "banned") throw new BanError("您的账号已被封禁，无法修改资料");

  if (body.nickname !== undefined) {
    if (typeof body.nickname !== "string" || body.nickname.trim().length < 1 || body.nickname.trim().length > 20)
      return error("昵称 1-20 个字符");
  }
  if (body.qrNumber !== undefined) {
    if (!/^[A-Z0-9]{6,12}$/i.test(body.qrNumber))
      return error("QR 号需为 6-12 位字母或数字");
    // QR=88888888 是开发者专属，只有第一个认领的人可以设置
    if (body.qrNumber.toUpperCase() === "88888888") {
      if (isDeveloperQrClaimed() && stored?.qrNumber !== "88888888") {
        return error("该 QR 号已被占用");
      }
    } else if (isQrTaken(body.qrNumber.toUpperCase(), u.email)) {
      return error("该 QR 号已被占用");
    }
  }

  const updates: Record<string, unknown> = {};
  if (body.nickname !== undefined) updates.nickname = body.nickname.trim();
  if (body.qrNumber !== undefined) {
    updates.qrNumber = body.qrNumber.toUpperCase();
    // 设置 QR=88888888 自动成为开发者
    if (body.qrNumber.toUpperCase() === "88888888") {
      updates.role = "developer";
    }
  }
  if (body.avatar !== undefined) updates.avatar = body.avatar;

  const updated = upsertUser(u.email, updates);
  return json({ email: updated.email, nickname: updated.nickname, qrNumber: updated.qrNumber, avatar: updated.avatar, role: updated.role });
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
      locationCity: p.locationCity,
    })),
    total: all.length, page, size,
  });
}

function handleCreatePost(req: NextRequest, body: { title?: string; content?: string; locationCity?: string }) {
  const u = authRequired(req);
  const { title, content, locationCity } = body;
  // 实时查库获取最新用户信息（昵称、头像等）
  const stored = getUser(u.email);
  if (stored?.role === "banned") throw new BanError("您的账号已被封禁，无法发帖");
  const authorNickname = stored?.nickname || u.nickname;
  const authorQr = stored?.qrNumber || u.qrNumber;
  const authorAvatar = stored?.avatar || null;

  if (!title || typeof title !== "string" || title.trim().length < 1 || title.trim().length > 100)
    return error("标题 1-100 个字符");
  if (!content || typeof content !== "string" || content.trim().length < 1 || content.trim().length > 5000)
    return error("内容 1-5000 个字符");

  const loc = typeof locationCity === "string" ? locationCity.trim().slice(0, 30) : "";

  const post: StoredPost = {
    id: crypto.randomBytes(12).toString("hex"),
    title: title.trim(),
    content: content.trim(),
    authorEmail: u.email,
    authorNickname,
    authorQr,
    authorAvatar,
    createdAt: new Date().toISOString(),
    comments: [],
    locationCity: loc || undefined,
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
  // 实时查库获取最新用户信息
  const stored = getUser(u.email);
  if (stored?.role === "banned") throw new BanError("您的账号已被封禁，无法评论");
  const authorNickname = stored?.nickname || u.nickname;
  const authorQr = stored?.qrNumber || u.qrNumber;
  const authorAvatar = stored?.avatar || null;

  if (!content || typeof content !== "string" || content.trim().length < 1 || content.trim().length > 2000)
    return error("评论 1-2000 个字符");

  const comment: StoredComment = {
    id: crypto.randomBytes(8).toString("hex"),
    content: content.trim(),
    authorEmail: u.email,
    authorNickname,
    authorQr,
    authorAvatar,
    createdAt: new Date().toISOString(),
  };

  const result = addComment(postId, comment);
  if (!result) return error("帖子不存在", 404);
  return json(comment);
}

// ===== 管理员功能 =====

function handleDeletePost(req: NextRequest, postId: string) {
  const admin = requireAdmin(req);
  const post = getPost(postId);
  if (!post) return error("帖子不存在", 404);
  deletePost(postId);
  return json({ success: true, message: "帖子已删除" });
}

function handleDeleteComment(req: NextRequest, postId: string, commentId: string) {
  requireAdmin(req);
  const success = deleteComment(postId, commentId);
  if (!success) return error("帖子或评论不存在", 404);
  return json({ success: true, message: "评论已删除" });
}

function handleBanUser(req: NextRequest, body: { email?: string }) {
  requireAdmin(req);
  const { email } = body;
  if (!email || !email.includes("@")) return error("请输入有效的邮箱地址");
  const success = banUser(email);
  if (!success) return error("封禁失败，用户不存在或是开发者", 400);
  return json({ success: true, message: "用户已封禁" });
}

function handleUnbanUser(req: NextRequest, body: { email?: string }) {
  requireAdmin(req);
  const { email } = body;
  if (!email || !email.includes("@")) return error("请输入有效的邮箱地址");
  const success = unbanUser(email);
  if (!success) return error("解封失败，用户不存在", 400);
  return json({ success: true, message: "用户已解封" });
}

function handleListUsers(req: NextRequest) {
  requireAdmin(req);
  const users = getAllUsers();
  return json({
    users: users.map((u) => ({
      email: u.email,
      nickname: u.nickname,
      qrNumber: u.qrNumber,
      avatar: u.avatar,
      role: u.role,
    })),
  });
}

// ===== 服务器运行状况（开发者专属） =====

function handleServerStatus(req: NextRequest) {
  // 仅开发者可访问
  requireAdmin(req);

  // ---- 运行指标 ----
  const mem = process.memoryUsage();
  const users = getAllUsers();
  const posts = getPosts();
  const comments = posts.reduce((sum, p) => sum + (p.comments?.length || 0), 0);
  const developers = users.filter((u) => u.role === "developer").length;
  const banned = users.filter((u) => u.role === "banned").length;
  const store = getDataStoreHealth();

  const heapPercent = mem.heapTotal ? Math.round((mem.heapUsed / mem.heapTotal) * 100) : 0;
  const rssMb = Math.round(mem.rss / 1024 / 1024);
  const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);
  const heapTotalMb = Math.round(mem.heapTotal / 1024 / 1024);
  const externalMb = Math.round(mem.external / 1024 / 1024);

  // ---- 健康检查项 ----
  const checks: { name: string; ok: boolean; detail: string }[] = [
    { name: "API 服务", ok: true, detail: "运行正常" },
    {
      name: "数据存储",
      ok: store.exists && store.writable,
      detail: !store.exists ? "目录不存在" : store.writable ? "可读写" : "只读（不可写）",
    },
    {
      name: "DeepSeek 密钥",
      ok: !!process.env.DEEPSEEK_API_KEY,
      detail: process.env.DEEPSEEK_API_KEY ? "已配置" : "未配置（对话将失败）",
    },
    {
      name: "SMTP 邮件服务",
      ok: !!process.env.SMTP_USER,
      detail: process.env.SMTP_USER ? `已配置（${process.env.SMTP_USER}）` : "未配置（无法发验证码）",
    },
    {
      name: "内存占用",
      ok: heapPercent < 85,
      detail: `${heapPercent}%${heapPercent >= 85 ? "（偏高）" : ""}`,
    },
  ];
  const healthy = checks.every((c) => c.ok);

  return json({
    ok: true,
    status: healthy ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    uptimeSec: Math.floor(process.uptime()),
    runtime: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    environment: {
      vercel: !!process.env.VERCEL,
      vercelEnv: process.env.VERCEL_ENV || (process.env.VERCEL ? "production" : "self-hosted"),
      region: process.env.VERCEL_REGION || "local",
    },
    memory: {
      rssMb,
      heapUsedMb,
      heapTotalMb,
      heapPercent,
      externalMb,
    },
    stats: {
      users: users.length,
      developers,
      banned,
      posts: posts.length,
      comments,
    },
    storage: { path: store.path, exists: store.exists, writable: store.writable },
    checks,
  });
}

// ===== Chat 代理（服务端调用 DeepSeek，前端不接触 API Key） =====

async function handleChat(
  req: NextRequest,
  body: { messages?: ChatMessage[]; temperature?: number; lat?: number; lng?: number; locName?: string; locSource?: string }
) {
  const { messages = [], temperature = 0.7 } = body;

  if (!messages.length) return error("缺少 messages 参数", 400);

  // ===== 提取用户位置：body 坐标优先，网络定位（x-cf-* 头）兜底 =====
  let userLocation: { lat: number | null; lng: number | null; city: string | null; source: string } | null = null;
  if (body.lat != null && body.lng != null) {
    const src = body.locSource === "manual" ? "manual" : "browser";
    userLocation = { lat: body.lat, lng: body.lng, city: body.locName || null, source: src };
  } else {
    const net = getNetworkLoc(req);
    if (net) userLocation = net;
  }

  // 用户最后一条消息
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const userText = lastUser?.content || "";

  // ===== 意图识别 + 工具调用 =====
  let toolResult: string | null = null;
  const intent = detectToolIntent(userText);
  if (intent) {
    if (intent.args && intent.args.useLocation && userLocation) {
      intent.args.lat = userLocation.lat;
      intent.args.lng = userLocation.lng;
      intent.args.locSource = userLocation.source;
      if (userLocation.city) intent.args.locName = userLocation.city;
    }
    toolResult = await runTool(intent.tool, intent.args, req);
  }

  // ===== 组装增强消息：注入位置上下文 + 工具结果 =====
  let enriched: ChatMessage[] = messages;
  if (userLocation || toolResult) {
    const sysParts: string[] = [];
    if (userLocation) {
      let locDesc = userLocation.city || (userLocation.lat != null && userLocation.lng != null ? (Number(userLocation.lat).toFixed(2) + ", " + Number(userLocation.lng).toFixed(2)) : "未知坐标");
      if (userLocation.source === "network") locDesc += "（网络定位近似值，可能不准；若用户说定位不准，请提示其点击「📍定位」按钮授权设备定位或手动设置城市）";
      else if (userLocation.source === "manual") locDesc += "（用户手动设置的城市，视为准确）";
      else locDesc += "（设备定位，视为准确）";
      sysParts.push("【用户当前位置】" + locDesc + "。这不仅用于天气：当用户询问当地历史、时区时间、本地美食、周边推荐、出行建议、方言文化等任何与位置相关的问题时，都请主动结合此位置作答，无需再向用户索取城市名。");
    }
    if (toolResult) {
      sysParts.push("【工具调用结果】" + toolResult + "\n请基于以上信息，用自然、有温度的语言回答用户，不要复述原始数据格式。");
    }
    const hasSys = messages.some((m) => m.role === "system");
    enriched = hasSys
      ? messages.map((m) => (m.role === "system" ? { ...m, content: m.content + "\n\n" + sysParts.join("\n\n") } : m))
      : ([{ role: "system", content: sysParts.join("\n\n") }, ...messages] as ChatMessage[]);
  }

  try {
    const stream = await streamDeepSeekChat({ messages: enriched, temperature });

    // 返回流式响应：text/plain 逐 token
    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    console.error("Chat error:", e);
    return error(e instanceof Error ? e.message : "AI 服务异常", 500);
  }
}

// ChatMessage 类型（与 types.ts 一致）
interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
