# Kidohomes Demo

Demo website bán thiết bị vệ sinh gồm hai phần chính: **tìm kiếm theo ngôn ngữ tự nhiên** và **chatbot tư vấn có grounding** trên catalog + tài liệu chính sách.

> Toàn bộ dữ liệu sản phẩm, giá, tồn kho và chính sách trong repo là **dữ liệu mẫu cho demo**, chưa được Kidohomes xác nhận và không phải thông tin bán hàng chính thức. Ảnh phòng tắm là ảnh minh họa (Unsplash), không phải ảnh từng mẫu.

## Stack

| Thành phần | Lựa chọn |
|---|---|
| Framework | Next.js 16.4 (App Router, Turbopack), React 19 |
| Giao diện | Tailwind CSS v4 |
| Dữ liệu | SQLite (`better-sqlite3`), catalog seed 47 sản phẩm |
| AI | Google Gemini (`@google/genai`) — structured JSON output |
| Kiểm thử | `node:test` cho hàm thuần, Playwright cho smoke E2E |

## Chạy nhanh

```bash
npm install
cp .env.example .env.local     # điền GEMINI_API_KEY nếu muốn chế độ live
npm run seed                   # tạo data/kidohomes.db + 47 sản phẩm
npm run dev                    # http://localhost:3000
```

Chạy production:

```bash
npm run build && npm start
```

## Kiến trúc

```
app/
 ├─ (shop)/                 layout chung: header + footer
 │   ├─ page.tsx            trang chủ (ISR 5 phút)
 │   ├─ san-pham/           catalog + chi tiết (generateMetadata, JSON-LD)
 │   ├─ tim-kiem/           tìm kiếm (client, đồng bộ URL ?q=)
 │   ├─ loading|error|not-found
 ├─ admin/                  khu quản trị (proxy.ts bảo vệ, noindex)
 │   ├─ login/              đăng nhập bằng ADMIN_PASSWORD
 │   └─ handoffs/           danh sách yêu cầu liên hệ + đổi trạng thái
 ├─ api/
 │   ├─ chat/               JSON hoặc NDJSON stream
 │   ├─ search/             rule-based, không gọi LLM
 │   ├─ handoff/            lưu yêu cầu liên hệ
 │   └─ admin/session/      đăng nhập / đăng xuất
 ├─ components/             chat launcher + panel (lazy), thẻ sản phẩm, ảnh...
 ├─ sitemap.ts, robots.ts
lib/
 ├─ text.ts                 chuẩn hoá tiếng Việt, tiền tệ  (thuần, có test)
 ├─ criteria.ts             parse tiêu chí, xếp hạng, lý do, độ khớp (thuần, có test)
 ├─ chat-rules.ts           luật offline (thuần, có test)
 ├─ policy-keywords.ts      từ khóa chủ đề chính sách dùng chung
 ├─ schemas.ts              zod schema + type suy ra (nguồn duy nhất)
 ├─ db.ts                   SQLite + migration nhẹ + DATABASE_PATH
 ├─ search.ts               truy vấn catalog + cache TTL
 ├─ knowledge.ts            đọc .md có cache + retrieval theo chủ đề
 ├─ llm.ts                  một luồng Gemini duy nhất
 ├─ rate-limit.ts           token bucket trong process
 └─ log.ts                  log JSON theo event
proxy.ts                    chặn /admin khi chưa đăng nhập (Next 16)
```

## Luồng chat

