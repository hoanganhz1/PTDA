import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

/**
 * Đánh giá bộ phân tích tiêu chí của API tìm kiếm (rule-based, không gọi LLM).
 * Chạy trên DB riêng để không ảnh hưởng dữ liệu demo.
 */

const localEnvPath = path.join(process.cwd(), ".env.local");
const defaultEnvPath = path.join(process.cwd(), ".env");
if (fs.existsSync(localEnvPath)) dotenv.config({ path: localEnvPath, override: true });
else if (fs.existsSync(defaultEnvPath)) dotenv.config({ path: defaultEnvPath, override: true });

process.env.DATABASE_PATH = process.env.EVAL_DATABASE_PATH ?? path.join(process.cwd(), "data", "eval.db");
process.env.LLM_MODE = "mock";

type SearchCase = {
  id: string;
  query: string;
  expectCriteria: Record<string, string | number | undefined>;
  expectTop?: Record<string, string | number | undefined>;
};

const cases: SearchCase[] = [
  {
    id: "S-01",
    query: "bồn cầu dưới 5 triệu",
    expectCriteria: { category: "bồn cầu", price_max: 5_000_000 },
    expectTop: { category: "bồn cầu" },
  },
  {
    id: "S-02",
    query: "sen tắm đứng TOTO",
    expectCriteria: { category: "sen cây", brand: "TOTO" },
    expectTop: { brand: "TOTO" },
  },
  {
    id: "S-03",
    query: "lavabo INAX cho phòng tắm nhỏ",
    expectCriteria: { category: "lavabo", brand: "INAX", room_size: "nho" },
    expectTop: { category: "lavabo" },
  },
  {
    id: "S-04",
    query: "vòi lavabo inox giá dưới 2tr",
    expectCriteria: { category: "vòi lavabo", material: "Inox", price_max: 2_000_000 },
    expectTop: { category: "vòi lavabo" },
  },
  {
    id: "S-05",
    query: "bồn tắm khoảng 5 triệu",
    expectCriteria: { category: "bồn tắm", price_min: 4_000_000, price_max: 6_000_000 },
  },
  {
    id: "S-06",
    query: "lavabo màu be",
    expectCriteria: { category: "lavabo", color: "Be" },
    expectTop: { color: "Be" },
  },
  {
    id: "S-07",
    query: "phụ kiện phòng tắm 500k",
    expectCriteria: { category: "phụ kiện phòng tắm" },
  },
];

async function main() {
  console.log("\n=======================================================");
  console.log("        ĐÁNH GIÁ BỘ PHÂN TÍCH TÌM KIẾM KIDOHOMES");
  console.log(`        DB: ${process.env.DATABASE_PATH}`);
  console.log("=======================================================\n");

  const { POST } = await import("../app/api/search/route");
  const { getDb } = await import("../lib/db");

  const productCount = (getDb().prepare("SELECT COUNT(*) as count FROM products").get() as { count: number }).count;
  if (productCount === 0) {
    console.log("→ DB đánh giá chưa có dữ liệu, đang seed…");
    await import("./seed");
  }

  let passed = 0;
  const failures: Array<{ id: string; query: string; reason: string }> = [];

  for (const testCase of cases) {
    let reason: string | null = null;
    let resultCount = 0;

    try {
      const response = await POST(
        new Request("http://localhost:3000/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: testCase.query }),
        }),
      );
      const data = (await response.json()) as {
        criteria: Record<string, unknown>;
        results: Array<Record<string, unknown>>;
        mode: string;
        error?: string;
      };

      if (!response.ok || data.error) {
        reason = `HTTP ${response.status}: ${data.error ?? "lỗi không xác định"}`;
      } else {
        resultCount = data.results.length;

        for (const [key, expected] of Object.entries(testCase.expectCriteria)) {
          if (expected === undefined) continue;
          if (data.criteria[key] !== expected) {
            reason = `tiêu chí ${key}='${String(data.criteria[key])}' ≠ '${expected}'`;
            break;
          }
        }

        if (!reason && resultCount === 0) reason = "không có kết quả nào";

        if (!reason && testCase.expectTop) {
          const top = data.results[0];
          for (const [key, expected] of Object.entries(testCase.expectTop)) {
            if (expected === undefined) continue;
            if (String(top[key]).toLowerCase() !== String(expected).toLowerCase()) {
              reason = `kết quả đầu ${key}='${String(top[key])}' ≠ '${expected}'`;
              break;
            }
          }
        }

        if (!reason && !data.results.every((item) => item.reason && item.match_confidence)) {
          reason = "kết quả thiếu reason/match_confidence";
        }
      }
    } catch (error) {
      reason = error instanceof Error ? error.message : String(error);
    }

    if (reason) {
      failures.push({ id: testCase.id, query: testCase.query, reason });
      console.log(`✗ ${testCase.id} "${testCase.query}" → ${reason}`);
    } else {
      passed += 1;
      console.log(`✓ ${testCase.id} "${testCase.query}" (${resultCount} kết quả)`);
    }
  }

  const summary = {
    total: cases.length,
    passed,
    failed: failures.length,
    accuracy: `${((passed / cases.length) * 100).toFixed(0)}%`,
    failures,
  };

  console.log("\n-------------------------------------------------------");
  console.log(JSON.stringify(summary, null, 2));
  console.log("-------------------------------------------------------\n");

  if (failures.length) process.exitCode = 1;
}

void main();
