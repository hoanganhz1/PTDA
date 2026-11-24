/**
 * Bộ phân tích tiêu chí, xếp hạng và giải thích lý do chọn sản phẩm.
 * Module thuần: chỉ phụ thuộc `lib/text.ts` và type, KHÔNG chạm DB/fs
 * → test được bằng `node --test` mà không cần SQLite.
 */
import { formatCurrency, normalizeQuery, normalizeVietnamese, parseAmountText } from "./text";
import type { MatchConfidence, Product, SearchCriteria, SearchResultItem } from "./types";

const AMOUNT_PATTERN = String.raw`(?:\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)`;

export const productCategories = [
  "bồn cầu",
  "lavabo",
  "sen cây",
  "vòi lavabo",
  "bồn tắm",
  "phụ kiện phòng tắm",
] as const;

export const categoryAliases: Record<string, string> = {
  "bon cau": "bồn cầu",
  "ban cau": "bồn cầu",
  "bon ve sinh": "bồn cầu",
  "bet ve sinh": "bồn cầu",
  "xi bet": "bồn cầu",
  "bồn cầu": "bồn cầu",
  "bàn cầu": "bồn cầu",
  "bệ xí": "bồn cầu",
  toilet: "bồn cầu",
  wc: "bồn cầu",
  lavabo: "lavabo",
  "chau lavabo": "lavabo",
  "chau rua": "lavabo",
  "chau rua mat": "lavabo",
  "chau rua tay": "lavabo",
  "bon rua mat": "lavabo",
  "chậu rửa": "lavabo",
  "chậu rửa mặt": "lavabo",
  "bồn rửa": "lavabo",
  "sen cay": "sen cây",
  "sen tam": "sen cây",
  "sen voi tam": "sen cây",
  "bo sen tam": "sen cây",
  "voi sen": "sen cây",
  "voi hoa sen": "sen cây",
  "voi sen tam": "sen cây",
  "voi tam": "sen cây",
  "voi phong tam": "sen cây",
  "tay sen": "sen cây",
  "bat sen": "sen cây",
  "vòi sen": "sen cây",
  "vòi hoa sen": "sen cây",
  "vòi tắm": "sen cây",
  "bon tam": "bồn tắm",
  "bon tam nam": "bồn tắm",
  "bồn tắm nằm": "bồn tắm",
  "phu kien": "phụ kiện phòng tắm",
  "phu kien phong tam": "phụ kiện phòng tắm",
  "phu kien nha tam": "phụ kiện phòng tắm",
  "do nha tam": "phụ kiện phòng tắm",
  "đồ nhà tắm": "phụ kiện phòng tắm",
  "voi lavabo": "vòi lavabo",
  "voi rua mat": "vòi lavabo",
  "voi rua tay": "vòi lavabo",
  "voi chau rua": "vòi lavabo",
  "tu lavabo": "lavabo",
  "tu chau lavabo": "lavabo",
  "tu chau rua": "lavabo",
  "vòi lavabo": "vòi lavabo",
  "vòi rửa mặt": "vòi lavabo",
  "vòi rửa tay": "vòi lavabo",
};

const ceramicAliases = ["gom", "su", "porcelain", "ceramic"];

function hasWord(normalized: string, word: string) {
  return new RegExp(`(?:^|\\s)${word}(?:$|\\s)`).test(normalized);
}

