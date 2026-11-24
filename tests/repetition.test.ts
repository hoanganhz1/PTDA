import assert from "node:assert/strict";
import test from "node:test";
import { findDegenerateRepetition, trimDegenerateRepetition } from "../lib/chat-utils";

const degenerate = `Dưới đây là tóm tắt chính sách bảo hành: - Thời hạn:Phạm vi:${"Thời hạn:Phạm vi:".repeat(30)}`;

test("phát hiện đúng kiểu lặp đã gặp trên UI", () => {
  const found = findDegenerateRepetition(degenerate);
  assert.equal(found.degenerate, true);
  assert.ok(found.repeats >= 5);
  assert.ok(found.index > 0);
});

test("không báo nhầm với văn bản chính sách bình thường", () => {
  const clean = [
    "Chính sách bảo hành mẫu:",
    "- Thời hạn: theo phiếu bảo hành đi kèm sản phẩm, ví dụ 12–48 tháng.",
    "- Phạm vi: lỗi kỹ thuật, lỗi vật liệu trong điều kiện sử dụng bình thường.",
    "- Không áp dụng cho hư hỏng do va đập, ngập nước hoặc tự tháo lắp.",
    "- Thời gian xử lý tham khảo 7–15 ngày làm việc kể từ khi đủ linh kiện.",
  ].join("\n");
  assert.equal(findDegenerateRepetition(clean).degenerate, false);
});

test("không báo nhầm khi danh sách sản phẩm lặp tên ngắn", () => {
  const list = "Bồn cầu A\nBồn cầu A\nBồn cầu B\nBồn cầu C\nSen tắm D";
  assert.equal(findDegenerateRepetition(list).degenerate, false);
});

test("cắt phần lặp, giữ phần đầu còn đọc được", () => {
  const trimmed = trimDegenerateRepetition(degenerate);
  assert.ok(!trimmed.includes("Thời hạn:Phạm vi:Thời hạn:Phạm vi:Thời hạn:Phạm vi:Thời hạn:Phạm vi:Thời hạn:Phạm vi:"));
  assert.match(trimmed, /tóm tắt chính sách bảo hành/);
  assert.ok(trimmed.length < degenerate.length);
});

test("văn bản sạch thì giữ nguyên", () => {
  const clean = "Chính sách đổi trả mẫu: báo trong 48 giờ nếu hàng nứt vỡ.";
  assert.equal(trimDegenerateRepetition(clean), clean);
});
