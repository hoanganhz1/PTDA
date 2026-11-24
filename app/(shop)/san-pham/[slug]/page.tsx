import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ProductImage from "@/app/components/product-image";
import ProductConsultButton from "@/app/components/product-consult-button";
import { getProductImageSrc } from "@/lib/product-images";
import { getProductBySlug } from "@/lib/search";
import { formatCurrency } from "@/lib/text";

type PageParams = { slug: string };

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateMetadata({ params }: { params: Promise<PageParams> }): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  if (!product) {
    return { title: "Không tìm thấy sản phẩm" };
  }

  const title = `${product.name} — ${product.brand}`;
  const description = `${product.short_description} Giá tham khảo ${formatCurrency(product.price)}.`;
  const image = getProductImageSrc(product.image_placeholder_key, product.category);

  return {
    title,
    description,
    alternates: { canonical: `/san-pham/${product.slug}` },
    openGraph: {
      title,
      description,
      type: "website",
      url: `/san-pham/${product.slug}`,
      images: [{ url: image, width: 1200, height: 630, alt: product.name }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function ProductDetailPage({ params }: { params: Promise<PageParams> }) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    brand: { "@type": "Brand", name: product.brand },
    category: product.category,
    description: product.short_description,
    image: [`${siteUrl}${getProductImageSrc(product.image_placeholder_key, product.category)}`],
    offers: {
      "@type": "Offer",
      priceCurrency: "VND",
      price: product.price,
      availability: product.in_stock ? "https://schema.org/InStock" : "https://schema.org/PreOrder",
      url: `${siteUrl}/san-pham/${product.slug}`,
      description: "Giá trong dữ liệu demo, cần xác nhận trước khi mua.",
    },
  };

  const specs: Array<[string, string]> = [
    ["Màu sắc", product.color],
    ["Chất liệu", product.material],
    [
      "Kích thước",
      `${product.dimensions_mm.width} × ${product.dimensions_mm.depth} × ${product.dimensions_mm.height} mm`,
    ],
    ["Diện tích phòng tối thiểu", `≥ ${product.min_room_area_m2} m²`],
    ["Bảo hành mẫu", `${product.warranty_months} tháng`],
    ["Mã sản phẩm", product.sku],
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <Link href="/san-pham" className="font-medium transition hover:text-sky-800">
          ← Trở lại danh mục
        </Link>
        <span aria-hidden="true" className="text-stone-300">
          /
        </span>
        <span className="text-slate-400">{product.category}</span>
      </nav>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10">
        <ProductImage
          imageKey={product.image_placeholder_key}
          category={product.category}
          name={product.name}
          className="aspect-[4/3] rounded-[2rem] lg:aspect-square"
          sizes="(max-width: 1024px) 100vw, 55vw"
          preload
        />

        <div className="flex flex-col rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_16px_50px_-40px_rgba(15,23,42,0.4)] sm:p-9">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-sky-900">
            <span>{product.category}</span>
            <span className="h-1 w-1 rounded-full bg-stone-300" />
            <span>{product.brand}</span>
          </div>
          <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-4xl">
            {product.name}
          </h1>
          <p className="mt-2 text-sm text-slate-500">Mã sản phẩm: {product.sku}</p>
          <p className="mt-5 text-base leading-7 text-slate-600">{product.short_description}</p>

          <div className="mt-7 border-y border-stone-100 py-5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-3xl font-bold tracking-tight text-slate-950">{formatCurrency(product.price)}</span>
              {product.original_price && product.original_price > product.price && (
                <span className="text-sm text-slate-400 line-through">{formatCurrency(product.original_price)}</span>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-400">Giá tham khảo trong dữ liệu demo, vui lòng xác nhận trước khi mua.</p>
          </div>

          <div className="mt-5 flex items-center gap-2 text-sm">
            <span className={`h-2 w-2 rounded-full ${product.in_stock ? "bg-emerald-500" : "bg-amber-500"}`} />
            <span className={product.in_stock ? "text-emerald-800" : "text-amber-800"}>
              {product.in_stock ? "Có hàng trong catalog demo" : "Tồn kho cần xác nhận"}
            </span>
          </div>

          <ul className="mt-6 flex flex-wrap gap-2">
            {product.features.map((feature) => (
              <li key={feature} className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-medium text-slate-700">
                {feature}
              </li>
            ))}
          </ul>

          <div className="mt-auto pt-8">
            <ProductConsultButton sku={product.sku} name={product.name} />
            <p className="mt-3 text-center text-xs text-slate-400">
              Catalog mẫu · Thông tin sản phẩm và giá chưa được xác thực.
            </p>
          </div>
        </div>
      </div>

      <section aria-labelledby="product-specs" className="mt-8 rounded-[2rem] border border-stone-200 bg-white p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-2 border-b border-stone-100 pb-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-800">Thông tin tham khảo</p>
            <h2 id="product-specs" className="mt-2 text-xl font-semibold">
              Chi tiết sản phẩm
            </h2>
          </div>
          <span className="text-xs text-slate-400">Thông số minh họa cho demo</span>
        </div>
        <dl className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
          {specs.map(([label, value]) => (
            <div key={label} className="border-b border-stone-100 py-4">
              <dt className="text-xs text-slate-500">{label}</dt>
              <dd className="mt-1.5 text-sm font-semibold text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </section>
  );
}
