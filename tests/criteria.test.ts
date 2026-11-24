import assert from "node:assert/strict";
import test from "node:test";
import { hasProductCriteria, mergeCriteria, parseRuleCriteria, parseSearchQuery } from "../lib/criteria";

test("nhận diện danh mục + ngân sách tối đa", () => {
  const criteria = parseRuleCriteria("bồn cầu dưới 5 triệu");
  assert.equal(criteria.category, "bồn cầu");
  assert.equal(criteria.price_max, 5_000_000);
  assert.equal(criteria.price_min, undefined);
});

test("nhận diện khoảng giá 'từ 3 đến 5 triệu'", () => {
  const criteria = parseRuleCriteria("lavabo từ 3 đến 5 triệu");
  assert.equal(criteria.category, "lavabo");
  assert.equal(criteria.price_min, 3_000_000);
  assert.equal(criteria.price_max, 5_000_000);
});

test("nhận diện giá xấp xỉ 'khoảng 5 triệu' thành một khoảng", () => {
  const criteria = parseRuleCriteria("bồn tắm khoảng 5 triệu");
  assert.equal(criteria.price_min, 4_000_000);
  assert.equal(criteria.price_max, 6_000_000);
});

test("nhận diện thương hiệu, màu, chất liệu", () => {
  assert.equal(parseRuleCriteria("sen cây TOTO").brand, "TOTO");
  assert.equal(parseRuleCriteria("tìm lavabo màu be").color, "Be");
  assert.equal(parseRuleCriteria("bồn cầu inox").material, "Inox");
});

test("không nhầm 'bệ xí' thành màu be", () => {
  const criteria = parseRuleCriteria("bệ xí cho phòng nhỏ");
  assert.equal(criteria.category, "bồn cầu");
  assert.equal(criteria.color, undefined);
});

test("không nhầm 'trang trí' thành màu trắng", () => {
  const criteria = parseRuleCriteria("đồ trang trí phòng tắm");
  assert.equal(criteria.color, undefined);
});

test("nhận diện kích thước phòng và tính năng", () => {
  const criteria = parseSearchQuery("bồn cầu cho phòng tắm nhỏ có nắp đóng êm");
  assert.equal(criteria.room_size, "nho");
  assert.ok(criteria.features.includes("nắp đóng êm"));
});

test("hasProductCriteria và mergeCriteria giữ tiêu chí cũ", () => {
  assert.equal(hasProductCriteria({ features: [] }), false);
  assert.equal(hasProductCriteria(parseSearchQuery("bồn cầu")), true);

  const merged = mergeCriteria(
    { category: "bồn cầu", features: ["tiết kiệm nước"] },
    { price_max: 5_000_000, features: ["nắp đóng êm"] },
  );
  assert.equal(merged.category, "bồn cầu");
  assert.equal(merged.price_max, 5_000_000);
  assert.deepEqual(merged.features, ["tiết kiệm nước", "nắp đóng êm"]);
});
