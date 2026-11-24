/**
 * Chuẩn hoá & định dạng văn bản tiếng Việt.
 * Module thuần (không truy cập DB, không đọc file) để test bằng `node --test`.
 */

export function normalizeVietnamese(value: string) {
  return value
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Chuẩn hoá câu truy vấn của khách: bỏ dấu, đổi cách viết tiền tệ phổ biến
 * ("5tr", "5 củ", "500k") về dạng số + đơn vị đọc được.
 */
export function normalizeQuery(input: string) {
  let value = normalizeVietnamese(input);
  value = value.replace(/(\d+(?:[.,]\d+)?)\s*m\b(?![²2])/g, "$1 triệu");
  value = value.replace(/(\d+(?:[.,]\d+)?)\s*tr\b/g, "$1 triệu");
  value = value.replace(/\btr\b/g, "triệu");
  value = value.replace(/\btri\b/g, "triệu");
  value = value.replace(/\btrieu\b/g, "triệu");
  value = value.replace(/\bcu\b/g, "triệu");
  value = value.replace(/\bnghin\b/g, "nghin");
  value = value.replace(/(\d+(?:[.,]\d+)?)\s*k\b/g, "$1 nghin");
  value = value.replace(/\bk\b/g, "nghin");
  return value;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Đọc số tiền từ một cụm văn bản đã chuẩn hoá ("5 triệu", "500k", "3,5tr"). */
export function parseAmountText(value: string): number | null {
  const normalized = normalizeQuery(value);
  const match = normalized.match(/(\d+(?:[.,]\d+)*)(?:\s*)(triệu|nghin|k|d|vnd)?/i);
  if (!match) {
    return null;
  }

  const groups = match[1].split(/[.,]/);
  const groupedNumber = groups.length > 1 && groups.slice(1).every((group) => group.length === 3);
  const amount = Number(groupedNumber ? groups.join("") : match[1].replace(",", "."));
  if (!Number.isFinite(amount)) return null;

  const unit = match[2]?.toLowerCase() ?? "";
  if (unit === "triệu" || normalized.includes("triệu")) {
    return Math.round(amount * 1000000);
  }
  if (unit === "nghin" || unit === "k") {
    return Math.round(amount * 1000);
  }
  return Math.round(amount);
}
