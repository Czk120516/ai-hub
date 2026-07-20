/**
 * JSON 文件数据存储（TypeScript 版）
 * 所有数据存 data/ 目录，Next.js 生产模式下持久化
 */
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function filePath(name: string) {
  return path.join(DATA_DIR, `${name}.json`);
}

function read<T>(name: string): T | null {
  ensureDir();
  const fp = filePath(name);
  if (!fs.existsSync(fp)) return null;
  try {
    return JSON.parse(fs.readFileSync(fp, "utf-8"));
  } catch {
    return null;
  }
}

function write<T>(name: string, data: T) {
  ensureDir();
  fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2), "utf-8");
}

// ========== 用户存储 ==========

export interface StoredUser {
  email: string;
  nickname: string;
  qrNumber: string;
  avatar: string | null;
}

export function getUsers(): Record<string, StoredUser> {
  return read<Record<string, StoredUser>>("users") || {};
}

export function saveUsers(users: Record<string, StoredUser>) {
  write("users", users);
}

export function getUser(email: string): StoredUser | null {
  return getUsers()[email] || null;
}

export function upsertUser(email: string, data: Partial<StoredUser>): StoredUser {
  const users = getUsers();
  users[email] = { ...users[email], ...data, email };
  saveUsers(users);
  return users[email];
}

export function isQrTaken(qrNumber: string, excludeEmail?: string): boolean {
  const users = getUsers();
  for (const [email, user] of Object.entries(users)) {
    if (user.qrNumber === qrNumber && email !== excludeEmail) {
      return true;
    }
  }
  return false;
}

// ========== 帖子存储 ==========

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
  return read<StoredPost[]>("posts") || [];
}

export function savePosts(posts: StoredPost[]) {
  write("posts", posts);
}

export function addPost(post: StoredPost): StoredPost {
  const posts = getPosts();
  posts.unshift(post);
  savePosts(posts);
  return post;
}

export function getPost(id: string): StoredPost | null {
  return getPosts().find((p) => p.id === id) || null;
}

export function addComment(postId: string, comment: StoredComment): StoredComment | null {
  const posts = getPosts();
  const post = posts.find((p) => p.id === postId);
  if (!post) return null;
  if (!post.comments) post.comments = [];
  post.comments.push(comment);
  savePosts(posts);
  return comment;
}
