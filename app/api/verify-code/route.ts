import { NextRequest, NextResponse } from "next/server";
import { generateToken, defaultNickname, generateQR } from "@/lib/auth-server";
import { verifyOtp, clearOtp, hasOtp } from "@/lib/otp-store";
import { registerToken } from "@/lib/auth-server";
import { getUser, upsertUser } from "@/lib/data-store";

export async function POST(req: NextRequest) {
  const { email, code } = await req.json();

  if (!email || !code) {
    return NextResponse.json({ error: "请输入邮箱和验证码" }, { status: 400 });
  }

  if (!hasOtp(email)) {
    return NextResponse.json({ error: "请先获取验证码" }, { status: 400 });
  }

  if (!verifyOtp(email, code)) {
    return NextResponse.json({ error: "验证码错误或已过期" }, { status: 400 });
  }

  clearOtp(email);

  const token = generateToken();
  const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
  registerToken(token, email);

  const existing = getUser(email);
  const user = upsertUser(email, {
    nickname: existing?.nickname || defaultNickname(email),
    qrNumber: existing?.qrNumber || generateQR(),
    avatar: existing?.avatar || null,
  });

  return NextResponse.json({
    success: true,
    token,
    expiresAt,
    user: {
      email: user.email,
      nickname: user.nickname,
      qrNumber: user.qrNumber,
      avatar: user.avatar,
    },
  });
}
