import type { Metadata } from "next";
import Link from "next/link";
import AdminLogoutButton from "@/app/components/admin-logout-button";

export const metadata: Metadata = {
  title: "Quản trị · Kidohomes",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold tracking-[0.1em] text-slate-900">
              KIDO<span className="text-sky-800">HOMES</span>
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
              Khu quản trị
            </span>
          </div>
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/admin/handoffs" className="font-medium text-slate-700 hover:text-sky-800">
              Yêu cầu liên hệ
            </Link>
            <Link href="/" className="text-slate-500 hover:text-sky-800">
              Về trang bán hàng
            </Link>
            <AdminLogoutButton />
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
