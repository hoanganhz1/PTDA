import assert from "node:assert/strict";
import test from "node:test";
import { ReplyStreamExtractor } from "../lib/stream-json";

function feed(chunks: string[]): { text: string; deltas: string[] } {
  const extractor = new ReplyStreamExtractor();
  const deltas: string[] = [];
  for (const chunk of chunks) {
    const delta = extractor.push(chunk);
    if (delta) deltas.push(delta);
  }
  return { text: extractor.text, deltas };
}

const fullJson = '{"reply":"Chào bạn! Bồn cầu INAX S1 giá 2.200.000đ.","recommended_product_codes":["KDH-0042"]}';

test("phát dần text khi JSON về từng mảnh nhỏ", () => {
  const chunks = fullJson.match(/[\s\S]{1,7}/g) ?? [];
  const { text, deltas } = feed(chunks);
  assert.equal(text, "Chào bạn! Bồn cầu INAX S1 giá 2.200.000đ.");
  assert.ok(deltas.length > 3, "phải phát nhiều đợt để thấy chữ hiện dần");
});

test("ghép các đợt delta lại đúng bằng text cuối", () => {
  const { text, deltas } = feed(fullJson.match(/[\s\S]{1,5}/g) ?? []);
  assert.equal(deltas.join(""), text);
});

test("xử lý escape xuống dòng và ngoặc kép", () => {
  const json = '{"reply":"Dòng 1\\nDòng 2 \\"trích dẫn\\"","intent":"general"}';
  const { text } = feed(json.match(/[\s\S]{1,3}/g) ?? []);
  assert.equal(text, 'Dòng 1\nDòng 2 "trích dẫn"');
});

test("không phát chữ khi escape chưa đủ ký tự", () => {
  const extractor = new ReplyStreamExtractor();
  assert.equal(extractor.push('{"reply":"Xin chào \\u'), "");
  assert.equal(extractor.push("1ec"), "");
  const delta = extractor.push('7t Việt","x":1}');
  assert.equal(delta, "Xin chào ệt Việt");
  assert.equal(extractor.text, "Xin chào ệt Việt");
});

test("không phát gì khi reply chưa xuất hiện trong JSON", () => {
  const extractor = new ReplyStreamExtractor();
  assert.equal(extractor.push('{"recommended_product_codes":["KDH-0042"]'), "");
  assert.equal(extractor.text, "");
});

test("đánh dấu hoàn tất khi gặp dấu ngoặc đóng của reply", () => {
  const extractor = new ReplyStreamExtractor();
  extractor.push('{"reply":"Ngắn gọn.');
  assert.equal(extractor.isComplete, false);
  const delta = extractor.push('"}');
  assert.equal(delta, "");
  assert.equal(extractor.isComplete, true);
  assert.equal(extractor.text, "Ngắn gọn.");
});
