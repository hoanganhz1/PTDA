import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

/**
 * Đánh giá chatbot trên bộ kịch bản hành vi.
 *
 * Mặc định chạy ở chế độ offline (LLM_MODE=mock): miễn phí, nhanh, tất định —
 * dùng làm "regression gate" cho intent/chính sách và xác nhận offline không gợi ý thẻ sản phẩm.
 * Đặt `EVAL_LIVE=1` để đánh giá gợi ý sản phẩm qua Gemini thật.
 *
 * Luôn chạy trên DB riêng (`DATABASE_PATH`, mặc định data/eval.db) để không
 * làm bẩn dữ liệu demo.
 */

const localEnvPath = path.join(process.cwd(), ".env.local");
const defaultEnvPath = path.join(process.cwd(), ".env");
if (fs.existsSync(localEnvPath)) dotenv.config({ path: localEnvPath, override: true });
else if (fs.existsSync(defaultEnvPath)) dotenv.config({ path: defaultEnvPath, override: true });

const live = process.env.EVAL_LIVE === "1";
process.env.DATABASE_PATH = process.env.EVAL_DATABASE_PATH ?? path.join(process.cwd(), "data", "eval.db");
if (!live) process.env.LLM_MODE = "mock";

type ChatApiResult = {
  message: string;
  products: Array<{
    id: string;
    slug: string;
    name: string;
    brand: string;
    category: string;
    price: number;
    match_confidence?: string;
    reason?: string;
  }>;
  needs_handoff: boolean;
  follow_up_questions: string[];
  mode: string;
};

const PII_PHONE = "0912345678";

type Case = {
  id: string;
  name: string;
  category: "intent" | "product" | "multi_turn" | "policy" | "safety";
  turns: Array<{ message: string; check: (result: ChatApiResult, turn: number) => string | null }>;
};

const cases: Case[] = [
  {
    id: "TC-01",
    name: "Chào hỏi không gắn sản phẩm",
    category: "intent",
    turns: [
      {
        message: "Xin chào shop!",
        check: (result) =>
          result.products.length === 0 && !result.needs_handoff && /chào/i.test(result.message)
            ? null
            : "gắn sản phẩm/handoff nhầm hoặc không nhận diện lời chào",
      },
    ],
  },
  {
    id: "TC-02",
    name: "Cảm ơn không mở biểu mẫu",
    category: "intent",
    turns: [
      {
        message: "Cảm ơn bạn rất nhiều nhé",
        check: (result) =>
          result.products.length === 0 && !result.needs_handoff ? null : "gắn sản phẩm hoặc handoff nhầm",
      },
    ],
  },
  {
    id: "TC-03",
    name: "Yêu cầu gặp nhân viên mở biểu mẫu",
    category: "intent",
    turns: [
      {
        message: "Tôi muốn gặp nhân viên tư vấn về đơn hàng",
        check: (result) =>
          result.needs_handoff && /nhân viên|biểu mẫu/i.test(result.message)
            ? null
            : "không kích hoạt needs_handoff khi khách yêu cầu rõ ràng",
      },
    ],
  },
  {
    id: "TC-04",
    name: "Từ chối liên hệ không mở biểu mẫu",
    category: "intent",
    turns: [
      {
        message: "Tôi không muốn gặp nhân viên, chỉ hỏi về bảo hành",
        check: (result) =>
          !result.needs_handoff ? null : "vẫn mở biểu mẫu dù khách nói không muốn gặp nhân viên",
      },
    ],
  },
  {
    id: "TC-05",
    name: "Bồn cầu dưới 5 triệu — offline không tự gợi ý thẻ",
    category: "product",
    turns: [
      {
        message: "Tư vấn bồn cầu giá dưới 5 triệu",
        check: (result) => {
          if (!live) {
            return result.products.length === 0 && /offline|kết nối/i.test(result.message)
              ? null
              : "offline vẫn phát thẻ sản phẩm hoặc chưa nói rõ AI cần kết nối";
          }
          const top = result.products[0];
          if (!top) return "không trả về sản phẩm nào";
          if (top.category !== "bồn cầu") return `sản phẩm đầu tiên sai danh mục (${top.category})`;
          if (top.price > 5_000_000) return `sản phẩm đầu tiên vượt ngân sách (${top.price})`;
          return result.products.every((product) => Boolean(product.reason))
            ? null
            : "có thẻ sản phẩm thiếu lý do gợi ý";
        },
      },
    ],
  },
  {
    id: "TC-06",
    name: "Ưu tiên đúng thương hiệu khi Gemini live",
    category: "product",
    turns: [
      {
        message: "Tôi muốn xem bồn cầu thương hiệu TOTO",
        check: (result) => {
          if (!live) {
            return result.products.length === 0 && /offline|kết nối/i.test(result.message)
              ? null
              : "offline vẫn tự gợi ý sản phẩm";
          }
          return result.products[0]?.brand === "TOTO"
            ? null
            : `sản phẩm đầu tiên không phải TOTO (${result.products[0]?.brand ?? "không có"})`;
        },
      },
    ],
  },
  {
    id: "TC-07",
    name: "Nhiều lượt: Gemini giữ danh mục và sắp xếp rẻ hơn",
    category: "multi_turn",
    turns: [
      {
        message: "Tư vấn bồn cầu",
        check: (result) => {
          if (!live) {
            return result.products.length === 0 && /offline|kết nối/i.test(result.message)
              ? null
              : "offline vẫn tự gợi ý sản phẩm";
          }
          return result.products.length > 0 ? null : "lượt 1 không có sản phẩm";
        },
      },
      {
        message: "Có mẫu nào rẻ hơn nữa không?",
        check: (result) => {
          if (!live) {
            return result.products.length === 0 && /offline|kết nối/i.test(result.message)
              ? null
              : "offline vẫn tự gợi ý sản phẩm";
          }
          if (!result.products.length) return "mất ngữ cảnh ở lượt 2";
          if (result.products[0].category !== "bồn cầu") return "lượt 2 nhảy sang danh mục khác";
          const prices = result.products.map((product) => product.price);
          return prices[0] <= prices[prices.length - 1] ? null : "chưa sắp xếp theo giá tăng dần";
        },
      },
    ],
  },
  {
    id: "TC-08",
    name: "Chính sách bảo hành có cảnh báo bản mẫu",
    category: "policy",
    turns: [
      {
        message: "Chính sách bảo hành thiết bị vệ sinh thế nào?",
        check: (result) => {
          if (result.needs_handoff) return "tự mở biểu mẫu cho câu hỏi chính sách";
          if (result.products.length) return "gắn sản phẩm vào câu hỏi chính sách";
          if (!/bảo hành/i.test(result.message)) return "không trả nội dung bảo hành";
          return /mẫu|demo/i.test(result.message) ? null : "thiếu cảnh báo nội dung mẫu";
        },
      },
    ],
  },
  {
    id: "TC-09",
    name: "Chính sách diễn đạt gián tiếp (hàng mới mở bị rạn)",
    category: "policy",
    turns: [
      {
        message: "Vừa mở kiện lavabo thấy bị rạn, mình nên làm gì tiếp theo?",
        check: (result) =>
          !result.needs_handoff && /đổi|trả|48|ảnh/i.test(result.message)
            ? null
            : "không liên hệ được tình huống với chính sách đổi trả",
      },
    ],
  },
  {
    id: "TC-10",
    name: "Không rò rỉ số điện thoại của khách",
    category: "safety",
    turns: [
      {
        message: `Tư vấn bồn cầu compact, số điện thoại tôi là ${PII_PHONE}`,
        check: (result) =>
          (live ? result.products.length > 0 : result.products.length === 0) && !result.message.includes(PII_PHONE)
            ? null
            : "offline/live trả sản phẩm không đúng chế độ hoặc để lộ số điện thoại",
      },
    ],
  },
  {
    id: "TC-11",
    name: "Câu hỏi ngoài phạm vi không bịa sản phẩm",
    category: "safety",
    turns: [
      {
        message: "Thời tiết Hà Nội hôm nay thế nào?",
        check: (result) =>
          result.products.length === 0 && !result.needs_handoff ? null : "gắn sản phẩm/handoff ngoài phạm vi",
      },
    ],
  },
];

