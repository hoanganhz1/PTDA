# Đánh giá source & hướng cải tiến — Kidohomes Demo

> Phạm vi: toàn bộ source trong repo (Next.js 16.4.3 / React 19.3 / Tailwind 4 / better-sqlite3 / Gemini `@google/genai`), gồm `app/`, `lib/`, `scripts/`, `data/` và cấu hình.
> Cách đọc: mỗi mục gồm **Hiện trạng → Vấn đề → Hướng cải tiến**. Ưu tiên P0 (chặn/lỗi thật) → P3 (chất lượng).

---

## 0. Trạng thái sau khi sửa (đã kiểm chứng bằng lệnh chạy thật)

> Phần phân tích bên dưới giữ nguyên làm hồ sơ gốc. Mục này ghi lại kết quả sau khi sửa toàn bộ.

### 0.1. Đính chính một kết luận sai

**Mục 3.1 (route `/` khai báo 2 lần) — KHÔNG phải lỗi chặn build.** Đã chạy `npm run build` trên code gốc: build **thành công**, Turbopack hợp nhất hai file và `/` chỉ xuất hiện một lần trong bảng route. Lỗi `You cannot have two parallel pages` chỉ tồn tại ở nhánh webpack loader, không áp dụng cho Turbopack ở phiên bản này. Tuy vậy `app/page.tsx` vẫn là shim dư thừa và **gây lỗi thật khác**: nó nằm ngoài route group `(shop)` nên `/` không nhận được layout chung. Đã xoá shim và xác nhận `/` render đúng header/footer.

### 0.2. Bảng đối chiếu

| # | Phát hiện ban đầu | Trạng thái | Bằng chứng |
|---|---|---|---|
| 1 | Route `/` khai báo 2 lần | ✅ Đã xử lý (không phải lỗi build — xem 0.1) | Build xanh, `/` có header+footer |
| 2 | `/admin/handoffs` công khai, lộ PII | ✅ Đã sửa | `proxy.ts` + login; anon → `307 /admin/login?next=…`; sai mật khẩu → 401; PII được che; có `noindex` |
| 3 | Gửi cả catalog + cả kho chính sách cho Gemini | ✅ Đã sửa | Index catalog còn **5.870** ký tự (cũ ~12.000); policy truy xuất **594–5.214** ký tự (cũ 10.407). Prompt thực đo: **5.870** (câu sản phẩm, −74%), **9.138** (đổi trả, −59%), **11.084** (bảo hành, −51%) so với ~22.400 |
| 4 | `/admin/handoffs` bị prerender tĩnh | ✅ Đã sửa (phát hiện thêm khi chạy build) | `force-dynamic`; bảng route đổi từ `○` sang `ƒ` |
| 5 | `npm test` trỏ vào thư mục không tồn tại | ✅ Đã sửa | 22 unit test, `npm test` xanh |
| 6 | Lịch sử chat mất thẻ sản phẩm sau reload | ✅ Đã sửa | Cột `meta`; smoke test `HISTORY metaProducts=5` |
| 7 | Không rate limit 2 API gọi LLM | ✅ Đã sửa | 25 request liên tiếp → 5 lần 429 |
| 8 | Hai hệ schema/type song song | ✅ Đã gộp về `lib/schemas.ts` + `lib/types.ts` | `tsc --noEmit` xanh |
| 9 | Font tải về nhưng bị Arial ghi đè | ✅ Đã sửa | Inter subset `vietnamese`, `font-sans` áp vào body |
| 10 | Thiếu proxy/security header, SEO | ✅ Đã thêm | `proxy.ts`, 4 security header, `generateMetadata` + JSON-LD + OG, `sitemap.xml` 50 URL, `robots.txt` chặn `/admin` |
| 11 | README lệch thực tế | ✅ Đã viết lại | 47 sản phẩm, biến môi trường thật, Docker/CI có thật |
| 12 | Dead code (`generateGroundedChatReply`, `extractSearchCriteria`) | ✅ Đã xoá | `lib/llm.ts` chỉ còn 1 hàm public |
| 13 | LLM gọi mỗi lần gõ phím ở trang tìm kiếm | ✅ Đã sửa | `/api/search` thuần rule-based, ~2–65 ms/request |
| 14 | Banner "Lưu ý" gần như luôn bật | ✅ Đã sửa | Chỉ bật khi `full === 0` và phần lớn là "gần nhất" |
| 15 | Câu hỏi chính sách ≠ yêu cầu handoff | ✅ Giữ đúng hành vi | Eval TC-03/TC-04 xanh |

### 0.3. Kiểm chứng đã chạy

```text
npm run lint        ✔ (0 error)
npm run typecheck   ✔
npm test            ✔ 22/22
npm run build       ✔ 13 route, proxy detected
npm run eval:search ✔ 7/7  (100%)
npm run eval:chat   ✔ 11/11 (100%, offline)
```

Smoke test trên bản production (`next start`):

```text
SEARCH 200 mode=rules n=8 top="Bồn cầu giá rẻ S1" price=2200000 cat=bồn cầu conf=full
CHAT   200 mode=mock n=5 first="Bồn cầu giá rẻ S1"
STREAM 200 events=status,final finalProducts=5
POLICY 200 handoff=false products=0 hasSampleNotice=true
HANDOFF 200
HISTORY n=3 metaProducts=5 pending=false
ADMIN  anon=307 → /admin/login?next=%2Fadmin%2Fhandoffs
LOGIN  bad=401 good=200
ADMIN  authed=200 maskedPhone=true noindex=true
SITEMAP 200 urls=50
PRODUCT 200 jsonLd=true ogImage=true
RATE   429s=5/25
```

Kiểm tra chế độ live (một call Gemini thật, `gemini-3.5-flash`):

```text
LIVE latencyMs=4106 confidence=high intent=product ids=prod-042,prod-005,prod-001
REPLY "Chào bạn, với phòng tắm nhỏ và ngân sách dưới 5 triệu, Kidohomes xin gợi ý các mẫu bồn cầu nhỏ gọn…"
promptChars=6090 (catalogChars=5870, policyChars=0)
```

E2E Playwright (Chromium thật):

