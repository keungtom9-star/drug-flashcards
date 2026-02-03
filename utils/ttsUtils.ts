export const getAvailableVoices = (): SpeechSynthesisVoice[] => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return [];
    return window.speechSynthesis.getVoices();
};

export const speakText = (text: string, voiceURI: string, lang: 'english' | 'lihkg') => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const targetLang = lang === 'lihkg' ? 'zh-HK' : 'en-US';
    u.lang = targetLang;
    u.rate = 0.95;

    if (voiceURI) {
        const voice = window.speechSynthesis.getVoices().find(v => v.voiceURI === voiceURI);
        if (voice) u.voice = voice;
    } else {
        // Smart select
        const voices = window.speechSynthesis.getVoices();
        const available = voices.filter(v => v.lang.includes(targetLang.replace('-', '_')) || v.lang.includes(targetLang));
        let best = available.find(v => v.name.includes('Premium'));
        if (!best) best = available.find(v => v.name.includes('Enhanced'));
        if (!best) best = available.find(v => v.name.includes('Google'));
        if (!best) best = available[0];
        if (best) u.voice = best;
    }

    window.speechSynthesis.speak(u);
};