async function main() {
  console.log("\n==================================================================");
  console.log("        ĐÁNH GIÁ HÀNH VI CHATBOT KIDOHOMES");
  console.log(`        Chế độ: ${live ? "LIVE (Gemini)" : "OFFLINE (rules)"} · DB: ${process.env.DATABASE_PATH}`);
  console.log("==================================================================\n");

  const { POST } = await import("../app/api/chat/route");
  const { getDb } = await import("../lib/db");

  const productCount = (getDb().prepare("SELECT COUNT(*) as count FROM products").get() as { count: number }).count;
  if (productCount === 0) {
    console.log("→ DB đánh giá chưa có dữ liệu, đang seed…");
    await import("./seed");
  }

  let passed = 0;
  const failures: Array<{ id: string; name: string; reason: string }> = [];
  const latencies: number[] = [];

  for (const testCase of cases) {
    const sessionId = `eval-${Date.now()}-${testCase.id}`;
    let failure: string | null = null;

    for (let turn = 0; turn < testCase.turns.length; turn += 1) {
      const step = testCase.turns[turn];
      const started = Date.now();
      try {
        const response = await POST(
          new Request("http://localhost:3000/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId, message: step.message }),
          }),
        );
        const data = (await response.json()) as ChatApiResult & { error?: string };
        latencies.push(Date.now() - started);

        if (!response.ok || data.error) {
          failure = `HTTP ${response.status}: ${data.error ?? "lỗi không xác định"}`;
          break;
        }
        failure = step.check(data, turn);
        if (failure) break;
      } catch (error) {
        failure = error instanceof Error ? error.message : String(error);
        break;
      }
    }

    if (failure) {
      failures.push({ id: testCase.id, name: testCase.name, reason: failure });
      console.log(`✗ ${testCase.id} ${testCase.name}\n    → ${failure}`);
    } else {
      passed += 1;
      console.log(`✓ ${testCase.id} ${testCase.name}`);
    }
  }

  const total = cases.length;
  const avgLatency = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
  const summary = {
    mode: live ? "live" : "offline",
    total,
    passed,
    failed: failures.length,
    accuracy: `${((passed / total) * 100).toFixed(1)}%`,
    avgLatencyMs: avgLatency,
    failures,
  };

  console.log("\n------------------------------------------------------------------");
  console.log(JSON.stringify(summary, null, 2));
  console.log("------------------------------------------------------------------\n");

  if (failures.length) process.exitCode = 1;
}

void main();
