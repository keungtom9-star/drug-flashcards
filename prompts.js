/**
 * prompts.js
 * Centralized storage for all AI System Prompts.
 * Functions return formatted prompt strings based on input data and language settings.
 */

function resolveLanguageInstruction(language, englishText, chineseText) {
  return (language === 'lihkg' || language === 'cantonese') ? chineseText : englishText;
}

// 1. Ward Cheatsheet Prompt (Search Result Action)
function getWardCheatsheetPrompt(drugName, language) {
  const langInstruction = resolveLanguageInstruction(
    language,
    'English',
    'Traditional Chinese (Hong Kong nursing style, clear and practical)'
  );

  return `Act as a senior clinical pharmacist. Create a ward-ready cheatsheet for ${drugName}.

Audience:
- Nursing students / new graduates in a busy ward.

Output rules:
- Use Markdown.
- Use short bullet points only.
- Keep each bullet under 12 words.
- Focus on safety and what to do at bedside.
- Use plain mobile wording for quick glance reading.

Use exactly these sections:
1. 💊 Administration
   - Route, dilution/reconstitution, infusion/push rate.
2. ⚠️ Never-Miss Safety
   - Top dangerous error(s), contraindications, red flags.
3. 🩺 What to Monitor
   - Before dose, during dose, after dose (vitals/labs/symptoms).
4. ⏱️ Timing Snapshot
   - Onset, peak, duration, reassessment timing.
5. 🚨 Escalate If
   - Clear trigger points for notifying doctor/rapid response.

Language: ${langInstruction}.`;
}

// 2. Global Database Search Prompt (JSON Generator)
function getAISearchPrompt(query) {
  return `You are a nursing tutor. The user is searching for the drug "${query}".
Provide a clinical summary in strict JSON format with no extra text. Keep values short for quick mobile scanning.

Use these exact keys: "name", "class", "system", "indication", "SideEffects", "nursing".

IMPORTANT FORMATTING RULES:
1. For the "nursing" field, use one string with short bullet points separated by new lines (\\n).
2. For the "system" field, choose exactly one from this list:
   [Gastro-intestinal system, Cardiovascular system, Respiratory system, Central nervous system, Infections, Endocrine system, Obstetrics, gynaecology, and urinary-tract disorders, Malignant disease and immunosuppression, Nutrition and blood, Musculoskeletal and joint disease, Eye, Ear, nose, and oropharynx, Skin, Immunological products and vaccines, Anaesthesia].

Example JSON format:
{
  "name": "Drug generic Name (brandname in hk)",
  "class": "Class Name",
  "system": "Cardiovascular system",
  "indication": "Brief indication",
  "SideEffects": "Common side effects",
  "nursing": "- Monitor BP before dose.\\n- Watch for dizziness."
}`;
}

// 3. Patient Case Study Prompt (Flashcards)
function getCaseStudyPrompt(drug, language) {
  const langInstruction = resolveLanguageInstruction(
    language,
    'English',
    'Traditional Chinese (HK clinical context)'
  );

  return `Create a short, realistic clinical case study for nursing students about ${drug.name} (${drug.indication}).

Include:
1. Patient scenario (age, complaint, key background).
2. Medication order (dose/route/frequency).
3. Pre-administration checks.
4. Post-administration observations.
5. One critical thinking question.

Format: Markdown using short headings + bullet points for glance reading.
Language: ${langInstruction}.`;
}

// 4. Quiz Explanation Prompt (AI Tutor)
function getQuizExplainPrompt(quizData, language) {
  const langInstruction = resolveLanguageInstruction(
    language,
    'English',
    'Traditional Chinese (friendly senior mentor tone)'
  );

  return `The user answered a drug quiz question.

Question: "${quizData.q}"
User answer: "${quizData.u}"
Correct answer: "${quizData.correctAnswerText}"
Drug focus: ${quizData.c.name}

Task:
1. State clearly: correct or incorrect.
2. Explain why the correct answer is correct (max 2 short bullets).
3. If incorrect, explain why the chosen answer is less suitable.
4. Give one memory tip.
5. End with one-line bedside takeaway (max 10 words).

Style rules:
- Use Markdown.
- Keep concise and easy to read on a phone.
- Use short bullets and short sentences.

Language: ${langInstruction}.`;
}

function getISBARPrompt(drug, language) {
  const langInstruction = resolveLanguageInstruction(
    language,
    'English',
    'Traditional Chinese (HK nursing handover style)'
  );

  return `Write an ISBAR handover to a doctor for a patient needing ${drug.name}.
Structure: Identity, Situation, Background, Assessment, Recommendation.
Use concise, clinically relevant point-form bullets for quick handover reading.
Language: ${langInstruction}.`;
}
