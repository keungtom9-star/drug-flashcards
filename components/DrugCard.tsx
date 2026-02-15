import React, { useState, useRef } from 'react';
import { Drug, Settings } from '../types';
import IVCalculator from './IVCalculator';
import { speakText } from '../utils/ttsUtils';
import { streamAI } from '../services/aiService';

interface DrugCardProps {
    drug: Drug;
    settings: Settings;
    isNew?: boolean;
}

const DrugCard: React.FC<DrugCardProps> = ({ drug, settings, isNew }) => {
    const [expanded, setExpanded] = useState(false);
    const [showCalc, setShowCalc] = useState(false);
    const [pushTimer, setPushTimer] = useState(0);
    const [timerActive, setTimerActive] = useState(false);
    const [aiOutput, setAiOutput] = useState<string | null>(null);
    const [loadingAI, setLoadingAI] = useState(false);
    const intervalRef = useRef<any>(null);

    const toggleExpand = () => setExpanded(!expanded);

    const startTimer = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (timerActive) return;
        setPushTimer(120);
        setTimerActive(true);
        intervalRef.current = setInterval(() => {
            setPushTimer((prev) => {
                if (prev <= 1) {
                    clearInterval(intervalRef.current!);
                    setTimerActive(false);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const handleSpeak = (e: React.MouseEvent) => {
        e.stopPropagation();
        const text = settings.aiLanguage === 'lihkg'
            ? `藥名: ${drug.name}。 類別: ${drug.class}。 用途: ${drug.indication}。 副作用: ${drug.SideEffects}。 護理: ${drug.nursing}`
            : `Drug Name: ${drug.name}. Class: ${drug.class}. Indication: ${drug.indication}. Side Effects: ${drug.SideEffects}. Nursing: ${drug.nursing}`;
        speakText(text, settings.voiceURI, settings.aiLanguage);
    };


    const openGoogleDeepLink = (e: React.MouseEvent) => {
        e.stopPropagation();
        const q = encodeURIComponent(`${drug.name} nursing considerations`);
        const appLink = `google://search?q=${q}`;
        const webLink = `https://www.google.com/search?igu=1&q=${q}`;

        const now = Date.now();
        window.location.href = appLink;
        setTimeout(() => {
            if (Date.now() - now < 1600) {
                window.open(webLink, '_blank', 'noopener');
            }
        }, 700);
    };

    const triggerAI = async (e: React.MouseEvent, type: 'isbar' | 'explain' | 'cheat' | 'mix') => {
        e.stopPropagation();
        setLoadingAI(true);
        setAiOutput('');
        
        let prompt = "";
        const langInstruction = settings.aiLanguage === 'lihkg' 
            ? "Use Hong Kong Cantonese (LIHKG style, casual/slang)." 
            : "主要用繁體中文（香港），保留英文醫學術語，適合護理學生。";

        if (type === 'isbar') prompt = `請以 ISBAR 撰寫 ${drug.name} 相關護理交班。內容用繁體中文（香港），保留英文醫學術語，重點精簡。${langInstruction}`;
        else if (type === 'mix') prompt = `請提供 ${drug.name} 的 Reconstitution 與 Administration 指引（IV/IM）：Diluent、Rate、Stability。用繁中（香港）+ 英文醫學術語。${langInstruction}`;
        else if (type === 'explain') prompt = `請向護理學生解釋 ${drug.name}，用簡單比喻。重點：Mechanism of Action、Key Indication、一個高風險警示。用短點列。${langInstruction}`;
        else if (type === 'cheat') {
            if (settings.aiLanguage === 'lihkg') {
                prompt = `You are a cynical "Old Seafood" (老屎忽) nurse on LIHKG teaching a fresh grad (FG) about ${drug.name}.
Structure:
1. **Facts**: What is it really? Use HK hospital slang/cantonese.
2. **Survival**: The ONE thing that gets you scolded by the MO/Consultant if you miss it.
3. **Admin**: Push fast/slow? Dilute?
4. **Patient Scolding**: How to warn a stubborn patient (废老) in colloquial Cantonese.
Tone: Funny, cynical, use emojis, typical HK forum style.`;
            } else {
                prompt = `請為 ${drug.name} 製作「Ward Survival Cheatsheet」，用短點列：🛑 STOP Checks、📉 Monitoring、⚡️ Red Flags。內容精簡，手機一眼睇。`;
            }
        }

        try {
            await streamAI(prompt, settings, (chunk) => {
                setAiOutput(chunk);
            });
        } catch (err) {
            setAiOutput(`錯誤：${(err as Error).message}`);
        } finally {
            setLoadingAI(false);
        }
    };

    const needsAdminTools = (drug.system && drug.system.includes('Cardio')) || (drug.admin_type && drug.admin_type.includes('IV'));

    return (
        <div 
            onClick={toggleExpand}
            className={`bg-surface p-5 rounded-[18px] shadow-sm border border-gray-100 relative overflow-hidden transition-all duration-200 active:scale-[0.99] cursor-pointer ${isNew ? 'border-secondary border-2' : ''}`}
        >
            {isNew && <div className="bg-secondary text-white text-[10px] px-2 py-1 rounded-full inline-block mb-2 font-bold">✅ Saved</div>}
            
            <div className="flex justify-between items-center">
                <div>
                    <div className="text-lg font-bold text-black">{drug.name}</div>
                    <div className="text-sm text-gray-500 font-medium">{drug.class}</div>
                </div>
                <div className={`text-gray-400 text-2xl font-light transition-transform duration-300 ${expanded ? 'rotate-90 text-primary opacity-100' : ''}`}>›</div>
            </div>

            {expanded && (
                <div className="mt-5 pt-4 border-t border-gray-100 animate-in fade-in slide-in-from-top-2 duration-300">
                    {drug.hold_param && (
                        <div className="bg-red-50 border border-danger text-danger p-3 rounded-xl text-sm font-bold flex items-center gap-2 mb-4">
                            <span>⛔️</span><span>HOLD IF: {drug.hold_param}</span>
                        </div>
                    )}

                    {needsAdminTools && (
                        <div className="mb-4 pb-4 border-b border-gray-100">
                            <div className="flex gap-2">
                                <button 
                                    onClick={startTimer}
                                    className={`flex-1 py-2 px-4 rounded-full text-sm font-bold flex items-center justify-center gap-2 transition-all ${timerActive ? 'bg-orange-400 text-white animate-pulse' : 'bg-primary text-white'}`}
                                >
                                    {timerActive ? `⏳ ${pushTimer}s` : '⏱ 2 Min Push'}
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setShowCalc(!showCalc); }}
                                    className="flex-1 py-2 px-4 rounded-full text-sm font-bold bg-gray-200 text-gray-600"
                                >
                                    🧮 Drip Calc
                                </button>
                            </div>
                            {showCalc && <IVCalculator />}
                        </div>
                    )}

                    <div className="space-y-4">
                        {[
                            { l: 'System', v: drug.system },
                            { l: 'Indication', v: drug.indication },
                            { l: 'Side Effects', v: drug.SideEffects },
                            { l: 'Nursing', v: drug.nursing }
                        ].map((item, i) => (
                            <div key={i}>
                                <span className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">{item.l}</span>
                                <span className="text-base text-black leading-relaxed">{item.v || "N/A"}</span>
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-2 overflow-x-auto py-4 no-scrollbar mt-2">
                        <button onClick={(e) => triggerAI(e, 'isbar')} className="whitespace-nowrap px-4 py-2 rounded-full text-[13px] font-semibold bg-yellow-50 text-yellow-600">🚑 ISBAR</button>
                        <button onClick={(e) => triggerAI(e, 'explain')} className="whitespace-nowrap px-4 py-2 rounded-full text-[13px] font-semibold bg-green-50 text-green-600">🎓 講解</button>
                        <button onClick={(e) => triggerAI(e, 'cheat')} className="whitespace-nowrap px-4 py-2 rounded-full text-[13px] font-semibold bg-blue-50 text-blue-500">📋 病房速覽</button>
                        <button onClick={(e) => triggerAI(e, 'mix')} className="whitespace-nowrap px-4 py-2 rounded-full text-[13px] font-semibold bg-purple-50 text-purple-600">🧪 Recon</button>
                        <button onClick={openGoogleDeepLink} className="whitespace-nowrap px-4 py-2 rounded-full text-[13px] font-semibold bg-gray-200 text-black">G</button>
                    </div>

                    <button 
                        onClick={handleSpeak}
                        className="w-full bg-surface-sec text-primary font-semibold py-3.5 rounded-xl text-base flex justify-center items-center gap-2 active:bg-gray-200 transition-colors"
                    >
                        🔊 朗讀內容
                    </button>

                    {(loadingAI || aiOutput) && (
                        <div className="mt-4 p-4 rounded-xl bg-surface-sec text-sm text-black leading-relaxed">
                            {loadingAI && !aiOutput && <div className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-gray-300 border-t-primary rounded-full animate-spin"></div> 思考中...</div>}
                            {aiOutput && (
                                <div 
                                    className="prose prose-sm max-w-none"
                                    dangerouslySetInnerHTML={{ __html: window.marked ? window.marked.parse(aiOutput) : aiOutput }} 
                                />
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default DrugCard;