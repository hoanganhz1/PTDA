import { categoryAliases as categoryAliasMap, filterProductsByCriteria, rankProducts } from "./criteria";
import { getDb } from "./db";
import { formatCurrency, normalizeVietnamese } from "./text";
import type { Product, ProductRow, SearchCriteria, SearchResultItem } from "./types";

/**
 * Truy vấn catalog trên SQLite + cache trong bộ nhớ.
 * Logic phân tích/xếp hạng thuần nằm ở `lib/criteria.ts` để test được không cần DB.
 */

const CATALOG_TTL_MS = Number(process.env.CATALOG_CACHE_TTL_MS ?? 60_000);

type CacheBucket = {
  products?: { value: Product[]; at: number };
  summary?: { value: string; at: number };
};

const globalForCache = globalThis as unknown as { __kidohomesCatalog?: CacheBucket };

function cache() {
  return (globalForCache.__kidohomesCatalog ??= {});
}

export function invalidateCatalogCache() {
  globalForCache.__kidohomesCatalog = {};
}

export function toProduct(row: ProductRow): Product {
  return {
    ...row,
    dimensions_mm: JSON.parse(row.dimensions_mm),
    features: JSON.parse(row.features),
    price: Number(row.price),
    original_price: row.original_price == null ? null : Number(row.original_price),
    min_room_area_m2: Number(row.min_room_area_m2),
    is_compact: Number(row.is_compact) === 1,
    in_stock: Number(row.in_stock) === 1,
    warranty_months: Number(row.warranty_months),
  };
}

export function getAllProducts(): Product[] {
  const bucket = cache();
  const now = Date.now();
  if (bucket.products && now - bucket.products.at < CATALOG_TTL_MS) {
    return bucket.products.value;
  }

  const rows = getDb().prepare("SELECT * FROM products ORDER BY price ASC").all() as ProductRow[];
  const value = rows.map(toProduct);
  bucket.products = { value, at: now };
  return value;
}

export function getProductBySlug(slug: string) {
  const row = getDb().prepare("SELECT * FROM products WHERE slug = ?").get(slug) as ProductRow | undefined;
  return row ? toProduct(row) : null;
}

export function getProductById(id: string) {
  const row = getDb().prepare("SELECT * FROM products WHERE id = ?").get(id) as ProductRow | undefined;
  return row ? toProduct(row) : null;
}

function normalizeProductCode(value: string) {
  return normalizeVietnamese(value).replace(/[^a-z0-9]/g, "").toUpperCase();
}

const searchStopWords = new Set([
  "toi", "em", "anh", "chi", "minh", "ban", "shop", "tim", "kiem", "can", "muon", "co", "giup", "van",
  "san", "pham", "loai", "nao", "mot", "vai", "cai", "chiec", "bo", "cho", "ve", "va", "la", "gi", "nhe", "oi",
  "nhung", "hoac", "hay", "vui", "long",
]);

const criteriaSearchWords = {
  price: ["khoang", "gia", "ngan", "sach", "duoi", "tren", "toi", "da", "khong", "qua", "den", "trieu", "tr", "nghin", "k", "vnd", "len", "vuot", "thieu", "max", "min", "budget", "around", "under"],
  color: ["mau", "trang", "den", "xanh", "be", "kem", "xam", "bac", "nau", "cat"],
  material: ["inox", "thep", "gom", "su", "porcelain", "ceramic", "composite", "kinh", "chat", "lieu", "bang"],
  features: ["tiet", "kiem", "nuoc", "nap", "dong", "em", "rimless", "khong", "vanh", "am", "tuong", "treo", "suc", "massage", "cam", "ung", "cong", "nghe", "lap", "thiet", "ke", "tu"],
  availability: ["con", "het", "hang", "san", "out", "of", "stock", "available"],
  room: ["phong", "tam", "nha", "sinh", "wc", "toilet", "khong", "gian", "mini", "compact", "nho", "gon", "hep", "rong", "lon", "thoang", "m2", "met", "vuong"],
  brand: ["toto", "inax", "grohe", "kohler", "villeroy", "boch"],
} satisfies Record<string, string[]>;

function stopWordsForCriteria(criteria: SearchCriteria, normalizedQuery: string) {
  const words = new Set(searchStopWords);
  const add = (items: string[]) => items.forEach((item) => words.add(item));
  if (criteria.category) {
    for (const [alias, category] of Object.entries(categoryAliasMap)) {
      const normalizedAlias = normalizeVietnamese(alias);
      if (
        normalizeVietnamese(category) === normalizeVietnamese(criteria.category) &&
        normalizedQuery.includes(normalizedAlias)
      ) {
        add(normalizedAlias.split(" "));
      }
    }
  }
  if (criteria.price_min !== undefined || criteria.price_max !== undefined) add(criteriaSearchWords.price);
  if (criteria.color) add(criteriaSearchWords.color);
  if (criteria.material) add(criteriaSearchWords.material);
  if (criteria.features?.length) add(criteriaSearchWords.features);
  if (criteria.in_stock !== undefined) add(criteriaSearchWords.availability);
  if (criteria.room_size || criteria.room_area_m2 !== undefined) add(criteriaSearchWords.room);
  if (criteria.brand) add(criteriaSearchWords.brand);
  return words;
}

/** Tra sản phẩm theo mã SKU; chuẩn hóa hoa/thường, dấu và dấu phân cách. */
export function getProductsBySkus(skus: string[]): Product[] {
  const requested = Array.from(new Set(skus.map(normalizeProductCode).filter(Boolean)));
  if (!requested.length) return [];

  const bySku = new Map(getAllProducts().map((product) => [normalizeProductCode(product.sku), product]));
  return requested.map((sku) => bySku.get(sku)).filter((product): product is Product => Boolean(product));
}

