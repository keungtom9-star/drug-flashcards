/**
 * prompts.js
 * 以香港繁體中文為主，保留英文醫學術語。
 */

function resolveLanguageInstruction(language) {
  return (language === 'english')
    ? 'Traditional Chinese (Hong Kong), keep English medical terms; if needed add brief English in brackets.'
    : 'Traditional Chinese (Hong Kong), keep English medical terms.';
}

function getWardCheatsheetPrompt(drugName, language) {
  const langInstruction = resolveLanguageInstruction(language);

  return `你是資深臨床藥劑師。請為 ${drugName} 製作「Ward Cheatsheet」。

對象：病房護理學生 / 新入職護士。

輸出要求（手機一眼睇）：
- 用 Markdown。
- 全部用點列（bullet points）。
- 每點盡量短（建議 12 字內）。
- 內容以繁中（香港）為主，保留英文醫學術語。

請嚴格用以下標題：
1. 💊 Administration
2. ⚠️ Never-Miss Safety
3. 🩺 Monitoring (Before / During / After)
4. ⏱️ Onset / Peak / Duration
5. 🚨 Escalate If

Language: ${langInstruction}.`;
}

function getAISearchPrompt(query) {
  return `你是護理導師。使用者搜尋藥物「${query}」。

請只回傳 strict JSON（不可有其他文字）。

Key 必須是："name", "class", "system", "indication", "SideEffects", "nursing"。

規則：
1. 內容以繁中（香港）為主，保留英文醫學術語。
2. 全部 value 要短，適合手機快速閱讀。
3. "nursing" 必須是單一字串，內含短點列，以 \n 分隔。
4. "system" 只可用以下其中一項：
[Gastro-intestinal system, Cardiovascular system, Respiratory system, Central nervous system, Infections, Endocrine system, Obstetrics, gynaecology, and urinary-tract disorders, Malignant disease and immunosuppression, Nutrition and blood, Musculoskeletal and joint disease, Eye, Ear, nose, and oropharynx, Skin, Immunological products and vaccines, Anaesthesia].`;
}

function getCaseStudyPrompt(drug, language) {
  const langInstruction = resolveLanguageInstruction(language);

  return `請建立 ${drug.name}（${drug.indication}）護理臨床個案。

要求：
- 以繁中（香港）為主，保留英文醫學術語。
- 用 Markdown 點列，短句，方便手機閱讀。

請包含：
1. Patient snapshot
2. Medication order
3. Pre-administration checks
4. Post-administration observations
5. Critical-thinking question

Language: ${langInstruction}.`;
}

function getQuizExplainPrompt(quizData, language) {
  const langInstruction = resolveLanguageInstruction(language);

  return `使用者完成藥理題目。

題目："${quizData.q}"
作答："${quizData.u}"
正確答案："${quizData.correctAnswerText}"
藥物重點：${quizData.c.name}

請用點列回答：
1. 先講對錯。
2. 為何正確答案正確（最多 2 點）。
3. 若答錯，講錯因（最多 1-2 點）。
4. 提供一個記憶法（memory tip）。
5. 最後一句 bedside takeaway（短句）。

Language: ${langInstruction}.`;
}

function getISBARPrompt(drug, language) {
  const langInstruction = resolveLanguageInstruction(language);
  return `請為使用 ${drug.name} 的病人撰寫 ISBAR 交班。

要求：
- 以繁中（香港）為主，保留英文醫學術語。
- 點列短句，方便當值時快速閱讀。
- 結構：Identity, Situation, Background, Assessment, Recommendation。

Language: ${langInstruction}.`;
}