/** Tránh bẫy "trang trí", "trang chủ", "bác sĩ", "nấu ăn" khi đoán màu. */
function hasColorWord(normalized: string, word: string) {
  // Sau khi bỏ dấu, "đen" và "đến" cùng thành "den"; loại chữ nối khoảng giá trước khi đoán màu.
  let colorText = normalized;
  if (word === "den") {
    colorText = colorText.replace(
      new RegExp(
        `(?:tu\\s*)?${AMOUNT_PATTERN}\\s*(?:triệu|trieu|tr|nghin|k|d|vnd)?\\s+den\\s+${AMOUNT_PATTERN}`,
        "g",
      ),
      " ",
    );
    colorText = colorText.replace(
      new RegExp(`(?:len\\s+den|toi\\s+den)\\s+${AMOUNT_PATTERN}`, "g"),
      " ",
    );
    if (!/(?:^|\s)mau\s+den(?:$|\s)/.test(colorText)) {
      colorText = colorText.replace(new RegExp(`\\bden\\s+${AMOUNT_PATTERN}`, "g"), " ");
    }
  }
  const pattern = new RegExp(
    `(?:^|\\s)(?:mau\\s+|màu\\s+|son\\s+|sơn\\s+)?${word}(?:$|\\s)`,
  );
  if (!pattern.test(colorText)) return false;
  if (word === "trang" && /(?:trang\s+(?:tri|chu|bi|phuc|thiet bi))/.test(colorText)) return false;
  if (word === "bac" && /(?:bac\s+(?:si|sĩ)|bac\s+ho)/.test(colorText)) return false;
  if (word === "nau" && /(?:nau\s+(?:an|nuong))/.test(colorText)) return false;
  return true;
}

