/**
 * prompts.js
 * Centralized storage for all AI System Prompts.
 * Functions return formatted prompt strings based on input data and language settings.
 */

// 1. Ward Cheatsheet Prompt (Search Result Action)
function getWardCheatsheetPrompt(drugName, language) {
    const langInstruction = (language === 'lihkg' || language === 'cantonese') 
        ? "Traditional Chinese (Cantonese style for clarity where appropriate)" 
        : "English";

    return `Act as a senior clinical pharmacist. Create a concise "Ward Cheatsheet" for the drug ${drugName}.
    
    Structure the response exactly as follows using Markdown:
    1. 💊 **Administration**: Usual route, critical prep (e.g., dilute with NS), and push rate if IV.
    2. ⚠️ **Critical Alerts**: One-sentence "Never Forget" (Black box warnings or lethal errors).
    3. 🩺 **Ward Monitoring**: Specific vitals/labs to check before & after (e.g., HR, K+, BP, Glucose).
    4. ⏱️ **Onset/Peak**: Essential timing for the ward (when to expect effect).
    
    Constraints:
    - Keep it extremely concise and professional (bullet points).
    - Target Audience: Nursing Students/New Grads on a busy ward.
    - Language: ${langInstruction}.`;
}

// 2. Global Database Search Prompt (JSON Generator)
function getAISearchPrompt(query) {
    return `You are a nursing tutor. The user is searching for the drug "${query}". 
    Provide a clinical summary in strict JSON format with no extra text. 
    
    Use these exact keys: "name", "class", "system", "indication", "SideEffects", "nursing".
    
    IMPORTANT FORMATTING RULES:
    1. For the "nursing" field, you MUST use a single string with bullet points separated by new lines (\\n).
    2. For the "system" field, you MUST strictly choose the single best fit from this exact list:
       [Gastro-intestinal system, Cardiovascular system, Respiratory system, Central nervous system, Infections, Endocrine system, Obstetrics, gynaecology, and urinary-tract disorders, Malignant disease and immunosuppression, Nutrition and blood, Musculoskeletal and joint disease, Eye, Ear, nose, and oropharynx, Skin, Immunological products and vaccines, Anaesthesia].
    
    Example JSON format:
    {
      "name": "Drug generic Name (brandname in hk)", 
      "class": "Class Name", 
      "system": "Cardiovascular system",
      "indication": "Brief indication", 
      "SideEffects": "Common side effects",
      "nursing": "- Monitor CBC for desired neutrophil increase.\\n- Manage bone pain."
    }`;
}

// 3. Patient Case Study Prompt (Flashcards)
function getCaseStudyPrompt(drug, language) {
    const langInstruction = (language === 'lihkg' || language === 'cantonese') 
        ? "Traditional Chinese (HK Clinical context)" 
        : "English";

    return `Create a short, realistic clinical case study for a nursing student regarding the drug: ${drug.name} (${drug.indication}).
    
    Include:
    1. **Patient Scenario**: A brief story (Age, Chief Complaint) requiring this drug.
    2. **The Order**: Write a mock medication order.
    3. **Pre-Assessment**: What MUST the nurse check before giving it?
    4. **Post-Administration**: What is the primary outcome to watch for?
    
    Format: Markdown.
    Tone: Educational but clinical.
    Language: ${langInstruction}.`;
}

// 4. Quiz Explanation Prompt (AI Tutor)
function getQuizExplainPrompt(quizData, language) {
    const langInstruction = (language === 'lihkg' || language === 'cantonese') 
        ? "Traditional Chinese (Explain like a friendly senior mentor)" 
        : "English";

    return `The user answered a quiz question about ${quizData.c.name}.
    
    Question: "${quizData.q}"
    User's Answer: "${quizData.u}"
    Correct Answer: "${quizData.correctAnswerText}"
    
    Task:
    1. Confirm if they were right or wrong.
    2. Explain clearly WHY the correct answer is right.
    3. Explain briefly why the other option might be confused (if applicable).
    4. Provide a simple memory tip (mnemonic or analogy) for this drug.
    
    Language: ${langInstruction}.`;
}

// prompts.js
function getWardCheatsheetPrompt(drugName, language) {
    const langInstruction = (language === 'lihkg') ? "Traditional Chinese (Cantonese Style)" : "English";
    return `Act as a senior pharmacist. Create a concise "Ward Cheatsheet" for ${drugName}.
    Include:
    1. 💊 **Admin**: Route, dilution, push rate.
    2. ⚠️ **Critical**: Black box warnings.
    3. 🩺 **Monitor**: Vitals/Labs.
    Use Markdown. Keep it brief. Language: ${langInstruction}.`;
}

function getISBARPrompt(drug, language) {
    const langInstruction = (language === 'lihkg') ? "Traditional Chinese (HK Nursing Style)" : "English";
    return `Write an ISBAR handover to a doctor for a patient needing ${drug.name}.
    Structure: Identity, Situation, Background, Assessment, Recommendation.
    Language: ${langInstruction}.`;
}

function getCaseStudyPrompt(drug, language) {
    const langInstruction = (language === 'lihkg') ? "Traditional Chinese" : "English";
    return `Create a short nursing case study for ${drug.name}. Include Scenario, Order, Pre-check, and Outcome. Language: ${langInstruction}.`;
}
