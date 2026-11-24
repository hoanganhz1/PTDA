import Link from "next/link";
import ProductImage from "./product-image";
import type { MatchConfidence } from "@/lib/types";

export type ProductCardItem = {
  slug: string;
  sku?: string;
  name: string;
  brand: string;
  price: number;
  original_price?: number | null;
  category: string;
  color?: string;
  short_description: string;
  in_stock?: boolean;
  image_placeholder_key: string;
  reason?: string;
};

const confidenceStyles: Partial<Record<MatchConfidence, { label: string; className: string }>> = {
  full: { label: "Khớp đầy đủ", className: "bg-emerald-50 text-emerald-700" },
};

export default function ProductCard({
  product,
  matchConfidence,
}: {
  product: ProductCardItem;
  matchConfidence?: MatchConfidence;
}) {
  const confidence = matchConfidence ? confidenceStyles[matchConfidence] ?? null : null;

  return (
    <article className="group overflow-hidden rounded-[1.6rem] border border-stone-200/80 bg-white shadow-[0_8px_28px_-22px_rgba(15,23,42,0.35)] transition duration-300 hover:-translate-y-1 hover:border-stone-300 hover:shadow-[0_22px_45px_-28px_rgba(15,23,42,0.4)]">
      <Link href={`/san-pham/${product.slug}`} className="block">
        <ProductImage
          imageKey={product.image_placeholder_key}
          category={product.category}
          name={product.name}
          className="aspect-[4/3]"
          quality={75}
        />
      </Link>
      <div className="p-5">
        <div className="flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          <span>{product.brand}</span>
          <span className="truncate text-right font-medium tracking-normal text-slate-400">{product.category}</span>
        </div>
        {product.sku && (
          <p className="mt-1.5 font-mono text-[11px] font-semibold text-sky-800">
            <span className="font-sans font-medium text-slate-500">SKU </span>{product.sku}
          </p>
        )}
        <Link href={`/san-pham/${product.slug}`} className="mt-2 block">
          <h2 className="text-lg font-semibold leading-snug text-slate-900 transition group-hover:text-sky-800">
            {product.name}
          </h2>
        </Link>
        <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-slate-600">{product.short_description}</p>
        {product.reason && (
          <p className="mt-3 rounded-xl bg-sky-50 px-3 py-2 text-xs leading-relaxed text-sky-900">{product.reason}</p>
        )}
        <div className="mt-5 flex items-end justify-between gap-3 border-t border-stone-100 pt-4">
          <div>
            <div className="text-xl font-bold tracking-tight text-slate-900">
              {new Intl.NumberFormat("vi-VN").format(product.price)}₫
            </div>
            {product.original_price && product.original_price > product.price && (
              <div className="mt-0.5 text-xs text-slate-400 line-through">
                {new Intl.NumberFormat("vi-VN").format(product.original_price)}₫
              </div>
            )}
          </div>
          <Link
            href={`/san-pham/${product.slug}`}
            className="shrink-0 rounded-full bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-sky-800"
          >
            Xem chi tiết
          </Link>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {product.in_stock !== undefined && (
            <span className={`flex items-center gap-2 ${product.in_stock ? "text-emerald-700" : "text-amber-700"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${product.in_stock ? "bg-emerald-500" : "bg-amber-500"}`} />
              {product.in_stock ? "Còn hàng trong catalog demo" : "Liên hệ xác nhận tồn kho"}
            </span>
          )}
          {confidence && (
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${confidence.className}`}>
              {confidence.label}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
