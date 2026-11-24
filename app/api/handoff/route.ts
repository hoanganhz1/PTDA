import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { logError, logEvent } from "@/lib/log";
import { rateLimit, requestKey } from "@/lib/rate-limit";
import { handoffRequestSchema } from "@/lib/schemas";

function isEmail(value: string) {
  return z.string().email().safeParse(value).success;
}

function isVietnamesePhone(value: string) {
  const phone = value.replace(/[\s().-]/g, "");
  return /^(?:\+?84|0)\d{9}$/.test(phone);
}

const HANDOFF_CONFIRMATION =
  "Đã lưu yêu cầu liên hệ của bạn. Nhân viên Kidohomes có thể liên hệ theo thông tin bạn đã cung cấp.";

export async function POST(request: Request) {
  const limit = rateLimit(requestKey(request, "handoff"), { limit: 5, windowMs: 60 * 60_000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Bạn đã gửi nhiều yêu cầu. Vui lòng thử lại sau." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = handoffRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Vui lòng nhập tên và số điện thoại Việt Nam hoặc email hợp lệ." },
      { status: 400 },
    );
  }

  const { sessionId, name, contact, message } = parsed.data;
  if (!isEmail(contact) && !isVietnamesePhone(contact)) {
    return NextResponse.json(
      { error: "Vui lòng nhập tên và số điện thoại Việt Nam hoặc email hợp lệ." },
      { status: 400 },
    );
  }

  try {
    const db = getDb();
    const recentMessages = db
      .prepare(
        "SELECT message FROM chat_history WHERE session_id = ? AND role = 'user' ORDER BY created_at DESC, rowid DESC LIMIT 3",
      )
      .all(sessionId) as Array<{ message: string }>;

    const context =
      message || recentMessages.reverse().map((item) => item.message).join(" | ").slice(0, 1000);

    db.transaction(() => {
      db.prepare("INSERT INTO handoff_requests (id, name, phone_email, message) VALUES (?, ?, ?, ?)").run(
        randomUUID(),
        name,
        contact,
        context || null,
      );
      db.prepare(
        `INSERT INTO chat_sessions (session_id, handoff_pending) VALUES (?, 0)
         ON CONFLICT(session_id) DO UPDATE SET handoff_pending = 0`,
      ).run(sessionId);
      db.prepare(
        "INSERT INTO chat_history (id, session_id, role, message, meta) VALUES (?, ?, 'assistant', ?, ?)",
      ).run(randomUUID(), sessionId, HANDOFF_CONFIRMATION, JSON.stringify({ follow_up_questions: [] }));
    })();

    logEvent("handoff_created", { session: sessionId.slice(0, 8), contactKind: isEmail(contact) ? "email" : "phone" });
    return NextResponse.json({ message: HANDOFF_CONFIRMATION });
  } catch (error) {
    logError("handoff_failed", error, { session: sessionId.slice(0, 8) });
    return NextResponse.json({ error: "Chưa lưu được yêu cầu. Vui lòng thử lại." }, { status: 500 });
  }
}