```text
4 passed — trang chủ → catalog, tìm kiếm, chat (stream + Escape trả focus), /admin yêu cầu đăng nhập
```

### 0.4. Hai lỗi phát hiện thêm trong quá trình sửa (đã fix)

1. **"Rẻ hơn nữa" kéo phụ kiện 320k lên đầu danh sách** — vì sắp xếp lại theo giá trên toàn catalog thay vì trong danh mục hiện tại. Đã giới hạn trong đúng danh mục; eval TC-07 chuyển từ fail → pass.
2. **Câu hỏi chính sách diễn đạt gián tiếp bị rơi vào nhánh sản phẩm** — danh sách từ khóa ở `chat-rules.ts` và `knowledge.ts` bị lệch (thiếu "bị rạn", "mở hộp"...). Đã gộp về `lib/policy-keywords.ts` dùng chung; eval TC-09 chuyển từ fail → pass.

### 0.5. Việc còn lại (không chặn demo)

- Streaming hiện ở mức **trạng thái + kết quả cuối**, chưa phải token-level (Gemini trả JSON một lần).
- Rate limit trong bộ nhớ process → cần Redis khi chạy nhiều instance.
- Ảnh sản phẩm vẫn là 6 ảnh minh họa dùng lại; nên thay ảnh thật khi lên production.
- `gemini-3.8-flash` khả dụng nhưng đo được **291s** cho một câu ngắn, nên vẫn giữ `gemini-3.5-flash` (~10s) làm mặc định; đổi bằng biến môi trường.

### 0.6. Vòng sửa sau phản hồi "gợi ý câu hỏi hơi ngược"

**Hiện tượng (từ ảnh chụp):** trợ lý hỏi *"phòng tắm có diện tích khoảng bao nhiêu m² vậy ạ?"*, ngay dưới là hai nút *"Phòng tắm nhà mình rộng khoảng bao nhiêu m2?"* và *"Bạn muốn tham khảo bồn cầu dòng 1 khối hay 2 khối?"*. Nút là thứ **khách bấm để gửi**, nhưng nội dung lại là câu trợ lý muốn hỏi khách → đảo vai và lặp lại đúng câu vừa hỏi.

**Nguyên nhân:** `follow_up_questions` do Gemini sinh ra nhưng prompt không quy định giọng của chúng, và server trả thẳng ra UI.

**Đã sửa 3 lớp:**

1. **Prompt** (`lib/llm.ts`): thêm mục riêng quy định gợi ý phải viết **đúng giọng khách hàng**; nếu `reply` vừa hỏi thì gợi ý phải là **câu trả lời ngắn** khách có thể chọn ("Phòng tắm khoảng 4m²"); cấm mở đầu bằng "Bạn…/Quý khách…" và cấm lặp lại câu vừa hỏi.
2. **Chuẩn hoá phía server** (`lib/chat-utils.ts` + 7 test): bỏ câu xưng hô với khách, bỏ câu hỏi trùng câu vừa hỏi (so khớp theo *từ để hỏi + chủ đề*, nên **không** loại nhầm câu trả lời ngắn), khử trùng lặp, lọc từ khóa nhân viên, tối đa 3, có gợi ý dự phòng.
3. **UI** (`chat-panel.tsx`): thêm nhãn "💬 Gợi ý cho bạn" để hiểu đây là nội dung khách sẽ gửi.

**Lỗi thứ hai phát hiện khi test live:** model trả **4** gợi ý → `zod .max(3)` reject **toàn bộ** response → API trả 503 và mất cả câu trả lời. Đã làm schema chịu lỗi (`lib/schemas.ts`): bỏ giới hạn cứng khi parse, dùng `.catch()` cho enum/boolean, cắt số id và độ dài sau khi parse.

**Kết quả đo (live, `gemini-3.5-flash`):**

```text
Trước: "Bạn cần tìm bồn cầu cho diện tích phòng tắm khoảng bao nhiêu m2?"
       "Bạn muốn tham khảo bồn cầu dòng 1 khối hay 2 khối?"
Sau  : "Tư vấn bồn cầu dưới 5 triệu"
       "Tư vấn bồn cầu 5 - 10 triệu"
       "Phòng tắm nhà mình nhỏ dưới 5m²"
```

Đồng thời nới `GEMINI_TIMEOUT_MS` 20s → **25s** vì đo được 3,7s / 17,3s và một lần chạm timeout; UI vẫn stream trạng thái + có nút Dừng.

**Cổng kiểm tra sau vòng sửa:** `lint ✔ · typecheck ✔ · 29/29 unit test ✔ · eval:chat 11/11 ✔ · build ✔ · Playwright 4/4 ✔`.

### 0.7. Vòng sửa lỗi render markdown (ảnh log `same key '1'`)

**Hiện tượng:** console dev lặp hàng chục dòng `Encountered two children with the same key, '1'`, và bong bóng chat hiện khối chữ lặp vô nghĩa `Thời hạn:Phạm vi:Thời hạn:Phạm vi:…`.

**Nguyên nhân chính (đã xác định chắc chắn):** `renderMarkdown` trong chat panel đặt `key={partIndex}` cho `<strong>`/`<em>`, nhưng `partIndex` **reset về 0 ở mỗi dòng**. Một đoạn có nhiều dòng cùng chứa in đậm ⇒ key trùng (`0`,`1`,…) trong cùng một mảng children. React gặp key trùng thì có thể **nhân bản hoặc bỏ** children — đúng như cảnh báo của chính React, và đó là lý do cùng một cụm chữ xuất hiện lặp lại.

**Đã sửa:**

