import { NextResponse } from "next/server";
import { adminLoginSchema } from "@/lib/schemas";
import { logEvent } from "@/lib/log";
import { rateLimit, requestKey } from "@/lib/rate-limit";

const ADMIN_COOKIE = "kd_admin";
const SESSION_MAX_AGE = 60 * 60 * 8; // 8 giờ

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(request: Request) {
  const limit = rateLimit(requestKey(request, "admin-login"), { limit: 8, windowMs: 15 * 60_000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Quá nhiều lần thử. Vui lòng thử lại sau." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return NextResponse.json({ error: "Trang quản trị chưa được cấu hình." }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = adminLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Mật khẩu không hợp lệ." }, { status: 400 });
  }

  if (parsed.data.password !== expected) {
    logEvent("admin_login_failed", { ip: request.headers.get("x-forwarded-for") ?? "local" });
    return NextResponse.json({ error: "Mật khẩu không đúng." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ADMIN_COOKIE,
    value: await sha256Hex(expected),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  logEvent("admin_login_ok");
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({ name: ADMIN_COOKIE, value: "", path: "/", maxAge: 0 });
  return response;
}
