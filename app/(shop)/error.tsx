"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ShopError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[shop] render error", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-800">Kidohomes</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Trang này đang gặp sự cố</h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
        Dữ liệu demo có thể đang được khởi tạo lại. Bạn thử tải lại trang, hoặc quay về danh mục sản phẩm.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-800"
        >
          Thử lại
        </button>
        <Link
          href="/san-pham"
          className="rounded-full border border-stone-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
        >
          Xem sản phẩm
        </Link>
      </div>
    </div>
  );
}
