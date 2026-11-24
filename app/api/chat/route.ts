// ─────────────────────────────────────────────────────────────────
// Chat API
//
// Luồng chính (LLM_MODE=live):
//   câu hỏi + lịch sử + index catalog + tài liệu chính sách ĐÃ TRUY XUẤT
//   → Gemini trả JSON có mã SKU → hệ thống tra SKU và render thẻ sản phẩm.
//
// Luồng offline (mock / thiếu API key): luật từ khóa trong `lib/chat-rules.ts`.
//
// Giao thức trả về:
//   - JSON (mặc định)          → dùng cho eval, script, client cũ.
//   - NDJSON khi `Accept: application/x-ndjson` → gửi trạng thái ngay + heartbeat,
//     sau đó gói `final`; giúp UI không bị "đứng im" trong lúc chờ model.
// ─────────────────────────────────────────────────────────────────
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  extractProductSku,
  getCatalogPromptSummary,
  getProductBySku,
  getProductsByIds,
  getProductsBySkus,
} from "@/lib/search";
import {
  buildReason,
  estimateMatchConfidence,
  filterProductsByCriteria,
  hasProductCriteria,
  mergeCriteria,
  parseSearchQuery,
} from "@/lib/criteria";
import {
  isGratitude,
  isGreeting,
  isHandoffRequest,
  isPolicyQuestion,
  isProductRequest,
  isRefinement,
} from "@/lib/chat-rules";
import { SAMPLE_POLICY_NOTICE, findRelevantKnowledge, getPolicyContext, type PolicyContext } from "@/lib/knowledge";
import { sanitizeFollowUpQuestions, findDegenerateRepetition, trimDegenerateRepetition } from "@/lib/chat-utils";
import { logError, logEvent } from "@/lib/log";
import { getGeminiDailyQuotaCooldownMs, isLiveMode, consultWithGemini } from "@/lib/llm";
import { rateLimit, requestKey } from "@/lib/rate-limit";
import { chatRequestSchema, type AiConsultantResult, type ChatMessageMeta, type ChatPayload } from "@/lib/schemas";
import { normalizeVietnamese } from "@/lib/text";
import type { Product, ProductSummary, SearchCriteria } from "@/lib/types";

const CHAT_RATE_LIMIT = Number(process.env.CHAT_RATE_LIMIT ?? 20);
const HANDOFF_REPLY =
  "Tôi sẽ chuyển yêu cầu cho nhân viên Kidohomes. Vui lòng điền thông tin vào biểu mẫu bên dưới.";

const FALLBACK_NOTICE =
  "⚠️ *Gemini hiện chưa kết nối được. Chế độ offline vẫn tra cứu chính sách, nhưng tạm ngưng tự động chọn sản phẩm.*";

