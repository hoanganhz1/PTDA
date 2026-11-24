import assert from "node:assert/strict";
import test from "node:test";
import { buildReason, estimateMatchConfidence, rankProducts } from "../lib/criteria";
import type { Product } from "../lib/types";

function makeProduct(overrides: Partial<Product>): Product {
  return {
    id: "prod-test",
    slug: "san-pham-test",
    sku: "KD-TEST-0001",
    name: "Sản phẩm test",
    category: "bồn cầu",
    brand: "TOTO",
    price: 4_000_000,
    original_price: null,
    color: "Trắng",
    material: "Gốm",
    dimensions_mm: { width: 360, depth: 620, height: 395 },
    min_room_area_m2: 5,
    is_compact: true,
    features: ["nắp đóng êm", "tiết kiệm nước"],
    warranty_months: 24,
    short_description: "Mô tả test",
    in_stock: true,
    image_placeholder_key: "toilet-compact",
    ...overrides,
  };
}

const catalog: Product[] = [
  makeProduct({ id: "a", name: "Bồn cầu TOTO rẻ", brand: "TOTO", price: 4_200_000 }),
  makeProduct({ id: "b", name: "Bồn cầu INAX", brand: "INAX", price: 3_900_000 }),
  makeProduct({ id: "c", name: "Bồn cầu TOTO đắt", brand: "TOTO", price: 9_100_000 }),
  makeProduct({ id: "d", name: "Lavabo", category: "lavabo", brand: "INAX", price: 2_400_000 }),
];

test("sản phẩm đúng hãng và trong ngân sách được xếp trước", () => {
  const ranked = rankProducts(catalog, { brand: "TOTO", price_max: 5_000_000, features: [] });
  assert.equal(ranked[0].id, "a");
  assert.equal(ranked[0].match_confidence, "full");
});

test("sản phẩm vượt ngân sách bị đánh dấu là phương án gần nhất", () => {
  const ranked = rankProducts(catalog, { category: "bồn cầu", price_max: 5_000_000, features: [] });
  const expensive = ranked.find((item) => item.id === "c");
  assert.ok(expensive);
  assert.equal(expensive.match_confidence, "closest");
  assert.match(expensive.reason, /Lưu ý:/);
  assert.match(expensive.reason, /cao hơn mức tối đa/);
});

test("không có tiêu chí thì mọi sản phẩm là 'closest' nhưng vẫn có lý do", () => {
  const ranked = rankProducts(catalog, { features: [] });
  for (const item of ranked) {
    assert.equal(item.match_confidence, "closest");
    assert.match(item.reason, /giá/);
  }
});

test("estimateMatchConfidence phân biệt khớp đầy đủ và khớp một phần", () => {
  const product = makeProduct({ id: "x" });
  assert.equal(
    estimateMatchConfidence(product, { category: "bồn cầu", price_max: 5_000_000, features: [] }),
    "full",
  );
  assert.equal(
    estimateMatchConfidence(product, { category: "bồn cầu", color: "Đen", features: [] }),
    "partial",
  );
});

test("buildReason nêu rõ điểm chưa khớp", () => {
  const reason = buildReason(makeProduct({ id: "y" }), { category: "lavabo", features: [] });
  assert.match(reason, /khác danh mục ưu tiên/);
});
