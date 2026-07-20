/**
 * AI Hub 后端 API 客户端
 * 对接 ai-hub-backend（Express）
 */

const API_BASE = "";

export interface UserProfile {
  email: string;
  nickname: string;
  qrNumber: string;
  avatar: string | null;
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

interface ApiResult<T> {
  success?: boolean;
  error?: string;
  [key: string]: unknown;
}

// ==================== 认证 API ====================

interface SendCodeResult {
  success: boolean;
  message?: string;
  error?: string;
}

interface VerifyCodeResult {
  success: boolean;
  token?: string;
  expiresAt?: number;
  user?: UserProfile;
  error?: string;
}

/** 发送验证码 */
export async function sendCode(email: string): Promise<SendCodeResult> {
  try {
    const res = await fetch(`${API_BASE}/api/send-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    return await res.json();
  } catch {
    return { success: false, error: "无法连接服务器" };
  }
}

/** 校验验证码并登录 */
export async function verifyCode(
  email: string,
  code: string
): Promise<VerifyCodeResult> {
  try {
    const res = await fetch(`${API_BASE}/api/verify-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    return await res.json();
  } catch {
    return { success: false, error: "无法连接服务器" };
  }
}

// ==================== 用户资料 API ====================

function authHeaders(token: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

/** 获取个人资料 */
export async function fetchProfile(token: string): Promise<UserProfile | null> {
  try {
    const res = await fetch(`${API_BASE}/api/user/profile`, {
      headers: authHeaders(token),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** 更新个人资料 */
export async function updateProfile(
  token: string,
  updates: { nickname?: string; qrNumber?: string; avatar?: string | null }
): Promise<{ error?: string; profile?: UserProfile }> {
  try {
    const res = await fetch(`${API_BASE}/api/user/profile`, {
      method: "PUT",
      headers: authHeaders(token),
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || "更新失败" };
    return { profile: data as UserProfile };
  } catch {
    return { error: "无法连接服务器" };
  }
}

/** 检查 QR 号是否可用 */
export async function checkQr(
  token: string,
  qrNumber: string
): Promise<{ available: boolean; error?: string }> {
  try {
    const res = await fetch(
      `${API_BASE}/api/user/check-qr/${encodeURIComponent(qrNumber)}`,
      { headers: authHeaders(token) }
    );
    return await res.json();
  } catch {
    return { available: false, error: "无法连接服务器" };
  }
}

// ==================== 讨论社区 API ====================

/** 获取帖子列表 */
export async function fetchPosts(
  page = 1,
  size = 20
): Promise<{ items: PostSummary[]; total: number }> {
  try {
    const res = await fetch(
      `${API_BASE}/api/community/posts?page=${page}&size=${size}`
    );
    const data = await res.json();
    return { items: data.items || [], total: data.total || 0 };
  } catch {
    return { items: [], total: 0 };
  }
}

/** 获取帖子详情 */
export async function fetchPost(id: string): Promise<Post | null> {
  try {
    const res = await fetch(`${API_BASE}/api/community/posts/${id}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** 发帖 */
export async function createPost(
  token: string,
  title: string,
  content: string
): Promise<{ error?: string; post?: Post }> {
  try {
    const res = await fetch(`${API_BASE}/api/community/posts`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ title, content }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || "发帖失败" };
    return { post: data as Post };
  } catch {
    return { error: "无法连接服务器" };
  }
}

/** 添加评论 */
export async function addPostComment(
  token: string,
  postId: string,
  content: string
): Promise<{ error?: string; comment?: Comment }> {
  try {
    const res = await fetch(
      `${API_BASE}/api/community/posts/${postId}/comments`,
      {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ content }),
      }
    );
    const data = await res.json();
    if (!res.ok) return { error: data.error || "评论失败" };
    return { comment: data as Comment };
  } catch {
    return { error: "无法连接服务器" };
  }
}
