# Assumptions and design decisions

## General approach
- This project is a demo website for Kidohomes and intentionally uses sample data only.
- Product and policy content are modeled as lightweight sample assets because no real Kidohomes dataset or brand assets were provided.
- The app favors a deterministic offline mode (`LLM_MODE=mock`) to ensure the demo can run in local labs without API access.

## Stack choices
- Next.js App Router + TypeScript is used as requested.
- SQLite via `better-sqlite3` is selected for a simple local database with no extra services.
- Google Gemini is integrated through the official `@google/genai` SDK, while the project defaults to mock mode when `GEMINI_API_KEY` is missing.
- Zod is used to validate extracted search criteria and structured AI responses.

## Search product logic
- Search criteria are normalized for Vietnamese text with accents, shorthand such as `tr`, `k`, `nghin`, and simple query patterns.
- **`/api/search` is rule-based only** (no LLM call). It checks exact SKU first, then applies parsed criteria and requires every remaining meaningful text term to occur in the product catalog fields; a malformed or unknown SKU never falls through to broad matches.
- Explicit category, brand, budget, color, material, stock, room-size/area, and feature criteria are hard filters. A SKU lookup returns only that exact product, or no product when the code is unknown or accompanying hard criteria conflict; it never substitutes a nearby item.
- Remaining text terms are accent-insensitive and matched against product name, category, brand, color, material, description, and features after rule criteria are applied. Unknown phrases return no products instead of silently showing the entire catalog; this favors precision over semantic matching for unrecognized synonyms.
- `match_confidence` is retained for compatibility with saved chat cards; current search results only include products that pass the recognized filters.

## Chatbot logic
- With `LLM_MODE=live` and a Gemini key, nuanced/product turns send prior turns as alternating customer/model messages, including products shown in earlier recommendation cards. Product catalog context is attached only to product turns, and policy context is limited to the retrieved templates for that question (`getPolicyContext`, at most 2 topics). Standalone greetings/thanks, explicit handoff phrases, and policy questions with a matching local document use deterministic replies without a Gemini request.
- If Gemini times out or fails, the API does not leave the customer with a dead end and does not silently pretend to be the model: it answers from the deterministic offline rules and labels the fallback. Daily quota exhaustion is remembered for the provider's retry window in the current process, so later chat turns skip futile Gemini calls and receive a clear fallback notice. A hard failure (write error, unexpected exception) still surfaces as an error.
- `mock` mode or missing credentials keeps the deterministic offline fallback and its keyword/criteria limitations. Offline intent keywords are shared with the policy retrieval through `lib/policy-keywords.ts` so the two cannot drift apart.
- Live product recommendations are resolved from Gemini's returned SKU codes against the sample SQLite catalog and then filtered against the active hard criteria. Offline mode does not rank or recommend products; exact SKU lookup is handled locally without a Gemini request.
- Chat keeps relevant product-advice context between turns. Policy, handoff, greeting, and unrelated turns end the previous product context.
- Product and policy answers are limited to the sample catalog and knowledge in `data/knowledge`; policy questions do not automatically offer or open a handoff form.
- Warranty questions return the full warranty document so no conditions are omitted by section ranking. The warranty policy is a demo-created sample and is not confirmed by Kidohomes; the chatbot does not determine eligibility for a specific case.
- All policy files remain unconfirmed demo content. The expanded return/refund policy includes assumed time limits and fees and is never an official Kidohomes commitment.
- In live mode, the handoff form appears only for an explicit handoff phrase recognized by the shared local rules or when Gemini classifies a less direct request as an explicit request to speak with staff. Merely mentioning staff or asking about support does not count; policy classification alone never activates the form.
- Email addresses and phone numbers in free-text prompts are redacted before Gemini calls; handoff form fields and contact data are never sent to Gemini.
- Chat history and handoff requests are stored in the local SQLite demo database. Each user turn is written before the model call, and assistant turns store a `meta` JSON column (recommended products + follow-up questions) so the widget can rebuild product cards after a page reload. A pending handoff flag stays set until the handoff form is submitted or the session is reset.
- Responses are JSON by default; when the client sends `Accept: application/x-ndjson` the API streams status events plus a final payload, so the UI can show progress and offer a stop button. Token-level streaming is not implemented because Gemini returns one structured JSON object.
- `follow_up_questions` are rendered as buttons the **customer** taps, so the model is instructed to write them in customer voice (a need or a short answer to the question just asked), never as a question back to the customer. `sanitizeFollowUpQuestions` enforces this server-side: it drops assistant-addressed lines ("Bạn …"), drops questions that only paraphrase the clarification just asked, removes duplicates and staff/contact wording, caps the list at 3, and falls back to neutral suggestions if everything was filtered out.
- The AI response schema is deliberately tolerant: list length and text length are not rejected at parse time (a 4th suggestion used to invalidate the whole answer with a 503). Truncation and caps are applied after parsing.
- Gemini latency measured in this environment ranged from ~3.7 s to ~17 s with occasional `503 UNAVAILABLE`; the default timeout is 25 s and the UI streams status plus a stop button so long waits stay visible and cancellable.
- Assistant markdown is rendered by a minimal renderer whose React keys are derived from paragraph + line + part, because keys that restart per line collide and make React duplicate or drop children (this produced repeated, garbled policy text on screen).
- Model answers are checked for degenerate repetition (a unit of ≥ 6 characters repeated ≥ 5 times in a row). Policy answers that get stuck in such a loop are replaced by the retrieved policy document itself; other answers are cut at the loop start and logged as `llm_degenerate_reply`. The prompt additionally forbids markdown tables and repeated phrasing for policy summaries.


## UI and branding
- The shop uses a warm neutral palette, dark navy accents, responsive product cards, and locally stored Unsplash bathroom imagery mapped to product categories. These stock scenes are illustrative and do not represent the exact demo product models.
- Brand assets are placeholder generated shapes rather than copied logos; the display name remains Kidohomes for the demo.
- Inter (with the `vietnamese` subset) is loaded via `next/font` and applied through the `--font-sans` theme token, so Vietnamese diacritics render consistently instead of falling back to Arial.
- `/admin` is a separate area: it uses its own layout, is marked `noindex`, and is never indexed or linked from the catalogue sitemap.

## Security and operations
- `/admin/**` is protected by `proxy.ts` (the Next.js 16 replacement for `middleware.ts`). The session cookie stores `SHA-256(ADMIN_PASSWORD)` — never the password — and is `httpOnly`, `sameSite=lax`, and expires after 8 hours. If `ADMIN_PASSWORD` is unset, admin routes return 503 instead of opening up.
- Contact details in handoff requests are masked by default and only revealed through an explicit toggle, so a shoulder-surf or accidental screenshot does not leak a full phone number or email.
- In-memory token buckets guard `/api/chat` (20/min/session), `/api/search` (60/min), `/api/handoff` (5/hour), and admin login (8/15 min). This is sufficient for a single instance; a shared store is required when scaling horizontally.
- `DATABASE_PATH` makes the SQLite file configurable (`:memory:` supported) so unit tests and eval scripts run on `data/eval.db` and never touch demo data. The DB and its WAL files are gitignored.
- Requests emit structured JSON logs (`lib/log.ts`) with prompt sizes, latency, intent, and handoff outcome, which is what the prompt-size and latency claims are measured from.

