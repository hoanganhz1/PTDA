import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-stone-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-7 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <span className="font-semibold tracking-[0.12em] text-slate-800">KIDOHOMES</span>
        <span className="max-w-xl leading-5">
          Catalog, giá và chính sách trong phiên bản này là dữ liệu demo, chưa phải thông tin bán hàng chính thức. Ảnh
          phòng tắm mang tính minh họa.
        </span>
        <Link href="/admin/handoffs" className="font-medium hover:text-sky-800">
          Quản trị
        </Link>
      </div>
    </footer>
  );
}