export function parseRuleCriteria(query: string): SearchCriteria {
  const normalized = normalizeQuery(query);
  const criteria: SearchCriteria = { features: [] };

  const categoryMatch = Object.entries(categoryAliases)
    .map(([key, category]) => [normalizeVietnamese(key), category] as const)
    .sort(([left], [right]) => right.length - left.length)
    .find(([key]) =>
      new RegExp(`(?:^|\\b)${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|\\b)`).test(normalized),
    );
  if (categoryMatch) {
    criteria.category = categoryMatch[1];
  }
  if (
    /(?:^|\s)voi\b.*\b(?:lavabo|chau rua|bon rua|rua mat|rua tay)(?:$|\s)/.test(normalized) ||
    /(?:^|\s)(?:lavabo|chau rua|bon rua|rua mat|rua tay)\b.*\bvoi(?:$|\s)/.test(normalized)
  ) {
    criteria.category = "vòi lavabo";
  }

  if (/(?:duoi|toi da|khong qua|vuot qua|len toi|len den|tam toi da|budget|max)/.test(normalized)) {
    const maxMatch = normalized.match(
      new RegExp(`(?:duoi|toi da|khong qua|vuot qua|len toi|len den|tam toi da|budget|max)\\s*(${AMOUNT_PATTERN})\\s*(triệu|tr|nghin|k|d|vnd)?`, "i"),
    );
    if (maxMatch) {
      const value = parseAmountText(maxMatch[0]);
      if (value !== null) {
        criteria.price_max = value;
      }
    }
  }

  const minMatch = normalized.match(
    new RegExp(`(?:tren|hon|toi thieu|tu)\\s*(${AMOUNT_PATTERN})\\s*(triệu|tr|nghin|k|d|vnd)?\\s*(?:tro len|hoac hon)?`, "i"),
  );
  if (
    minMatch &&
    !normalized.match(new RegExp(`tu\\s*${AMOUNT_PATTERN}\\s*(?:triệu|tr|nghin|k|d|vnd)?\\s*(?:den|toi|-)`, "i"))
  ) {
    const value = parseAmountText(minMatch[0]);
    if (value !== null) criteria.price_min = value;
  }

  {
    const rangeMatch = normalized.match(
      new RegExp(`(?:tu\\s*)?(${AMOUNT_PATTERN})\\s*(triệu|tr|nghin|k|d|vnd)?\\s*(?:den|toi|-)\\s*(${AMOUNT_PATTERN})\\s*(triệu|tr|nghin|k|d|vnd)?`, "i"),
    );
    if (rangeMatch) {
      const isGroupedMoney = (value: string) => /[.,]\d{3}(?:[.,]\d{3})*$/.test(value);
      const minUnit = rangeMatch[2] ?? (isGroupedMoney(rangeMatch[1]) ? "" : rangeMatch[4] ?? "triệu");
      const maxUnit = rangeMatch[4] ?? (isGroupedMoney(rangeMatch[3]) ? "" : rangeMatch[2] ?? "triệu");
      const min = parseAmountText(`${rangeMatch[1]} ${minUnit}`);
      const max = parseAmountText(`${rangeMatch[3]} ${maxUnit}`);
      if (min && max) {
        criteria.price_min = Math.min(min, max);
        criteria.price_max = Math.max(min, max);
      }
    }
  }

  if (
    /(?:khoang|tam|gan|around|budget|ngan sach|gia)/.test(normalized) &&
    criteria.price_min === undefined &&
    criteria.price_max === undefined
  ) {
    const approxMatch = normalized.match(
      new RegExp(`(?:khoang|tam|gan|around|budget|ngan sach|gia)\\s*(?:khoang\\s*)?(${AMOUNT_PATTERN})\\s*(triệu|tr|nghin|k|d|vnd)?`, "i"),
    );
    if (approxMatch) {
      const value = parseAmountText(approxMatch[0]);
      if (value) {
        criteria.price_min = Math.round(value * 0.8);
        criteria.price_max = Math.round(value * 1.2);
      }
    }
  }

  if (criteria.price_min === undefined && criteria.price_max === undefined) {
    const amountWithUnit = normalized.match(
      new RegExp(`(${AMOUNT_PATTERN})\\s*(triệu|nghin|k)(?=$|\\s|[,!?;.:])`, "i"),
    );
    if (amountWithUnit) {
      const value = parseAmountText(amountWithUnit[0]);
      if (value) {
        criteria.price_min = Math.round(value * 0.8);
        criteria.price_max = Math.round(value * 1.2);
      }
    }
  }

  if (
    /(?:phong tam|phong ve sinh|nha ve sinh|toilet|wc|khong gian|dien tich)\s+(?:rat\s+)?(?:nho|hep|mini|compact)\b/.test(
      normalized,
    ) ||
    /(?:nho gon|compact)\b/.test(normalized)
  ) {
    criteria.room_size = "nho";
  }

  if (/(?:phong tam|phong ve sinh|nha ve sinh|toilet|wc|khong gian)\s+vua\b/.test(normalized)) {
    criteria.room_size = "vua";
  }

  if (
    /(?:phong tam|phong ve sinh|nha ve sinh|toilet|wc|khong gian|dien tich)\s+(?:rat\s+)?(?:rong|lon|thoang)\b/.test(
      normalized,
    )
  ) {
    criteria.room_size = "rong";
  }

  if (/(?:het hang|tam het|khong con hang|out of stock)/.test(normalized)) {
    criteria.in_stock = false;
  } else if (/(?:con hang|co hang|san hang|hang san co|available|in stock)/.test(normalized)) {
    criteria.in_stock = true;
  }

  const roomAreaMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:m2|m²|met\s+vuong)(?=$|\s|[,!?;.:)])/i);
  if (roomAreaMatch) {
    const roomArea = Number(roomAreaMatch[1].replace(",", "."));
    if (Number.isFinite(roomArea) && roomArea > 0 && roomArea <= 100) criteria.room_area_m2 = roomArea;
  }

  if (hasWord(normalized, "toto")) criteria.brand = "TOTO";
  if (hasWord(normalized, "inax")) criteria.brand = "INAX";
  if (hasWord(normalized, "grohe")) criteria.brand = "Grohe";
  if (hasWord(normalized, "kohler")) criteria.brand = "Kohler";
  if (normalized.includes("villeroy")) criteria.brand = "Villeroy & Boch";

  if (hasColorWord(normalized, "trang")) criteria.color = "Trắng";
  if (hasColorWord(normalized, "den")) criteria.color = "Đen";
  if (hasColorWord(normalized, "xanh")) criteria.color = "Xanh";
  if (/(?:^|\s)mau\s+(?:be|kem)(?:$|\s)/.test(normalized)) criteria.color = "Be";
  if (hasColorWord(normalized, "xam")) criteria.color = "Xám";
  if (hasColorWord(normalized, "bac")) criteria.color = "Bạc";
  if (hasColorWord(normalized, "nau")) criteria.color = "Nâu";
  if (/(?:^|\s)mau\s+cat(?:$|\s)/.test(normalized)) criteria.color = "Cát";

  if (hasWord(normalized, "inox")) criteria.material = "Inox";
  else if (hasWord(normalized, "thep") || /(?:^|\s)bang\s+thep(?:$|\s)/.test(normalized)) criteria.material = "Thép";
  if (
    /(?:^|\s)(?:chat\s+lieu\s+)?(?:gom|su|porcelain|ceramic)(?:$|\s)/.test(normalized) &&
    !normalized.includes("su dung")
  ) {
    criteria.material = "Gốm";
  }
  if (/(?:^|\s)(?:da\s+mai|bang\s+da)(?:$|\s)/.test(normalized)) criteria.material = "Đá mài";
  if (hasWord(normalized, "composite")) criteria.material = "Composite";
  if (/(?:^|\s)(?:chat\s+lieu\s+kinh|bang\s+kinh)(?:$|\s)/.test(normalized) && !normalized.includes("kinh te")) {
    criteria.material = "Kính";
  }

  if (normalized.includes("tiet kiem nuoc") || normalized.includes("it ton nuoc") || normalized.includes("tiet kiem")) {
    criteria.features?.push("tiết kiệm nước");
  }
  if (normalized.includes("nap dong em") || normalized.includes("dong em") || normalized.includes("nap em")) {
    criteria.features?.push("nắp đóng êm");
  }
  if (normalized.includes("rimless") || normalized.includes("khong vanh")) {
    criteria.features?.push("thiết kế rimless");
  }
  if (normalized.includes("am tuong")) criteria.features?.push("lắp âm tường");
  if (normalized.includes("treo tuong")) criteria.features?.push("treo tường");
  if (normalized.includes("cong nghe cham") || normalized.includes("cam ung")) {
    criteria.features?.push("công nghệ chạm");
  }
  if (normalized.includes("tam suc") || normalized.includes("massage")) {
    criteria.features?.push("tắm sục");
  }

  return criteria;
}

