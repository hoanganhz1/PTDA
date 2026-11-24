/**
 * Rate limit tối giản (token bucket trong bộ nhớ process).
 * Đủ cho demo 1 instance; khi chạy nhiều instance thì thay bằng store chia sẻ
 * (Upstash Redis, gateway...) nhưng giữ nguyên chữ ký hàm.
 */

type Bucket = { tokens: number; updatedAt: number };

const globalForLimiter = globalThis as unknown as { __kidohomesBuckets?: Map<string, Bucket> };

function buckets() {
  return (globalForLimiter.__kidohomesBuckets ??= new Map());
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
};

export function rateLimit(
  key: string,
  { limit = 20, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {},
): RateLimitResult {
  const store = buckets();
  const now = Date.now();
  const ratePerMs = limit / windowMs;
  const bucket = store.get(key) ?? { tokens: limit, updatedAt: now };

  const refilled = Math.min(limit, bucket.tokens + (now - bucket.updatedAt) * ratePerMs);
  if (refilled < 1) {
    const missing = 1 - refilled;
    store.set(key, { tokens: refilled, updatedAt: now });
    return { ok: false, remaining: 0, retryAfterSec: Math.max(1, Math.ceil(missing / ratePerMs / 1000)) };
  }

  store.set(key, { tokens: refilled - 1, updatedAt: now });

  // Tránh Map phình vô hạn khi bị quét key ngẫu nhiên.
  if (store.size > 5000) {
    for (const [bucketKey, value] of store) {
      if (now - value.updatedAt > windowMs * 2) store.delete(bucketKey);
    }
  }

  return { ok: true, remaining: Math.floor(refilled - 1), retryAfterSec: 0 };
}

/** Key theo IP (sau proxy) + session để vừa chặn lạm dụng vừa không phạt nhầm người dùng chung IP. */
export function requestKey(request: Request, scope: string, sessionId?: string) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "local";
  return `${scope}:${ip}:${sessionId ?? "-"}`;
}
