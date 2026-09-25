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

Before deploying on Netlify:

1. Open **Project configuration → Environment variables**.
2. Create `DEEPSEEK_API_KEY` and paste a newly issued DeepSeek key as its value.
3. Mark it as a secret / sensitive value when Netlify offers that option.
4. Redeploy the site so the function receives the new variable.

Never add the real key to source code, GitHub, screenshots, logs, or pull-request comments. Local Vite alone does not emulate Netlify Functions; use a Netlify development environment or a deployed preview when testing live AI calls.

Users may instead choose **Settings → Use my own DeepSeek API**. This optional BYOK mode stores the personal key only in that browser's local storage and sends AI requests directly to `https://api.deepseek.com/chat/completions`; it never sends the personal key to Netlify. **Clear saved key** deletes it and immediately restores the built-in secure mode. Avoid BYOK on a shared device, and use the default server mode when direct browser requests are restricted by a network or browser policy.

## Missing-drug search and Nursing care

Missing drugs are checked in this order: the configured Google Sheet, RxNorm, then the openFDA drug-label API. These searches do not use AI tokens and never add a result automatically. If all sources miss, the review form provides a Google Search button and manual entry.

Official RxNorm/openFDA results also offer an optional **AI improve official data** button. It simplifies the editable official fields in place without changing Nursing care or saving anything automatically.

The editable **Nursing care** field uses DeepSeek and generates exactly three short bedside sentences, which must be reviewed against the prescription, current formulary, and local policy before choosing an Add button. AI improvement, streaming Cantonese explanation, and disease-drug revision all use the same server-protected DeepSeek model; there is no fallback to another provider.

The home **Revise** tab is deliberately local and fast: it shows 10 randomly selected saved drugs in one floating-card column, and **Random 10** reshuffles them.

The former Clinical / quiz page is now **AI Drugs by Disease**. Enter a disease or condition to request 10 common but distinct medicines, their classes, bilingual uses, and clinically important interactions within that 10-drug set. Structured disease requests disable unnecessary model thinking, use an 8K JSON-output allowance, retry with a shorter JSON prompt when the first response is malformed, truncated or short, and then fall back to compact delimiter and names-only formats if JSON remains unusable. The page merges safe partial replies, removes duplicate generic / brand / salt entries, salvages complete entries from truncated JSON, and checks every result against the loaded or cached drug database. Matches are marked **In database**; unmatched results remain clearly labelled AI drafts and are never auto-saved.

Ward laboratory cards keep their English clinical explanation and add Traditional Chinese Cantonese names, uses, interpretation, and nursing escalation points for all 62 listed values, including ABG / VBG.
