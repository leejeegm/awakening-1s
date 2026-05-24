import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAdminTokenEdge } from "@/lib/adminAuthEdge";

const ADMIN_API_PUBLIC = new Set(["/api/admin/login"]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/admin/") && !ADMIN_API_PUBLIC.has(pathname)) {
    const token = request.cookies.get("admin_session")?.value;
    if (!(await verifyAdminTokenEdge(token))) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/admin/:path*"],
};
