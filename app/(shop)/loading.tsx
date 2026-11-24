export default function ShopLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8" aria-busy="true" aria-live="polite">
      <div className="h-6 w-40 animate-pulse rounded-full bg-stone-200" />
      <div className="mt-4 h-10 w-2/3 animate-pulse rounded-2xl bg-stone-200" />
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="overflow-hidden rounded-[1.6rem] border border-stone-200 bg-white">
            <div className="aspect-[4/3] animate-pulse bg-stone-200" />
            <div className="space-y-3 p-5">
              <div className="h-3 w-24 animate-pulse rounded-full bg-stone-200" />
              <div className="h-5 w-3/4 animate-pulse rounded-full bg-stone-200" />
              <div className="h-4 w-full animate-pulse rounded-full bg-stone-100" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Đang tải nội dung…</span>
    </div>
  );
}
