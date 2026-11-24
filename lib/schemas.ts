import { z } from "zod";

/**
 * Nguồn schema duy nhất cho toàn bộ app.
 * Type TS được suy ra bằng `z.infer` để tránh khai báo trùng ở nhiều nơi.
 */

export const searchCriteriaSchema = z.object({
  category: z.string().optional(),
  price_min: z.number().optional(),
  price_max: z.number().optional(),
  brand: z.string().optional(),
  color: z.string().optional(),
  material: z.string().optional(),
  room_size: z.enum(["nho", "vua", "rong"]).optional(),
  room_area_m2: z.number().positive().max(100).optional(),
  in_stock: z.boolean().optional(),
  features: z.array(z.string()).default([]),
});

export type SearchCriteria = z.infer<typeof searchCriteriaSchema>;

export const chatRequestSchema = z.object({
  sessionId: z.string().trim().min(1).max(128),
  message: z.string().trim().min(1).max(1500),
});

export const handoffRequestSchema = z.object({
  sessionId: z.string().trim().min(1).max(128),
  name: z.string().trim().min(2).max(100),
  contact: z.string().trim().min(5).max(150),
  message: z.string().trim().max(1000).optional().default(""),
});

export const adminLoginSchema = z.object({
  password: z.string().min(1).max(200),
});

/**
 * Kết quả Gemini trả về cho luồng tư vấn chính.
 *
 * Cố ý KHÔNG đặt giới hạn cứng cho `reply`/`follow_up_questions`: nếu model trả
 * 4 gợi ý thay vì 3, việc reject cả object sẽ làm mất toàn bộ câu trả lời.
 * Việc cắt gọn được làm ở tầng sau (`sanitizeFollowUpQuestions`, cắt mã, cắt độ dài).
 * Các trường enum/boolean dùng `.catch()` để một giá trị lạ không kéo sập cả lượt chat.
 */
export const aiConsultantSchema = z.object({
  reply: z.string().trim().min(1),
  recommended_product_codes: z.array(z.string()).default([]),
  follow_up_questions: z.array(z.string()).default([]),
  intent: z.enum(["greeting", "gratitude", "product", "policy", "general"]).catch("general"),
  handoff_requested: z.boolean().catch(false),
  is_policy_answer: z.boolean().catch(false),
  clarification_needed: z.boolean().catch(false),
  confidence: z.enum(["high", "medium", "low"]).catch("high"),
});

export type AiConsultantResult = z.infer<typeof aiConsultantSchema>;

/** Một lượt chat trả về client (dùng chung cho REST và stream). */
export const chatPayloadSchema = z.object({
  message: z.string(),
  products: z.array(
    z.object({
      id: z.string(),
      sku: z.string().optional(),
      slug: z.string(),
      name: z.string(),
      brand: z.string(),
      category: z.string(),
      price: z.number(),
      original_price: z.number().nullable().optional(),
      short_description: z.string(),
      in_stock: z.boolean(),
      image_placeholder_key: z.string(),
      reason: z.string().optional(),
      match_confidence: z.enum(["full", "partial", "closest"]).optional(),
    }),
  ),
  product_ids: z.array(z.string()),
  needs_handoff: z.boolean(),
  follow_up_questions: z.array(z.string()),
  mode: z.enum(["live", "mock", "fallback"]),
});

export type ChatPayload = z.infer<typeof chatPayloadSchema>;

/** Metadata lưu kèm message assistant để khôi phục thẻ sản phẩm sau khi reload. */
export const chatMessageMetaSchema = z.object({
  products: z.array(z.unknown()).optional(),
  follow_up_questions: z.array(z.string()).optional(),
});

export type ChatMessageMeta = z.infer<typeof chatMessageMetaSchema>;
