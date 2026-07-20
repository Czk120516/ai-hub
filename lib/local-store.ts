/**
 * 前端 localStorage 数据层
 * 当后端不可达时，所有数据存储在浏览器 localStorage 中
 * 支持：用户注册/登录、资料管理、社区帖子/评论
 */

// ==================== 类型 ====================

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

interface StoredUser {
  email: string;
  nickname: string;
  qrNumber: string;
  avatar: string | null;
}

interface StoredSession {
  email: string;
  token: string;
  expiresAt: number;
}

// ==================== 工具函数 ====================

function generateId(len = 12): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < len * 2; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function generateQR(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const qrNumbers = getQRSet();
  for (let attempt = 0; attempt < 100; attempt++) {
    let qr = "";
    for (let i = 0; i < 8; i++) {
      qr += chars[Math.floor(Math.random() * chars.length)];
    }
    if (!qrNumbers.has(qr)) return qr;
  }
  return "U" + Date.now().toString(36).slice(-7).toUpperCase();
}

function defaultNickname(email: string): string {
  return email.split("@")[0].slice(0, 12);
}

// ==================== 存储读写 ====================

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem("aihub_" + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  localStorage.setItem("aihub_" + key, JSON.stringify(value));
}

// ==================== 用户 ====================

function getUsers(): Record<string, StoredUser> {
  return read<Record<string, StoredUser>>("users", {});
}

function saveUsers(users: Record<string, StoredUser>): void {
  write("users", users);
}

function getQRSet(): Set<string> {
  const users = getUsers();
  const set = new Set<string>();
  for (const u of Object.values(users)) {
    set.add(u.qrNumber);
  }
  return set;
}

// ==================== 会话 ====================

function getSession(): StoredSession | null {
  const s = read<StoredSession | null>("session", null);
  if (s && s.expiresAt > Date.now() / 1000) return s;
  if (s) localStorage.removeItem("aihub_session");
  return null;
}

function saveSession(email: string): StoredSession {
  const session: StoredSession = {
    email,
    token: "local_" + generateId(32),
    expiresAt: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
  };
  write("session", session);
  return session;
}

// ==================== 帖子 ====================

function getPostsStore(): Post[] {
  return read<Post[]>("posts", []);
}

function savePostsStore(posts: Post[]): void {
  write("posts", posts);
}

// ==================== 公开 API ====================

/** 模拟发送验证码（本地版直接跳过） */
export function localSendCode(email: string): { success: boolean; message?: string; error?: string } {
  if (!email || !email.includes("@")) {
    return { success: false, error: "请输入有效的邮箱地址" };
  }
  return { success: true, message: "验证码已发送（本地模式：直接输入任意 6 位数字即可登录）" };
}

/** 本地登录/注册 */
export function localVerifyCode(
  email: string,
  code: string
): { success: boolean; token?: string; expiresAt?: number; user?: UserProfile; error?: string } {
  if (!email || !code) {
    return { success: false, error: "请输入邮箱和验证码" };
  }
  if (code.length !== 6 || !/^\d+$/.test(code)) {
    return { success: false, error: "请输入 6 位数字验证码" };
  }

  const users = getUsers();
  let user = users[email];

  if (!user) {
    // 新用户注册
    const qr = generateQR();
    user = {
      email,
      nickname: defaultNickname(email),
      qrNumber: qr,
      avatar: null,
    };
    users[email] = user;
    saveUsers(users);
  }

  const session = saveSession(email);

  return {
    success: true,
    token: session.token,
    expiresAt: session.expiresAt,
    user: {
      email: user.email,
      nickname: user.nickname,
      qrNumber: user.qrNumber,
      avatar: user.avatar,
    },
  };
}

/** 获取当前用户的 token */
export function getLocalToken(): string | null {
  const s = getSession();
  return s?.token || null;
}

/** 获取当前用户的 email */
export function getLocalEmail(): string | null {
  const s = getSession();
  return s?.email || null;
}

/** 注销 */
export function localLogout(): void {
  localStorage.removeItem("aihub_session");
}

/** 获取当前用户资料 */
export function localFetchProfile(): UserProfile | null {
  const email = getLocalEmail();
  if (!email) return null;
  const users = getUsers();
  const u = users[email];
  if (!u) return null;
  return { email: u.email, nickname: u.nickname, qrNumber: u.qrNumber, avatar: u.avatar };
}

