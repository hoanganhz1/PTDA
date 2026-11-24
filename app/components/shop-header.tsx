import Link from "next/link";

export default function ShopHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-[#fbfaf8]/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3.5 sm:gap-4 sm:px-6 lg:px-8">
        <Link href="/" className="shrink-0 text-[15px] font-bold tracking-[0.1em] text-slate-900 sm:text-[17px] sm:tracking-[0.11em]">
          KIDO<span className="text-sky-800">HOMES</span>
        </Link>
        <nav aria-label="Điều hướng chính" className="flex items-center gap-0 sm:gap-2">
          <Link href="/" className="hidden rounded-full px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-stone-100 hover:text-slate-950 sm:block sm:px-4 sm:text-sm">
            Trang chủ
          </Link>
          <Link href="/san-pham" className="rounded-full px-2 py-2 text-xs font-medium text-slate-600 transition hover:bg-stone-100 hover:text-slate-950 sm:px-4 sm:text-sm">
            Sản phẩm
          </Link>
          <Link href="/tim-kiem" className="rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-800 sm:px-5 sm:text-sm">
            <span className="sm:hidden">Tìm</span>
            <span className="hidden sm:inline">Tìm & tư vấn</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
