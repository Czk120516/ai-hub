/**
 * 服务端 JSON 文件存储
 * Vercel serverless: /tmp 在同一部署内持久化
 */
import fs from "fs";
import path from "path";

const DATA_DIR = path.join("/tmp", "aihub-data");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJSON<T>(name: string): T | null {
  ensureDir();
  const fp = path.join(DATA_DIR, `${name}.json`);
  if (!fs.existsSync(fp)) return null;
  try {
    return JSON.parse(fs.readFileSync(fp, "utf-8"));
  } catch {
    return null;
  }
}

function writeJSON(name: string, data: unknown) {
  ensureDir();
  fs.writeFileSync(path.join(DATA_DIR, `${name}.json`), JSON.stringify(data, null, 2), "utf-8");
}

// ===== 用户 =====

export type UserRole = "user" | "developer" | "banned";

export interface StoredUser {
  email: string;
  nickname: string;
  qrNumber: string;
  avatar: string | null;
  role: UserRole;
}

export function getUsers(): Record<string, StoredUser> {
  return readJSON<Record<string, StoredUser>>("users") || {};
}

export function getUser(email: string): StoredUser | null {
  return getUsers()[email] || null;
}

export function upsertUser(email: string, data: Partial<StoredUser>): StoredUser {
  const users = getUsers();
  const existing = users[email];
  users[email] = { ...existing, ...data, email, role: existing?.role || data.role || "user" };
  writeJSON("users", users);
  return users[email];
}

export function isQrTaken(qrNumber: string, excludeEmail?: string): boolean {
  const users = getUsers();
  for (const [email, user] of Object.entries(users)) {
    if (user.qrNumber === qrNumber && email !== excludeEmail) return true;
  }
  return false;
}

/** 开发者 QR=888888 是否已被占用（含特殊保护） */
export function isDeveloperQrClaimed(): boolean {
  return isQrTaken("888888");
}

// ===== 管理员功能 =====

export function deletePost(id: string): boolean {
  const posts = getPosts();
  const idx = posts.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  posts.splice(idx, 1);
  writeJSON("posts", posts);
  return true;
}

export function deleteComment(postId: string, commentId: string): boolean {
  const posts = getPosts();
  const post = posts.find((p) => p.id === postId);
  if (!post) return false;
  const idx = post.comments.findIndex((c) => c.id === commentId);
  if (idx === -1) return false;
  post.comments.splice(idx, 1);
  writeJSON("posts", posts);
  return true;
}

export function banUser(email: string): boolean {
  const users = getUsers();
  if (!users[email]) return false;
  if (users[email].role === "developer") return false; // 不能封禁开发者
  users[email].role = "banned";
  writeJSON("users", users);
  return true;
}

export function unbanUser(email: string): boolean {
  const users = getUsers();
  if (!users[email]) return false;
  users[email].role = "user";
  writeJSON("users", users);
  return true;
}

export function getAllUsers(): StoredUser[] {
  return Object.values(getUsers());
}

// ===== 帖子 =====

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
}

export function getPosts(): StoredPost[] {
  return readJSON<StoredPost[]>("posts") || [];
}

export function addPost(post: StoredPost): StoredPost {
  const posts = getPosts();
  posts.unshift(post);
  writeJSON("posts", posts);
  return post;
}

export function getPost(id: string): StoredPost | null {
  return getPosts().find((p) => p.id === id) || null;
}

export function addComment(postId: string, comment: StoredComment): StoredComment | null {
  const posts = getPosts();
  const post = posts.find((p) => p.id === postId);
  if (!post) return null;
  post.comments.push(comment);
  writeJSON("posts", posts);
  return comment;
}

// ===== OTP (内存) =====

interface OTPEntry {
  codeHash: string;
  expiresAt: number;
  lastSentAt: number;
}

const otpStore = new Map<string, OTPEntry>();

// 每分钟清理过期 OTP
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of otpStore) {
      if (v.expiresAt < now) otpStore.delete(k);
    }
  }, 60_000);
}

export { otpStore };
export type { OTPEntry };
