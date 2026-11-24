"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Nút mở chat ở góc phải. Panel được tách thành chunk riêng và chỉ tải
 * khi khách bấm lần đầu → không nặng bundle cho mọi trang.
 */
const ChatPanel = dynamic(() => import("./chat-panel"), { ssr: false });

export default function ChatLauncher() {
  const [open, setOpen] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState({ message: "", version: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setPendingPrompt((current) => ({ ...current, message: "" }));
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  useEffect(() => {
    function handleOpen(event: Event) {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      setPendingPrompt((current) => ({
        message: detail?.message?.slice(0, 500) ?? "",
        version: current.version + 1,
      }));
      setOpen(true);
    }

    window.addEventListener("kidohomes-chat-open", handleOpen);
    return () => window.removeEventListener("kidohomes-chat-open", handleOpen);
  }, []);

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <ChatPanel
          onClose={close}
          initialMessage={pendingPrompt.message}
          initialMessageKey={pendingPrompt.version}
        />
      )}

      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls="kidohomes-chat-panel"
        aria-label={open ? "Đóng chat Kidohomes" : "Mở chat Kidohomes"}
        onClick={() => (open ? close() : setOpen(true))}
        className="group flex h-13 items-center gap-2.5 rounded-full bg-gradient-to-r from-sky-600 to-sky-700 px-5 font-medium text-white shadow-lg transition-all hover:from-sky-700 hover:to-sky-800 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
      >
        <span className="h-2.5 w-2.5 rounded-full bg-white" aria-hidden="true" />
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 10h10M7 14h6m-7 6-3 1 1-4a9 9 0 1 1 3 3Z" />
        </svg>
        <span className="text-sm font-semibold">Tư vấn</span>
      </button>
    </div>
  );
}