function formatWaitTime(milliseconds: number) {
  const totalMinutes = Math.max(1, Math.ceil(milliseconds / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} phút`;
  return minutes ? `${hours} giờ ${minutes} phút` : `${hours} giờ`;
}

type HistoryTurn = { role: "user" | "assistant"; text: string; recommendations?: ProductSummary[] };

function summarize(products: Product[], criteria: SearchCriteria): ProductSummary[] {
  return products.map((product) => ({
    id: product.id,
    sku: product.sku,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    category: product.category,
    price: product.price,
    original_price: product.original_price,
    short_description: product.short_description,
    in_stock: product.in_stock,
    image_placeholder_key: product.image_placeholder_key,
    reason: buildReason(product, criteria),
    ...(hasProductCriteria(criteria) ? { match_confidence: estimateMatchConfidence(product, criteria) } : {}),
  }));
}

/** Bổ sung SKU cho thẻ chat cũ đã lưu trước khi mã sản phẩm được đưa vào metadata. */
function includeProductCodes(summaries: ProductSummary[]): ProductSummary[] {
  const missingCodes = summaries.filter((product) => !product.sku?.trim());
  if (!missingCodes.length) return summaries;

  const skuById = new Map(getProductsByIds(missingCodes.map((product) => product.id)).map((product) => [product.id, product.sku]));
  return summaries.map((product) => ({
    ...product,
    sku: product.sku?.trim() || skuById.get(product.id),
  }));
}

function loadHistory(sessionId: string, limit: number): HistoryTurn[] {
  const rows = getDb()
    .prepare(
      "SELECT role, message, meta FROM chat_history WHERE session_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?",
    )
    .all(sessionId, limit) as Array<{ role: "user" | "assistant"; message: string; meta: string | null }>;
  return rows.reverse().map((row) => {
    let recommendations: ProductSummary[] | undefined;
    if (row.role === "assistant" && row.meta) {
      try {
        const meta = JSON.parse(row.meta) as { products?: ProductSummary[] };
        if (Array.isArray(meta.products)) {
          recommendations = includeProductCodes(meta.products as ProductSummary[]).slice(0, 5);
        }
      } catch {
        // Bỏ qua metadata hỏng; phần văn bản hội thoại vẫn dùng được.
      }
    }
    return { role: row.role, text: row.message, recommendations };
  });
}

function policyQuestionReply(message: string) {
  const policy = findRelevantKnowledge(message);
  const notice = policy.isSample
    ? "⚠️ *Nội dung chính sách dưới đây là bản mẫu của demo, chưa được Kidohomes xác nhận.*\n\n"
    : policy.available
      ? "📋 Thông tin tham khảo theo tài liệu chính sách.\n\n"
      : "";
  return `${notice}${policy.text}`;
}

/** Suy ra tiêu chí tích luỹ từ các lượt trước để quyết định có nạp catalog cho Gemini không. */
function criteriaFromHistory(history: HistoryTurn[]): SearchCriteria {
  let previous: SearchCriteria = { features: [] };
  const userTurns = history.filter((turn) => turn.role === "user").slice(-8);

  for (let index = userTurns.length - 1; index >= 0; index -= 1) {
    const normalized = normalizeVietnamese(userTurns[index].text);
    const criteria = parseSearchQuery(userTurns[index].text);
    const mixedSocialTurn =
      (isGreeting(normalized) || isGratitude(normalized)) &&
      (hasProductCriteria(criteria) || isProductRequest(normalized) || isRefinement(normalized));
    if (
      isPolicyQuestion(normalized) ||
      isHandoffRequest(normalized) ||
      ((isGreeting(normalized) || isGratitude(normalized)) && !mixedSocialTurn)
    ) break;

    if (hasProductCriteria(criteria)) {
      previous = mergeCriteria(criteria, previous);
      if (criteria.category) break;
    } else if (isRefinement(normalized) || isProductRequest(normalized)) {
      continue;
    } else {
      break;
    }
  }
  return previous;
}

type OfflineReply = {
  text: string;
  needsHandoff: boolean;
  followUps: string[];
  products: ProductSummary[];
};

function buildOfflineReply(input: { message: string; normalized: string }): OfflineReply {
  const { message, normalized } = input;
  const reply: OfflineReply = { text: "", needsHandoff: false, followUps: [], products: [] };

  if (isHandoffRequest(normalized)) {
    reply.text = HANDOFF_REPLY;
    reply.needsHandoff = true;
    return reply;
  }

  const currentCriteria = parseSearchQuery(message);
  const hasProductIntent =
    hasProductCriteria(currentCriteria) || isProductRequest(normalized) || isRefinement(normalized);
  const standaloneGreeting = isGreeting(normalized) && !hasProductIntent && !isPolicyQuestion(normalized);
  const standaloneGratitude = isGratitude(normalized) && !hasProductIntent && !isPolicyQuestion(normalized);

  if (standaloneGreeting) {
    reply.text =
      "Xin chào! 👋 Tôi là trợ lý Kidohomes. Khi AI đang kết nối, tôi có thể tư vấn sản phẩm theo nhu cầu của bạn.";
    reply.followUps = ["Chính sách bảo hành", "Điều kiện đổi trả", "Gặp nhân viên tư vấn"];
    return reply;
  }

  if (standaloneGratitude) {
    reply.text = "Rất vui được hỗ trợ bạn! 😊";
    reply.followUps = ["Hỏi về chính sách bảo hành", "Gặp nhân viên tư vấn"];
    return reply;
  }

  if (isPolicyQuestion(normalized)) {
    reply.text = policyQuestionReply(message);
    reply.followUps = ["Điều kiện nào không được bảo hành?", "Cần chuẩn bị gì khi yêu cầu bảo hành?"];
    return reply;
  }

  if (hasProductIntent) {
    reply.text =
      "Hiện chế độ offline không tự chọn hoặc gợi ý sản phẩm. Bạn có thể xem mục Sản phẩm trên website, hoặc nhắn khi chatbot AI kết nối lại để được gợi ý theo mã sản phẩm.";
    reply.followUps = ["Gặp nhân viên tư vấn", "Hỏi chính sách bảo hành"];
    return reply;
  }

  reply.text =
    "Tôi có thể tra cứu các chính sách có trong tài liệu. Tư vấn và chọn sản phẩm theo mã cần chatbot AI kết nối.";
  reply.followUps = ["Hỏi về bảo hành", "Hỏi về đổi trả", "Gặp nhân viên tư vấn"];
  return reply;
}
type ConsultantOutcome = {
  text: string;
  needsHandoff: boolean;
  followUps: string[];
  products: ProductSummary[];
};

/**
 * Biến kết quả Gemini thành nội dung hiển thị và tra thẻ sản phẩm bằng mã SKU.
 */
function applyConsultantResult(input: {
  aiResult: AiConsultantResult;
  policy: PolicyContext;
  message: string;
  sessionId: string;
  criteria: SearchCriteria;
}): ConsultantOutcome {
  const { aiResult, policy, message, sessionId, criteria } = input;
  const needsHandoff = aiResult.handoff_requested;
  const isPolicyAnswer = aiResult.intent === "policy" || aiResult.is_policy_answer;

  let text = "";
  let answeredFromDocument = false;

  if (needsHandoff) {
    text = HANDOFF_REPLY;
  } else {
    const rawReply = aiResult.reply.slice(0, 4000);
    const repetition = findDegenerateRepetition(rawReply);

    if (repetition.degenerate) {
      logEvent("llm_degenerate_reply", {
        session: sessionId.slice(0, 8),
        at: repetition.index,
        repeats: repetition.repeats,
        unit: repetition.unit.slice(0, 40),
        policyAnswer: isPolicyAnswer,
      });

      if (isPolicyAnswer && policy.matched) {
        // Model kẹt vòng lặp khi tóm tắt chính sách → trả thẳng tài liệu đã truy xuất.
        text = policyQuestionReply(message);
        answeredFromDocument = true;
      } else {
        text = trimDegenerateRepetition(rawReply);
      }
    } else {
      text = rawReply;
    }
  }

  if (!answeredFromDocument && policy.matched && policy.isSample && isPolicyAnswer) {
    text = `${SAMPLE_POLICY_NOTICE}\n\n${text}`;
  }

  let products: ProductSummary[] = [];
  if (!needsHandoff && aiResult.recommended_product_codes.length > 0) {
    const requestedCodes = aiResult.recommended_product_codes.slice(0, 4);
    const exactSkuMatches = getProductsBySkus(requestedCodes);
    const eligibleProducts = filterProductsByCriteria(exactSkuMatches, criteria);
    products = summarize(eligibleProducts, criteria);
    if (exactSkuMatches.length !== requestedCodes.length || eligibleProducts.length !== exactSkuMatches.length) {
      text = eligibleProducts.length > 0
        ? `Mẫu đạt đủ tiêu chí: ${eligibleProducts.map((product) => `${product.name} (${product.sku})`).join(", ")}. Các mã còn lại đã được loại vì không xác minh được hoặc không đạt bộ lọc.`
        : hasProductCriteria(criteria)
          ? "Chưa có sản phẩm nào trong catalog mẫu đáp ứng đồng thời tất cả tiêu chí. Mình không đưa ra phương án gần nhất."
          : "Không xác minh được mã sản phẩm trong catalog mẫu nên chưa thể hiển thị thẻ sản phẩm.";
    }
  } else if (aiResult.intent === "product" && hasProductCriteria(criteria) && !aiResult.clarification_needed) {
    text = "Chưa có sản phẩm nào trong catalog mẫu đáp ứng đồng thời tất cả tiêu chí. Mình không đưa ra phương án gần nhất.";
  }

  return { text, needsHandoff, followUps: aiResult.follow_up_questions, products };
}

async function handleChat(input: {
  sessionId: string;
  message: string;
  signal?: AbortSignal;
  onDelta?: (text: string) => void;
}): Promise<ChatPayload> {
  const { sessionId, message, signal, onDelta } = input;
  const started = Date.now();
  const normalized = normalizeVietnamese(message);
  const exactSku = extractProductSku(message);
  const db = getDb();

  const history = loadHistory(sessionId, 12);

  // Lưu câu hỏi TRƯỚC khi gọi model: nếu model timeout/lỗi thì lịch sử vẫn còn.
  db.prepare("INSERT INTO chat_history (id, session_id, role, message) VALUES (?, ?, 'user', ?)").run(
    randomUUID(),
    sessionId,
    message,
  );

  let responseText = "";
  let needsHandoff = false;
  let followUpQuestions: string[] = [];
  let products: ProductSummary[] = [];
  const live = isLiveMode();
  let mode: ChatPayload["mode"] = live ? "live" : "mock";

  if (exactSku) {
    const product = getProductBySku(exactSku);
    const skuCriteria = parseSearchQuery(message);
    const eligibleProduct = product && filterProductsByCriteria([product], skuCriteria).length > 0 ? product : null;
    mode = "mock";
    if (eligibleProduct) {
      responseText = `Mã ${eligibleProduct.sku} khớp chính xác với sản phẩm ${eligibleProduct.name}.`;
      const [summary] = summarize([eligibleProduct], skuCriteria);
      products = [{ ...summary, reason: `Khớp chính xác mã sản phẩm ${eligibleProduct.sku}.`, match_confidence: "full" }];
      followUpQuestions = ["Thông số sản phẩm này", "Chính sách bảo hành"];
    } else if (product) {
      responseText = `Mã ${product.sku} là chính xác, nhưng sản phẩm không khớp các tiêu chí đi kèm. Mình không hiển thị phương án gần nhất.`;
      followUpQuestions = ["Tra mã SKU khác", "Nới tiêu chí tìm kiếm"];
    } else {
      responseText = `Không tìm thấy sản phẩm có mã ${exactSku}. Mình không hiển thị sản phẩm gần giống; hãy kiểm tra lại mã SKU.`;
      followUpQuestions = ["Xem cách tìm mã sản phẩm", "Gặp nhân viên tư vấn"];
    }
    logEvent("chat_sku_lookup", {
      session: sessionId.slice(0, 8),
      found: Boolean(product),
    });
  } else if (live) {
    // Nạp đúng loại ngữ cảnh: tối đa 2 tài liệu chính sách và catalog chỉ cho lượt cần tư vấn sản phẩm.
    const policy = getPolicyContext(message);
    const currentCriteria = parseSearchQuery(message);
    const previousCriteria = criteriaFromHistory(history);
    const hasProductContext =
      hasProductCriteria(previousCriteria) || history.some((turn) => Boolean(turn.recommendations?.length));
    const refersToPreviousProduct =
      hasProductContext && /(?:mau nay|mau do|san pham nay|loai nay|cai nay|mau vua goi y|san pham vua goi y)/.test(normalized);
    const isStandaloneSocialTurn =
      (isGreeting(normalized) || isGratitude(normalized)) &&
      !hasProductCriteria(currentCriteria) &&
      !isProductRequest(normalized) &&
      !isPolicyQuestion(normalized) &&
      !isRefinement(normalized) &&
      !refersToPreviousProduct;
    const isStandalonePolicyTurn =
      isPolicyQuestion(normalized) &&
      policy.matched &&
      !hasProductCriteria(currentCriteria) &&
      !isProductRequest(normalized) &&
      !isRefinement(normalized) &&
      !refersToPreviousProduct;

    if (isStandaloneSocialTurn || isHandoffRequest(normalized) || isStandalonePolicyTurn) {
      const local = buildOfflineReply({ message, normalized });
      if (isGreeting(normalized) && isStandaloneSocialTurn) {
        local.text = "Xin chào! Tôi là trợ lý Kidohomes. Hãy cho tôi biết bạn cần loại thiết bị nào, ngân sách và diện tích phòng để tôi tìm sản phẩm theo mã.";
        local.followUps = ["Bồn cầu dưới 5 triệu", "Sen tắm cho phòng nhỏ", "Chính sách bảo hành"];
      } else if (isGratitude(normalized) && isStandaloneSocialTurn) {
        local.text = "Rất vui được hỗ trợ bạn! Bạn có thể hỏi thêm về sản phẩm hoặc chính sách bất cứ lúc nào.";
        local.followUps = ["Tìm sản phẩm phù hợp", "Hỏi về chính sách bảo hành"];
      }
      responseText = local.text;
      needsHandoff = local.needsHandoff;
      followUpQuestions = local.followUps;
      products = local.products;
      logEvent("chat_local_fast_path", {
        session: sessionId.slice(0, 8),
        reason: isHandoffRequest(normalized)
          ? "handoff"
          : isStandalonePolicyTurn
            ? "policy_document"
            : isGreeting(normalized)
              ? "greeting"
              : "gratitude",
      });
    } else {
      const needsCatalog =
        !isHandoffRequest(normalized) &&
        !isStandaloneSocialTurn &&
        (hasProductCriteria(currentCriteria) ||
          (isProductRequest(normalized) && (!policy.matched || !isPolicyQuestion(normalized))) ||
          (hasProductContext && (!policy.matched || isRefinement(normalized) || refersToPreviousProduct)));
      const catalogSummary = needsCatalog ? getCatalogPromptSummary() : "";
      const quotaCooldownBeforeRequest = getGeminiDailyQuotaCooldownMs();
      const aiResult = quotaCooldownBeforeRequest > 0
        ? null
        : await consultWithGemini({
            query: message,
            history: history.slice(-8),
            catalogSummary,
            policyText: policy.matched ? policy.text : undefined,
            signal,
            // Product text is shown only after SKU and hard-filter validation.
            onDelta: needsCatalog ? undefined : onDelta,
          });

      if (!aiResult) {
        // Gemini timeout, lỗi hoặc hết quota: fallback offline không tự chọn sản phẩm.
        const fallback = buildOfflineReply({ message, normalized });
        mode = "fallback";
        const quotaCooldownRemaining = getGeminiDailyQuotaCooldownMs();
        const dailyQuotaExhausted = quotaCooldownRemaining > 0;
        logEvent("chat_fallback", {
          session: sessionId.slice(0, 8),
          reason: dailyQuotaExhausted ? "daily_quota" : "llm_unavailable",
          products: fallback.products.length,
          policy: policy.matched,
        });
        const notice = dailyQuotaExhausted
          ? `⚠️ *Gemini đã hết hạn mức API trong ngày nên tính năng tự động chọn sản phẩm đang tạm ngưng. Hệ thống sẽ thử lại sau khoảng ${formatWaitTime(quotaCooldownRemaining)}.*`
          : FALLBACK_NOTICE;
        responseText = `${notice}\n\n${fallback.text}`;
        needsHandoff = fallback.needsHandoff;
        followUpQuestions = fallback.followUps;
        products = fallback.products;
      } else {
        const recommendationCriteria = mergeCriteria(previousCriteria, currentCriteria);
        const outcome = applyConsultantResult({
          aiResult,
          policy,
          message,
          sessionId,
          criteria: recommendationCriteria,
        });
        responseText = outcome.text;
        needsHandoff = outcome.needsHandoff;
        followUpQuestions = outcome.followUps;
        products = outcome.products;
      }
    }
  } else {
    const offline = buildOfflineReply({ message, normalized });
    responseText = offline.text;
    needsHandoff = offline.needsHandoff;
    followUpQuestions = offline.followUps;
    products = offline.products;
  }

  followUpQuestions = sanitizeFollowUpQuestions(followUpQuestions, responseText);

  const meta: ChatMessageMeta = { products, follow_up_questions: followUpQuestions };
  db.transaction(() => {
    db.prepare("INSERT INTO chat_history (id, session_id, role, message, meta) VALUES (?, ?, 'assistant', ?, ?)").run(
      randomUUID(),
      sessionId,
      responseText,
      JSON.stringify(meta),
    );
    if (needsHandoff) {
      db.prepare(
        `INSERT INTO chat_sessions (session_id, handoff_pending) VALUES (?, 1)
         ON CONFLICT(session_id) DO UPDATE SET handoff_pending = 1`,
      ).run(sessionId);
    } else {
      // Không ghi đè trạng thái chờ handoff đang bật.
      db.prepare(
        `INSERT INTO chat_sessions (session_id, handoff_pending) VALUES (?, 0)
         ON CONFLICT(session_id) DO NOTHING`,
      ).run(sessionId);
    }
  })();

  pruneOldChatHistory();

  const payload: ChatPayload = {
    message: responseText,
    products,
    product_ids: products.map((product) => product.id),
    needs_handoff: needsHandoff,
    follow_up_questions: followUpQuestions,
    mode,
  };

  logEvent("chat_done", {
    session: sessionId.slice(0, 8),
    mode: payload.mode,
    latencyMs: Date.now() - started,
    products: products.length,
    handoff: needsHandoff,
    messageChars: message.length,
  });

  return payload;
}

const globalForPrune = globalThis as unknown as { __kidohomesLastPrune?: number };

/** Dọn lịch sử chat cũ (giữ tối đa 30 ngày), chạy tối đa 1 lần/giờ. */
function pruneOldChatHistory() {
  const now = Date.now();
  if (globalForPrune.__kidohomesLastPrune && now - globalForPrune.__kidohomesLastPrune < 3_600_000) return;
  globalForPrune.__kidohomesLastPrune = now;
  try {
    getDb().prepare("DELETE FROM chat_history WHERE created_at < datetime('now', '-30 days')").run();
    getDb().prepare("DELETE FROM chat_sessions WHERE created_at < datetime('now', '-30 days')").run();
  } catch (error) {
    logError("chat_prune_failed", error);
  }
}

// ════════════════════════════════════════════════════════════════
//  GET – lấy lịch sử chat (kèm metadata để dựng lại thẻ sản phẩm)
// ════════════════════════════════════════════════════════════════
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("status") === "1") {
    const cooldownMs = getGeminiDailyQuotaCooldownMs();
    const mode: ChatPayload["mode"] = !isLiveMode() ? "mock" : cooldownMs > 0 ? "fallback" : "live";
    return NextResponse.json(
      { mode, retry_after_seconds: Math.ceil(cooldownMs / 1000) },
      {
        headers: {
          "Cache-Control": "no-store",
          ...(cooldownMs > 0 ? { "Retry-After": String(Math.ceil(cooldownMs / 1000)) } : {}),
        },
      },
    );
  }

  const sessionId = url.searchParams.get("sessionId")?.trim();
  if (!sessionId || sessionId.length > 128) {
    return NextResponse.json({ error: "Phiên trò chuyện không hợp lệ." }, { status: 400 });
  }

  const rows = getDb()
    .prepare(
      "SELECT role, message, meta FROM chat_history WHERE session_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 30",
    )
    .all(sessionId) as Array<{ role: "user" | "assistant"; message: string; meta: string | null }>;

  const session = getDb()
    .prepare("SELECT handoff_pending FROM chat_sessions WHERE session_id = ?")
    .get(sessionId) as { handoff_pending: number } | undefined;

  return NextResponse.json({
    messages: rows.reverse().map((row) => {
      let meta: ChatMessageMeta | null = null;
      if (row.meta) {
        try {
          meta = JSON.parse(row.meta) as ChatMessageMeta;
          if (Array.isArray(meta?.products)) {
            meta = {
              ...meta,
              products: includeProductCodes(meta.products as ProductSummary[]),
            };
          }
        } catch {
          meta = null;
        }
      }
      return { role: row.role, message: row.message, meta };
    }),
    needs_handoff: session?.handoff_pending === 1,
  });
}

// ════════════════════════════════════════════════════════════════
//  DELETE – đặt lại phiên
// ════════════════════════════════════════════════════════════════
export async function DELETE(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("sessionId")?.trim();
  if (!sessionId || sessionId.length > 128) {
    return NextResponse.json({ error: "Phiên trò chuyện không hợp lệ." }, { status: 400 });
  }

  const db = getDb();
  db.transaction(() => {
    db.prepare("DELETE FROM chat_history WHERE session_id = ?").run(sessionId);
    db.prepare("DELETE FROM chat_sessions WHERE session_id = ?").run(sessionId);
  })();

  return NextResponse.json({ success: true, message: "Đã làm mới phiên hội thoại." });
}

// ════════════════════════════════════════════════════════════════
//  POST – xử lý tin nhắn (JSON hoặc NDJSON)
// ════════════════════════════════════════════════════════════════
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Tin nhắn không hợp lệ." }, { status: 400 });
  }

  const { sessionId, message } = parsed.data;
  const limit = rateLimit(requestKey(request, "chat", sessionId), { limit: CHAT_RATE_LIMIT, windowMs: 60_000 });
  if (!limit.ok) {
    logEvent("chat_rate_limited", { session: sessionId.slice(0, 8) });
    return NextResponse.json(
      { error: "Bạn gửi hơi nhanh, vui lòng chờ một lát rồi thử lại." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  const wantsStream = (request.headers.get("accept") ?? "").includes("application/x-ndjson");
  if (!wantsStream) {
    try {
      return NextResponse.json(await handleChat({ sessionId, message, signal: request.signal }), {
        headers: { "Cache-Control": "no-store" },
      });
    } catch (error) {
      logError("chat_failed", error, { session: sessionId.slice(0, 8) });
      return NextResponse.json({ error: "Có lỗi khi xử lý tin nhắn. Vui lòng thử lại." }, { status: 500 });
    }
  }

  const encoder = new TextEncoder();
  let closed = false;
  const started = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(data)}\n`));
        } catch {
          closed = true;
        }
      };

      send({ type: "status", stage: "received" });
      const heartbeat = setInterval(() => send({ type: "status", stage: "thinking" }), 2500);

      try {
        const payload = await handleChat({
          sessionId,
          message,
          signal: request.signal,
          // Chữ hiện dần trong lúc model vẫn đang viết.
          onDelta: (text) => send({ type: "delta", text }),
        });
        send({ type: "final", payload, latencyMs: Date.now() - started });
      } catch (error) {
        logError("chat_stream_failed", error, { session: sessionId.slice(0, 8) });
        send({ type: "error", message: "Có lỗi khi xử lý tin nhắn. Vui lòng thử lại." });
      } finally {
        clearInterval(heartbeat);
        if (!closed) {
          closed = true;
          controller.close();
        }
      }
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
