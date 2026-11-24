import Image from "next/image";
import Link from "next/link";
import ProductCard from "@/app/components/product-card";
import { getAllProducts } from "@/lib/search";
import type { Product } from "@/lib/types";

const categories = [
  { name: "Bồn cầu", value: "bồn cầu", image: "bathroom-toilet.jpg", note: "Thiết kế gọn, tiện nghi" },
  { name: "Lavabo", value: "lavabo", image: "bathroom-vanity.jpg", note: "Tinh tế trong từng đường nét" },
  { name: "Sen tắm", value: "sen cây", image: "bathroom-shower.jpg", note: "Nâng tầm trải nghiệm mỗi ngày" },
];

export const revalidate = 300;

export default function HomePage() {
  const allProducts = getAllProducts();
  const featuredCategories = ["bồn cầu", "lavabo", "sen cây", "vòi lavabo", "bồn tắm", "phụ kiện phòng tắm"];
  const products = featuredCategories
    .map((category) => allProducts.find((product) => product.category === category))
    .filter((product): product is Product => product !== undefined);

  return (
    <main className="text-slate-900">
      <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1fr_0.9fr] lg:gap-16 lg:px-8 lg:py-20">
        <div className="py-2">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-sky-900/10 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-900 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-700" />
            Không gian sống, bắt đầu từ phòng tắm
          </p>
          <h1 className="max-w-2xl text-4xl font-semibold leading-[1.12] tracking-tight text-slate-950 sm:text-5xl lg:text-[3.8rem]">
            Chọn đúng thiết bị.
            <span className="mt-1 block font-serif font-normal italic text-sky-900">Tận hưởng mỗi ngày.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
            Tìm thiết bị vệ sinh theo ngân sách, diện tích và phong cách của bạn — hoặc trò chuyện với trợ lý Kidohomes để tìm phương án phù hợp.
          </p>

          <form action="/tim-kiem" className="mt-8 flex flex-col gap-2 rounded-2xl border border-stone-200 bg-white p-2 shadow-[0_18px_50px_-35px_rgba(15,23,42,0.5)] sm:flex-row">
            <label className="sr-only" htmlFor="home-product-search">Bạn đang tìm sản phẩm nào?</label>
            <input
              id="home-product-search"
              name="q"
              className="min-w-0 flex-1 rounded-xl bg-transparent px-4 py-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
              aria-label="Tìm kiếm sản phẩm"
              placeholder="Ví dụ: lavabo nhỏ gọn, màu trắng..."
            />
            <button className="rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-sky-800">
              Khám phá sản phẩm
            </button>
          </form>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="mr-1 font-medium text-slate-600">Thử tìm:</span>
            {["Bồn cầu cho phòng nhỏ", "Sen cây tiết kiệm nước", "Lavabo dưới 5 triệu"].map((query) => (
              <Link
                key={query}
                href={`/tim-kiem?q=${encodeURIComponent(query)}`}
                className="rounded-full border border-stone-200 bg-white px-3 py-1.5 transition hover:border-sky-800/30 hover:text-sky-900"
              >
                {query}
              </Link>
            ))}
          </div>
          <p className="mt-8 text-xs leading-5 text-slate-400">
            Catalog và giá trong phiên bản này là dữ liệu demo, chưa phải thông tin bán hàng chính thức.
          </p>
        </div>

        <div className="relative">
          <div className="absolute -right-3 -top-3 h-28 w-28 rounded-full border border-sky-900/10 sm:-right-5 sm:-top-5 sm:h-40 sm:w-40" />
          <div className="relative overflow-hidden rounded-[2rem] bg-stone-200 shadow-[0_35px_80px_-45px_rgba(15,23,42,0.45)]">
            <Image
              src="/product-images/bathroom-spa.jpg"
              alt="Không gian phòng tắm hiện đại với bồn tắm độc lập"
              width={1000}
              height={700}
              preload
              sizes="(max-width: 1024px) 100vw, 45vw"
              className="aspect-[4/3] w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/70 via-slate-950/15 to-transparent p-6 pt-24 text-white sm:p-8 sm:pt-28">
              <span className="text-xs font-medium uppercase tracking-[0.2em] text-white/75">Gợi ý không gian</span>
              <p className="mt-2 max-w-sm text-xl font-medium leading-snug sm:text-2xl">Một góc thư thái, dành riêng cho bạn.</p>
            </div>
          </div>
          <div className="absolute -bottom-5 left-4 rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-lg sm:left-8">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Khám phá dễ dàng</span>
            <span className="mt-1 block text-sm font-semibold text-slate-800">Tìm kiếm bằng ngôn ngữ tự nhiên</span>
          </div>
        </div>
      </section>

      <section className="border-y border-stone-200/80 bg-white/70">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="mb-7 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-800">Khám phá theo nhu cầu</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Danh mục nổi bật</h2>
            </div>
            <Link href="/san-pham" className="hidden text-sm font-semibold text-slate-600 transition hover:text-sky-800 sm:block">
              Tất cả danh mục <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {categories.map((category) => (
              <Link
                key={category.value}
                href={`/san-pham?category=${encodeURIComponent(category.value)}`}
                className="group relative overflow-hidden rounded-[1.5rem] bg-slate-900"
              >
                <Image
                  src={`/product-images/${category.image}`}
                  alt=""
                  width={700}
                  height={480}
                  sizes="(max-width: 640px) 100vw, 33vw"
                  className="aspect-[1.65/1] w-full object-cover opacity-80 transition duration-500 group-hover:scale-105 group-hover:opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-6">
                  <p className="text-xs font-medium text-white/70">{category.note}</p>
                  <h3 className="mt-1 text-2xl font-semibold">{category.name}</h3>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-800">Từ catalog mẫu</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Một vài lựa chọn đáng xem</h2>
          </div>
          <Link href="/san-pham" className="text-sm font-semibold text-slate-600 transition hover:text-sky-800">
            Xem tất cả <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      </section>
    </main>
  );
}