1. Client gửi `POST /api/chat` với `Accept: application/x-ndjson`.
2. Server lưu câu hỏi vào `chat_history` **trước** khi gọi model (không mất lượt nếu timeout).
3. `lib/knowledge.ts` **truy xuất** tối đa 2 tài liệu chính sách liên quan (thay vì gửi cả 6 file).
4. Lịch sử gần nhất được gửi theo lượt `user`/`model`; danh sách thẻ sản phẩm vừa hiển thị được gắn vào lượt tư vấn để các câu như “mẫu này” có ngữ cảnh. Lời chào/cảm ơn, yêu cầu gặp nhân viên rõ ràng và câu hỏi chính sách khớp tài liệu được xử lý cục bộ để giảm các request Gemini không cần thiết.
5. `lib/search.ts` cung cấp **index catalog rút gọn** (đã cache 60s) chỉ cho lượt tư vấn sản phẩm; gồm kích thước, diện tích tối thiểu, bảo hành mẫu và tính năng.
6. Gemini trả JSON với `recommended_product_codes`; server tra các mã SKU này trong catalog rồi dựng thẻ sản phẩm.
   Gợi ý câu hỏi được viết **theo giọng khách hàng** (hoặc là câu trả lời ngắn để chọn nhanh), rồi được lọc lại ở server: bỏ câu hỏi ngược lại khách ("Bạn …"), bỏ câu lặp lại đúng điều trợ lý vừa hỏi, giới hạn 3 gợi ý.
7. Server tra SKU trong SQLite rồi render dữ liệu sản phẩm thật (model không tự bịa thẻ) và lưu `meta` để lần sau reload vẫn còn thẻ.
8. Stream trả `status` ngay + heartbeat mỗi 2,5s, kết thúc bằng gói `final`; UI có nút **Dừng**.

`LLM_MODE=mock` (hoặc Gemini không khả dụng) → xử lý chào hỏi/chính sách bằng luật offline; gợi ý sản phẩm cần Gemini live để chọn theo mã SKU. Trạng thái cấu hình/cooldown được hiển thị trong khung chat; danh mục hỗ trợ lọc thương hiệu, khoảng giá, tồn kho mẫu và sắp xếp.

Nếu Gemini timeout/lỗi, phản hồi vẫn về được (HTTP 200, `mode: "fallback"`): server xử lý chào hỏi/chính sách bằng luật offline; gợi ý thẻ sản phẩm tạm ngưng đến khi Gemini kết nối lại. Khi Google báo hết quota theo ngày, server ghi nhớ thời điểm được thử lại, bỏ qua các lần gọi Gemini vô ích trong thời gian chờ và báo thời gian ước tính cho khách.

