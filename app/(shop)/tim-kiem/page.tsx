"use client";

import { Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import ProductCard from "@/app/components/product-card";
import type { MatchConfidence } from "@/lib/types";

type SearchApiResult = {
  criteria?: Record<string, string | number | string[] | boolean | undefined>;
  stats?: { full: number; partial: number; closest: number };
  mode?: "rules" | "sku" | "text";
  matched_by?: "sku" | "text" | "criteria";
  sku_conflict?: boolean;
  latencyMs?: number;
  notice?: string;
  results?: Array<{
    id: string;
    sku?: string;
    slug: string;
    category: string;
    brand: string;
    color: string;
    price: number;
    original_price: number | null;
    name: string;
    short_description: string;
    image_placeholder_key: string;
    in_stock: boolean;
    reason: string;
    match_confidence: MatchConfidence;
  }>;
};

const criteriaLabels: Record<string, string> = {
  category: "Danh mục",
  brand: "Thương hiệu",
  color: "Màu",
  material: "Chất liệu",
  price_min: "Giá từ",
  price_max: "Giá đến",
  room_size: "Không gian",
  room_area_m2: "Diện tích",
  in_stock: "Tình trạng",
  features: "Tính năng",
};

const roomSizeLabels: Record<string, string> = { nho: "nhỏ", vua: "vừa", rong: "rộng" };

function formatCriteriaValue(key: string, value: string | number | string[] | boolean) {
  if (key === "room_size" && typeof value === "string") return roomSizeLabels[value] ?? value;
  if (key === "in_stock" && typeof value === "boolean") return value ? "Còn hàng" : "Hết hàng";
  if (key === "room_area_m2" && typeof value === "number") return `${value}m²`;
  if ((key === "price_min" || key === "price_max") && typeof value === "number") {
    return `${new Intl.NumberFormat("vi-VN").format(value)}đ`;
  }
  return Array.isArray(value) ? value.join(", ") : String(value);
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-12 text-sm text-slate-600 sm:px-6">Đang chuẩn bị tìm kiếm…</div>
      }
    >
      <SearchPageInner />
    </Suspense>
  );
}

function SearchPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const initialQuery = params.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const [result, setResult] = useState<SearchApiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchVersion, setSearchVersion] = useState(0);
  const lastSyncedQuery = useRef(initialQuery);

  const syncUrl = useCallback(
    (value: string) => {
      if (!value || value === lastSyncedQuery.current) return;
      lastSyncedQuery.current = value;
      router.replace(`/tim-kiem?q=${encodeURIComponent(value)}`, { scroll: false });
    },
    [router],
  );

  useEffect(() => {
    const target = query.trim();
    if (!target) {
      // Xoá kết quả cũ khi ô tìm kiếm rỗng (đặt trong timer để không setState đồng bộ trong effect).
      const reset = window.setTimeout(() => {
        setResult(null);
        setLoading(false);
        setError("");
      }, 0);
      return () => window.clearTimeout(reset);
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: target }),
          signal: controller.signal,
        });
        const payload = (await response.json()) as SearchApiResult & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Không thể hoàn tất tìm kiếm.");
        setResult(payload);
        syncUrl(target);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Đã xảy ra lỗi khi tìm kiếm.");
        setResult(null);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query, searchVersion, syncUrl]);

  const criteriaChips = result?.criteria
    ? Object.entries(result.criteria).filter(
        ([key, value]) => key === "features"
          ? Array.isArray(value) && value.length > 0
          : value !== undefined && value !== null && value !== "",
      )
    : [];

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearchVersion((version) => version + 1);
  }

  function applySample(sample: string) {
    setQuery(sample);
    syncUrl(sample);
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="rounded-[2rem] bg-slate-950 px-5 py-8 text-white sm:px-9 sm:py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">Tìm bằng mô tả hoặc mã SKU</p>
        <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Mô tả điều bạn cần.
          <span className="block text-slate-300">Chỉ hiện sản phẩm đạt tiêu chí.</span>
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
          Mã SKU được tra chính xác. Danh mục, thương hiệu, khoảng giá, màu, chất liệu, tồn kho, diện tích và tính năng
          đều là bộ lọc bắt buộc. Mô tả “phòng nhỏ/vừa/rộng” cũng loại sản phẩm không phù hợp kích thước lắp đặt.
        </p>
        <form
          onSubmit={submitSearch}
          className="mt-6 flex flex-col gap-2 rounded-2xl border border-white/10 bg-white p-2 sm:flex-row"
        >
          <label className="sr-only" htmlFor="natural-search">
            Mô tả sản phẩm bạn đang tìm
          </label>
          <input
            id="natural-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-w-0 flex-1 rounded-xl px-4 py-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
            placeholder="Ví dụ: bồn cầu TOTO dưới 5 triệu · hoặc KDH-0001"
          />
          <button
            type="submit"
            className="rounded-xl bg-sky-800 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-sky-700"
          >
            Tìm sản phẩm
          </button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          {["Bồn cầu cho phòng nhỏ", "Lavabo dưới 5 triệu", "Sen cây tiết kiệm nước"].map((sample) => (
            <button
              key={sample}
              type="button"
              onClick={() => applySample(sample)}
              className="rounded-full border border-white/20 px-3.5 py-1.5 text-xs text-slate-200 transition hover:border-white/50 hover:bg-white/10"
            >
              {sample}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div
          role="status"
          className="mt-7 flex items-center gap-3 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm text-sky-900"
        >
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-800/20 border-t-sky-800" />
          Đang tìm lựa chọn phù hợp…
        </div>
      )}
      {error && (
        <div role="alert" className="mt-7 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error}{" "}
          <button
            type="button"
            onClick={() => setSearchVersion((version) => version + 1)}
            className="font-semibold underline underline-offset-2"
          >
            Thử lại
          </button>
        </div>
      )}

      {result && (
        <section aria-label="Kết quả tìm kiếm" aria-live="polite" className="mt-8">
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-800">
                {result.matched_by === "sku"
                  ? "Tra cứu mã sản phẩm"
                  : result.matched_by === "text"
                    ? "Khớp tên/mẫu sản phẩm"
                    : "Kết quả theo tiêu chí"}
              </p>
              <h2 className="mt-1 text-xl font-semibold">
                {result.results?.length ?? 0} {result.matched_by === "sku" ? "sản phẩm đúng mã" : "sản phẩm khớp"}
              </h2>
            </div>
            <Link
              href="/san-pham"
              className="text-sm font-medium text-slate-500 underline decoration-stone-300 underline-offset-4 hover:text-slate-900"
            >
              Xem toàn bộ catalog
            </Link>
          </div>

          {criteriaChips.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {criteriaChips.map(([key, value]) => (
                <span
                  key={key}
                  className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs text-slate-600"
                >
                  {criteriaLabels[key] ?? key.replaceAll("_", " ")}:{" "}
                  {formatCriteriaValue(key, value as string | number | string[] | boolean)}
                </span>
              ))}
            </div>
          )}

          {result.notice && (
            <p className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
              {result.notice}
            </p>
          )}

          {result.results?.length ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {result.results.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  matchConfidence={result.matched_by === "sku" ? undefined : product.match_confidence}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-stone-300 bg-white p-9 text-center">
              <h3 className="text-lg font-semibold">
                {result.matched_by === "sku"
                  ? result.sku_conflict
                    ? "Mã đúng nhưng tiêu chí không khớp"
                    : "Không tìm thấy mã sản phẩm"
                  : result.matched_by === "text"
                    ? "Không tìm thấy tên hoặc từ khóa này"
                    : "Chưa có sản phẩm khớp các tiêu chí"}
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                {result.matched_by === "sku"
                  ? result.sku_conflict
                    ? "Mã này tồn tại nhưng sản phẩm không thỏa các bộ lọc đi kèm. Hãy bỏ bớt tiêu chí để xem đúng sản phẩm theo mã."
                    : "Kiểm tra lại mã SKU, ví dụ KDH-0001."
                  : result.matched_by === "text"
                    ? "Thử tên mẫu, mã SKU hoặc mô tả loại sản phẩm cụ thể hơn."
                    : "Bỏ bớt điều kiện bắt buộc rồi tìm lại; chỉ sản phẩm đạt đủ tiêu chí mới được hiển thị."}
              </p>
            </div>
          )}

          {result.latencyMs !== undefined && (
            <p className="mt-5 text-right text-[11px] text-slate-400">Tìm xong trong {result.latencyMs} ms</p>
          )}
        </section>
      )}
    </section>
  );
}
