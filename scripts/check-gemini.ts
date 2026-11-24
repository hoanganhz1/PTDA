import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

/**
 * Kiểm tra nhanh kết nối Gemini và độ trễ thực tế của model đang cấu hình.
 *
 *   npm run check:gemini                      # model trong GEMINI_MODEL
 *   npm run check:gemini -- gemini-3.8-flash  # thử model khác
 *
 * Cảnh báo nếu độ trễ vượt GEMINI_TIMEOUT_MS (mặc định 20s) vì khi đó
 * request thật sẽ rơi vào timeout.
 */

const localEnvPath = path.join(process.cwd(), ".env.local");
const defaultEnvPath = path.join(process.cwd(), ".env");
if (fs.existsSync(localEnvPath)) dotenv.config({ path: localEnvPath, override: true });
else if (fs.existsSync(defaultEnvPath)) dotenv.config({ path: defaultEnvPath, override: true });

const timeoutMs = Number(process.env.GEMINI_TIMEOUT_MS ?? 35_000);

async function testModel(ai: GoogleGenAI, model: string) {
  const started = Date.now();
  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: "Trả lời đúng một câu ngắn: Xin chào từ Kidohomes!" }] }],
      config: { thinkingConfig: { thinkingBudget: 0 } },
    });
    const duration = Date.now() - started;
    const note = duration > timeoutMs ? ` ⚠️ vượt timeout ${timeoutMs}ms` : "";
    console.log(`✅ ${model}: ${duration}ms${note} — "${response.text?.trim().slice(0, 60)}"`);
  } catch (error) {
    const duration = Date.now() - started;
    console.log(`❌ ${model}: lỗi sau ${duration}ms — ${error instanceof Error ? error.message.slice(0, 160) : error}`);
  }
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    console.error("❌ Chưa có GEMINI_API_KEY trong .env.local");
    process.exitCode = 1;
    return;
  }

  const currentModel = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite";
  const models = process.argv.slice(2).filter(Boolean);
  const targets = models.length ? models : [currentModel];
  const maskedKey = apiKey.length > 8 ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}` : "***";

  console.log("\n=======================================================");
  console.log("        KIỂM TRA GEMINI API KEY & ĐỘ TRỄ MODEL");
  console.log("=======================================================");
  console.log(`- API key   : ${maskedKey}`);
  console.log(`- LLM_MODE  : ${process.env.LLM_MODE ?? "mock"}`);
  console.log(`- Timeout   : ${timeoutMs}ms`);
  console.log(`- Model thử : ${targets.join(", ")}\n`);

  const ai = new GoogleGenAI({ apiKey });
  for (const model of targets) {
    await testModel(ai, model);
  }
  console.log("\nGợi ý: giữ model có độ trễ thấp nhất trong GEMINI_MODEL; đổi model chỉ cần sửa biến môi trường.\n");
}

void main();