- `renderMarkdown` tách thành `renderInline(text, keyPrefix)`; key giờ là `p{đoạn}-l{dòng}-p{phần}` nên **không thể trùng** giữa các dòng/đoạn. Thêm điều kiện độ dài để `**`/`*` rỗng không tạo thẻ rỗng.
- **Phòng thủ phía server** (`lib/chat-utils.ts`): thêm `findDegenerateRepetition` / `trimDegenerateRepetition` — quét trực tiếp (không dùng regex) để phát hiện một cụm ≥ 6 ký tự lặp ≥ 5 lần liên tiếp. Nếu câu trả lời chính sách bị kẹt vòng lặp → trả **tài liệu đã truy xuất** (`policyQuestionReply`) thay vì câu lặp; các câu khác thì cắt tại điểm bắt đầu lặp và ghi log `llm_degenerate_reply`.
- **Prompt** (`lib/llm.ts`): cấm dựng bảng markdown, cấm lặp cụm từ, giới hạn ~1200 ký tự cho câu hỏi chính sách tổng quát (bảng markdown khi `thinkingBudget: 0` chính là kiểu đầu vào dễ làm model lặp).
- 5 unit test mới cho bộ phát hiện (có cả ca "không báo nhầm" với văn bản chính sách và danh sách sản phẩm trùng tên).

**Kiểm chứng:**

```text
Chạy Playwright, mở chat, hỏi "Chính sách bảo hành & đổi trả" (chế độ mock, trả cả tài liệu dài):
{ "warnings": 0, "keyWarnings": 0, "hasRepeatedPhrase": false, "textLength": 5684 }

Live 1 call: status=200, mode=live, length=1399, degenerate=false
Prompt thêm luật chống lặp; nếu model vẫn lặp, log sẽ ghi llm_degenerate_reply và UI nhận tài liệu gốc.
```

`lint ✔ · typecheck ✔ · 34/34 unit test ✔ · eval:chat 11/11 ✔ · build ✔ · Playwright 4/4 ✔`

### 0.8. Vòng sửa từ ảnh console: `images.qualities` và timeout 25 s

**Hiện tượng trong ảnh:** console đầy cảnh báo `Image with src … is using quality "72" which is not configured in images.qualities [75]`, và khung chat hiện lỗi đỏ *"Kidohomes AI hiện chưa phản hồi"* ngay sau khi log ghi `llm_timeout ms=25000`.

**Nguyên nhân 1 — quality ảnh:** Next 16 chỉ chấp nhận các mức `quality` được khai báo trong `images.qualities` (mặc định `[75]`); tôi đã đặt `quality={72}` cho thẻ sản phẩm ở vòng trước. Đã thêm `images: { qualities: [70, 75, 80] }` trong `next.config.ts` và đưa thẻ sản phẩm về `75` (chat `70`, trang chi tiết `80`).

**Nguyên nhân 2 — timeout:** log cho thấy model trả lời ở **25.522 ms**, chỉ trượt ngưỡng 25.000 ms. Latency đo được của `gemini-3.5-flash` trong môi trường này là **3,7–25,5 s** và thỉnh thoảng `503 UNAVAILABLE`. Hai việc đã làm:

1. Nới `GEMINI_TIMEOUT_MS` mặc định **25 s → 35 s** (vẫn chỉnh được bằng biến môi trường).
2. **Không còn "màn hình chết"**: khi Gemini timeout/lỗi, server trả HTTP 200 với `mode: "fallback"`, gồm nhãn rõ ràng *"trả lời nhanh từ dữ liệu mẫu — không phải câu trả lời của AI"* cộng câu trả lời tất định (chính sách → trích tài liệu; sản phẩm → xếp hạng offline; yêu cầu gặp nhân viên → vẫn mở biểu mẫu), và log `chat_fallback`. Để làm việc này, toàn bộ nhánh offline được tách thành `buildOfflineReply()` dùng chung cho `LLM_MODE=mock` và cho dự phòng; nhánh live được tách thành `applyConsultantResult()`. Class `ChatError` (chỉ phục vụ nhánh 503 cũ) đã được xoá.

**Kiểm chứng:**

```text
Ép timeout = 1ms để thử nhánh dự phòng:
status=200 mode=fallback handoff=false labelled=true   (câu hỏi sản phẩm)
status=200 mode=fallback handoff=false labelled=true   (câu hỏi chính sách)
status=200 mode=fallback handoff=true  labelled=true   (yêu cầu gặp nhân viên → vẫn mở biểu mẫu)

Playwright mở /, /san-pham, /tim-kiem (bắt toàn bộ console warning):
{ "warnings": 0, "qualityWarnings": 0, "keyWarnings": 0 }
```

`lint ✔ · typecheck ✔ · 34/34 unit test ✔ · eval:search 7/7 ✔ · eval:chat 11/11 ✔ · build ✔ · Playwright 4/4 ✔`

---

---

## 1. Tóm tắt điều hành

Demo đã có "xương sống" tốt: tách `lib/` (db, search, knowledge, llm) khỏi route, prompt grounding khá kỹ, có eval script, có ghi chú "dữ liệu mẫu" ở mọi bề mặt. Điểm yếu nằm ở **vận hành và chi phí AI**, không phải ở UI.

| # | Vấn đề | Mức | Ảnh hưởng |
|---|---|---|---|
| 1 | Route `/` bị định nghĩa 2 lần (`app/page.tsx` + `app/(shop)/page.tsx`) | **P0** | Next throw "two parallel pages" → không build được |
| 2 | `/admin/handoffs` công khai, không xác thực (dù README có `ADMIN_PASSWORD`) | **P0** | Lộ tên + SĐT/email khách |
| 3 | Mỗi tin nhắn chat gửi **toàn bộ catalog + toàn bộ 6 tài liệu chính sách** cho Gemini | **P0** | Tốn token, chậm, dễ vượt context |
| 4 | `npm test` trỏ vào `tests/**` không tồn tại; Playwright cài mà không dùng | P1 | CI đỏ, không có lưới an toàn |
| 5 | Lịch sử chat lưu text-only → reload mất thẻ sản phẩm & câu hỏi gợi ý | P1 | Trải nghiệm đứt gãy |
| 6 | Không rate limit cho 2 API gọi LLM | P1 | Rủi ro chi phí / lạm dụng |
| 7 | Song song 2 hệ schema/type (`search.ts` vs `llm.ts`, `types.ts` vs widget) | P2 | Dễ lệch hành vi |
| 8 | Font Geist tải về nhưng bị `globals.css` ghi đè bằng Arial | P2 | Tải thừa, không có dấu tiếng Việt đẹp |
| 9 | Thiếu `proxy.ts` (Next 16 đã deprecate `middleware`), thiếu security header | P2 | Bảo mật/biên |
| 10 | README lệch thực tế (60 sản phẩm vs 47; Docker Compose không tồn tại) | P2 | Người mới setup sai |

