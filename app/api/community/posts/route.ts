import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getPosts, addPost } from "@/lib/data-store";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const size = Math.min(parseInt(url.searchParams.get("size") || "20"), 50);
  const all = getPosts();
  const start = (page - 1) * size;
  const items = all.slice(start, start + size);

  return NextResponse.json({
    items: items.map((p) => ({
      id: p.id,
      title: p.title,
      content: p.content,
      authorNickname: p.authorNickname,
      authorQr: p.authorQr,
      authorAvatar: p.authorAvatar,
      createdAt: p.createdAt,
      commentCount: (p.comments || []).length,
    })),
    total: all.length,
    page,
    size,
  });
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { title, content } = await req.json();

  if (!title || typeof title !== "string" || title.trim().length < 1 || title.trim().length > 100) {
    return NextResponse.json({ error: "标题 1-100 个字符" }, { status: 400 });
  }
  if (!content || typeof content !== "string" || content.trim().length < 1 || content.trim().length > 5000) {
    return NextResponse.json({ error: "内容 1-5000 个字符" }, { status: 400 });
  }

  const post = {
    id: crypto.randomBytes(12).toString("hex"),
    title: title.trim(),
    content: content.trim(),
    authorEmail: auth.email,
    authorNickname: auth.nickname,
    authorQr: auth.qrNumber,
    authorAvatar: auth.avatar,
    createdAt: new Date().toISOString(),
    comments: [],
  };

  addPost(post);
  return NextResponse.json(post);
}
