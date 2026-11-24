/**
 * Chuẩn hoá "gợi ý câu hỏi tiếp theo" trước khi trả về client.
 *
 * Vì sao cần: các gợi ý được render thành nút để **khách** bấm gửi, nhưng model
 * thường viết chúng theo giọng trợ lý ("Bạn cần tìm bồn cầu cho diện tích bao
 * nhiêu m2?") và lặp lại đúng câu vừa hỏi trong `reply`. Khi đó bấm vào sẽ thành
 * "hỏi ngược" chính mình. Hàm này chỉ giữ câu đúng giọng khách hàng.
 *
 * Module thuần → test được bằng `node --test`.
 */
import { normalizeVietnamese } from "./text";

const STAFF_TERMS = ["nhan vien", "tu van vien", "lien he", "goi lai", "hotline"];

const DEFAULT_FOLLOW_UPS = [
  "Tư vấn bồn cầu dưới 5 triệu",
  "Mẫu nhỏ gọn cho phòng 4m²",
  "Hỏi chính sách bảo hành",
];

const MAX_FOLLOW_UPS = 3;
const MAX_LENGTH = 80;

function tokens(value: string) {
  return new Set(
    normalizeVietnamese(value)
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 1),
  );
}

/** Gợi ý đang nói với khách ("Bạn …", "Quý khách …") thay vì giọng khách hàng. */
function isAssistantAddressed(text: string) {
  const normalized = normalizeVietnamese(text);
  return /^(ban|quy khach|anh\/?chi|chi|anh)\b/.test(normalized);
}

/**
 * Chỉ cần chống lặp khi gợi ý LÀ MỘT CÂU HỎI trùng câu trợ lý vừa hỏi.
 * Câu trả lời ngắn ("Phòng tắm khoảng 4m²") trùng từ khóa với câu hỏi là
 * chuyện bình thường và rất hữu ích, không được coi là lặp.
 */
const QUESTION_WORDS = ["bao nhieu", "bao lau", "nao", "gi", "may", "khong", "chua"];

function isQuestion(text: string) {
  return /\?\s*$/.test(text) || questionWords(text).length > 0;
}

function questionWords(text: string) {
  const normalized = normalizeVietnamese(text);
  return QUESTION_WORDS.filter((word) => new RegExp(`(?:^|\\s)${word}(?:$|\\s)`).test(normalized));
}

function isDuplicateOfReply(suggestion: string, reply: string) {
  if (!isQuestion(suggestion)) return false;

  const suggestionTokens = tokens(suggestion);
  if (!suggestionTokens.size) return true;
  const suggestionWords = questionWords(suggestion);

  const replyQuestions = reply.match(/[^.!?…\n]*\?/g) ?? [];
  for (const question of replyQuestions) {
    const questionTokens = tokens(question);
    let shared = 0;
    for (const token of suggestionTokens) {
      if (questionTokens.has(token)) shared += 1;
    }
    if (shared < 2) continue;

    // Cùng loại câu hỏi (cùng từ để hỏi) + cùng chủ đề ⇒ coi là lặp.
    const questionWordsInReply = questionWords(question);
    if (suggestionWords.some((word) => questionWordsInReply.includes(word))) return true;

    // Hoặc gần như trùng nguyên câu hỏi.
    if (shared / suggestionTokens.size >= 0.75) return true;
  }

  return false;
}

export function sanitizeFollowUpQuestions(
  questions: string[],
  reply: string,
  fallback: string[] = DEFAULT_FOLLOW_UPS,
): string[] {
  if (!questions.length) return [];

  const seen = new Set<string>();
  const kept: string[] = [];

  for (const raw of questions) {
    const candidate = raw.replace(/\s+/g, " ").trim();
    if (!candidate || candidate.length > MAX_LENGTH) continue;

    const key = normalizeVietnamese(candidate).replace(/[?.!,]+$/g, "");
    if (!key || seen.has(key)) continue;
    if (STAFF_TERMS.some((term) => key.includes(term))) continue;
    if (isAssistantAddressed(candidate)) continue;
    if (isDuplicateOfReply(candidate, reply)) continue;

    seen.add(key);
    kept.push(candidate);
    if (kept.length === MAX_FOLLOW_UPS) break;
  }

  // Toàn bộ bị loại → dùng gợi ý mặc định (vẫn là câu khách nói được).
  return kept.length ? kept : fallback;
}

export { DEFAULT_FOLLOW_UPS };

// ────────────────────────────────────────────────────────────────
// Phát hiện câu trả lời bị "kẹt vòng lặp" (degenerate repetition)
// ────────────────────────────────────────────────────────────────
export type RepetitionCheck = {
  degenerate: boolean;
  /** Vị trí bắt đầu đoạn lặp trong văn bản. */
  index: number;
  /** Đơn vị bị lặp (để log/điều tra). */
  unit: string;
  /** Số lần lặp liên tiếp. */
  repeats: number;
};

const MIN_UNIT = 6;
const MAX_UNIT = 40;
const MIN_REPEATS = 5;
const SCAN_LIMIT = 4000;

/**
 * Model đôi khi lặp cùng một cụm từ hàng chục lần (thường khi cố dựng bảng
 * markdown), tạo ra khối chữ vô nghĩa. Hàm này tìm đoạn lặp liên tiếp
 * (>= 5 lần, đơn vị >= 6 ký tự) bằng quét trực tiếp để không phụ thuộc regex.
 */
export function findDegenerateRepetition(text: string): RepetitionCheck {
  const limit = Math.min(text.length, SCAN_LIMIT);

  for (let size = MIN_UNIT; size <= MAX_UNIT; size += 1) {
    for (let start = 0; start + size * MIN_REPEATS <= limit; start += 1) {
      const unit = text.slice(start, start + size);
      if (!unit.trim()) continue;

      let repeats = 1;
      let cursor = start + size;
      while (cursor + size <= limit && text.slice(cursor, cursor + size) === unit) {
        repeats += 1;
        cursor += size;
      }

      if (repeats >= MIN_REPEATS) {
        return { degenerate: true, index: start, unit, repeats };
      }
    }
  }

  return { degenerate: false, index: -1, unit: "", repeats: 0 };
}

/** Cắt tại chỗ bắt đầu lặp, giữ phần nội dung còn đọc được. */
export function trimDegenerateRepetition(text: string): string {
  const found = findDegenerateRepetition(text);
  if (!found.degenerate) return text;

  const head = text.slice(0, found.index).trimEnd();
  if (head.length >= 40) return `${head} …`;
  return text.slice(0, 200).trimEnd();
}
