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

## Secure Qwen API on Netlify

The default AI provider is the free OpenRouter model `qwen/qwen3.8-27b:free`. Browser requests go through `netlify/functions/openrouter-qwen.mjs`, so the OpenRouter key is never included in the public HTML or JavaScript bundle.

1. Revoke any API key that has been pasted into chat, source code, or a public location.
2. Create a fresh OpenRouter key.
3. In Netlify, open **Project configuration → Environment variables** and add `OPENROUTER_API_KEY` with Functions access.
4. Trigger a new deployment. Netlify applies runtime environment-variable changes to Functions on the next deploy.

For local Function testing, use Netlify Dev and provide `OPENROUTER_API_KEY` through a gitignored local environment file. Never add the real value to this repository.

## Missing-drug search and Nursing care

Missing drugs are checked in this order: the configured Google Sheet, RxNorm, then the openFDA drug-label API. These searches do not use AI tokens and never add a result automatically. If all sources miss, the review form provides a Google Search button and manual entry.

Official RxNorm/openFDA results also offer an optional **AI improve official data** button. It simplifies the editable official fields in place without changing Nursing care or saving anything automatically.

Only the editable **Nursing care** field uses DeepSeek. Add a DeepSeek key in Settings, generate the short bedside guidance, then review it against the prescription, current formulary, and local policy before choosing an Add button.

The home **Revise** tab shows 10 randomly selected drugs in a single floating-card column. Tap a card to reveal its indication, side effects, Nursing care, and drug effect; choose **New 10** to reshuffle.
