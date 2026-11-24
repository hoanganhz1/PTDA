"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import ProductImage from "./product-image";
import type { ChatPayload } from "@/lib/schemas";
import type { ProductSummary } from "@/lib/types";

// ── Markdown-lite renderer (bold, italic, xuống dòng) ────────────
/**
 * Render markdown tối giản: **bold**, *italic*, xuống dòng, đoạn.
 * Key được ghép theo (đoạn, dòng, phần tử) để không bao giờ trùng giữa các dòng —
 * key trùng khiến React bỏ/duplicate children (từng gây lặp cả khối chữ).
 */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, partIndex) => {
    const key = `${keyPrefix}-p${partIndex}`;
    if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.length > 2 && part.startsWith("*") && part.endsWith("*")) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function renderMarkdown(text: string): ReactNode[] {
  return text.split(/\n{2,}/).map((paragraph, paragraphIndex) => {
    const lines = paragraph.split("\n");
    const children: ReactNode[] = [];

    lines.forEach((line, lineIndex) => {
      children.push(...renderInline(line, `p${paragraphIndex}-l${lineIndex}`));
      if (lineIndex < lines.length - 1) {
        children.push(<br key={`p${paragraphIndex}-br${lineIndex}`} />);
      }
    });

    return (
      <p key={`p${paragraphIndex}`} className={paragraphIndex > 0 ? "mt-2" : ""}>
        {children}
      </p>
    );
  });
}

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  products?: ProductSummary[];
  followUpQuestions?: string[];
};

type HistoryMessage = {
  role: "user" | "assistant";
  message: string;
  meta?: { products?: ProductSummary[]; follow_up_questions?: string[] } | null;
};

const storageKey = "kidohomes-chat-session";

function welcomeMessageFor(mode: ChatPayload["mode"]): ChatMessage {
  const text = mode === "live"
    ? "Xin chào! Tôi là trợ lý Kidohomes. Hãy cho tôi biết loại sản phẩm, ngân sách hoặc diện tích phòng; tôi sẽ tìm lựa chọn kèm mã sản phẩm cụ thể."
    : mode === "fallback"
      ? "Xin chào! Tư vấn sản phẩm bằng AI đang tạm ngưng. Tôi vẫn có thể tra cứu chính sách hoặc chuyển yêu cầu cho nhân viên."
      : "Xin chào! Tôi là trợ lý Kidohomes ở chế độ offline. Tôi có thể tra cứu chính sách hoặc giúp bạn liên hệ nhân viên tư vấn.";
  return { role: "assistant", text };
}

const visibleProductLimit = 2;

const stageLabels: Record<string, string> = {
  received: "Đã nhận câu hỏi…",
  thinking: "Đang phân tích nhu cầu và chọn sản phẩm…",
};

/** Session id lưu theo tab; đọc/ghi trong effect để không vi phạm purity của React. */
function useSessionId() {
  const [sessionId, setSessionId] = useState("");

  useEffect(() => {
    let cancelled = false;

    // Tạo/đọc session id trong microtask: tránh setState đồng bộ ngay trong effect.
    const init = () => {
      let stored = window.sessionStorage.getItem(storageKey);
      if (!stored) {
        stored = window.crypto.randomUUID();
        window.sessionStorage.setItem(storageKey, stored);
      }
      if (!cancelled) setSessionId(stored);
    };
    queueMicrotask(init);

    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey) setSessionId(event.newValue ?? "");
    };
    const onReset = () => setSessionId(window.sessionStorage.getItem(storageKey) ?? "");
    window.addEventListener("storage", onStorage);
    window.addEventListener("kidohomes-session-reset", onReset);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("kidohomes-session-reset", onReset);
    };
  }, []);

  return sessionId;
}

