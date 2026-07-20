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

export interface StoredUser {
  email: string;
  nickname: string;
  qrNumber: string;
  avatar: string | null;
}

export function getUsers(): Record<string, StoredUser> {
  return readJSON<Record<string, StoredUser>>("users") || {};
}

export function getUser(email: string): StoredUser | null {
  return getUsers()[email] || null;
}

export function upsertUser(email: string, data: Partial<StoredUser>): StoredUser {
  const users = getUsers();
  users[email] = { ...users[email], ...data, email };
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
