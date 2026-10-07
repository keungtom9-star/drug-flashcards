<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy AI Drug Tutor

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/temp/1

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

## DeepSeek-only AI

All AI features use the official DeepSeek API with the `deepseek-flash` model. By default they call `/.netlify/functions/deepseek`, so the browser never receives the site's secret.

The app and its Netlify proxy do not set or forward a `max_tokens` output ceiling. DeepSeek still applies the selected model's context limit, the account's quota/rate limits, and normal API charges; removing the app-side ceiling does not make the upstream service literally unlimited or free.

Before deploying on Netlify:

1. Open **Project configuration → Environment variables**.
2. Create `DEEPSEEK_API_KEY` and paste a newly issued DeepSeek key as its value.
3. Mark it as a secret / sensitive value when Netlify offers that option.
4. Redeploy the site so the function receives the new variable.

Never add the real key to source code, GitHub, screenshots, logs, or pull-request comments. Local Vite alone does not emulate Netlify Functions; use a Netlify development environment or a deployed preview when testing live AI calls.

Users may instead choose **Settings → Use my own DeepSeek API**. This optional BYOK mode stores the personal key only in that browser's local storage and sends AI requests directly to `https://api.deepseek.com/chat/completions`; it never sends the personal key to Netlify. **Clear saved key** deletes it and immediately restores the built-in secure mode. Avoid BYOK on a shared device, and use the default server mode when direct browser requests are restricted by a network or browser policy.

## Missing-drug search and Nursing care

When a saved drug is missing, the app presents two explicit choices. **RxNorm + openFDA** checks the configured Google Sheet first, then RxNorm and the openFDA drug-label API without AI tokens; RxNorm related brand concepts are used when an openFDA label has no brand name. **Direct AI search** skips those public databases and asks DeepSeek for one concise English + Cantonese draft, including exactly three Nursing care sentences in each language. The AI route is clearly labelled as non-official data that must be checked against BNF or the local formulary. Both routes open an editable review and never add or save a result automatically.

Official RxNorm/openFDA results offer one combined **AI improve data + Nursing care** action. It prepares medicine-card suggestions—generic/brand name, class, indication, side effects, system, drug effect, and exactly three concise Nursing care sentences—in one request. A field-by-field **Current / AI suggestion** review lets the user choose **Use AI** or **Keep original**, apply all, and undo the last AI change. Nothing is saved automatically. The same request prepares concise English and Traditional Chinese written Cantonese versions. Medicine and brand names remain in English for safer identification.

Every saved database result also has **AI modify data** beside Google, Drugs.com, and the Cantonese explanation. It prefills that record, uses the same combined data-and-Nursing action, and waits for field-level approval. Accepting an AI change marks the record as AI-modified and clears its previous verification date until the user explicitly marks it verified again. The review offers separate **device only** and **Google Sheet + device** save buttons. Sheet updates use the original generic name, require an explicit server acknowledgement, and never fall back to appending a duplicate row.

Every editable review also includes **Auto-check: AI + RxNorm + openFDA**. It requires both an RxNorm identity and an openFDA label, then asks DeepSeek to compare those supplied facts with the current mobile card and prepares field-by-field suggestions. A passing automated check never writes `verified_at` by itself: the nurse must review any differences and explicitly choose **Confirm checked & mark verified today**, then save. Editing a field makes the automated result stale and clears the verification state.

## English / Cantonese drug cards

Choose **Settings → Drug card language / 藥卡語言** to show the clinical card fields in English or Traditional Chinese Cantonese. Search and Revise switch immediately, Cantonese terms are searchable, and records without Cantonese data safely fall back to English. The generic and brand name always stay in English.

The editable review keeps both language sections together. Device-only saves may keep an older English-only record, but a Google Sheet save requires both language sections. The six Cantonese columns are `class_zh_hk`, `system_zh_hk`, `indication_zh_hk`, `side_effects_zh_hk`, `nursing_zh_hk`, and `effect_of_drug_zh_hk`; the existing unsuffixed columns remain English. The v3 script also stores `data_source`, `verified_at`, and `ai_modified` so every mobile card can show provenance and safety status.