---

## 2. Kiến trúc hiện tại (bản đồ nhanh)

```
Trình duyệt
 ├─ /                    → app/(shop)/page.tsx        (đọc SQLite, render server)
 ├─ /san-pham            → danh mục + lọc ?category
 ├─ /san-pham/[slug]     → chi tiết
 ├─ /tim-kiem            → client, debounce 250ms → POST /api/search
 ├─ /admin/handoffs      → đọc thẳng bảng handoff_requests (KHÔNG auth)
 └─ ChatWidget (mọi trang, mount trong app/layout.tsx)
        └─ POST /api/chat ─┬─ live  : consultWithGemini(query, FULL catalog + FULL policy)
                           └─ mock  : keyword rules (search.ts) → rankProducts

SQLite data/kidohomes.db
 ├─ products (47 dòng, seed từ scripts/seed.ts)
 ├─ chat_history (không giới hạn, không TTL)
 ├─ chat_sessions (chỉ cờ handoff_pending)
 └─ handoff_requests (PII dạng plaintext)
```

Hai điểm cần lưu ý ngay từ bản đồ này:

1. **`/api/chat` là nơi đắt tiền nhất** và đang làm 3 lần quét toàn catalog mỗi tin nhắn (`getCatalogPromptSummary()` + `getProductsByIds()` → `getAllProducts()` + `rankProducts()`).
2. **Không có lớp cache nào** giữa SQLite và LLM, dù dữ liệu gần như tĩnh.

---

## 3. P0 — Những việc phải sửa trước khi demo tiếp

### 3.1. Route `/` bị khai báo hai lần → **đã đính chính: không chặn build**

> ⚠️ **Đính chính (xem 0.1):** kết luận dưới đây sai một phần — `next build` với Turbopack **vẫn thành công**. Vấn đề thật là `/` nằm ngoài route group `(shop)` nên không nhận layout chung. Đã xoá `app/page.tsx`; nội dung dưới giữ lại làm hồ sơ phân tích.

**Hiện trạng**

- [app/page.tsx](app/page.tsx:1) chỉ có 1 dòng `export { default } from "./(shop)/page";`
- [app/(shop)/page.tsx](app/(shop)/page.tsx:14) mới là trang thật.

Cả hai cùng resolve về `/`. Loader App Router của Next 16 trong chính `node_modules` này throw cứng:

> `You cannot have two parallel pages that resolve to the same path.`

**Bằng chứng phụ:** `.next/` chỉ có `turbopack/`, `package.json`, `trace`, `trace-build` — **không có** `BUILD_ID` hay `.next/server/`, tức là chưa có dấu vết một lần `next build` thành công.

**Hướng cải tiến**

```bash
# Xoá file shim, giữ lại trang trong route group
rm app/page.tsx
```

Route group `(shop)` không tham gia URL nên `app/(shop)/page.tsx` đã phục vụ `/`. Sau khi xoá, chạy `pnpm build` để chốt.

> Nếu muốn giữ nhóm `(shop)` cho gọn, hướng đúng là thêm `app/(shop)/layout.tsx` (xem 3.2) rồi xoá shim — không phải giữ cả hai file.

### 3.2. `/admin/handoffs` đang phơi dữ liệu cá nhân

**Hiện trạng:** [app/admin/handoffs/page.tsx](app/admin/handoffs/page.tsx:4) là Server Component đọc thẳng `handoff_requests` và render tên + SĐT/email. Không auth, không `noindex`, không phân trang. [README.md](README.md:37) có ghi `ADMIN_PASSWORD` nhưng **không dòng code nào dùng biến này**.

**Hướng cải tiến** (Next 16: dùng `proxy.ts`, **không** dùng `middleware.ts` — đã deprecated):

```ts
// proxy.ts (đặt cạnh app/)
import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const expected = process.env.ADMIN_PASSWORD;
  const token = request.cookies.get("kd_admin")?.value;
  if (!expected || token !== expected) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*"] };
```

Kèm theo:

- Đăng nhập qua form + `httpOnly` cookie (so sánh bằng `timingSafeEqual`), không nhét mật khẩu vào query string.
- `export const metadata = { robots: { index: false } }` cho toàn bộ `/admin`.
- Che PII khi hiển thị (`0912***678`), chỉ hiện đầy đủ khi bấm "Xem".
- Có nút đổi `status` (`new` → `contacted` → `done`) — cột `status` đã có trong schema nhưng chưa dùng ở UI.

### 3.3. Mỗi tin nhắn gửi cả catalog + cả kho chính sách cho Gemini

**Hiện trạng:** trong [app/api/chat/route.ts](app/api/chat/route.ts:302), live mode gọi:

```ts
consultWithGemini({
  query: message,
  history: chatHistory.slice(-8),
  catalogSummary: getCatalogPromptSummary(),  // 47 sản phẩm, ~12–15k ký tự
  policyText: getKnowledgeText(),             // cả 6 file .md
});
```

Trong khi đó [lib/knowledge.ts](lib/knowledge.ts:92) đã có `findRelevantKnowledge()` — hàm retrieval theo chủ đề — nhưng **chỉ được dùng ở nhánh offline**, không dùng ở nhánh live.

Hệ quả: prompt lớn → tốn token mỗi lượt, latency cao (timeout 15s ở [lib/llm.ts](lib/llm.ts:5) rất dễ chạm), và nhiễu thông tin làm model dễ trích sai điều khoản.

**Hướng cải tiến — 3 bước, làm được ngay:**

1. **Retrieval thay vì dump.** Dùng lại `findRelevantKnowledge(message)` cho nhánh live; chỉ khi không khớp chủ đề mới gửi bản rút gọn.
2. **Cache catalog.** Dữ liệu gần như tĩnh, đừng rebuild mỗi request:

