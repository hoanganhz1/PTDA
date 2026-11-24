"use client";

export default function ProductConsultButton({ sku, name }: { sku: string; name: string }) {
  function openChat() {
    window.dispatchEvent(
      new CustomEvent("kidohomes-chat-open", {
        detail: { message: `Tư vấn giúp tôi sản phẩm mã ${sku}: ${name}` },
      }),
    );
  }

  return (
    <button
      type="button"
      onClick={openChat}
      aria-label={`Mở chatbot để tư vấn sản phẩm ${sku}: ${name}`}
      className="flex w-full items-center justify-center rounded-full bg-slate-900 px-6 py-4 text-sm font-semibold text-white transition hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
    >
      Nhận tư vấn về sản phẩm này
    </button>
  );
}
