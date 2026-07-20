import { NextRequest, NextResponse } from "next/server";
import { generateCode } from "@/lib/auth-server";
import { canResend, storeOtp } from "@/lib/otp-store";
import { sendVerificationCode } from "@/lib/mailer";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "请输入有效的邮箱地址" }, { status: 400 });
    }

    const check = canResend(email);
    if (!check.ok) {
      return NextResponse.json(
        { error: `请 ${check.waitSeconds} 秒后再试` },
        { status: 429 }
      );
    }

    const code = generateCode();
    storeOtp(email, code);
    await sendVerificationCode(email, code);

    return NextResponse.json({ success: true, message: "验证码已发送，请查收邮箱" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "邮件发送失败";
    console.error("发送邮件失败:", msg);
    return NextResponse.json({ error: "邮件发送失败，请稍后重试" }, { status: 500 });
  }
}
