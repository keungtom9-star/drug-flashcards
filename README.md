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

All AI features use the official DeepSeek API with the `deepseek-flash` model. Add a personal DeepSeek key in the app's Settings; it is stored only in that browser and sent directly to `api.deepseek.com`. Never add a real key to source code, GitHub, a screenshot, or a pull-request comment.

## Missing-drug search and Nursing care

Missing drugs are checked in this order: the configured Google Sheet, RxNorm, then the openFDA drug-label API. These searches do not use AI tokens and never add a result automatically. If all sources miss, the review form provides a Google Search button and manual entry.

Official RxNorm/openFDA results also offer an optional **AI improve official data** button. It simplifies the editable official fields in place without changing Nursing care or saving anything automatically.

The editable **Nursing care** field uses DeepSeek and generates exactly three short bedside sentences, which must be reviewed against the prescription, current formulary, and local policy before choosing an Add button. AI improvement, Cantonese explanation, and disease-based revision also use the same DeepSeek model and key; there is no fallback to another provider.

The home **Revise** tab shows 10 randomly selected drugs in a single floating-card column. Tap a card to reveal the indication, side effects, Nursing care, and drug effect; choose **Random 10** to reshuffle. You can also enter a disease and ask DeepSeek for up to 10 common, distinct generic medicines. This request uses DeepSeek JSON mode with a compact name array, then retries once if the first answer is empty or short. The app accepts full JSON objects, compact name arrays, numbered or bulleted lists, Markdown tables, and recoverable names from truncated JSON. It removes generic/brand/salt duplicates and checks every result against the loaded or cached drug database: matches reuse the saved details and Nursing care, while unmatched cards are clearly marked as AI drafts. Disease lists stay in memory only and never auto-save.