export function parseSearchQuery(query: string) {
  const cleaned = normalizeQuery(query);
  const rules = parseRuleCriteria(cleaned);
  const features = Array.from(new Set(rules.features ?? []));
  return { ...rules, features };
}

export function hasProductCriteria(criteria: SearchCriteria) {
  return Boolean(
    criteria.category ||
      criteria.price_min !== undefined ||
      criteria.price_max !== undefined ||
      criteria.brand ||
      criteria.color ||
      criteria.material ||
      criteria.room_size ||
      criteria.room_area_m2 ||
      criteria.in_stock !== undefined ||
      criteria.features?.length,
  );
}

export function mergeCriteria(base: SearchCriteria, next: SearchCriteria): SearchCriteria {
  return {
    category: next.category ?? base.category,
    price_min: next.price_min ?? base.price_min,
    price_max: next.price_max ?? base.price_max,
    brand: next.brand ?? base.brand,
    color: next.color ?? base.color,
    material: next.material ?? base.material,
    room_size: next.room_size ?? base.room_size,
    room_area_m2: next.room_area_m2 ?? base.room_area_m2,
    in_stock: next.in_stock ?? base.in_stock,
    features: Array.from(new Set([...(base.features ?? []), ...(next.features ?? [])])),
  };
}

export function describeCriteria(criteria: SearchCriteria) {
  const details: string[] = [];
  if (criteria.category) details.push(`danh mục ${criteria.category}`);
  if (criteria.brand) details.push(`thương hiệu ${criteria.brand}`);
  if (criteria.price_min !== undefined && criteria.price_max !== undefined) {
    details.push(`ngân sách ${formatCurrency(criteria.price_min)}–${formatCurrency(criteria.price_max)}`);
  } else if (criteria.price_max !== undefined) {
    details.push(`giá tối đa ${formatCurrency(criteria.price_max)}`);
  } else if (criteria.price_min !== undefined) {
    details.push(`giá từ ${formatCurrency(criteria.price_min)}`);
  }
  if (criteria.room_size === "nho") details.push("cho phòng tắm nhỏ");
  if (criteria.room_size === "vua") details.push("cho phòng tắm vừa");
  if (criteria.room_size === "rong") details.push("cho phòng tắm rộng");
  if (criteria.room_area_m2) details.push(`phòng tắm khoảng ${criteria.room_area_m2}m²`);
  if (criteria.color) details.push(`màu ${criteria.color}`);
  if (criteria.material) details.push(`chất liệu ${criteria.material}`);
  if (criteria.in_stock !== undefined) details.push(criteria.in_stock ? "còn hàng" : "hết hàng");
  if (criteria.features?.length) details.push(`tính năng: ${criteria.features.join(", ")}`);
  return details;
}

