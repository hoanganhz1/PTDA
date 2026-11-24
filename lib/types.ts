import type { SearchCriteria } from "./schemas";

export type Product = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  category: string;
  brand: string;
  price: number;
  original_price: number | null;
  color: string;
  material: string;
  dimensions_mm: {
    width: number;
    depth: number;
    height: number;
  };
  min_room_area_m2: number;
  is_compact: boolean;
  features: string[];
  warranty_months: number;
  short_description: string;
  in_stock: boolean;
  image_placeholder_key: string;
};

/** Dòng thô đọc từ SQLite (JSON lưu dạng TEXT, boolean lưu dạng 0/1). */
export type ProductRow = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  category: string;
  brand: string;
  price: number;
  original_price: number | null;
  color: string;
  material: string;
  dimensions_mm: string;
  min_room_area_m2: number;
  is_compact: number;
  features: string;
  warranty_months: number;
  short_description: string;
  in_stock: number;
  image_placeholder_key: string;
};

export type MatchConfidence = "full" | "partial" | "closest";

export type SearchResultItem = Product & {
  reason: string;
  score: number;
  match_confidence: MatchConfidence;
};

/** Hình dạng sản phẩm trả về cho client (chat, search, thẻ sản phẩm). */
export type ProductSummary = {
  id: string;
  /** Mã SKU duy nhất; optional để đọc được lịch sử chat tạo từ phiên bản cũ. */
  sku?: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  original_price: number | null;
  short_description: string;
  in_stock: boolean;
  image_placeholder_key: string;
  reason?: string;
  match_confidence?: MatchConfidence;
};

export type ChatIntent = "product_advice" | "policy" | "handoff" | "out_of_scope";

export type { SearchCriteria };