## Biến môi trường

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `LLM_MODE` | `mock` | `live` để gọi Gemini, `mock` để chạy luật offline |
| `GEMINI_API_KEY` | — | khóa Google AI Studio |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` | model dùng cho structured output |
| `GEMINI_THINKING_LEVEL` | `medium` | mức suy luận `low` / `medium` / `high`; cao hơn tăng độ trễ và token |
| `GEMINI_MAX_OUTPUT_TOKENS` | `2200` | giới hạn gồm token suy luận và JSON cuối |
| `GEMINI_TIMEOUT_MS` | `35000` | chặn trên cho một call Gemini; quá hạn sẽ trả lời nhanh có nhãn thay vì báo lỗi |
| `ADMIN_PASSWORD` | — | **bắt buộc** để mở `/admin` (cookie chứa SHA-256) |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | dùng cho canonical/OG/sitemap |
| `NEXT_PUBLIC_APP_NAME` | `Kidohomes Demo` | tên hiển thị |
| `DATABASE_PATH` | `data/kidohomes.db` | đổi sang `:memory:` được |
| `CATALOG_CACHE_TTL_MS` | `60000` | TTL cache catalog |
| `CHAT_RATE_LIMIT` | `20` | số tin nhắn/phút/phiên |
| `LOG_SILENT` | `0` | `1` để tắt log JSON |

## Script

| Lệnh | Việc |
|---|---|
| `npm run dev` / `build` / `start` | chạy dev / build / chạy production |
| `npm run lint` / `typecheck` | ESLint / tsc |
| `npm test` | unit test hàm thuần (`node --import tsx --test`) |
| `npm run test:e2e` | Playwright smoke (cần `npx playwright install chromium`) |
| `npm run seed` | seed lại DB (idempotent) |
| `npm run check:gemini` | kiểm tra key + độ trễ model (`-- gemini-3.8-flash` để thử model khác) |
| `npm run eval:search` | đánh giá bộ phân tích tìm kiếm (miễn phí) |
| `npm run eval:chat` | đánh giá hành vi chatbot (mặc định offline) |
| `EVAL_LIVE=1 npm run eval:chat` | chạy eval qua Gemini thật (tốn hạn mức) |

Cả hai script eval chạy trên `data/eval.db` riêng, tự seed nếu trống, in summary JSON và trả exit code 1 khi có ca lỗi → dùng được làm regression gate trong CI.

## Bảo mật & dữ liệu cá nhân

- `/admin/*` được `proxy.ts` chặn; cookie phiên là SHA-256 của `ADMIN_PASSWORD`, `httpOnly`, hết hạn sau 8 giờ. Thiếu `ADMIN_PASSWORD` → trả 503 thay vì mở công khai.
- Trang handoff mặc định **che** số điện thoại/email; muốn xem đầy đủ phải bấm "Hiện đầy đủ thông tin liên hệ". Toàn bộ `/admin` có `noindex` + header `X-Robots-Tag`.
- Email/SĐT trong câu hỏi được che trước khi gửi Gemini; dữ liệu biểu mẫu handoff không gửi ra ngoài.
- Rate limit: chat 20/phút/phiên, search 60/phút, handoff 5/giờ, đăng nhập admin 8/15 phút.
- Lịch sử chat tự xoá sau 30 ngày; DB và file WAL không commit (xem `.gitignore`).

## Docker

```bash
docker compose up --build
```

`Dockerfile` build theo chế độ standalone, seed DB ngay trong ảnh; `docker/entrypoint.sh` copy DB mẫu sang volume khi volume rỗng nên dữ liệu handoff/chat được giữ qua restart. Truyền `LLM_MODE=live` và `GEMINI_API_KEY` qua biến môi trường của compose nếu muốn dùng Gemini.

## CI

`.github/workflows/ci.yml`: `lint → typecheck → test → seed → build → eval:search → eval:chat`, thêm job Playwright và upload report khi lỗi. CI chạy `LLM_MODE=mock` để không phụ thuộc mạng/hạn mức API.

## Kịch bản demo 5 phút

1. Trang chủ → gõ "bồn cầu cho phòng tắm nhỏ, giá dưới 5 triệu" → xem thẻ tiêu chí, badge "Khớp đầy đủ/Khớp một phần/Phần gần nhất" và lý do trên từng thẻ.
2. Mở một sản phẩm → kiểm tra thông số, ảnh minh họa, giá demo.
3. Mở chat → "Tư vấn bồn cầu dưới 5 triệu" → thẻ sản phẩm + câu hỏi gợi ý; thử nút **Dừng** khi đang chờ.
4. Hỏi "Chính sách bảo hành thế nào?" → trả nội dung kèm cảnh báo bản mẫu, không tự mở biểu mẫu.
5. Nói "Cho tôi gặp nhân viên" → biểu mẫu hiện ra → gửi (SĐT/email VN hợp lệ).
6. Vào `/admin/handoffs` → đăng nhập bằng `ADMIN_PASSWORD` → xem danh sách (đã che PII), đổi trạng thái sang "Đã liên hệ".

## Giới hạn đã biết

- Dữ liệu và chính sách vẫn là bản mẫu; mọi nội dung cần Kidohomes xác nhận trước khi dùng thật.
- Rate limit lưu trong bộ nhớ process: đủ cho 1 instance, cần Redis/gateway khi scale nhiều instance.
- Chưa có streaming token-level (Gemini đang trả JSON một lần); UI hiện stream trạng thái + kết quả cuối.
- Ảnh sản phẩm là 6 ảnh minh họa dùng lại cho toàn catalog.