function materialMatches(productMaterial: string, requestedMaterial: string) {
  const product = normalizeVietnamese(productMaterial);
  const requested = normalizeVietnamese(requestedMaterial);
  if (!product || !requested) return false;
  if (ceramicAliases.includes(requested)) {
    return ceramicAliases.some((alias) => containsNormalizedPhrase(product, alias));
  }
  return containsNormalizedPhrase(product, requested);
}

function containsNormalizedPhrase(value: string, phrase: string) {
  const normalizedValue = normalizeVietnamese(value).replace(/[^a-z0-9]+/g, " ").trim();
  const normalizedPhrase = normalizeVietnamese(phrase).replace(/[^a-z0-9]+/g, " ").trim();
  return Boolean(normalizedPhrase) && ` ${normalizedValue} `.includes(` ${normalizedPhrase} `);
}

function colorMatches(productColor: string, requestedColor: string) {
  const requested = normalizeVietnamese(requestedColor);
  const aliases = requested === "be" ? ["be", "kem"] : [requested];
  return aliases.some((alias) => containsNormalizedPhrase(productColor, alias));
}

function featureMatches(product: Product, features: string[]) {
  const aliases: Record<string, string[]> = {
    "tiet kiem nuoc": ["tiet kiem nuoc", "giam tieu hao nuoc", "it ton nuoc", "tieu thu nuoc thap"],
    "nap dong em": ["nap dong em", "dong em", "softclose", "soft close"],
    "thiet ke rimless": ["thiet ke rimless", "rimless", "khong vanh"],
    "lap am tuong": ["lap am tuong", "am tuong"],
    "treo tuong": ["treo tuong"],
    "cong nghe cham": ["cong nghe cham", "cam ung"],
    "tam suc": ["tam suc", "massage"],
  };
  const normalizedFeatures = product.features.map(normalizeVietnamese);
  const matched = features.filter((feature) => {
    const requested = normalizeVietnamese(feature);
    const candidates = aliases[requested] ?? [requested];
    return normalizedFeatures.some((item) => candidates.some((alias) => containsNormalizedPhrase(item, alias)));
  });
  return { matched, missing: features.filter((feature) => !matched.includes(feature)) };
}

/** Mọi tiêu chí đã nhận diện, kể cả mức rộng/hẹp của phòng, đều được lọc cứng. */
export function filterProductsByCriteria(products: Product[], criteria: SearchCriteria) {
  return products.filter((product) => {
    if (criteria.category && normalizeVietnamese(product.category) !== normalizeVietnamese(criteria.category)) return false;
    if (criteria.brand && normalizeVietnamese(product.brand) !== normalizeVietnamese(criteria.brand)) return false;
    if (criteria.price_min !== undefined && product.price < criteria.price_min) return false;
    if (criteria.price_max !== undefined && product.price > criteria.price_max) return false;
    if (criteria.room_size === "nho" && !(product.is_compact || product.min_room_area_m2 <= 7)) return false;
    if (criteria.room_size === "vua" && product.min_room_area_m2 > 12) return false;
    if (criteria.room_size === "rong" && product.min_room_area_m2 < 10) return false;
    if (criteria.color && !colorMatches(product.color, criteria.color)) return false;
    if (criteria.material && !materialMatches(product.material, criteria.material)) return false;
    if (criteria.room_area_m2 !== undefined && product.min_room_area_m2 > criteria.room_area_m2) return false;
    if (criteria.in_stock !== undefined && product.in_stock !== criteria.in_stock) return false;
    if (criteria.features?.length && featureMatches(product, criteria.features).missing.length) return false;
    return true;
  });
}

