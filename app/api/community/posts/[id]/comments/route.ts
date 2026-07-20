import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { addComment } from "@/lib/data-store";
import crypto from "crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { content } = await req.json();

  if (!content || typeof content !== "string" || content.trim().length < 1 || content.trim().length > 2000) {
    return NextResponse.json({ error: "评论 1-2000 个字符" }, { status: 400 });
  }

  const comment = {
    id: crypto.randomBytes(8).toString("hex"),
    content: content.trim(),
    authorEmail: auth.email,
    authorNickname: auth.nickname,
    authorQr: auth.qrNumber,
    authorAvatar: auth.avatar,
    createdAt: new Date().toISOString(),
  };

  const result = addComment(params.id, comment);
  if (!result) {
    return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
  }

  return NextResponse.json(comment);
}
