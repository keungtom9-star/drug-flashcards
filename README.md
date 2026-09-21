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
