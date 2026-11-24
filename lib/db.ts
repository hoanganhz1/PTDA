import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

/**
 * Đường dẫn DB cấu hình được qua `DATABASE_PATH` để chạy test/eval trên file riêng
 * thay vì ghi vào dữ liệu demo (`:memory:` cũng được hỗ trợ).
 */
export const dbPath =
  process.env.DATABASE_PATH?.trim() || path.join(process.cwd(), "data", "kidohomes.db");

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    brand TEXT NOT NULL,
    price INTEGER NOT NULL,
    original_price INTEGER,
    color TEXT NOT NULL,
    material TEXT NOT NULL,
    dimensions_mm TEXT NOT NULL,
    min_room_area_m2 INTEGER NOT NULL,
    is_compact INTEGER NOT NULL,
    features TEXT NOT NULL,
    warranty_months INTEGER NOT NULL,
    short_description TEXT NOT NULL,
    in_stock INTEGER NOT NULL,
    image_placeholder_key TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS handoff_requests (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone_email TEXT NOT NULL,
    message TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'new'
  );

  CREATE TABLE IF NOT EXISTS chat_history (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS chat_sessions (
    session_id TEXT PRIMARY KEY,
    handoff_pending INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_chat_history_session_created
    ON chat_history(session_id, created_at);

  CREATE INDEX IF NOT EXISTS idx_handoff_requests_created
    ON handoff_requests(created_at);
`;

function hasColumn(db: Database.Database, table: string, column: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return columns.some((item) => item.name === column);
}

/** Migration idempotent cho schema chat và mã sản phẩm demo. */
function migrate(db: Database.Database) {
  if (!hasColumn(db, "chat_history", "meta")) {
    db.exec("ALTER TABLE chat_history ADD COLUMN meta TEXT");
  }
  if (!hasColumn(db, "chat_sessions", "created_at")) {
    db.exec("ALTER TABLE chat_sessions ADD COLUMN created_at TEXT");
    db.exec("UPDATE chat_sessions SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL");
  }

  // Chuẩn hóa SKU demo sinh từ seed cũ thành mã ASCII ổn định theo ID.
  const legacyProducts = db
    .prepare("SELECT id, category, sku FROM products WHERE id GLOB 'prod-[0-9]*'")
    .all() as Array<{ id: string; category: string; sku: string }>;
  const findCollision = db.prepare("SELECT 1 FROM products WHERE sku = ? AND id <> ?");
  const updateSku = db.prepare("UPDATE products SET sku = ? WHERE id = ? AND sku = ?");
  db.transaction(() => {
    for (const product of legacyProducts) {
      const match = product.id.match(/^prod-(\d+)$/);
      if (!match) continue;

      const sequence = Number(match[1]);
      const oldSeedSku = `KD-${product.category.replace(/\s+/g, "-").slice(0, 4).toUpperCase()}-${String(sequence).padStart(4, "0")}`;
      if (product.sku !== oldSeedSku) continue;

      const normalizedSku = `KDH-${String(sequence).padStart(4, "0")}`;
      if (findCollision.get(normalizedSku, product.id)) continue;
      updateSku.run(normalizedSku, product.id, product.sku);
    }
  })();
}

function openDatabase() {
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const database = new Database(dbPath);
  database.pragma("journal_mode = WAL");
  database.pragma("busy_timeout = 5000");
  database.exec(SCHEMA);
  migrate(database);
  return database;
}

const globalForDb = globalThis as unknown as { __kidohomesDb?: Database.Database };

/** Singleton theo process để hot-reload của `next dev` không mở nhiều connection. */
export function getDb() {
  return (globalForDb.__kidohomesDb ??= openDatabase());
}

export function ensureDatabaseReady() {
  return getDb().prepare("SELECT COUNT(*) as count FROM products").get() as { count: number };
}

/** Dùng cho script/eval: đóng connection để file DB được ghi xuống đĩa ngay. */
export function closeDb() {
  globalForDb.__kidohomesDb?.close();
  globalForDb.__kidohomesDb = undefined;
}
