import { NextRequest, NextResponse } from "next/server";
import { getPost } from "@/lib/data-store";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const post = getPost(params.id);
  if (!post) {
    return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
  }
  return NextResponse.json(post);
}
