"use client";

import { useState, type FormEvent } from "react";

export default function LoginForm({ next }: { next: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");

    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Không đăng nhập được.");
        return;
      }
      window.location.replace(next);
    } catch {
      setError("Không kết nối được tới máy chủ.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-3">
      <label htmlFor="admin-password" className="block text-sm font-medium text-slate-700">
        Mật khẩu quản trị
      </label>
      <input
        id="admin-password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
        placeholder="Nhập mật khẩu trong ADMIN_PASSWORD"
      />
      {error && (
        <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending || !password}
        className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:opacity-50"
      >
        {pending ? "Đang kiểm tra..." : "Đăng nhập"}
      </button>
    </form>
  );
}
