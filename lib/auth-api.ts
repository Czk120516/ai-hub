/**
 * AI Hub API 客户端
 * 调用 Next.js API Routes（同域部署）
 */
import {
  localSendCode,
  localVerifyCode,
  localFetchProfile,
  localUpdateProfile,
  localCheckQr,
  localFetchPosts,
  localFetchPost,
  localCreatePost,
  localAddComment,
} from "./local-store";

const API_BASE = "";

// 降级开关：API 不可达时转 localStorage
let useLocal = false;

async function apiFetch(path: string, options?: RequestInit) {
  if (useLocal) throw new Error("offline");
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
    return res;
  } catch {
    useLocal = true;
    throw new Error("offline");
  }
}

export interface UserProfile {
  email: string;
  nickname: string;
  qrNumber: string;
  avatar: string | null;
  role: "user" | "developer" | "banned";
}

export interface PostSummary {
  id: string;
  title: string;
  content: string;
  authorNickname: string;
  authorQr: string;
  authorAvatar: string | null;
  createdAt: string;
  commentCount: number;
  locationCity?: string;
}

export interface Post extends PostSummary {
  authorEmail: string;
  comments: Comment[];
}

export interface Comment {
  id: string;
  content: string;
  authorNickname: string;
  authorQr: string;
  authorAvatar: string | null;
  createdAt: string;
}

// Token header
function authH(token: string) {
  return { Authorization: `Bearer ${token}` };
}

// ==================== 认证 ====================

export async function sendCode(email: string) {
  try {
    const res = await apiFetch("/api/send-code", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    return await res.json();
  } catch {
    return localSendCode(email);
  }
}

export async function verifyCode(email: string, code: string) {
  try {
    const res = await apiFetch("/api/verify-code", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    });
    return await res.json();
  } catch {
    return localVerifyCode(email, code);
  }
}

/** 开发者免验证码直登（仅 DEV_EMAIL 可用） */
export async function devLogin(email: string) {
  try {
    const res = await apiFetch("/api/dev-login", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    return await res.json();
  } catch {
    return { error: "网络错误" };
  }
}

// ==================== 用户资料 ====================

export async function fetchProfile(token: string): Promise<UserProfile | null> {
  try {
    const res = await apiFetch("/api/user/profile", { headers: authH(token) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return localFetchProfile();
  }
}

export async function updateProfile(
  token: string,
  updates: { nickname?: string; qrNumber?: string; avatar?: string | null }
): Promise<{ error?: string; profile?: UserProfile }> {
  try {
    const res = await apiFetch("/api/user/profile", {
      method: "PUT",
      headers: authH(token),
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || "更新失败" };
    return { profile: data as UserProfile };
  } catch {
    return localUpdateProfile(updates);
  }
}

export async function checkQr(token: string, qrNumber: string) {
  try {
    const res = await apiFetch(`/api/user/check-qr/${encodeURIComponent(qrNumber)}`, {
      headers: authH(token),
    });
    return await res.json();
  } catch {
    return localCheckQr(qrNumber);
  }
}

// ==================== 社区 ====================

export async function fetchPosts(page = 1, size = 20) {
  try {
    const res = await apiFetch(`/api/community/posts?page=${page}&size=${size}`);
    const data = await res.json();
    return { items: data.items || [], total: data.total || 0 };
  } catch {
    return localFetchPosts(page, size);
  }
}

export async function fetchPost(id: string): Promise<Post | null> {
  try {
    const res = await apiFetch(`/api/community/posts/${id}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return localFetchPost(id);
  }
}

export async function createPost(
  token: string,
  title: string,
  content: string,
  locationCity?: string
) {
  try {
    const res = await apiFetch("/api/community/posts", {
      method: "POST",
      headers: authH(token),
      body: JSON.stringify({ title, content, locationCity }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || "发帖失败" };
    return { post: data as Post };
  } catch {
    return localCreatePost(title, content, locationCity);
  }
}

export async function addPostComment(token: string, postId: string, content: string) {
  try {
    const res = await apiFetch(`/api/community/posts/${postId}/comments`, {
      method: "POST",
      headers: authH(token),
      body: JSON.stringify({ content }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || "评论失败" };
    return { comment: data as Comment };
  } catch {
    return localAddComment(postId, content);
  }
}

// ==================== 管理员功能 ====================

export async function adminDeletePost(token: string, postId: string) {
  try {
    const res = await apiFetch(`/api/community/posts/${postId}`, {
      method: "DELETE",
      headers: authH(token),
    });
    return await res.json();
  } catch {
    return { error: "网络错误" };
  }
}

export async function adminDeleteComment(token: string, postId: string, commentId: string) {
  try {
    const res = await apiFetch(`/api/community/posts/${postId}/comments/${commentId}`, {
      method: "DELETE",
      headers: authH(token),
    });
    return await res.json();
  } catch {
    return { error: "网络错误" };
  }
}

export async function adminBanUser(token: string, email: string) {
  try {
    const res = await apiFetch("/api/admin/ban", {
      method: "POST",
      headers: authH(token),
      body: JSON.stringify({ email }),
    });
    return await res.json();
  } catch {
    return { error: "网络错误" };
  }
}

export async function adminUnbanUser(token: string, email: string) {
  try {
    const res = await apiFetch("/api/admin/unban", {
      method: "POST",
      headers: authH(token),
      body: JSON.stringify({ email }),
    });
    return await res.json();
  } catch {
    return { error: "网络错误" };
  }
}

export async function adminListUsers(token: string): Promise<{ users?: UserProfile[]; error?: string }> {
  try {
    const res = await apiFetch("/api/admin/users", {
      headers: authH(token),
    });
    return await res.json();
  } catch {
    return { error: "网络错误" };
  }
}

// ==================== 服务器运行状况 ====================

export interface ServerCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface ServerStatus {
  ok: boolean;
  status: "healthy" | "degraded";
  timestamp: string;
  uptimeSec: number;
  runtime: { node: string; platform: string; arch: string };
  environment: { vercel: boolean; vercelEnv: string; region: string };
  memory: {
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
    heapPercent: number;
    externalMb: number;
  };
  stats: { users: number; developers: number; banned: number; posts: number; comments: number };
  storage: { path: string; exists: boolean; writable: boolean };
  checks: ServerCheck[];
}

export async function fetchServerStatus(token: string): Promise<ServerStatus | null> {
  try {
    const res = await apiFetch("/api/admin/server-status", {
      headers: authH(token),
    });
    if (!res.ok) return null;
    return (await res.json()) as ServerStatus;
  } catch {
    return null;
  }
}
