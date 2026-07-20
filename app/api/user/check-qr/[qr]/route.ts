import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { isQrTaken } from "@/lib/data-store";

export async function GET(
  req: NextRequest,
  { params }: { params: { qr: string } }
) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const qr = params.qr.toUpperCase();
  if (!/^[A-Z0-9]{6,12}$/.test(qr)) {
    return NextResponse.json({ available: false, error: "格式不正确" });
  }

  return NextResponse.json({ available: !isQrTaken(qr, auth.email) });
}
