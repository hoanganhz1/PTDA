/**
 * Luật nhận diện ý định cho chế độ offline (không có Gemini).
 * Chế độ live dùng Gemini đọc ngữ nghĩa; các hàm này chỉ là fallback.
 * Module thuần → test được bằng `node --test`.
 */
import { policyKeywords } from "./policy-keywords";

export { policyKeywords };

export const greetingTerms = ["xin chao", "chao ban", "chao shop", "hello", "hi", "alo"];
export const gratitudeTerms = ["cam on", "thanks", "thank you", "ok", "oke", "duoc roi"];

export const handoffKeywords = [
  "gap nhan vien",
  "gap tu van vien",
  "gap nguoi that",
  "gap nguoi ho tro",
  "can gap nhan vien",
  "can gap tu van vien",
  "noi chuyen voi nhan vien",
  "noi chuyen voi tu van vien",
  "noi chuyen voi nguoi that",
  "noi chuyen voi nguoi ho tro",
  "muon noi chuyen voi",
  "cho toi noi chuyen voi",
  "can nguoi that",
  "muon nguoi that",
  "can nguoi ho tro",
  "muon nguoi ho tro",
  "muon lien he nhan vien",
  "muon lien he tu van vien",
  "cho toi lien he nhan vien",
  "cho toi lien he tu van vien",
  "muon nhan vien goi lai",
  "cho nhan vien goi lai",
  "goi lai cho toi",
  "muon duoc goi lai",
  "nho nguoi phu trach goi",
  "nhan vien goi",
];

export const refinementTerms = [
  "con khong",
  "con nua",
  "con mau nao",
  "san pham",
  "mau nao",
  "mau khac",
  "loai khac",
  "goi y them",
  "them lua chon",
  "co gi khac",
  "con hang khong",
  "co san khong",
  "re hon",
  "gia thap hon",
  "binh dan hon",
  "dat hon",
  "gia cao hon",
  "cao cap hon",
  "con mau",
  "con loai",
  "phu hop",
  "co hang",
  "kich thuoc",
  "ngan sach",
  "danh muc",
  "phong tam nho",
  "phong ve sinh nho",
  "nha ve sinh nho",
  "so sanh",
  "khac nhau",
  "phan biet",
  "uu nhuoc diem",
];

export const productRequestTerms = [
  "tu van",
  "goi y",
  "tim",
  "mua",
  "can",
  "muon xem",
  "san pham",
  "mau nao",
  "loai nao",
  "co hang",
  "bao nhieu",
  "nho gon",
  "gia",
];

export function isHandoffRequest(normalized: string) {
  if (
    ["khong muon gap", "khong can gap", "khong muon noi chuyen voi", "khong can lien he", "khong muon lien he"].some(
      (phrase) => normalized.includes(phrase),
    )
  ) {
    return false;
  }
  if (/(co\s+)?(can|nen|phai).*(gap|lien he|goi).*(nhan vien|tu van vien).*(khong|chua|\?)/.test(normalized)) {
    return false;
  }
  return handoffKeywords.some((keyword) => normalized.includes(keyword));
}

export function isPolicyQuestion(normalized: string) {
  return policyKeywords.some((keyword) => normalized.includes(keyword));
}

export function isGreeting(normalized: string) {
  return greetingTerms.some((term) => normalized === term || normalized.startsWith(`${term} `));
}

export function isGratitude(normalized: string) {
  return gratitudeTerms.some((term) => normalized === term || normalized.startsWith(`${term} `));
}

export function isRefinement(normalized: string) {
  return refinementTerms.some((term) => normalized.includes(term));
}

export function isProductRequest(normalized: string) {
  return productRequestTerms.some((term) => normalized.includes(term));
}