export function buildReason(product: Product, criteria: SearchCriteria) {
  const parts: string[] = [];
  const tradeoffs: string[] = [];

  if (criteria.category) {
    if (normalizeVietnamese(product.category) === normalizeVietnamese(criteria.category)) {
      parts.push(`đúng danh mục ${product.category}`);
    } else {
      tradeoffs.push(`khác danh mục ưu tiên (${product.category})`);
    }
  }

  if (criteria.price_max !== undefined) {
    if (product.price <= criteria.price_max) {
      parts.push(`giá ${formatCurrency(product.price)} trong mức tối đa`);
    } else {
      tradeoffs.push(`cao hơn mức tối đa khoảng ${formatCurrency(product.price - criteria.price_max)}`);
    }
  }

  if (criteria.price_min !== undefined && product.price < criteria.price_min) {
    tradeoffs.push(`thấp hơn mức giá dự kiến khoảng ${formatCurrency(criteria.price_min - product.price)}`);
  }

  if (criteria.room_size === "nho") {
    if (product.is_compact || product.min_room_area_m2 <= 7) {
      parts.push("kiểu gọn, phù hợp phòng tắm nhỏ");
    } else {
      tradeoffs.push("cần không gian lắp đặt rộng hơn");
    }
  } else if (criteria.room_size === "vua" && product.min_room_area_m2 <= 12) {
    parts.push("phù hợp không gian vừa");
  } else if (criteria.room_size === "rong" && product.min_room_area_m2 >= 10) {
    parts.push("phù hợp không gian rộng");
  }

  if (criteria.room_area_m2) {
    if (product.min_room_area_m2 <= criteria.room_area_m2) {
      parts.push(`yêu cầu phòng từ ${product.min_room_area_m2}m², trong mức ${criteria.room_area_m2}m²`);
    } else {
      tradeoffs.push(`cần phòng từ ${product.min_room_area_m2}m², lớn hơn diện tích bạn nêu`);
    }
  }

  if (criteria.brand) {
    if (product.brand.toLowerCase() === criteria.brand.toLowerCase()) {
      parts.push(`thương hiệu ${product.brand}`);
    } else {
      tradeoffs.push(`khác thương hiệu ưu tiên ${criteria.brand}`);
    }
  }

  if (criteria.color) {
    if (colorMatches(product.color, criteria.color)) {
      parts.push(`màu ${product.color}`);
    } else {
      tradeoffs.push(`màu ${product.color}, khác màu ưu tiên`);
    }
  }

  if (criteria.material) {
    if (materialMatches(product.material, criteria.material)) {
      parts.push(`chất liệu ${product.material}`);
    } else {
      tradeoffs.push(`chất liệu ${product.material}, khác chất liệu ưu tiên`);
    }
  }

  if (criteria.in_stock !== undefined) {
    parts.push(criteria.in_stock ? "catalog báo còn hàng" : "catalog báo hết hàng");
  }

  const features = criteria.features ?? [];
  const { matched, missing } = featureMatches(product, features);
  if (matched.length) parts.push(`đáp ứng ${matched.length}/${features.length} tính năng ưu tiên`);
  if (missing.length) tradeoffs.push(`chưa thể hiện ${missing.join(", ")}`);

  const summary = parts.length
    ? parts.join("; ")
    : `lựa chọn tham khảo trong danh mục, giá ${formatCurrency(product.price)}`;
  return tradeoffs.length ? `${summary}. Lưu ý: ${tradeoffs.join("; ")}.` : `${summary}.`;
}

/**
 * Ước lượng mức độ khớp để UI hiển thị badge thay vì chỉ một banner cảnh báo chung.
 * - full: khớp mọi tiêu chí cứng đã nêu
 * - partial: khớp một phần (còn ít nhất 1 tiêu chí lệch)
 * - closest: lệch tiêu chí quan trọng nhất (được giữ cho dữ liệu tương thích cũ)
 */