export default function ChatPanel({
  onClose,
  initialMessage = "",
  initialMessageKey = 0,
}: {
  onClose: () => void;
  initialMessage?: string;
  initialMessageKey?: number;
}) {
  const sessionId = useSessionId();
  const [draft, setDraft] = useState({ promptKey: initialMessageKey, value: initialMessage });
  const message = draft.promptKey === initialMessageKey ? draft.value : initialMessage;
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessageFor("fallback")]);
  const [mode, setMode] = useState<ChatPayload["mode"] | null>(null);
  const [expandedRecommendationMessages, setExpandedRecommendationMessages] = useState<number[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [stage, setStage] = useState("");
  /** Chữ đang được model viết dần (stream), hiển thị như bong bóng tạm. */
  const [streamText, setStreamText] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [needsHandoff, setNeedsHandoff] = useState(false);
  const [error, setError] = useState("");
  const [handoffName, setHandoffName] = useState("");
  const [handoffContact, setHandoffContact] = useState("");
  const [handoffReason, setHandoffReason] = useState("");
  const [isSubmittingHandoff, setIsSubmittingHandoff] = useState(false);

  const panelRef = useRef<HTMLElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (initialMessage) requestAnimationFrame(() => textareaRef.current?.focus());
  }, [initialMessage, initialMessageKey]);

  // Focus trap + Escape: hành vi bắt buộc của một dialog.
  useEffect(() => {
    const node = panelRef.current;
    const previous = document.activeElement as HTMLElement | null;
    textareaRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !node) return;

      const focusable = node.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      abortRef.current?.abort();
      previous?.focus();
    };
  }, [onClose]);

  // Tải lịch sử (kèm metadata để dựng lại thẻ sản phẩm sau khi reload).
  useEffect(() => {
    if (!sessionId) return;
    let active = true;

    async function loadHistory() {
      try {
        const [response, statusResponse] = await Promise.all([
          fetch(`/api/chat?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store" }),
          fetch("/api/chat?status=1", { cache: "no-store" }).catch(() => null),
        ]);
        const statusData = statusResponse?.ok
          ? ((await statusResponse.json()) as { mode?: ChatPayload["mode"] })
          : null;
        const detectedMode = statusData?.mode ?? "fallback";
        const data = (await response.json()) as {
          messages?: HistoryMessage[];
          needs_handoff?: boolean;
          error?: string;
        };
        if (!response.ok) throw new Error(data.error || "Không tải được lịch sử trò chuyện.");
        if (!active) return;
        setMode(detectedMode);

        if (data.messages?.length) {
          setMessages(
            data.messages.map((item) => ({
              role: item.role,
              text: item.message,
              products: item.meta?.products,
              followUpQuestions: item.meta?.follow_up_questions,
            })),
          );
        } else {
          setMessages([welcomeMessageFor(detectedMode)]);
        }
        setExpandedRecommendationMessages([]);
        setNeedsHandoff(data.needs_handoff === true);
      } catch (historyError) {
        if (active) {
          setError(historyError instanceof Error ? historyError.message : "Không tải được lịch sử trò chuyện.");
        }
      } finally {
        if (active) setIsLoadingHistory(false);
      }
    }

    void loadHistory();
    return () => {
      active = false;
    };
  }, [sessionId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: isSending && streamText ? "auto" : "smooth",
      block: "end",
    });
  }, [messages, isSending, needsHandoff, streamText, error]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 96)}px`;
    textarea.style.overflowY = textarea.scrollHeight > 96 ? "auto" : "hidden";
  }, [message]);

  const appendAssistant = useCallback((payload: ChatPayload) => {
    setMode(payload.mode);
    setMessages((current) => [
      ...current,
      {
        role: "assistant",
        text: payload.message,
        products: payload.products as ProductSummary[],
        followUpQuestions: payload.follow_up_questions,
      },
    ]);
    setNeedsHandoff(payload.needs_handoff === true);
  }, []);

  const submitMessage = useCallback(
    async (text: string) => {
      const value = text.trim();
      if (!value || !sessionId || isSending) return;

      setDraft({ promptKey: initialMessageKey, value: "" });
      setError("");
      setIsSending(true);
      setStage("received");
      setStreamText("");
      setMessages((current) => [...current, { role: "user", text: value }]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
          body: JSON.stringify({ sessionId, message: value }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? "Chưa gửi được tin nhắn. Vui lòng thử lại.");
        }
        if (!response.body) {
          throw new Error("Trình duyệt không hỗ trợ đọc phản hồi dạng stream.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let payload: ChatPayload | null = null;

        while (true) {
          const { done, value: chunk } = await reader.read();
          if (done) break;
          buffer += decoder.decode(chunk, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;
            let event: {
              type: string;
              stage?: string;
              message?: string;
              text?: string;
              payload?: ChatPayload;
            };
            try {
              event = JSON.parse(line);
            } catch {
              continue;
            }
            if (event.type === "status" && event.stage) setStage(event.stage);
            else if (event.type === "delta" && typeof event.text === "string") {
              setStage("");
              setStreamText((current) => current + event.text);
            } else if (event.type === "final" && event.payload) payload = event.payload;
            else if (event.type === "error") throw new Error(event.message ?? "Có lỗi khi xử lý tin nhắn.");
          }
        }

        if (!payload) throw new Error("Không nhận được phản hồi hoàn chỉnh. Vui lòng thử lại.");
        appendAssistant(payload);
      } catch (sendError) {
        if (sendError instanceof DOMException && sendError.name === "AbortError") {
          setError("Đã dừng chờ phản hồi. Bạn có thể hỏi lại hoặc mở lại cuộc trò chuyện.");
          return;
        }
        setError(sendError instanceof Error ? sendError.message : "Đã xảy ra lỗi khi gửi tin nhắn.");
      } finally {
        abortRef.current = null;
        setIsSending(false);
        setStage("");
        setStreamText("");
      }
    },
    [appendAssistant, initialMessage, initialMessageKey, isSending, sessionId],
  );

  function handleMessageSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitMessage(message);
  }

  function resetSession() {
    if (isSending) return;
    if (!window.confirm("Bạn có muốn xóa cuộc trò chuyện này và bắt đầu phiên mới?")) return;

    if (sessionId) void fetch(`/api/chat?sessionId=${encodeURIComponent(sessionId)}`, { method: "DELETE" });

    window.sessionStorage.setItem(storageKey, window.crypto.randomUUID());
    window.dispatchEvent(new Event("kidohomes-session-reset"));
    setMessages([welcomeMessageFor(mode ?? "fallback")]);
    setExpandedRecommendationMessages([]);
    setNeedsHandoff(false);
    setDraft({ promptKey: initialMessageKey, value: "" });
    setError("");
    setStreamText("");
  }

  const statusLabel = mode === "live"
    ? "AI đã cấu hình · gợi ý theo mã SKU"
    : mode === "fallback"
      ? "AI tạm ngưng · còn tra cứu chính sách"
      : mode === "mock"
        ? "Chế độ offline · chưa gợi ý sản phẩm"
        : "Đang kiểm tra trạng thái…";
  const statusDot = mode === "live" ? "bg-emerald-400" : mode === "fallback" ? "bg-amber-400" : "bg-slate-400";
  const statusBadge = mode === "live" ? "Gemini" : mode === "fallback" ? "Tạm ngưng" : mode === "mock" ? "Offline" : "...";
  const quickStarters = mode === "live"
    ? ["Bồn cầu dưới 5 triệu", "Sen tắm cho phòng nhỏ", "Chính sách bảo hành"]
    : ["Chính sách bảo hành", "Điều kiện đổi trả", "Gặp nhân viên tư vấn"];

  async function submitHandoff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionId || isSubmittingHandoff) return;

    setError("");
    setIsSubmittingHandoff(true);
    try {
      const response = await fetch("/api/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, name: handoffName, contact: handoffContact, message: handoffReason }),
      });
      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok || !data.message) {
        throw new Error(data.error ?? "Chưa lưu được yêu cầu liên hệ. Vui lòng thử lại.");
      }
      setMessages((current) => [...current, { role: "assistant", text: data.message as string }]);
      setNeedsHandoff(false);
      setHandoffName("");
      setHandoffContact("");
      setHandoffReason("");
    } catch (handoffError) {
      setError(handoffError instanceof Error ? handoffError.message : "Đã xảy ra lỗi khi lưu yêu cầu.");
    } finally {
      setIsSubmittingHandoff(false);
    }
  }

  return (
    <section
      id="kidohomes-chat-panel"
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="kidohomes-chat-title"
      tabIndex={-1}
      className="flex h-[min(40rem,calc(100dvh-6.5rem))] w-[min(26rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl focus:outline-none"
    >
      <header className="flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-3 text-white shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusDot}`} aria-hidden="true" />
          <div>
            <div className="flex items-center gap-1.5">
              <h2 id="kidohomes-chat-title" className="text-sm font-semibold tracking-wide">
                Trợ lý Kidohomes
              </h2>
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-slate-200">{statusBadge}</span>
            </div>
            <p className="text-[10px] text-slate-300">{statusLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Làm mới cuộc trò chuyện"
            aria-label="Làm mới cuộc trò chuyện"
            onClick={resetSession}
            className="rounded-lg p-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Đóng cửa sổ chat"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-3.5 overflow-y-auto bg-stone-50/70 p-4" aria-busy={isSending || isLoadingHistory}>
        <div aria-live="polite" aria-relevant="additions text" className="space-y-3.5">
          {isLoadingHistory ? (
            <p className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-500" role="status">
              Đang tải cuộc trò chuyện…
            </p>
          ) : messages.map((chatMessage, index) => (
            <div key={`${chatMessage.role}-${index}`} className="space-y-2">
              <div className={`flex ${chatMessage.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
                    chatMessage.role === "user"
                      ? "whitespace-pre-wrap rounded-br-sm bg-sky-600 text-white"
                      : "rounded-bl-sm border border-slate-200/90 bg-white text-slate-800"
                  }`}
                >
                  {chatMessage.role === "assistant" ? renderMarkdown(chatMessage.text) : chatMessage.text}
                </div>
              </div>

              {chatMessage.products && chatMessage.products.length > 0 && (
                <div className="ml-1 space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Gợi ý sản phẩm · {chatMessage.products.length}
                  </p>
                  {chatMessage.products
                    .slice(
                      0,
                      expandedRecommendationMessages.includes(index)
                        ? chatMessage.products.length
                        : visibleProductLimit,
                    )
                    .map((product) => (
                    <div
                      key={product.id}
                      className="flex items-stretch overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-sky-300"
                    >
                      <Link href={`/san-pham/${product.slug}`} className="group flex min-w-0 flex-1 gap-2.5 p-2.5">
                        <ProductImage
                          imageKey={product.image_placeholder_key}
                          category={product.category}
                          name={product.name}
                          className="h-[4.5rem] w-[4.5rem] shrink-0 rounded-lg"
                          sizes="72px"
                          quality={70}
                          showIllustrationBadge={false}
                        />
                        <div className="min-w-0 flex-1 self-center">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="truncate text-[10px] font-medium text-slate-500">
                              {product.brand} · {product.category}
                            </span>
                            <span className="shrink-0 text-[9px] text-slate-400">Ảnh minh họa</span>
                          </div>
                          <span className="mt-0.5 block line-clamp-1 text-[12px] font-semibold leading-snug text-slate-900 group-hover:text-sky-700">
                            {product.name}
                          </span>
                          {product.sku && (
                            <span className="mt-1 inline-flex max-w-full items-center rounded-md bg-sky-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-sky-800">
                              <span className="mr-1 font-sans font-medium text-slate-500">SKU</span>
                              <span className="truncate">{product.sku}</span>
                            </span>
                          )}
                          <div className="mt-0.5 flex items-center justify-between gap-2">
                            <span className="text-[12px] font-bold text-sky-700">
                              {new Intl.NumberFormat("vi-VN").format(product.price)}₫
                            </span>
                            <span className={`truncate text-[10px] ${product.in_stock ? "text-emerald-700" : "text-amber-700"}`}>
                              {product.in_stock ? "Catalog mẫu: có hàng" : "Cần xác nhận tồn kho"}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-slate-600">
                            {product.reason || product.short_description}
                          </p>
                          <span className="mt-1.5 inline-flex text-[10px] font-semibold text-sky-700 group-hover:underline">
                            Xem chi tiết sản phẩm →
                          </span>
                        </div>
                      </Link>
                      <button
                        type="button"
                        disabled={isSending}
                        aria-label={`Hỏi thêm về ${product.name}`}
                        onClick={() => void submitMessage(`Tư vấn thêm về ${product.name}`)}
                        className="shrink-0 border-l border-slate-100 px-2.5 text-[10px] font-semibold text-sky-700 transition hover:bg-sky-50 disabled:opacity-50"
                      >
                        Hỏi
                      </button>
                    </div>
                  ))}
                  {chatMessage.products.length > visibleProductLimit && (
                    <button
                      type="button"
                      aria-expanded={expandedRecommendationMessages.includes(index)}
                      onClick={() =>
                        setExpandedRecommendationMessages((current) =>
                          current.includes(index) ? current.filter((item) => item !== index) : [...current, index],
                        )
                      }
                      className="rounded-full px-2 py-1 text-[11px] font-medium text-sky-700 transition hover:bg-sky-50"
                    >
                      {expandedRecommendationMessages.includes(index)
                        ? "Thu gọn gợi ý"
                        : `Xem thêm ${chatMessage.products.length - visibleProductLimit} sản phẩm`}
                    </button>
                  )}
                </div>
              )}

              {chatMessage.followUpQuestions?.length ? (
                <div className="ml-1 space-y-1.5 pt-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    💬 Gợi ý cho bạn
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {chatMessage.followUpQuestions.map((question) => (
                      <button
                        key={question}
                        type="button"
                        disabled={isSending}
                        onClick={() => void submitMessage(question)}
                        className="rounded-full border border-sky-300/80 bg-white px-3 py-1.5 text-left text-xs font-medium text-sky-800 shadow-2xs transition hover:border-sky-400 hover:bg-sky-50 disabled:opacity-50"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {!isLoadingHistory && messages.length === 1 && (
          <div className="ml-1 space-y-1.5 pt-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Chủ đề phổ biến:</p>
            <div className="flex flex-wrap gap-1.5">
              {quickStarters.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  disabled={isSending || isLoadingHistory}
                  onClick={() => void submitMessage(topic)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>
        )}

        {isSending && streamText && (
          <div className="flex justify-start">
            <div className="max-w-[90%] rounded-2xl rounded-bl-sm border border-slate-200/90 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-slate-800 shadow-sm">
              {renderMarkdown(streamText)}
              <span
                aria-hidden="true"
                className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse rounded-sm bg-sky-500 align-middle"
              />
              <span className="sr-only">Đang trả lời…</span>
            </div>
          </div>
        )}

        {isSending && !streamText && (
          <div className="flex items-center gap-2 px-1 py-1 text-xs text-slate-500" role="status">
            <div className="flex space-x-1" aria-hidden="true">
              <div className="h-2 w-2 animate-bounce rounded-full bg-sky-500" style={{ animationDelay: "0ms" }} />
              <div className="h-2 w-2 animate-bounce rounded-full bg-sky-500" style={{ animationDelay: "150ms" }} />
              <div className="h-2 w-2 animate-bounce rounded-full bg-sky-500" style={{ animationDelay: "300ms" }} />
            </div>
            <span>{stageLabels[stage] ?? "Đang xử lý…"}</span>
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="ml-auto rounded-full border border-slate-300 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 transition hover:border-slate-500 hover:text-slate-900"
            >
              Dừng
            </button>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700" role="alert">
            {error}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {needsHandoff && (
        <form onSubmit={submitHandoff} className="space-y-2 border-t border-slate-200 bg-sky-50/70 p-3 text-xs">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">Gặp nhân viên tư vấn Kidohomes</p>
            <span className="rounded bg-sky-200 px-1.5 py-0.5 text-[10px] font-medium text-sky-800">Hỗ trợ 1-1</span>
          </div>
          <p className="text-slate-600">
            Để lại số điện thoại hoặc email để nhân viên kiểm tra tình trạng hàng thực tế và hỗ trợ chính sách chi tiết.
          </p>
          <input
            id="handoff-name"
            required
            minLength={2}
            maxLength={100}
            value={handoffName}
            onChange={(event) => setHandoffName(event.target.value)}
            placeholder="Họ và tên của bạn *"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-200"
          />
          <input
            id="handoff-contact"
            required
            maxLength={150}
            value={handoffContact}
            onChange={(event) => setHandoffContact(event.target.value)}
            placeholder="Số điện thoại hoặc email liên hệ *"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-200"
          />
          <input
            id="handoff-reason"
            maxLength={1000}
            value={handoffReason}
            onChange={(event) => setHandoffReason(event.target.value)}
            placeholder="Nội dung cần hỗ trợ (vd: hỏi lịch lắp đặt, chiết khấu dự án,...)"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-200"
          />
          <button
            type="submit"
            disabled={isSubmittingHandoff || !sessionId}
            className="w-full rounded-lg bg-slate-900 py-2 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {isSubmittingHandoff ? "Đang gửi yêu cầu..." : "Gửi yêu cầu nhân viên gọi lại"}
          </button>
        </form>
      )}

      <form onSubmit={handleMessageSubmit} className="border-t border-slate-200 bg-white p-3">
        <label htmlFor="kidohomes-chat-message" className="sr-only">
          Nhập tin nhắn
        </label>
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            id="kidohomes-chat-message"
            value={message}
            onChange={(event) => setDraft({ promptKey: initialMessageKey, value: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Hỏi về bồn cầu, sen tắm, ngân sách..."
            rows={1}
            className="max-h-24 min-h-10 flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          />
          <button
            type="submit"
            disabled={!message.trim() || !sessionId || isSending || isLoadingHistory}
            className="min-h-10 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Gửi
          </button>
        </div>
      </form>
    </section>
  );
}