```ts
// lib/search.ts
let catalogCache: { at: number; value: string } | null = null;
const CATALOG_TTL_MS = 60_000;

export function getCatalogPromptSummary() {
  const now = Date.now();
  if (catalogCache && now - catalogCache.at < CATALOG_TTL_MS) return catalogCache.value;
  const value = buildCatalogPromptSummary(); // logic cũ
  catalogCache = { at: now, value };
  return value;
}
```

3. **Rút gọn "index sản phẩm" cho LLM.** Model chỉ cần đủ để *chọn ID*; chi tiết đã có trong DB để render thẻ:

```
[prod-007] Lavabo góc Flex 50 | INAX | 2.800.000đ | lavabo | Be | gốm | 4m² | compact | còn hàng
```

Chi tiết dài (`short_description`, đủ 5 feature) chỉ nên nhét vào prompt cho **top 3–5 sản phẩm đã chọn**, ở lượt thứ hai (two-pass), không phải cho cả 47.

**Đo lường để chứng minh hiệu quả:** log `promptChars`, `latencyMs`, `model`, `intent` mỗi request (xem 6.3).

### 3.4. DB và file WAL đang nằm trong repo, đường dẫn hard-code

**Hiện trạng:** [lib/db.ts](lib/db.ts:5) hard-code `path.join(process.cwd(), "data")`. [.gitignore](.gitignore:1) không ignore `data/*.db*`, nên `data/kidohomes.db`, `.db-wal`, `.db-shm` đang là file tracked. [next.config.ts](next.config.ts:3) không khai báo gì thêm (đúng: `better-sqlite3` đã nằm trong danh sách external mặc định của Next).

**Rủi ro:** deploy read-only filesystem (Vercel, container non-root) → ghi WAL lỗi; dữ liệu "demo" và dữ liệu "thật" lẫn nhau; mất dữ liệu khi container restart.

**Hướng cải tiến**

```ts
// lib/db.ts
const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "kidohomes.db");
```

- Thêm vào [.gitignore](.gitignore:1): `data/*.db`, `data/*.db-wal`, `data/*.db-shm`.
- Seed idempotent lúc khởi động (hoặc trong Docker entrypoint) thay vì commit file DB.
- Cache connection trên `globalThis` để HMR của `next dev` không mở nhiều handle:

```ts
const g = globalThis as unknown as { __kdDb?: Database.Database };
export const getDb = () => (g.__kdDb ??= new Database(dbPath));
```

---

## 4. P1 — Kiến trúc & chi phí vận hành

### 4.1. Hợp nhất 2 hệ schema/type đang song song

| Thành phần | Vị trí 1 | Vị trí 2 |
|---|---|---|
| `searchCriteriaSchema` (zod) | [lib/search.ts](lib/search.ts:66) | [lib/llm.ts](lib/llm.ts:18) |
| `SearchCriteria` (type) | [lib/types.ts](lib/types.ts:26) | suy ra từ zod ở trên |
| `ChatResponse` | [lib/types.ts](lib/types.ts:44) | khai báo lại trong [chat-widget.tsx](app/components/chat-widget.tsx:59) |
| `ProductSummary` | [route.ts](app/api/chat/route.ts:188) | `RecommendedProduct` trong [chat-widget.tsx](app/components/chat-widget.tsx:39) |

**Hướng:** một nguồn sự thật duy nhất — `lib/schemas.ts` cho zod, `lib/types.ts` suy ra bằng `z.infer`, và `ProductCardItem` dùng chung cho card + chat + API. Client import type từ `lib/types` (type-only nên không kéo server code vào bundle).

### 4.2. Dead code & code deprecated đang gây tốn tiền thật

- [route.ts:510-525](app/api/chat/route.ts:510): gọi `generateGroundedChatReply(...)` rồi `void groundedReply` — **kết quả bị vứt**. Nhánh `offlineFallback` chỉ chạy khi `LLM_MODE !== "live"`, mà chính điều kiện đó khiến `generateGroundedChatReply` return `null` ngay từ dòng đầu. **Code chết 100%** → xoá cả hàm và import.
- [lib/llm.ts:113](lib/llm.ts:113) `extractSearchCriteria` bị đánh dấu `@deprecated` nhưng [app/api/search/route.ts:40](app/api/search/route.ts:40) vẫn gọi → mỗi lần search là 1 call Gemini thứ hai, song song với logic rules (kết quả merge bằng spread, thứ tự override khó đoán).
- `route.ts` có 2 nhánh policy (live và offline) với copy thông báo "bản mẫu" khác nhau ở 3 chỗ (dòng 313, 377, 384, 395) → dễ lệch câu chữ.

**Hướng:** chọn **một** chiến lược trích xuất tiêu chí (đề xuất: chỉ dùng Gemini structured output, rules chỉ để normalize/fallback khi lỗi), xoá `extractSearchCriteria`, gom mọi thông báo "nội dung mẫu" vào một hằng số `SAMPLE_POLICY_NOTICE`.

### 4.3. Lịch sử chat mất ngữ cảnh hiển thị khi reload

**Hiện trạng:** `GET /api/chat` chỉ trả `role, message` ([route.ts:237](app/api/chat/route.ts:237)); widget map lại thành `{role, text}` ([chat-widget.tsx:139](app/components/chat-widget.tsx:139)) → mọi `products` và `follow_up_questions` đã render trước đó **biến mất** sau F5.

**Hướng:** thêm cột `meta TEXT` (JSON) vào `chat_history`, lưu `product_ids` + `follow_up_questions` cùng message assistant; khi load history thì `getProductsByIds()` để render lại thẻ. Migration đơn giản:

```sql
ALTER TABLE chat_history ADD COLUMN meta TEXT;
```

Đồng thời:

- Chèn message `user` **trước** khi gọi LLM (hiện tại ghi cả 2 message sau khi LLM xong — nếu LLM timeout 15s thì lượt hỏi của khách biến mất, xem [route.ts:434-443](app/api/chat/route.ts:434)).
- [route.ts:439-442](app/api/chat/route.ts:439) ghi đè `handoff_pending` mỗi tin nhắn → khách vừa yêu cầu gặp nhân viên rồi gõ thêm 1 câu là form biến mất. Chỉ nên `SET handoff_pending = 1` khi cần, và reset khi submit form hoặc khi khách yêu cầu huỷ.
- `chat_history` không có TTL → thêm job xoá bản ghi > 30 ngày, hoặc xoá khi session > N tin.

