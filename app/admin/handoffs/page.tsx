import Link from "next/link";
import { getDb } from "@/lib/db";
import { updateHandoffStatus } from "./actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

const statusLabels: Record<string, string> = {
  new: "Mới",
  contacted: "Đã liên hệ",
  done: "Đã xong",
};

const statusStyles: Record<string, string> = {
  new: "bg-sky-100 text-sky-800",
  contacted: "bg-amber-100 text-amber-800",
  done: "bg-emerald-100 text-emerald-800",
};

/** Che bớt thông tin liên hệ: đủ để nhận diện, không đủ để rò rỉ toàn bộ. */
function maskContact(value: string) {
  if (value.includes("@")) {
    const [user, domain] = value.split("@");
    const visible = user.slice(0, 2);
    return `${visible}${"*".repeat(Math.max(2, user.length - visible.length))}@${domain}`;
  }
  const digits = value.replace(/[^\d+]/g, "");
  if (digits.length <= 6) return "*".repeat(digits.length);
  return `${digits.slice(0, 3)}${"*".repeat(digits.length - 6)}${digits.slice(-3)}`;
}

function formatDate(value: string) {
  const date = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("vi-VN");
}

type HandoffRow = {
  id: string;
  name: string;
  phone_email: string;
  message: string | null;
  created_at: string;
  status: string;
};

export default async function HandoffsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; reveal?: string }>;
}) {
  const { page, reveal } = await searchParams;
  const currentPage = Math.max(1, Number(page ?? "1") || 1);
  const showFullContact = reveal === "1";

  const db = getDb();
  const total = (db.prepare("SELECT COUNT(*) as count FROM handoff_requests").get() as { count: number }).count;
  const pending = (
    db.prepare("SELECT COUNT(*) as count FROM handoff_requests WHERE status = 'new'").get() as { count: number }
  ).count;
  const rows = db
    .prepare("SELECT * FROM handoff_requests ORDER BY created_at DESC, rowid DESC LIMIT ? OFFSET ?")
    .all(PAGE_SIZE, (currentPage - 1) * PAGE_SIZE) as HandoffRow[];

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const revealQuery = showFullContact ? "" : "&reveal=1";

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-800">Dữ liệu cá nhân</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Yêu cầu liên hệ</h1>
            <p className="mt-2 text-sm text-slate-600">
              {total} yêu cầu · <span className="font-semibold text-sky-800">{pending} chưa xử lý</span> · thông tin liên hệ
              được che bớt mặc định.
            </p>
          </div>
          <Link
            href={`/admin/handoffs?page=${currentPage}${revealQuery}`}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
          >
            {showFullContact ? "Ẩn bớt thông tin liên hệ" : "Hiện đầy đủ thông tin liên hệ"}
          </Link>
        </div>

        {rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">Chưa có yêu cầu liên hệ nào.</p>
        ) : (
          <div className="mt-2 divide-y divide-slate-100">
            {rows.map((row) => (
              <article key={row.id} className="grid gap-3 py-4 sm:grid-cols-[1fr_auto]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{row.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        statusStyles[row.status] ?? "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {statusLabels[row.status] ?? row.status}
                    </span>
                    <span className="text-xs text-slate-400">{formatDate(row.created_at)}</span>
                  </div>
                  <p className="mt-1 font-mono text-sm text-slate-700">
                    {showFullContact ? row.phone_email : maskContact(row.phone_email)}
                  </p>
                  {row.message && (
                    <p className="mt-1.5 line-clamp-3 text-sm leading-6 text-slate-600">{row.message}</p>
                  )}
                </div>
                <form action={updateHandoffStatus} className="flex items-start gap-2">
                  <input type="hidden" name="id" value={row.id} />
                  <label className="sr-only" htmlFor={`status-${row.id}`}>
                    Trạng thái xử lý
                  </label>
                  <select
                    id={`status-${row.id}`}
                    name="status"
                    defaultValue={row.status}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
                  >
                    <option value="new">Mới</option>
                    <option value="contacted">Đã liên hệ</option>
                    <option value="done">Đã xong</option>
                  </select>
                  <button
                    type="submit"
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-800"
                  >
                    Lưu
                  </button>
                </form>
              </article>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <nav
            aria-label="Phân trang"
            className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-sm"
          >
            <Link
              href={`/admin/handoffs?page=${Math.max(1, currentPage - 1)}${revealQuery}`}
              aria-disabled={currentPage === 1}
              className={`rounded-full px-3 py-1.5 ${
                currentPage === 1 ? "pointer-events-none text-slate-300" : "text-slate-600 hover:text-sky-800"
              }`}
            >
              ← Trang trước
            </Link>
            <span className="text-xs text-slate-500">
              Trang {currentPage}/{totalPages}
            </span>
            <Link
              href={`/admin/handoffs?page=${Math.min(totalPages, currentPage + 1)}${revealQuery}`}
              aria-disabled={currentPage >= totalPages}
              className={`rounded-full px-3 py-1.5 ${
                currentPage >= totalPages ? "pointer-events-none text-slate-300" : "text-slate-600 hover:text-sky-800"
              }`}
            >
              Trang sau →
            </Link>
          </nav>
        )}
      </div>
    </main>
  );
}
