/**
 * Tách dần trường `reply` từ JSON mà Gemini stream về.
 *
 * Vì sao cần: Gemini trả structured JSON một object, nên nếu đợi đủ JSON mới
 * hiển thị thì khách phải chờ toàn bộ thời gian sinh chữ. Bộ tách này đọc phần
 * `"reply": "..."` ngay khi token về, giải mã escape dần và trả về phần text mới
 * để UI hiện chữ theo kiểu "đang gõ".
 *
 * Module thuần → test được bằng `node --test`.
 */

const REPLY_KEY = /"reply"\s*:\s*"/;

/** Trả về index ngay sau dấu `"` mở đầu giá trị của `reply`, hoặc -1. */
function findReplyValueStart(raw: string): number {
  const match = REPLY_KEY.exec(raw);
  return match ? match.index + match[0].length : -1;
}

/** Quét nội dung chuỗi JSON (đã ở trong dấu ngoặc kép) cho tới dấu `"` chưa escape. */
function scanStringValue(raw: string, start: number): { value: string; ended: boolean } {
  let index = start;
  let escaped = false;

  while (index < raw.length) {
    const char = raw[index];

    if (escaped) {
      escaped = false;
      index += 1;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      index += 1;
      continue;
    }

    if (char === '"') {
      return { value: raw.slice(start, index), ended: true };
    }

    index += 1;
  }

  return { value: raw.slice(start), ended: false };
}

/** Giải mã escape JSON; trả null khi chuỗi còn dở (ví dụ đang giữa `\u12`). */
function decodeJsonString(value: string): string | null {
  try {
    return JSON.parse(`"${value}"`) as string;
  } catch {
    return null;
  }
}

export class ReplyStreamExtractor {
  private raw = "";
  private emitted = "";
  private complete = false;

  /** Nạp một chunk JSON thô, trả về phần text mới (rỗng nếu chưa có gì mới). */
  push(chunk: string): string {
    this.raw += chunk;
    if (this.complete) return "";

    const start = findReplyValueStart(this.raw);
    if (start === -1) return "";

    const { value, ended } = scanStringValue(this.raw, start);
    const decoded = decodeJsonString(value);
    if (decoded === null) return "";

    if (ended) this.complete = true;

    if (decoded.length <= this.emitted.length) return "";
    // Chỉ phát phần tăng thêm, nhưng phải khớp tiền tố để tránh nhảy chữ.
    if (!decoded.startsWith(this.emitted)) {
      this.emitted = decoded;
      return decoded;
    }

    const delta = decoded.slice(this.emitted.length);
    this.emitted = decoded;
    return delta;
  }

  /** Toàn bộ text đã tách được (dùng khi JSON cuối bị cắt cụt). */
  get text(): string {
    return this.emitted;
  }

  get isComplete(): boolean {
    return this.complete;
  }
}