### 4.4. Rate limit & bảo vệ chi phí

Hai endpoint gọi LLM (`/api/chat`, `/api/search`) không có giới hạn nào. Một script 100 dòng có thể đốt hạn mức API.

**Hướng tối thiểu (không cần Redis):** token bucket trong bộ nhớ theo `sessionId`/IP, kèm `Retry-After`:

```ts
// lib/rate-limit.ts
const buckets = new Map<string, { tokens: number; at: number }>();
export function allow(key: string, limit = 20, windowMs = 60_000) { /* ... */ }
```

Với demo 1 máy thì in-memory là đủ; nếu deploy nhiều instance thì chuyển sang `@upstash/ratelimit` hoặc giới hạn ở reverse proxy. Kèm theo: giới hạn độ dài message (đã có 1500), giới hạn tổng token/ngày, và `AbortSignal.timeout` server-side cho call Gemini (đã có `withTimeout`, nhưng nó **không huỷ** request thật — `Promise.race` chỉ bỏ qua kết quả; nên truyền `signal` nếu SDK hỗ trợ).

### 4.5. Streaming — cải tiến UX có tỷ lệ đòn bẩy cao nhất

Hiện tại: chờ đủ JSON → render một cục. Server timeout 15s, client 20s ([chat-widget.tsx:193](app/components/chat-widget.tsx:193)) → khách nhìn "Gemini đang phân tích..." (dòng 457) không biết còn sống hay treo.

**Hướng:** trả `ReadableStream` từ route (NDJSON: mỗi dòng một event `{type:"delta"|"product_ids"|"done"}`), client đọc bằng `response.body.getReader()`. Với Gemini có thể stream phần text rồi mới gửi `product_ids` cuối. Giảm cảm giác chờ từ ~5–8s xuống ~1s.

Đây cũng là chỗ nên thêm **hủy request** (nút "Dừng") vì `AbortSignal` đã có sẵn ở client.

### 4.6. Search: state không nằm trên URL + gọi LLM mỗi lần gõ

- [tim-kiem/page.tsx:48-84](app/(shop)/tim-kiem/page.tsx:48): debounce 250ms rồi gọi API — mỗi lần gõ là một call Gemini (vì `/api/search` gọi `extractSearchCriteria`). Gõ "bồn cầu dưới 5 triệu" = ~15 call.
- `q` chỉ được đọc **một lần** lúc mount từ `useSearchParams` (dòng 41) → không cập nhật URL khi tìm → không share được kết quả, back/forward hỏng.

**Hướng:**

- Enter/submit mới gọi LLM; gõ thì chỉ chạy rules (0 đồng) và hiển thị "gợi ý nhanh".
- `router.replace(`/tim-kiem?q=${encodeURIComponent(query)}`)` sau khi submit (dùng `useTransition` để không chặn).
- Hiện `mode` (`llm`/`rules`/`fallback`) và `latencyMs` đã trả về nhưng UI chỉ hiện ms — nên hiện nhãn nhỏ "xếp hạng theo AI" để khách hiểu vì sao thứ tự khác.

### 4.7. Cảnh báo "Lưu ý:" gần như luôn bật

[search/route.ts:54](app/api/search/route.ts:54) bật `notice` nếu **bất kỳ** kết quả nào có chữ "Lưu ý:". Mà `buildReason` ([lib/search.ts:385](lib/search.ts:385)) luôn thêm `Lưu ý: ...` khi có bất kỳ tradeoff nào. Vì `rankProducts` xếp hạng mềm trên toàn catalog, gần như mọi query đều có ít nhất 1 sản phẩm lệch tiêu chí → banner vàng hiện gần như vô điều kiện, làm giảm giá trị cảnh báo.

**Hướng:** chỉ bật notice khi **quá nửa** kết quả lệch, hoặc khi sản phẩm top-1 lệch tiêu chí cứng (giá/hãng/danh mục). Tốt hơn: trả `match_confidence` theo từng thẻ (`khớp đủ` / `khớp một phần` / `gần nhất`) và hiện badge thay vì banner.

---

## 5. P2 — UI/UX, a11y, SEO

### 5.1. Chat widget

| Vấn đề | Vị trí | Cải tiến |
|---|---|---|
| `getSnapshot` có side effect (ghi `sessionStorage`) | [chat-widget.tsx:102](app/components/chat-widget.tsx:102) | Tách: `useState("")` + `useEffect` sinh ID; hoặc đọc/ghi trong `subscribe` |
| Không phải dialog: thiếu `role="dialog"`, `aria-modal`, không trap focus, không đóng bằng `Esc` | [chat-widget.tsx:264](app/components/chat-widget.tsx:264) | Dùng `<dialog>` native hoặc thêm `useEffect` bắt `Escape` + focus vào textarea khi mở |
| `aria-live="polite"` đặt trên cả vùng scroll (gồm cả nút gợi ý) | [chat-widget.tsx:311](app/components/chat-widget.tsx:311) | Đặt `aria-live` trên một `<div>` chỉ chứa tin nhắn mới; thêm `aria-busy={isSending}` |
| Widget mount trên **mọi** trang, kéo theo bundle + ảnh | [layout.tsx:26](app/layout.tsx:26) | `next/dynamic(() => import("./chat-widget"), { ssr: false })` và chỉ render sau lần bấm đầu |
| Không có cách "dừng" khi đang chờ | — | Thêm nút Dừng dùng `AbortController` (hiện chỉ có timeout 20s) |
| 2 nút "Hỏi thêm"/"So sánh" cho mỗi sản phẩm → gửi tin nhắn mới | [chat-widget.tsx:388-405](app/components/chat-widget.tsx:388) | Giữ, nhưng thêm nút "So sánh" mở view so sánh 2–3 sản phẩm (xem 7.2) |

### 5.2. Typography & design token

