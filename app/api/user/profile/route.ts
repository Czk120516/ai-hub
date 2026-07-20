import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getUser, upsertUser, isQrTaken } from "@/lib/data-store";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({
    email: auth.email,
    nickname: auth.nickname,
    qrNumber: auth.qrNumber,
    avatar: auth.avatar,
  });
}

export async function PUT(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { nickname, qrNumber, avatar } = await req.json();

  if (nickname !== undefined) {
    if (typeof nickname !== "string" || nickname.trim().length < 1 || nickname.trim().length > 20) {
      return NextResponse.json({ error: "昵称 1-20 个字符" }, { status: 400 });
    }
  }

  if (qrNumber !== undefined) {
    if (!/^[A-Z0-9]{6,12}$/i.test(qrNumber)) {
      return NextResponse.json({ error: "QR 号需为 6-12 位字母或数字" }, { status: 400 });
    }
    if (isQrTaken(qrNumber.toUpperCase(), auth.email)) {
      return NextResponse.json({ error: "该 QR 号已被占用" }, { status: 400 });
    }
  }

  const updates: Record<string, unknown> = {};
  if (nickname !== undefined) updates.nickname = nickname.trim();
  if (qrNumber !== undefined) updates.qrNumber = qrNumber.toUpperCase();
  if (avatar !== undefined) updates.avatar = avatar;

  const updated = upsertUser(auth.email, updates);
  return NextResponse.json({
    email: updated.email,
    nickname: updated.nickname,
    qrNumber: updated.qrNumber,
    avatar: updated.avatar,
  });
}
