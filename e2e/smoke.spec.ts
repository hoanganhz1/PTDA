import { expect, test } from "@playwright/test";

test("trang chủ hiển thị và điều hướng được sang catalog", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Chọn đúng thiết bị");
  await page.getByRole("link", { name: /^Sản phẩm$/ }).first().click();
  await expect(page).toHaveURL(/\/san-pham/);
  await expect(page.getByRole("heading", { name: /Thiết bị cho phòng tắm/ })).toBeVisible();
});

test("tìm kiếm tự nhiên trả về danh sách được xếp hạng", async ({ page }) => {
  await page.goto(`/tim-kiem?q=${encodeURIComponent("bồn cầu dưới 5 triệu")}`);
  await expect(page.getByText(/lựa chọn được xếp hạng/)).toBeVisible();
  await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
});

test("chat trả lời ở chế độ offline và giữ được thẻ sản phẩm", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Mở chat Kidohomes/ }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  await dialog.getByRole("textbox").fill("Bồn cầu dưới 5 triệu");
  await dialog.getByRole("button", { name: "Gửi" }).click();

  await expect(dialog.getByText(/Dưới đây là các sản phẩm phù hợp/)).toBeVisible({ timeout: 20_000 });
  await expect(dialog.getByText(/Gợi ý sản phẩm/)).toBeVisible();

  // Đóng bằng Escape và focus quay lại nút mở chat
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: /Mở chat Kidohomes/ })).toBeFocused();
});

test("khu quản trị yêu cầu đăng nhập", async ({ page }) => {
  await page.goto("/admin/handoffs");
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByRole("heading", { name: /Đăng nhập/ })).toBeVisible();
});
