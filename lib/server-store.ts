/**
 * 服务端存储 — Cloudflare KV 异步持久化 + 请求内内存缓存
 * 兼容本地开发：无 KV 绑定时退化为内存存储（仅当前进程有效）
 *
 * 设计要点（为了不动 route.ts 里约 45 个同步调用点）：
 * - 请求开始时调用 ensureStore() 从 KV 加载最新数据到内存缓存
 * - 读操作同步读取内存缓存（签名与旧实现完全一致）
 * - 写操作修改内存缓存并标记 dirty
 * - 请求结束时调用 flushStore() 将 dirty 数据写回 KV
 */
import { getRequestContext } from "@cloudflare/next-on-pages";

// ===== KV 绑定访问 =====

interface KVNamespaceLike {
  get(key: string, opts?: any): Promise<any>;
  put(key: string, value: string, opts?: any): Promise<any>;
}

function getKV(): KVNamespaceLike | null {
  try {
    const ctx: any = getRequestContext();
    const kv = ctx?.env?.AIHUB_DATA;
    if (kv) return kv as KVNamespaceLike;
  } catch {
    /* 本地开发或非 Cloudflare 环境：返回 null，使用内存兜底 */
  }
  return null;
}

// ===== 类型与内存缓存 =====

export type UserRole = "user" | "developer" | "banned";

export interface StoredUser {
  email: string;
  nickname: string;
  qrNumber: string;
  avatar: string | null;
  role: UserRole;
}

export interface StoredComment {
  id: string;
  content: string;
  authorEmail: string;
  authorNickname: string;
  authorQr: string;
  authorAvatar: string | null;
  createdAt: string;
}

export interface StoredPost {
  id: string;
  title: string;
  content: string;
  authorEmail: string;
  authorNickname: string;
  authorQr: string;
  authorAvatar: string | null;
  createdAt: string;
  comments: StoredComment[];
  locationCity?: string;
}

interface OTPEntry {
  codeHash: string;
  expiresAt: number;
  lastSentAt: number;
}

interface StoreState {
  users: Record<string, StoredUser>;
  posts: StoredPost[];
  otp: Record<string, OTPEntry>;
}

const memFallback: StoreState = { users: {}, posts: [], otp: {} };
let state: StoreState | null = null;
let dirty = false;

function getState(): StoreState {
  return state ?? memFallback;
}

function markDirty() {
  dirty = true;
}

/** 请求开始：从 KV 加载最新数据（无 KV 则使用内存兜底） */
export async function ensureStore(): Promise<void> {
  const kv = getKV();
  if (!kv) {
    if (!state) state = { users: {}, posts: [], otp: {} };
    dirty = false;
    return;
  }
  const [users, posts, otp] = await Promise.all([
    kv.get("users", "json"),
    kv.get("posts", "json"),
    kv.get("otp", "json"),
  ]);
  // 清理过期 OTP
  const otpObj: Record<string, OTPEntry> = (otp as any) || {};
  const now = Date.now();
  let pruned = false;
  for (const k of Object.keys(otpObj)) {
    if (otpObj[k].expiresAt < now) {
      delete otpObj[k];
      pruned = true;
    }
  }
  state = {
    users: (users as any) || {},
    posts: (posts as any) || [],
    otp: otpObj,
  };
  dirty = pruned; // 若清理了过期 OTP，需回写
}

/** 请求结束：将变更写回 KV（无变更则跳过） */
export async function flushStore(): Promise<void> {
  const kv = getKV();
  if (!kv || !state || !dirty) return;
  await Promise.all([
    kv.put("users", JSON.stringify(state.users)),
    kv.put("posts", JSON.stringify(state.posts)),
    kv.put("otp", JSON.stringify(state.otp)),
  ]);
  dirty = false;
}

// ===== 用户 =====

export function getUsers(): Record<string, StoredUser> {
  return getState().users;
}

export function getUser(email: string): StoredUser | null {
  return getState().users[email] || null;
}

export function upsertUser(email: string, data: Partial<StoredUser>): StoredUser {
  const s = getState();
  const existing = s.users[email];
  s.users[email] = { ...existing, ...data, email, role: existing?.role || data.role || "user" };
  markDirty();
  return s.users[email];
}

export function isQrTaken(qrNumber: string, excludeEmail?: string): boolean {
  const users = getState().users;
  for (const [email, user] of Object.entries(users)) {
    if (user.qrNumber === qrNumber && email !== excludeEmail) return true;
  }
  return false;
}

export function isDeveloperQrClaimed(): boolean {
  return isQrTaken("88888888");
}

export function deletePost(id: string): boolean {
  const posts = getState().posts;
  const idx = posts.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  posts.splice(idx, 1);
  markDirty();
  return true;
}

export function deleteComment(postId: string, commentId: string): boolean {
  const posts = getState().posts;
  const post = posts.find((p) => p.id === postId);
  if (!post) return false;
  const idx = post.comments.findIndex((c) => c.id === commentId);
  if (idx === -1) return false;
  post.comments.splice(idx, 1);
  markDirty();
  return true;
}

export function banUser(email: string): boolean {
  const users = getState().users;
  if (!users[email]) return false;
  if (users[email].role === "developer") return false;
  users[email].role = "banned";
  markDirty();
  return true;
}

export function unbanUser(email: string): boolean {
  const users = getState().users;
  if (!users[email]) return false;
  users[email].role = "user";
  markDirty();
  return true;
}

export function getAllUsers(): StoredUser[] {
  return Object.values(getState().users);
}

// ===== 帖子 =====

export function getPosts(): StoredPost[] {
  return getState().posts;
}

export function addPost(post: StoredPost): StoredPost {
  const posts = getState().posts;
  posts.unshift(post);
  markDirty();
  return post;
}

export function getPost(id: string): StoredPost | null {
  return getState().posts.find((p) => p.id === id) || null;
}

export function addComment(postId: string, comment: StoredComment): StoredComment | null {
  const posts = getState().posts;
  const post = posts.find((p) => p.id === postId);
  if (!post) return null;
  if (!post.comments) post.comments = [];
  post.comments.push(comment);
  markDirty();
  return comment;
}

// ===== OTP（保持与原 otpStore Map 完全相同的接口，route.ts 无需改动） =====

export const otpStore = {
  get(email: string): OTPEntry | undefined {
    return getState().otp[email];
  },
  set(email: string, entry: OTPEntry): void {
    getState().otp[email] = entry;
    markDirty();
  },
  delete(email: string): void {
    delete getState().otp[email];
    markDirty();
  },
};
export type { OTPEntry };

// ===== 数据存储健康检测 =====

export function getDataDir(): string {
  return getKV() ? "Cloudflare KV / AIHUB_DATA" : "in-memory (本地开发)";
}

export function getDataStoreHealth(): {
  path: string;
  exists: boolean;
  writable: boolean;
  kv: boolean;
  users: number;
  posts: number;
} {
  return {
    path: getDataDir(),
    exists: true,
    writable: true,
    kv: !!getKV(),
    users: Object.keys(getState().users).length,
    posts: getState().posts.length,
  };
}