export function estimateMatchConfidence(product: Product, criteria: SearchCriteria): MatchConfidence {
  const checks: boolean[] = [];
  const critical: boolean[] = [];

  if (criteria.category) {
    const ok = normalizeVietnamese(product.category) === normalizeVietnamese(criteria.category);
    checks.push(ok);
    critical.push(ok);
  }
  if (criteria.brand) {
    const ok = product.brand.toLowerCase() === criteria.brand.toLowerCase();
    checks.push(ok);
    critical.push(ok);
  }
  if (criteria.in_stock !== undefined) {
    const ok = product.in_stock === criteria.in_stock;
    checks.push(ok);
    critical.push(ok);
  }
  if (criteria.price_max !== undefined) {
    const ok = product.price <= criteria.price_max;
    checks.push(ok);
    critical.push(ok);
  }
  if (criteria.price_min !== undefined) checks.push(product.price >= criteria.price_min);
  if (criteria.color) checks.push(colorMatches(product.color, criteria.color));
  if (criteria.material) checks.push(materialMatches(product.material, criteria.material));
  if (criteria.room_size === "nho") checks.push(product.is_compact || product.min_room_area_m2 <= 7);
  if (criteria.room_size === "vua") checks.push(product.min_room_area_m2 <= 12);
  if (criteria.room_size === "rong") checks.push(product.min_room_area_m2 >= 10);
  if (criteria.room_area_m2) {
    const fits = product.min_room_area_m2 <= criteria.room_area_m2;
    checks.push(fits);
    critical.push(fits);
  }

  const features = criteria.features ?? [];
  if (features.length) {
    const { missing } = featureMatches(product, features);
    checks.push(missing.length === 0);
  }

  if (!checks.length) return "closest";
  if (critical.some((ok) => !ok)) return "closest";
  const passed = checks.filter(Boolean).length;
  return passed === checks.length ? "full" : "partial";
}

export function rankProducts(products: Product[], criteria: SearchCriteria) {
  return products
    .map((product) => {
      let score = 0;
      if (criteria.category) {
        score += normalizeVietnamese(product.category) === normalizeVietnamese(criteria.category) ? 60 : -25;
      }
      if (criteria.brand) {
        score += product.brand.toLowerCase() === criteria.brand.toLowerCase() ? 24 : -10;
      }
      if (criteria.price_min !== undefined) {
        score +=
          product.price >= criteria.price_min
            ? 10
            : -Math.min(20, Math.ceil(((criteria.price_min - product.price) / criteria.price_min) * 20));
      }
      if (criteria.price_max !== undefined) {
        score +=
          product.price <= criteria.price_max
            ? 15
            : -Math.min(35, Math.ceil(((product.price - criteria.price_max) / criteria.price_max) * 35));
      }
      if (criteria.room_size === "nho") {
        score += product.is_compact || product.min_room_area_m2 <= 7 ? 18 : -12;
      } else if (criteria.room_size === "vua") {
        score += product.min_room_area_m2 <= 12 ? 10 : -5;
      } else if (criteria.room_size === "rong") {
        score += product.min_room_area_m2 >= 10 ? 10 : -5;
      }
      if (criteria.room_area_m2) {
        const excessArea = Math.max(0, product.min_room_area_m2 - criteria.room_area_m2);
        score += excessArea === 0 ? 20 : -Math.min(36, Math.ceil((excessArea / criteria.room_area_m2) * 18));
      }
      if (criteria.color) {
        score += colorMatches(product.color, criteria.color) ? 12 : -5;
      }
      if (criteria.material) {
        score += materialMatches(product.material, criteria.material) ? 12 : -5;
      }
      if (product.in_stock) score += 5;

      const features = criteria.features ?? [];
      if (features.length > 0) {
        const { matched } = featureMatches(product, features);
        score += matched.length * 10 - (features.length - matched.length) * 4;
      }

      return {
        ...product,
        score,
        reason: buildReason(product, criteria),
        match_confidence: estimateMatchConfidence(product, criteria),
      } satisfies SearchResultItem;
    })
    .sort((a, b) => b.score - a.score || a.price - b.price);
}
