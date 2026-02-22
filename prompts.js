/**
 * prompts.js
 * Use English output while keeping standard medical terminology.
 */

function resolveLanguageInstruction(language) {
  return (language === 'english')
    ? 'English only. Keep medical terminology clear and standard.'
    : 'English only. Keep medical terminology clear and standard.';
}

function getWardCheatsheetPrompt(drugName, language) {
  const langInstruction = resolveLanguageInstruction(language);

  return `You are a senior clinical pharmacist. Create a "Ward Cheatsheet" for ${drugName}.

Audience: ward nursing students / newly hired nurses.

Output requirements (mobile quick view):
- Use Markdown.
- Use bullet points only.
- Keep each point very short (ideally under 12 words).
- Write in English and keep medical terms precise.

Use exactly these headings:
1. 💊 Administration
2. ⚠️ Never-Miss Safety
3. 🩺 Monitoring (Before / During / After)
4. ⏱️ Onset / Peak / Duration
5. 🚨 Escalate If

Language: ${langInstruction}.`;
}

function getAISearchPrompt(query) {
  return `You are a nursing tutor. The user is searching for "${query}".

Return strict JSON only (no extra text).

Required keys: "name", "class", "system", "indication", "SideEffects", "nursing".

Rules:
1. Use English only, with concise medical language.
2. Keep all values short for fast mobile reading.
3. "nursing" must be a single string with short bullet lines separated by \n.
4. "system" must be exactly one of:
[Gastro-intestinal system, Cardiovascular system, Respiratory system, Central nervous system, Infections, Endocrine system, Obstetrics, gynaecology, and urinary-tract disorders, Malignant disease and immunosuppression, Nutrition and blood, Musculoskeletal and joint disease, Eye, Ear, nose, and oropharynx, Skin, Immunological products and vaccines, Anaesthesia].`;
}

function getCaseStudyPrompt(drug, language) {
  const langInstruction = resolveLanguageInstruction(language);

  return `Create a nursing clinical case for ${drug.name} (${drug.indication}).

Requirements:
- English only, with clear medical terminology.
- Use short Markdown bullet points for mobile readability.

Include:
1. Patient snapshot
2. Medication order
3. Pre-administration checks
4. Post-administration observations
5. Critical-thinking question

Language: ${langInstruction}.`;
}

function getQuizExplainPrompt(quizData, language) {
  const langInstruction = resolveLanguageInstruction(language);

  return `The user has completed a pharmacology question.

Question: "${quizData.q}"
User answer: "${quizData.u}"
Correct answer: "${quizData.correctAnswerText}"
Drug focus: ${quizData.c.name}

Respond in bullet points:
1. State whether the answer is correct.
2. Explain why the correct answer is correct (max 2 points).
3. If incorrect, explain the mistake (max 1-2 points).
4. Give one memory tip.
5. End with one short bedside takeaway.

Language: ${langInstruction}.`;
}

function getISBARPrompt(drug, language) {
  const langInstruction = resolveLanguageInstruction(language);
  return `Write an ISBAR handover for a patient receiving ${drug.name}.

Requirements:
- English only, with concise medical wording.
- Use short bullet points for fast on-duty reading.
- Structure: Identity, Situation, Background, Assessment, Recommendation.

Language: ${langInstruction}.`;
}
