import { expect, test } from "@playwright/test";

/**
 * Không gọi Gemini: giả lập đúng giao thức NDJSON của /api/chat để kiểm tra
 * phần client hiển thị chữ dần (delta) rồi thay bằng payload cuối.
 */
test("hiển thị chữ dần khi server stream delta", async ({ page }) => {
  await page.route("**/api/chat", async (route) => {
    if (route.request().method() !== "POST") return route.continue();

    const events = [
      { type: "status", stage: "received" },
      { type: "delta", text: "Chào bạn, " },
      { type: "delta", text: "Kidohomes gợi ý " },
      { type: "delta", text: "bồn cầu INAX S1." },
      {
        type: "final",
        payload: {
          message: "Chào bạn, Kidohomes gợi ý bồn cầu INAX S1.",
          products: [],
          product_ids: [],
          needs_handoff: false,
          follow_up_questions: ["Tư vấn bồn cầu dưới 5 triệu"],
          mode: "live",
        },
      },
    ];

    await route.fulfill({
      status: 200,
      headers: { "content-type": "application/x-ndjson; charset=utf-8" },
      body: `${events.map((event) => JSON.stringify(event)).join("\n")}\n`,
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: /Mở chat Kidohomes/ }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox").fill("Tư vấn bồn cầu");
  await dialog.getByRole("button", { name: "Gửi" }).click();

  // Tin nhắn cuối phải xuất hiện đúng nội dung đã stream và không bị lặp đôi.
  await expect(dialog.getByText("Chào bạn, Kidohomes gợi ý bồn cầu INAX S1.")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Tư vấn bồn cầu dưới 5 triệu" })).toBeVisible();
});