## Safe Google Sheet updates

The **Save changes to Google Sheet + device** button and AI charge log require the web app in [`google-apps-script/Code.gs`](google-apps-script/Code.gs). The current web app protocol is v3. Safe drug-row updates remain compatible with v2 payloads and refuse an update unless exactly one original row matches; v3 additionally supports provenance fields and a separate AI usage table.

1. Back up the Sheet, then open its existing Google Apps Script project.
2. Replace or merge the existing web-app handler with `google-apps-script/Code.gs`.
3. For a standalone script, add the Script Property `SPREADSHEET_ID`. Optionally add `SHEET_NAME`; a Sheet-bound script can use its active spreadsheet.
4. Update the existing web-app deployment so its `/exec` URL stays the same, with access granted to the app's users.
5. Open the deployed `/exec?action=capabilities`; it should return `"supports_update":true`, `"supports_usage_log":true`, `"bilingual_fields":true`, `"languages":["en","zh-HK"]`, and `"protocol_version":3`.

This deployment can be done on iPhone or iPad in Safari by opening the Apps Script project and requesting the desktop website, although a larger screen is easier for replacing `Code.gs` and updating the deployment. Keep the existing `/exec` URL so the installed Home Screen app does not need a new setting.

On the first add or update after deployment, the script automatically appends missing Cantonese and provenance columns to an existing header row. A blank drug sheet receives the complete English + Cantonese header set. Back up the Sheet before replacing the script, and do not rename the drug-name column.

The first AI usage upload creates a separate `AI_Usage` tab. It records request ID, timestamp, feature, model/mode, success, prompt/cache/output/total tokens, retry count, estimated USD, pricing period/version, and a short error. It never stores prompts, API keys, or medicine content. Request IDs are deduplicated. Cost is an estimate based on the pricing version in `ai-usage.js`; the provider invoice remains authoritative.

Settings includes a **Data & Sync Centre** for Google Sheet drug v2/v3 capability, AI usage v3 capability, DeepSeek, RxNorm, openFDA, last database sync, queued drug writes, tokens, and estimated charge. Failed safe drug writes and usage records remain in device storage and can be retried. Until the deployment reports bilingual v2 support, no drug POST is attempted; until it reports usage v3 support, usage stays queued. Device-only save remains available.

The editable **Nursing care** field uses DeepSeek and generates exactly three short bedside sentences, which must be reviewed against the prescription, current formulary, and local policy before choosing an Add or Save button. AI improvement, streaming Cantonese explanation, and disease-drug revision all use the same server-protected DeepSeek model; there is no fallback to another provider.

The home **Revise** tab is deliberately local and fast: it shows 10 randomly selected saved drugs in one colourful floating-card column. Opening cards fills a round progress bar, explored cards gain a check mark, and **Random 10** starts a fresh mix. A small header timestamp identifies the currently deployed app update.

The former Clinical / quiz page is now **AI Drugs by Disease**. Enter a disease or condition to request 10 common but distinct medicines, their classes, bilingual uses, and clinically important interactions within that 10-drug set. Structured disease requests disable unnecessary model thinking, leave the output ceiling to the official DeepSeek API, retry with a shorter JSON prompt when the first response is malformed, truncated or short, and then fall back to compact delimiter and names-only formats if JSON remains unusable. The page merges safe partial replies, removes duplicate generic / brand / salt entries, salvages complete entries from truncated JSON, and checks every result against the loaded or cached drug database. Matches are marked **In database**; unmatched results remain clearly labelled AI drafts and are never auto-saved.

Ward laboratory cards keep their English clinical explanation and add Traditional Chinese Cantonese names, uses, interpretation, and nursing escalation points for all 62 listed values, including ABG / VBG.
