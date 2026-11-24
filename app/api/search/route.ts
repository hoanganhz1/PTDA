import { NextResponse } from "next/server";
import { z } from "zod";
import { filterProductsByCriteria } from "@/lib/criteria";
import {
  extractProductSku,
  findProductsByCriteria,
  getProductBySku,
  hasProductCriteria,
  mergeCriteria,
  parseSearchQuery,
  searchProductsByText,
} from "@/lib/search";
import { logError, logEvent } from "@/lib/log";
import { rateLimit, requestKey } from "@/lib/rate-limit";
import { searchCriteriaSchema } from "@/lib/schemas";

/**
 * Tìm SKU chính xác trước, sau đó áp dụng tiêu chí và từ khóa catalog cục bộ.
 * Route này không gọi Gemini nên tìm kiếm liên tục không tiêu thụ quota model.
 */
const requestSchema = z.object({
  query: z.string().max(400).optional(),
  criteria: searchCriteriaSchema.partial().optional(),
});

const MAX_RESULTS = 8;

export async function POST(request: Request) {
  const limit = rateLimit(requestKey(request, "search"), { limit: 60, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Bạn tìm hơi nhanh, vui lòng chờ một lát." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu tìm kiếm không hợp lệ." }, { status: 400 });
  }

  const started = Date.now();

  try {
    const query = parsed.data.query ?? "";
    const sku = extractProductSku(query);
    if (sku) {
      const product = getProductBySku(sku);
      const queryCriteria = parseSearchQuery(query);
      const skuCriteria = parsed.data.criteria
        ? mergeCriteria(queryCriteria, { ...parsed.data.criteria, features: parsed.data.criteria.features ?? [] })
        : queryCriteria;
      const eligibleProduct = product && filterProductsByCriteria([product], skuCriteria).length > 0 ? product : null;
      const results = eligibleProduct
        ? [{ ...eligibleProduct, score: 1_000, reason: `Khớp chính xác mã sản phẩm ${eligibleProduct.sku}.`, match_confidence: "full" as const }]
        : [];
      const stats = { full: results.length, partial: 0, closest: 0 };
      const notice = !product
        ? `Không tìm thấy sản phẩm có mã ${sku}. Kiểm tra lại mã rồi thử lại.`
        : !eligibleProduct
          ? `Mã ${product.sku} tồn tại nhưng sản phẩm không khớp các tiêu chí đi kèm. Không hiển thị phương án gần nhất.`
          : undefined;
      const latencyMs = Date.now() - started;
      logEvent("search_done", {
        latencyMs,
        results: results.length,
        closest: 0,
        queryChars: query.length,
        matchedBy: "sku",
      });
      return NextResponse.json(
        {
          criteria: skuCriteria,
          results,
          stats,
          mode: "sku",
          matched_by: "sku",
          sku_conflict: Boolean(product && !eligibleProduct),
          latencyMs,
          notice,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const criteria = parsed.data.criteria
      ? mergeCriteria(parseSearchQuery(query), { ...parsed.data.criteria, features: parsed.data.criteria.features ?? [] })
      : parseSearchQuery(query);

    const hasCriteria = hasProductCriteria(criteria);
    const criteriaMatches = findProductsByCriteria(criteria);
    const textMatches = searchProductsByText(query, criteriaMatches, criteria);
    const ranked = textMatches ?? (hasCriteria ? criteriaMatches : []);
    const results = ranked.filter((item) => item.match_confidence === "full").slice(0, MAX_RESULTS);
    const matchedBy = textMatches !== null ? "text" : "criteria";

    const stats = {
      full: results.filter((item) => item.match_confidence === "full").length,
      partial: results.filter((item) => item.match_confidence === "partial").length,
      closest: results.filter((item) => item.match_confidence === "closest").length,
    };

    const notice =
      results.length === 0 && hasCriteria
        ? "Không có sản phẩm đáp ứng đồng thời mọi tiêu chí. Hãy bỏ bớt điều kiện bắt buộc hoặc chỉnh lại nhu cầu."
        : results.length === 0
          ? "Mình chưa nhận ra từ khóa sản phẩm. Nhập mã SKU, tên/mẫu sản phẩm hoặc nêu loại sản phẩm, hãng và ngân sách."
          : undefined;

    const latencyMs = Date.now() - started;
    logEvent("search_done", {
      latencyMs,
      results: results.length,
      closest: stats.closest,
      queryChars: query.length,
      matchedBy,
    });

    return NextResponse.json(
      { criteria, results, stats, mode: matchedBy === "text" ? "text" : "rules", matched_by: matchedBy, latencyMs, notice },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    logError("search_failed", error);
    return NextResponse.json({ error: "Không thể hoàn tất tìm kiếm." }, { status: 500 });
  }
}
