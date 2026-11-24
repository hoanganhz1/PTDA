import assert from "node:assert/strict";
import test from "node:test";
import { formatCurrency, normalizeQuery, normalizeVietnamese, parseAmountText } from "../lib/text";

test("normalizeVietnamese bỏ dấu và chữ đ", () => {
  assert.equal(normalizeVietnamese("Bồn Cầu ĐẸP"), "bon cau dep");
  assert.equal(normalizeVietnamese("  Sen   cây  "), "sen cay");
});

test("normalizeQuery quy đổi cách viết tiền tệ thường gặp", () => {
  assert.match(normalizeQuery("bồn cầu 5tr"), /triệu/);
  assert.match(normalizeQuery("khoảng 3 củ"), /triệu/);
  assert.match(normalizeQuery("bồn tắm 500k"), /nghin/);
});

test("parseAmountText đọc đúng số tiền", () => {
  assert.equal(parseAmountText("5 triệu"), 5_000_000);
  assert.equal(parseAmountText("dưới 5tr"), 5_000_000);
  assert.equal(parseAmountText("3,5 triệu"), 3_500_000);
  assert.equal(parseAmountText("500k"), 500_000);
  assert.equal(parseAmountText("2 củ"), 2_000_000);
  assert.equal(parseAmountText("không có số"), null);
});

test("formatCurrency định dạng tiền Việt Nam", () => {
  const text = formatCurrency(5_000_000);
  assert.match(text, /5\.000\.000/);
});
