#!/bin/sh
set -e

# Database nằm trên volume: lần chạy đầu volume rỗng nên copy DB demo đã seed.
if [ ! -f "${DATABASE_PATH}" ]; then
  echo "[entrypoint] chưa có DB tại ${DATABASE_PATH}, copy bản seed…"
  mkdir -p "$(dirname "${DATABASE_PATH}")"
  cp /app/seed/kidohomes.db "${DATABASE_PATH}"
fi

exec node server.js
