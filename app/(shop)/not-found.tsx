import Link from "next/link";

export default function ShopNotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-800">404</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Không tìm thấy trang này</h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
        Đường dẫn có thể đã đổi hoặc sản phẩm không còn trong catalog demo.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/san-pham"
          className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-800"
        >
          Xem tất cả sản phẩm
        </Link>
        <Link
          href="/"
          className="rounded-full border border-stone-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
        >
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}