/** 更新个人资料 */
export function localUpdateProfile(updates: {
  nickname?: string;
  qrNumber?: string;
  avatar?: string | null;
}): { error?: string; profile?: UserProfile } {
  const email = getLocalEmail();
  if (!email) return { error: "未登录" };

  const users = getUsers();
  const user = users[email];
  if (!user) return { error: "用户不存在" };

  if (updates.nickname !== undefined) {
    const n = updates.nickname.trim();
    if (n.length < 1 || n.length > 20) return { error: "昵称 1-20 个字符" };
    user.nickname = n;
  }

  if (updates.qrNumber !== undefined) {
    const qr = updates.qrNumber.toUpperCase();
    if (!/^[A-Z0-9]{6,12}$/.test(qr)) return { error: "QR 号需为 6-12 位字母或数字" };
    const qrSet = getQRSet();
    if (qrSet.has(qr) && qr !== user.qrNumber) return { error: "该 QR 号已被占用" };
    user.qrNumber = qr;
  }

  if (updates.avatar !== undefined) {
    user.avatar = updates.avatar;
  }

  users[email] = user;
  saveUsers(users);

  return {
    profile: {
      email: user.email,
      nickname: user.nickname,
      qrNumber: user.qrNumber,
      avatar: user.avatar,
    },
  };
}

/** 检查 QR 号是否可用 */
export function localCheckQr(qrNumber: string): { available: boolean; error?: string } {
  const qr = qrNumber.toUpperCase();
  if (!/^[A-Z0-9]{6,12}$/.test(qr)) return { available: false, error: "格式不正确" };
  const email = getLocalEmail();
  const users = getUsers();
  const current = email ? users[email] : null;
  const qrSet = getQRSet();
  if (qrSet.has(qr) && current?.qrNumber !== qr) {
    return { available: false };
  }
  return { available: true };
}

/** 获取帖子列表 */
export function localFetchPosts(page = 1, size = 20): { items: PostSummary[]; total: number } {
  const all = getPostsStore();
  // 按时间倒序
  all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const start = (page - 1) * size;
  const items = all.slice(start, start + size).map((p) => ({
    id: p.id,
    title: p.title,
    content: p.content,
    authorNickname: p.authorNickname,
    authorQr: p.authorQr,
    authorAvatar: p.authorAvatar,
    createdAt: p.createdAt,
    commentCount: (p.comments || []).length,
  }));
  return { items, total: all.length };
}

/** 获取帖子详情 */
export function localFetchPost(id: string): Post | null {
  const posts = getPostsStore();
  return posts.find((p) => p.id === id) || null;
}

/** 发帖 */
export function localCreatePost(
  title: string,
  content: string
): { error?: string; post?: Post } {
  const email = getLocalEmail();
  if (!email) return { error: "请先登录" };

  const users = getUsers();
  const user = users[email];
  if (!user) return { error: "用户不存在" };

  if (!title || title.trim().length < 1 || title.trim().length > 100) {
    return { error: "标题 1-100 个字符" };
  }
  if (!content || content.trim().length < 1 || content.trim().length > 5000) {
    return { error: "内容 1-5000 个字符" };
  }

  const post: Post = {
    id: generateId(12),
    title: title.trim(),
    content: content.trim(),
    authorEmail: email,
    authorNickname: user.nickname,
    authorQr: user.qrNumber,
    authorAvatar: user.avatar,
    createdAt: new Date().toISOString(),
    commentCount: 0,
    comments: [],
  };

  const posts = getPostsStore();
  posts.push(post);
  savePostsStore(posts);

  return { post };
}

/** 添加评论 */
export function localAddComment(
  postId: string,
  content: string
): { error?: string; comment?: Comment } {
  const email = getLocalEmail();
  if (!email) return { error: "请先登录" };

  const users = getUsers();
  const user = users[email];
  if (!user) return { error: "用户不存在" };

  if (!content || content.trim().length < 1 || content.trim().length > 2000) {
    return { error: "评论 1-2000 个字符" };
  }

  const posts = getPostsStore();
  const post = posts.find((p) => p.id === postId);
  if (!post) return { error: "帖子不存在" };

  const comment: Comment = {
    id: generateId(8),
    content: content.trim(),
    authorNickname: user.nickname,
    authorQr: user.qrNumber,
    authorAvatar: user.avatar,
    createdAt: new Date().toISOString(),
  };

  post.comments.push(comment);
  savePostsStore(posts);

  return { comment };
}
