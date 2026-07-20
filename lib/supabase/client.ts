/**
 * 本地登录模块（零网络请求，浏览器内完成）
 *
 * 使用 localStorage 存储，Web Crypto (PBKDF2) 哈希密码。
 * 不上传任何数据到任何服务器。
 */

export interface SupabaseUser {
  id: string;
  email: string;
}

export interface SupabaseSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: SupabaseUser;
}

const SESSION_KEY = "ai-hub-session";
const USER_KEY = "ai-hub-user";

function getStoredSession(): SupabaseSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as SupabaseSession;
    if (session.expires_at * 1000 < Date.now()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function setStoredSession(session: SupabaseSession | null) {
  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

// ========== 本地密码哈希（PBKDF2）==========

const ENCODER = new TextEncoder();

async function hashPassword(password: string, salt?: Uint8Array): Promise<{ hash: string; salt: string }> {
  const actualSalt = salt || crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    ENCODER.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: actualSalt.buffer as ArrayBuffer, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256,
  );
  const hashStr = Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const saltStr = Array.from(actualSalt)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return { hash: hashStr, salt: saltStr };
}

// ========== 公开 API ==========

/** 注册新用户 */
export async function signUp(email: string, password: string): Promise<{ error?: string }> {
  try {
    // 检查是否已注册
    const raw = localStorage.getItem(USER_KEY);
    if (raw) {
      const stored = JSON.parse(raw);
      if (stored.email === email.toLowerCase().trim()) {
        return { error: "该邮箱已注册，请直接登录" };
      }
    }

    const { hash, salt } = await hashPassword(password);

    localStorage.setItem(
      USER_KEY,
      JSON.stringify({
        email: email.toLowerCase().trim(),
        passwordHash: hash,
        salt: salt,
        createdAt: Date.now(),
      }),
    );

    return {};
  } catch {
    return { error: "注册失败，请重试" };
  }
}

/** 邮箱密码登录 */
export async function signIn(email: string, password: string): Promise<{ session?: SupabaseSession; error?: string }> {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) {
      return { error: "该邮箱未注册，请先注册" };
    }

    const stored = JSON.parse(raw);
    if (stored.email !== email.toLowerCase().trim()) {
      return { error: "邮箱或密码错误" };
    }

    // 用存储的 salt 哈希输入的密码
    const salt = new Uint8Array(stored.salt.match(/.{2}/g).map((b: string) => parseInt(b, 16)));
    const { hash } = await hashPassword(password, salt);

    if (hash !== stored.passwordHash) {
      return { error: "邮箱或密码错误" };
    }

    // 创建 session（7 天有效）
    const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
    const session: SupabaseSession = {
      access_token: crypto.randomUUID(),
      refresh_token: crypto.randomUUID(),
      expires_at: expiresAt,
      user: {
        id: crypto.randomUUID(),
        email: stored.email,
      },
    };

    setStoredSession(session);
    return { session };
  } catch {
    return { error: "登录失败，请重试" };
  }
}

/** 获取当前用户（纯本地，秒开） */
export async function getCurrentUser(): Promise<{
  user: SupabaseUser | null;
  session: SupabaseSession | null;
}> {
  const session = getStoredSession();
  if (!session) return { user: null, session: null };

  if (session.expires_at * 1000 < Date.now()) {
    setStoredSession(null);
    return { user: null, session: null };
  }

  return { user: session.user, session };
}

/** 退出登录 */
export async function signOut(): Promise<void> {
  setStoredSession(null);
}
