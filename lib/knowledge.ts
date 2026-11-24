import fs from "node:fs";
import path from "node:path";
import { POLICY_TOPICS, type PolicyTopic } from "./policy-keywords";
import { normalizeVietnamese } from "./text";

/**
 * Đọc & truy xuất tài liệu chính sách trong `data/knowledge`.
 *
 * Hai chế độ sử dụng:
 * - `getPolicyContext()` – retrieval: chỉ gửi cho LLM (các) tài liệu liên quan nhất.
 * - `findRelevantKnowledge()` – dựng câu trả lời offline theo mục (chế độ mock).
 *
 * Nội dung file được cache theo mtime nên không đọc đĩa lại mỗi request.
 */

const knowledgeDir = path.join(process.cwd(), "data", "knowledge");

type FileCache = Map<string, { mtimeMs: number; content: string }>;
const globalForKnowledge = globalThis as unknown as { __kidohomesKnowledge?: FileCache };

function cache() {
  return (globalForKnowledge.__kidohomesKnowledge ??= new Map());
}

function listKnowledgeFiles() {
  if (!fs.existsSync(knowledgeDir)) return [] as string[];
  return fs
    .readdirSync(knowledgeDir)
    .filter((file) => file.endsWith(".md"))
    .sort();
}

/** Đọc file có cache theo mtime → sửa .md là nội dung tự cập nhật. */
function readPolicyFile(file: string): string {
  const filePath = path.join(knowledgeDir, file);
  if (!fs.existsSync(filePath)) return "";

  const stat = fs.statSync(filePath);
  const cached = cache().get(file);
  if (cached && cached.mtimeMs === stat.mtimeMs) return cached.content;

  const content = fs.readFileSync(filePath, "utf8");
  cache().set(file, { mtimeMs: stat.mtimeMs, content });
  return content;
}

export function getKnowledgeText() {
  return listKnowledgeFiles()
    .map((file) => readPolicyFile(file).trim())
    .filter(Boolean)
    .join("\n\n---\n\n");
}

function removeMarkdown(text: string) {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*\|?[-| ]+\|?\s*$/gm, "")
    .replace(/\s*\|\s*/g, " — ")
    .trim();
}

const SAMPLE_PATTERN = /bản mẫu|nội dung mẫu|cần .* xác nhận|chưa được .*xác nhận/i;

export function isSamplePolicy(text: string) {
  return SAMPLE_PATTERN.test(text);
}

function scoreTopic(topic: PolicyTopic, normalizedQuery: string) {
  return topic.keywords.reduce(
    (score, keyword) => (normalizedQuery.includes(keyword) ? score + 1 : score),
    0,
  );
}

export type PolicyContext = {
  /** Nội dung gửi cho LLM (rỗng nếu không tìm thấy chủ đề phù hợp). */
  text: string;
  isSample: boolean;
  topics: string[];
  matched: boolean;
};

/**
 * Retrieval cho luồng live: chỉ nạp tối đa `maxTopics` tài liệu khớp chủ đề
 * thay vì gửi toàn bộ kho chính sách cho Gemini.
 */
export function getPolicyContext(query: string, maxTopics = 2): PolicyContext {
  const normalized = normalizeVietnamese(query);
  const ranked = POLICY_TOPICS.map((topic) => ({ topic, score: scoreTopic(topic, normalized) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!ranked.length) {
    return { text: "", isSample: false, topics: [], matched: false };
  }

  // Luôn lấy tài liệu khớp nhất; chỉ thêm tài liệu khác khi nó có cùng điểm
  // (câu hỏi gộp 2 chủ đề), tránh kéo theo tài liệu chỉ trùng 1 từ khóa yếu.
  const best = ranked[0].score;
  const selected = ranked.filter((item) => item.score >= best).slice(0, maxTopics);

  const blocks = selected
    .map(({ topic }) => {
      const content = readPolicyFile(topic.file).trim();
      return content ? `## Tài liệu: ${topic.label} (${topic.file})\n${removeMarkdown(content)}` : "";
    })
    .filter(Boolean);

  const text = blocks.join("\n\n---\n\n");
  return {
    text,
    isSample: isSamplePolicy(text),
    topics: selected.map(({ topic }) => topic.label),
    matched: text.length > 0,
  };
}

export type OfflineKnowledgeResult = {
  available: boolean;
  isSample: boolean;
  text: string;
};

/**
 * Chế độ offline: chọn 1 chủ đề khớp nhất rồi trả về các mục liên quan
 * (bảo hành trả toàn bộ tài liệu vì nội dung ngắn và thường được hỏi tổng quát).
 */
export function findRelevantKnowledge(query: string): OfflineKnowledgeResult {
  const normalized = normalizeVietnamese(query);
  const topic = POLICY_TOPICS.map((candidate) => ({
    ...candidate,
    score: scoreTopic(candidate, normalized),
  }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score)[0];

  if (!topic) {
    return {
      available: false,
      isSample: false,
      text: "Tôi chưa tìm thấy thông tin chính sách phù hợp trong tài liệu hiện có. Bạn có thể hỏi cụ thể về bảo hành, đổi trả, giao hàng, lắp đặt hoặc thanh toán.",
    };
  }

  const content = readPolicyFile(topic.file).trim();
  if (!content) {
    return {
      available: false,
      isSample: false,
      text: "Hiện chưa có nội dung cho chính sách này trong tài liệu chatbot.",
    };
  }

  const isSample = isSamplePolicy(content);
  if (topic.file === "policy-bao-hanh.md") {
    return { available: true, isSample, text: removeMarkdown(content) };
  }

  const sections = content.split(/(?=^##\s)/m);
  const normalizedWords = normalized.split(/\s+/).filter((word) => word.length > 2);
  const rankedSections = sections
    .map((section, index) => ({
      section,
      index,
      score: normalizedWords.filter((word) => normalizeVietnamese(section).includes(word)).length,
    }))
    .filter((item) => item.index === 0 || item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 3)
    .sort((a, b) => a.index - b.index);

  return {
    available: true,
    isSample,
    text: removeMarkdown(rankedSections.map((item) => item.section).join("\n\n")),
  };
}

export const SAMPLE_POLICY_NOTICE =
  "⚠️ *Lưu ý: nội dung chính sách trong demo là bản mẫu, chưa được Kidohomes xác nhận; không phải cam kết chính thức.*";
