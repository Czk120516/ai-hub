import { NextResponse } from "next/server";
import { extractToken, getUserFromToken } from "@/lib/auth-server";
import { StoredUser } from "@/lib/data-store";

/** 验证请求，返回用户；未登录返回 401 */
export function requireAuth(req: Request): StoredUser | NextResponse {
  const token = extractToken(req.headers.get("authorization"));
  if (!token) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const user = getUserFromToken(token);
  if (!user) {
    return NextResponse.json({ error: "登录已过期，请重新登录" }, { status: 401 });
  }
  return user;
}