/** Trích mã dạng KDH-0001 khỏi câu tìm kiếm; mã được tra chính xác, không token hóa thành tiêu chí. */
export function extractProductSku(query: string) {
  const knownFormat = query.match(/\b(KDH[-_ ]?\d{4})\b/i);
  const labeledCode = query.match(/(?:sku|mã(?:\s+sản phẩm)?|ma(?:\s+sản phẩm)?|product\s+code)\s*[:#-]?\s*([A-Z]{2,8}[-_ ]?\d{2,10})\b/i);
  const code = knownFormat?.[1] ?? labeledCode?.[1];
  return code?.replace(/\s+/g, "-").toUpperCase();
}

export function getProductBySku(sku: string) {
  return getProductsBySkus([sku])[0] ?? null;
}

/** Tìm theo các từ tự do còn lại sau khi phân tích tiêu chí; mọi từ khóa phải khớp nguyên từ. */
export function searchProductsByText(
  query: string,
  candidates: Product[] = getAllProducts(),
  criteria: SearchCriteria = { features: [] },
): SearchResultItem[] | null {
  let normalizedQuery = normalizeVietnamese(query);
  if (criteria.room_area_m2 !== undefined) normalizedQuery = normalizedQuery.replace(/\bdien\s+tich\b/g, " ");
  const stopWords = stopWordsForCriteria(criteria, normalizedQuery);
  const terms = Array.from(new Set(
    normalizedQuery
      .split(/[^a-z0-9]+/)
      .filter((term) => term.length > 1 && !/^\d+$/.test(term) && !stopWords.has(term)),
  ));
  if (!terms.length) return null;

  return candidates
    .map((product): SearchResultItem | null => {
      const name = normalizeVietnamese(product.name);
      const searchableText = normalizeVietnamese([
        product.name,
        product.category,
        product.brand,
        product.color,
        product.material,
        product.short_description,
        ...product.features,
      ].join(" "));
      const searchableWords = new Set(searchableText.split(/[^a-z0-9]+/).filter(Boolean));
      const nameWords = new Set(name.split(/[^a-z0-9]+/).filter(Boolean));
      const matched = terms.filter((term) => searchableWords.has(term));
      if (matched.length !== terms.length) return null;
      const score = matched.reduce((total, term) => total + (nameWords.has(term) ? 20 : 6), 0);
      return {
        ...product,
        score,
        reason: `Khớp từ khóa ${matched.join(", ")} trong tên hoặc thông tin sản phẩm.`,
        match_confidence: "full" as const,
      };
    })
    .filter((product): product is SearchResultItem => product !== null)
    .sort((a, b) => b.score - a.score || a.price - b.price);
}

/** Một truy vấn IN(...) thay vì nạp cả catalog rồi map. */
export function getProductsByIds(ids: string[]): Product[] {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (!unique.length) return [];

  const placeholders = unique.map(() => "?").join(", ");
  const rows = getDb()
    .prepare(`SELECT * FROM products WHERE id IN (${placeholders})`)
    .all(...unique) as ProductRow[];
  const byId = new Map(rows.map((row) => [row.id, toProduct(row)]));
  return unique.map((id) => byId.get(id)).filter((product): product is Product => Boolean(product));
}

/**
 * Bản rút gọn dùng làm "index" cho LLM: chỉ trường cần để chọn mã SKU.
 * Mô tả dài/tính năng đầy đủ được render từ DB sau khi model chọn xong.
 */
export function getCatalogPromptSummary(): string {
  const bucket = cache();
  const now = Date.now();
  if (bucket.summary && now - bucket.summary.at < CATALOG_TTL_MS) {
    return bucket.summary.value;
  }

  const products = getAllProducts();
  const grouped = new Map<string, Product[]>();
  for (const product of products) {
    const list = grouped.get(product.category) ?? [];
    list.push(product);
    grouped.set(product.category, list);
  }

  const lines: string[] = [];
  for (const [category, items] of grouped) {
    lines.push(`### ${category} (${items.length})`);
    for (const product of items) {
      const tags = [product.is_compact ? "compact" : null, product.in_stock ? "còn hàng" : "tạm hết"]
        .filter(Boolean)
        .join(", ");
      lines.push(
        `[${product.sku}] ${product.name} | ${product.brand} | ${formatCurrency(product.price)} | ` +
          `${product.color} | ${product.material} | ${product.dimensions_mm.width}×${product.dimensions_mm.depth}×${product.dimensions_mm.height}mm | ` +
          `phòng từ ${product.min_room_area_m2}m² | bảo hành mẫu ${product.warranty_months} tháng | ${tags} | ` +
          `${product.features.slice(0, 3).join(", ")}`,
      );
    }
  }

  const value = lines.join("\n");
  bucket.summary = { value, at: now };
  return value;
}

export function findProductsByCriteria(criteria: SearchCriteria): SearchResultItem[] {
  return rankProducts(filterProductsByCriteria(getAllProducts(), criteria), criteria);
}

// Re-export để các module cũ chỉ cần import từ "@/lib/search".
export {
  buildReason,
  categoryAliases,
  describeCriteria,
  estimateMatchConfidence,
  hasProductCriteria,
  mergeCriteria,
  parseRuleCriteria,
  parseSearchQuery,
  productCategories,
  rankProducts,
} from "./criteria";
export { formatCurrency, normalizeQuery, normalizeVietnamese } from "./text";
