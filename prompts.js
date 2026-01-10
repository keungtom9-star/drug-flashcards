// File: prompts.js

/**
 * 1. HELPER: Determines the language style (Cantonese/LIHKG/English)
 */
function getRoleInstruction(language) {
    if (language === 'cantonese') {
         return "Language Requirement: **Strictly Traditional Chinese (Cantonese)**. \n\nDirectives:\n1. The majority of the response MUST be in Traditional Chinese characters.\n2. ONLY use English for specific Medical Terms and Drug Names.\n3. Do not output full English sentences.\n4. in a professional tone and be like a teacher or professor.";
    }
    if (language === 'lihkg') {
         return "Language Requirement: **Strictly Traditional Chinese (Cantonese)** with **Hong Kong Internet Slang**.\n\nDirectives:\n1. Roleplay as a cynical/informal HK nursing student (LIHKG style).\n2. The majority of the response MUST be in Traditional Chinese characters (e.g. 大癲, 師兄, 救命).\n3. ONLY use English for Medical Terms.\n4. Do not output full English sentences.";
    }
    return "Provide response in **English**.";
}

/**
 * 2. PROMPT: Clinical Mentor (The "Ask" Feature)
 */
function getMentorPrompt(userInput, language) {
    return `Role: Senior Clinical Nursing Educator. Input: "${userInput}". 
    1. Explain Pathophysiology using **vivid analogies** with common treatments
    2. Focus on "What nurse must DO/OBSERVE". 
    3. Do not Use Tables, but use Bullet points to make it easy to read
    4. Limit the reply to 10 - 20 sentences 
    ${getRoleInstruction(language)}`;
}

/**
 * 3. PROMPT: Integrated Case Study (The "Sim" Feature)
 */
function getCaseStudyPrompt(drugObj, language) {
    return `
    Drug: ${drugObj.name} (${drugObj.class}).
    Task: Create a detailed clinical case study.
    
    Structure Required:
    1. limit the response to 10-20 sentences    
    2. **Patient Profile**: Create a common patient for this drug (Age, Gender, History).
    3. **Condition & Dosage**: Why are they taking this specific drug and what is the standard dosing regimen for this condition?
    4. **Polypharmacy Context**: List 2-3 other drugs this patient is likely taking (co-morbidities) and potential interactions.
    5. **Drug Differentiation**: Briefly explain how ${drugObj.name} differs from a similar drug in its class or drugs with similar functions (e.g. if it's Heparin, compare to Enoxaparin; if Atenolol, compare to Propranolol).
    6. **Scenario**: A situation requiring nursing judgment and actions to check before and after admin this drug.
    7. **Action**: What the nurse should do.

    ${getRoleInstruction(language)}`;
}

/**
 * 4. PROMPT: Quiz Explanation (The "Explain Why" Feature)
 */
function getQuizExplainPrompt(quizData, language) {
    return `Explain quiz. 
    Question: "${quizData.q}" 
    User Answered: "${quizData.u}" 
    Correct Answer: "${quizData.correctAnswerText}" 
    Drug Context: "${quizData.c.name}" (${quizData.c.class}). 
    ${getRoleInstruction(language)} 
    Markdown: 1. Why is "${quizData.correctAnswerText}" correct? 2. Brief Nursing Tip.`;
}