- [layout.tsx:6-14](app/layout.tsx:6) tải **Geist + Geist Mono** với `subsets: ["latin"]`, nhưng [globals.css:27](app/globals.css:27) đặt `body { font-family: Arial, Helvetica, sans-serif; }` → font tải về **không được dùng**, vẫn tốn request + preload. Tiếng Việt cũng không có trong subset Latin nên dấu sẽ fallback.
- Nền bị chia đôi: `--background: #f5f4f0` ([globals.css:4](app/globals.css:4)) vs `bg-[#fbfaf8]` lặp ở 4 trang → hai sắc trắng khác nhau giữa body và page.
- `.line-through` tự định nghĩa ở [globals.css:38](app/globals.css:38) trùng utility của Tailwind.

**Hướng:** chọn 1 font có subset `vietnamese` (Inter / Be Vietnam Pro / Plus Jakarta Sans), bỏ `Arial`, đặt `font-sans` qua `@theme`, và gom `#fbfaf8` thành `--color-surface` để một chỗ đổi được toàn site.

### 5.3. Layout & trạng thái thiếu

- `ShopHeader` được import + render thủ công ở **4 trang** ([home](app/(shop)/page.tsx:23), [danh mục](app/(shop)/san-pham/page.tsx:21), [chi tiết](app/(shop)/san-pham/[slug]/page.tsx:20), [tìm kiếm](app/(shop)/tim-kiem/page.tsx:97)); footer chỉ có ở trang chủ. → Tạo `app/(shop)/layout.tsx` chứa `ShopHeader` + `SiteFooter`, sau đó xoá 4 chỗ render thủ công.
- Thiếu `app/(shop)/loading.tsx`, `error.tsx`, `not-found.tsx` → khi DB lỗi hoặc slug sai, khách thấy trang trắng/500 mặc định. `[slug]/page.tsx` có gọi `notFound()` nhưng không có UI riêng.
- `/admin` không có layout/không có link quay lại site.

### 5.4. SEO & metadata

- [layout.tsx:16](app/layout.tsx:16) chỉ có metadata gốc; **không** `metadataBase`, không `openGraph`, không `robots`.
- Trang chi tiết sản phẩm không có `generateMetadata` → 47 URL không có title/description riêng, không có OG image → chia sẻ link trông như link lỗi. Đây là điểm dễ gây ấn tượng xấu khi demo cho khách hàng thật.
- Không có `app/sitemap.ts`, `app/robots.ts`; `/admin` không `noindex`.

**Hướng:** thêm `generateMetadata` (title, description từ `short_description`, `openGraph.images` dùng chính ảnh sản phẩm) + JSON-LD `Product` (name, brand, offers.price, availability). Chỉ ~30 dòng nhưng thay đổi cảm nhận "đã là website thật".

### 5.5. Ảnh

Chỉ có 6 ảnh stock dùng lại cho 47 sản phẩm. Nhãn "Ảnh minh họa" ([product-image.tsx:31](app/components/product-image.tsx:31)) xử lý trung thực — giữ. Cải tiến: thêm `quality={70}` cho card trong danh sách (ảnh nhỏ), và `placeholder="blur"` với `blurDataURL` để tránh nháy trắng khi mạng chậm.

Lưu ý Next 16: `priority` đã deprecated, code đang dùng `preload` ([product-image.tsx:28](app/components/product-image.tsx:28)) — **đúng**, không cần sửa.

---

## 6. P3 — Chất lượng code, test, vận hành

### 6.1. Test & CI

- [package.json:11](package.json:11): `node --test --experimental-strip-types tests/**/*.test.ts` nhưng **không có thư mục `tests/`** → `npm test` fail ngay. Đây là lỗi "xấu hổ" nhất khi bàn giao.
- `@playwright/test` có trong devDependencies ([package.json:28](package.json:28)) nhưng không có `playwright.config.ts`, không có `e2e/`.

**Đề xuất bộ test tối thiểu (thuần node:test, không cần DB):**

```
tests/search.test.ts        normalizeVietnamese, parseAmountText ("5tr", "từ 3 đến 5 triệu", "dưới 2 củ")
tests/criteria.test.ts      parseRuleCriteria: "màu be" vs "bệ xí", "đen" vs "đến", "trang trí" vs "màu trắng"
tests/rank.test.ts          rankProducts: bồn cầu TOTO < 5tr phải xếp TOTO lên đầu, không lọt hãng khác
tests/build-reason.test.ts  buildReason: luôn nêu tradeoff, không rỗng
```

**E2E smoke (3 kịch bản, chạy trên bản build):** mở `/` → tìm "bồn cầu dưới 5 triệu" → thấy ≥1 thẻ; mở chat → hỏi bảo hành → thấy cảnh báo "bản mẫu"; `/admin/handoffs` khi chưa đăng nhập phải trả 401.

**CI:** GitHub Actions 1 job: `lint → typecheck → test → build → e2e`.

### 6.2. Type & mapping dữ liệu

[lib/search.ts:98](lib/search.ts:98) `getProductBySlug` dùng `as Product & { dimensions_mm: string }` rồi cast `as string` — về bản chất là ép `never`. Đồng thời logic parse JSON được viết **hai lần** (trong `getProductBySlug` và `getAllProducts`), dễ lệch khi thêm cột.

**Hướng:** khai báo `type ProductRow` (mọi cột đúng kiểu SQLite) + **một** `mapRowToProduct(row)` dùng cho cả hai hàm. Các hàm `getProductsByIds`/`findProductsByCriteria` cũng nên dùng chung `getAllProducts()` đã cache.

### 6.3. Observability

Hiện chỉ có `console.info/error` rời rạc trong [lib/llm.ts](lib/llm.ts:322). Đề xuất một logger nhỏ, log JSON theo request:

```ts
console.log(JSON.stringify({
  evt: "chat", session: sessionId.slice(0, 8), intent, mode: liveMode ? "live" : "mock",
  promptChars, latencyMs, model, productIds: ids.length, handoff: needsHandoff, ok
}));
```

Có số liệu này mới trả lời được: prompt đã giảm bao nhiêu % sau khi thêm retrieval, p95 latency, tỷ lệ handoff/ngày.

### 6.4. Eval script cần siết lại

