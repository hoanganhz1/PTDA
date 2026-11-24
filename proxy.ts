import { NextResponse, type NextRequest } from "next/server";

/**
 * Bảo vệ khu vực quản trị (Next 16: `proxy.ts` thay cho `middleware.ts`).
 *
 * Cookie chứa SHA-256 của ADMIN_PASSWORD (không chứa mật khẩu gốc) và được
 * so sánh với hash tính từ biến môi trường ở mỗi request.
 */

const ADMIN_COOKIE = "kd_admin";
const LOGIN_PATH = "/admin/login";

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function proxy(request: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return new NextResponse(
      "Trang quản trị chưa được cấu hình. Hãy đặt biến môi trường ADMIN_PASSWORD.",
      { status: 503 },
    );
  }

  if (request.nextUrl.pathname === LOGIN_PATH) {
    return NextResponse.next();
  }

  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  const expected = await sha256Hex(password);
  if (token && token === expected) {
    return NextResponse.next();
  }

  const loginUrl = new URL(LOGIN_PATH, request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*"],
};
