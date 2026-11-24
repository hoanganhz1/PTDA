import assert from "node:assert/strict";
import test from "node:test";
import {
  isGratitude,
  isGreeting,
  isHandoffRequest,
  isPolicyQuestion,
  isRefinement,
} from "../lib/chat-rules";
import { normalizeVietnamese } from "../lib/text";

test("nhận diện yêu cầu handoff rõ ràng", () => {
  assert.equal(isHandoffRequest(normalizeVietnamese("Tôi muốn gặp nhân viên tư vấn")), true);
  assert.equal(isHandoffRequest(normalizeVietnamese("Nhờ người phụ trách gọi cho mình")), true);
});

test("không kích hoạt handoff khi khách từ chối liên hệ", () => {
  assert.equal(isHandoffRequest(normalizeVietnamese("Tôi không muốn gặp nhân viên, chỉ hỏi bảo hành")), false);
  assert.equal(isHandoffRequest(normalizeVietnamese("Có cần gặp nhân viên không?")), false);
});

test("nhận diện lời chào và lời cảm ơn", () => {
  assert.equal(isGreeting(normalizeVietnamese("Xin chào shop!")), true);
  assert.equal(isGreeting(normalizeVietnamese("Bồn cầu dưới 5 triệu")), false);
  assert.equal(isGratitude(normalizeVietnamese("Cảm ơn bạn rất nhiều")), true);
});

test("nhận diện câu hỏi chính sách", () => {
  assert.equal(isPolicyQuestion(normalizeVietnamese("Hàng giao bị nứt vỡ thì đổi trả thế nào?")), true);
  assert.equal(isPolicyQuestion(normalizeVietnamese("Bồn cầu TOTO giá bao nhiêu?")), false);
});

test("nhận diện câu hỏi tinh chỉnh để giữ ngữ cảnh", () => {
  assert.equal(isRefinement(normalizeVietnamese("Có mẫu nào rẻ hơn nữa không?")), true);
  assert.equal(isRefinement(normalizeVietnamese("Tư vấn bồn cầu")), false);
});
