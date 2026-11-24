# ---- Build ----
FROM node:24-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_OUTPUT_STANDALONE=1

# Cài dependency (better-sqlite3 dùng prebuilt cho glibc, không cần build toolchain)
COPY package.json package-lock.json ./
RUN npm ci

# Seed DB demo ngay trong ảnh để container chạy được mà không cần bước phụ
COPY . .
RUN npm run seed && npm run build

# ---- Runtime ----
FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_PATH=/app/data/kidohomes.db

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/data/knowledge ./data/knowledge
# DB mẫu đã seed: dùng cho lần chạy đầu (volume rỗng)
COPY --from=builder /app/data/kidohomes.db ./seed/kidohomes.db
COPY docker/entrypoint.sh /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh && mkdir -p /app/data && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000
ENTRYPOINT ["/app/entrypoint.sh"]