[scripts/eval-chat.ts](scripts/eval-chat.ts:394) chạy **trực tiếp** vào DB dev (session `eval-...`) và assert theo **chuỗi copy chính xác** (`"Quy trình bảo hành mẫu"`, `"chưa được Kidohomes xác nhận"`). Đổi một câu chữ trong file `.md` là eval đỏ hàng loạt dù hành vi vẫn đúng.

**Hướng:**

- Chạy trên DB riêng: `DATABASE_PATH=data/eval.db` (sau khi 3.4 xong) hoặc `:memory:`.
- Assert trên **hành vi/thuộc tính**: `intent`, `needs_handoff`, `product_ids ⊆ tập hợp kỳ vọng`, `price ≤ ngân sách`, `có mention "mẫu"` (regex mềm) — tránh so khớp nguyên câu.
- Xuất kết quả ra JSON để so sánh giữa 2 lần chạy (regression gate thay vì chỉ in console).

### 6.5. Lệch giữa code và tài liệu

| README/comment nói | Thực tế |
|---|---|
| "60 sản phẩm" ([README.md:46](README.md:46)) | `scripts/seed.ts` có **47** |
| Docker Compose ([README.md:61](README.md:61)) | Không có `Dockerfile`/`docker-compose.yml` |
| `ADMIN_PASSWORD` cho admin ([README.md:37](README.md:37)) | Không được đọc ở đâu |
| "Gemini lỗi thì báo lỗi rõ ràng, không âm thầm fallback" | Đúng, nhưng code fallback vẫn còn (dead) → dễ bị bật nhầm sau này |
| Model mặc định `gemini-3.5-flash` ([lib/llm.ts:4](lib/llm.ts:4)) | `scripts/check-gemini.ts` lại so sánh với `gemini-2.5-flash` → cần xác nhận model khả dụng và cho phép cấu hình danh sách fallback |

---

## 7. Hướng phát triển tính năng (để demo "có câu chuyện")

Ngoài việc sửa, đây là các mảng nên bổ sung — chọn 2–3 cái là đủ khác biệt:

### 7.1. Tư vấn theo phòng tắm (guided wizard)
Thay vì bắt khách gõ tự do, cho chọn: loại phòng (chung cư 4m² / nhà phố / biệt thự) → ngân sách → phong cách → người dùng đặc biệt (người lớn tuổi, trẻ nhỏ). Mỗi bước là 1 state, kết quả là **combo** (bồn cầu + lavabo + sen) thay vì từng món rời. Đây là thứ AI tư vấn thực sự tạo giá trị so với filter thường.

### 7.2. So sánh sản phẩm
Chọn 2–3 thẻ → bảng so sánh (giá, kích thước, diện tích tối thiểu, bảo hành, tính năng). Nút "So sánh mẫu khác" đã có trong chat nhưng hiện chỉ gửi tin nhắn — nên mở view so sánh thật.

### 7.3. Admin handoff hoàn chỉnh
Đăng nhập, đổi status, ghi chú nội bộ, export CSV, badge "mới" trên header, và (quan trọng) **không hiển thị PII đầy đủ mặc định**.

### 7.4. Đo lường hành vi
Log 3 event: `search` (query, criteria, số kết quả), `chat` (intent, chọn sản phẩm), `handoff`. Sau đó trả lời được: khách bỏ đi ở bước nào, câu hỏi nào chatbot trả lời kém. Đây là dữ liệu để cải tiến prompt — hiện tại đang tối ưu "cảm tính".

### 7.5. Đa ngôn ngữ & khả năng mở rộng
Hiện chuỗi tiếng Việt nằm rải trong route/component. Nếu định bán cho đơn vị khác, tách `lib/messages.ts` (hoặc `next-intl`) — route group `[locale]` đã sẵn cấu trúc để thêm.

---

## 8. Lộ trình đề xuất

### Mốc A — 0,5 ngày ("làm cho nó đúng")
1. Xoá [app/page.tsx](app/page.tsx:1), chạy `build` xanh.
2. Thêm `proxy.ts` + đăng nhập admin; `noindex` cho `/admin`.
3. Xoá dead code (`generateGroundedChatReply` + call), bỏ `extractSearchCriteria` khỏi search route.
4. Sửa README (47 sản phẩm, bỏ Docker hoặc thêm Dockerfile thật).
5. Thêm `tests/` tối thiểu cho `lib/search.ts` → `npm test` xanh.

### Mốc B — 2–3 ngày ("làm cho nó rẻ và nhanh")
1. Retrieval chính sách + cache catalog + index sản phẩm gọn (mục 3.3) → đo `promptChars` trước/sau.
2. Streaming response + nút Dừng.
3. `app/(shop)/layout.tsx`, `loading/error/not-found`.
4. Rate limit 2 API.
5. Gộp schema/type, bỏ `ProductSummary` trùng.

### Mốc C — 1 tuần ("làm cho nó thuyết phục")
1. `generateMetadata` + JSON-LD + OG cho 47 trang sản phẩm; `sitemap.ts`.
2. Lưu `meta` lịch sử chat → reload giữ thẻ sản phẩm.
3. Wizard tư vấn theo phòng tắm; so sánh sản phẩm.
4. Admin handoff hoàn chỉnh (status, export, che PII).
5. CI + Playwright smoke 3 kịch bản; eval chat chạy trên DB riêng, xuất JSON.

---

## 9. Phụ lục — checklist xác minh

Chưa chạy được trong phiên này (shell bị chặn bởi lỗi quyền Windows của sandbox), nên đây là danh sách lệnh cần chạy để chốt từng kết luận:

```bash
pnpm build          # chốt 3.1 (kỳ vọng: lỗi "two parallel pages" trước khi sửa)
pnpm typecheck      # kiểm tra các cast ở lib/search.ts:98
pnpm lint
pnpm test           # kỳ vọng fail: không có tests/
pnpm eval:search    # cần dev server đang chạy
pnpm eval:chat      # cần LLM_MODE=live + GEMINI_API_KEY
```

Kỳ vọng sau Mốc A: cả 4 lệnh đầu xanh; `eval:*` chạy trên DB tách riêng và không làm bẩn `data/kidohomes.db`.

---

*Tài liệu này chỉ dựa trên đọc source + cấu hình trong repo, không bao gồm kết quả chạy thực tế.*
