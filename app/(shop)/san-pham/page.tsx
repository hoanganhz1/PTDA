import Link from "next/link";
import ProductCard from "@/app/components/product-card";
import { getAllProducts } from "@/lib/search";

type CatalogSearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePrice(value: string | undefined) {
  if (!value?.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function formatPrice(value: number) {
  return `${new Intl.NumberFormat("vi-VN").format(value)}₫`;
}

export default async function ProductCatalogPage({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}) {
  const query = await searchParams;
  const allProducts = getAllProducts();
  const categories = Array.from(new Set(allProducts.map((product) => product.category)));
  const brands = Array.from(new Set(allProducts.map((product) => product.brand))).sort((a, b) => a.localeCompare(b, "vi"));

  const requestedCategory = firstValue(query.category);
  const requestedBrand = firstValue(query.brand);
  const selectedCategory = categories.includes(requestedCategory ?? "") ? requestedCategory : undefined;
  const selectedBrand = brands.includes(requestedBrand ?? "") ? requestedBrand : undefined;
  let minPrice = parsePrice(firstValue(query.minPrice));
  let maxPrice = parsePrice(firstValue(query.maxPrice));
  const rangeWasReversed = minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice;
  if (rangeWasReversed) [minPrice, maxPrice] = [maxPrice, minPrice];

  const stock = firstValue(query.stock) === "available" ? "available" : "all";
  const requestedSort = firstValue(query.sort);
  const sort = requestedSort === "price-desc" || requestedSort === "name" ? requestedSort : "price-asc";

  const products = allProducts
    .filter((product) => !selectedCategory || product.category === selectedCategory)
    .filter((product) => !selectedBrand || product.brand === selectedBrand)
    .filter((product) => minPrice === undefined || product.price >= minPrice)
    .filter((product) => maxPrice === undefined || product.price <= maxPrice)
    .filter((product) => stock !== "available" || product.in_stock)
    .sort((a, b) => {
      if (sort === "price-desc") return b.price - a.price;
      if (sort === "name") return a.name.localeCompare(b.name, "vi");
      return a.price - b.price;
    });

  const retainedFilters = new URLSearchParams();
  if (selectedBrand) retainedFilters.set("brand", selectedBrand);
  if (minPrice !== undefined) retainedFilters.set("minPrice", String(minPrice));
  if (maxPrice !== undefined) retainedFilters.set("maxPrice", String(maxPrice));
  if (stock === "available") retainedFilters.set("stock", stock);
  if (sort !== "price-asc") retainedFilters.set("sort", sort);

  function categoryHref(category?: string) {
    const params = new URLSearchParams(retainedFilters);
    if (category) params.set("category", category);
    const suffix = params.toString();
    return suffix ? `/san-pham?${suffix}` : "/san-pham";
  }

  function removeFilterHref(key: string) {
    const params = new URLSearchParams(retainedFilters);
    if (selectedCategory) params.set("category", selectedCategory);
    params.delete(key);
    const suffix = params.toString();
    return suffix ? `/san-pham?${suffix}` : "/san-pham";
  }

  function filterChip(label: string, key: string) {
    return (
      <Link
        href={removeFilterHref(key)}
        aria-label={`Bỏ tiêu chí ${label}`}
        className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-slate-700 transition hover:bg-sky-50 hover:text-sky-900"
      >
        {label}<span aria-hidden="true" className="text-slate-400">×</span>
      </Link>
    );
  }

  const activeFilterCount = [selectedCategory, selectedBrand, minPrice, maxPrice, stock === "available" ? stock : undefined]
    .filter((value) => value !== undefined).length;
  const hasActiveOptions = activeFilterCount > 0 || sort !== "price-asc";

  return (
    <main className="text-slate-900">
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="flex flex-col justify-between gap-5 border-b border-stone-200 pb-8 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-800">Kidohomes · Catalog demo</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              {selectedCategory ? selectedCategory : "Thiết bị cho phòng tắm"}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Lọc theo danh mục, thương hiệu, ngân sách và tình trạng trong catalog. Hình ảnh và thông tin hiện là dữ liệu minh họa.
            </p>
          </div>
          <p className="text-sm text-slate-500">
            <span className="font-semibold text-slate-900">{products.length}</span> / {allProducts.length} sản phẩm
          </p>
        </div>

        <nav aria-label="Lọc theo danh mục" className="flex gap-2 overflow-x-auto py-5">
          <Link
            href={categoryHref()}
            aria-current={!selectedCategory ? "page" : undefined}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition ${
              !selectedCategory
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-stone-200 bg-white text-slate-600 hover:border-slate-400"
            }`}
          >
            Tất cả
          </Link>
          {categories.map((item) => (
            <Link
              key={item}
              href={categoryHref(item)}
              aria-current={selectedCategory === item ? "page" : undefined}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition ${
                selectedCategory === item
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-stone-200 bg-white text-slate-600 hover:border-slate-400"
              }`}
            >
              {item}
            </Link>
          ))}
        </nav>

        <form action="/san-pham" method="get" className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
          {selectedCategory && <input type="hidden" name="category" value={selectedCategory} />}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] lg:items-end">
            <label className="text-xs font-medium text-slate-600">
              Thương hiệu
              <select name="brand" defaultValue={selectedBrand ?? ""} className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100">
                <option value="">Tất cả thương hiệu</option>
                {brands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600">
              Giá từ
              <input name="minPrice" type="number" min="0" step="100000" inputMode="numeric" defaultValue={minPrice ?? ""} placeholder="0₫" className="mt-1.5 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-600 focus:ring-2 focus:ring-sky-100" />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Giá đến
              <input name="maxPrice" type="number" min="0" step="100000" inputMode="numeric" defaultValue={maxPrice ?? ""} placeholder="Không giới hạn" className="mt-1.5 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-600 focus:ring-2 focus:ring-sky-100" />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Sắp xếp
              <select name="sort" defaultValue={sort} className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100">
                <option value="price-asc">Giá thấp đến cao</option>
                <option value="price-desc">Giá cao đến thấp</option>
                <option value="name">Tên sản phẩm A–Z</option>
              </select>
            </label>
            <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-1 lg:flex-col lg:items-stretch">
              <label className="flex min-h-10 flex-1 items-center gap-2 text-xs text-slate-600 lg:flex-none">
                <input type="checkbox" name="stock" value="available" defaultChecked={stock === "available"} className="h-4 w-4 accent-sky-800" />
                Catalog báo còn hàng
              </label>
              <button type="submit" className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-800">
                Áp dụng lọc
              </button>
            </div>
          </div>
          {rangeWasReversed && (
            <p className="mt-3 text-xs text-amber-800" role="status">
              Khoảng giá đã được tự sắp xếp lại: {formatPrice(minPrice!)} đến {formatPrice(maxPrice!)}.
            </p>
          )}
          {hasActiveOptions && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3 text-xs">
              {activeFilterCount > 0 && <span className="font-medium text-slate-600">Đang lọc theo {activeFilterCount} tiêu chí</span>}
              {selectedCategory && filterChip(selectedCategory, "category")}
              {selectedBrand && filterChip(selectedBrand, "brand")}
              {minPrice !== undefined && filterChip(`Từ ${formatPrice(minPrice)}`, "minPrice")}
              {maxPrice !== undefined && filterChip(`Đến ${formatPrice(maxPrice)}`, "maxPrice")}
              {stock === "available" && filterChip("Catalog báo còn hàng", "stock")}
              {sort !== "price-asc" && filterChip(`Sắp xếp: ${sort === "price-desc" ? "giá cao đến thấp" : "tên A–Z"}`, "sort")}
              <Link href="/san-pham" className="font-semibold text-sky-800 underline underline-offset-2">Xóa bộ lọc</Link>
            </div>
          )}
        </form>

        {products.length > 0 ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        ) : (
          <div className="mt-6 rounded-3xl border border-dashed border-stone-300 bg-white px-6 py-16 text-center">
            <h2 className="text-xl font-semibold">Không tìm thấy sản phẩm khớp bộ lọc</h2>
            <p className="mt-2 text-sm text-slate-500">Thử nới khoảng giá hoặc bỏ bớt một vài tiêu chí.</p>
            <Link href="/san-pham" className="mt-4 inline-flex rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">
              Xóa bộ lọc
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
