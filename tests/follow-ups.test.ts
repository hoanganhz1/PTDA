import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_FOLLOW_UPS, sanitizeFollowUpQuestions } from "../lib/chat-utils";

const reply =
  "Dạ, nếu phòng tắm có diện tích khoảng bao nhiêu m² vậy ạ? Bạn chia sẻ thêm kích thước ước tính (ví dụ: nhỏ dưới 4m², vừa 4–6m² hay rộng trên 6m²) để Kidohomes tư vấn mẫu bồn cầu tối ưu không gian nhất cho nhà mình nhé!";

test("loại gợi ý hỏi ngược lại khách ('Bạn …')", () => {
  const result = sanitizeFollowUpQuestions(
    ["Bạn cần tìm bồn cầu cho diện tích phòng tắm khoảng bao nhiêu m2?"],
    reply,
  );
  assert.deepEqual(result, DEFAULT_FOLLOW_UPS);
});

test("loại gợi ý lặp lại đúng câu vừa hỏi trong reply", () => {
  const result = sanitizeFollowUpQuestions(
    ["Phòng tắm nhà mình rộng khoảng bao nhiêu m2?", "Tư vấn bồn cầu dưới 5 triệu"],
    reply,
  );
  assert.deepEqual(result, ["Tư vấn bồn cầu dưới 5 triệu"]);
});

test("giữ gợi ý đúng giọng khách hàng", () => {
  const result = sanitizeFollowUpQuestions(
    ["Phòng tắm khoảng 4m²", "Tư vấn bồn cầu 1 khối dưới 5 triệu", "Mẫu nào tiết kiệm nước nhất?"],
    reply,
  );
  assert.deepEqual(result, [
    "Phòng tắm khoảng 4m²",
    "Tư vấn bồn cầu 1 khối dưới 5 triệu",
    "Mẫu nào tiết kiệm nước nhất?",
  ]);
});

test("khử trùng lặp không phân biệt hoa/thường và dấu câu", () => {
  const result = sanitizeFollowUpQuestions(["Tư vấn bồn cầu", "tư vấn bồn cầu?"], "Chào bạn");
  assert.deepEqual(result, ["Tư vấn bồn cầu"]);
});

test("giới hạn tối đa 3 gợi ý", () => {
  const result = sanitizeFollowUpQuestions(
    ["Bồn cầu dưới 5 triệu", "Sen tắm cho phòng nhỏ", "Lavabo màu trắng", "Bồn tắm giá rẻ"],
    "Nội dung khác",
  );
  assert.equal(result.length, 3);
});

test("loại gợi ý liên quan nhân viên và câu quá dài", () => {
  const tooLong = `Tư vấn ${"rất ".repeat(30)}dài`;
  const result = sanitizeFollowUpQuestions(["Gặp nhân viên tư vấn", tooLong, "Xem mẫu khác"], "Nội dung");
  assert.deepEqual(result, ["Xem mẫu khác"]);
});

test("input rỗng thì trả rỗng (không tự thêm gợi ý)", () => {
  assert.deepEqual(sanitizeFollowUpQuestions([], reply), []);
});
