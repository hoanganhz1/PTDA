import type { Metadata } from "next";
import LoginForm from "./login-form";

export const metadata: Metadata = {
  title: "Đăng nhập quản trị · Kidohomes",
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target = next?.startsWith("/admin") ? next : "/admin/handoffs";

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4 py-12">
      <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-800">Khu quản trị</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Đăng nhập để xem yêu cầu liên hệ</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Trang này chứa thông tin liên hệ khách hàng (dữ liệu cá nhân), nên chỉ người có mật khẩu quản trị mới truy cập được.
        </p>
        <LoginForm next={target} />
      </div>
    </main>
  );
}
