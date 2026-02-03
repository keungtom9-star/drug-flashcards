import React, { useState, useEffect } from 'react';
import { Drug, Settings } from './types';
import { fetchDrugs, uploadDrug } from './services/dataService';
import { DEFAULT_DEEPSEEK_KEY, SYSTEMS } from './constants';
import DrugCard from './components/DrugCard';
import { getAvailableVoices } from './utils/ttsUtils';
import { streamAI, getFullAIResponse } from './services/aiService';

const App: React.FC = () => {
    // --- State ---
    const [drugs, setDrugs] = useState<Drug[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSystem, setSelectedSystem] = useState('All');
    const [history, setHistory] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Modals
    const [showSettings, setShowSettings] = useState(false);
    const [showVS, setShowVS] = useState(false);
    
    // Settings
    const [settings, setSettings] = useState<Settings>({
        provider: 'deepseek',
        deepseekKey: DEFAULT_DEEPSEEK_KEY,
        yinliKey: '',
        yinliModel: 'gemini-2.5-flash',
        voiceURI: '',
        aiLanguage: 'lihkg'
    });

    // VS Logic
    const [vsA, setVsA] = useState('');
    const [vsB, setVsB] = useState('');
    const [vsOutput, setVsOutput] = useState('');
    const [vsLoading, setVsLoading] = useState(false);

    // AI Search Logic
    const [aiPreviewDrug, setAiPreviewDrug] = useState<Drug | null>(null);
    const [aiSearchLoading, setAiSearchLoading] = useState(false);
    const [aiSearchError, setAiSearchError] = useState('');

    // --- Effects ---
    useEffect(() => {
        // Load settings from local storage
        const savedProvider = localStorage.getItem('ai_provider');
        const savedDSKey = localStorage.getItem('ds_key');
        const savedYinliKey = localStorage.getItem('yl_key');
        const savedVoice = localStorage.getItem('voice_uri');
        const savedHistory = localStorage.getItem('search_hist');

        setSettings(prev => ({
            ...prev,
            provider: (savedProvider as any) || 'deepseek',
            deepseekKey: savedDSKey || DEFAULT_DEEPSEEK_KEY,
            yinliKey: savedYinliKey || '',
            voiceURI: savedVoice || ''
        }));

        if (savedHistory) setHistory(JSON.parse(savedHistory));

        // Load Data
        fetchDrugs()
            .then(data => setDrugs(data))
            .catch(err => console.error(err))
            .finally(() => setLoading(false));

        // Load voices listener
        if (window.speechSynthesis) {
             window.speechSynthesis.onvoiceschanged = () => { /* triggers re-render if needed to show voices in settings */ };
        }
    }, []);

    // --- Handlers ---
    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const q = e.target.value;
        setSearchQuery(q);
        if (aiPreviewDrug) setAiPreviewDrug(null);
        if (q.length > 3 && !history.includes(q)) {
            const newHist = [q, ...history].slice(0, 5);
            setHistory(newHist);
            localStorage.setItem('search_hist', JSON.stringify(newHist));
        }
    };

    const handleSystemClick = (sysFull: string) => {
        setSelectedSystem(sysFull);
        setSearchQuery('');
        setAiPreviewDrug(null);
    };

    const handleAICompare = async () => {
        if (!vsA || !vsB) return;
        setVsLoading(true);
        setVsOutput('');
        const langInstruction = settings.aiLanguage === 'lihkg' ? "Use Hong Kong Cantonese (LIHKG style)." : "Use English.";
        const prompt = `Compare "${vsA}" vs "${vsB}" for a nursing student. Markdown Table. Columns: Feature, ${vsA}, ${vsB}. Rows: Class, Indication, Mech, Side Effects, Nursing. Winner summary at end. ${langInstruction}`;
        
        try {
            await streamAI(prompt, settings, setVsOutput);
        } catch (e) {
            setVsOutput(`Error: ${(e as Error).message}`);
        } finally {
            setVsLoading(false);
        }
    };

    const handleAISearch = async () => {
        setAiSearchLoading(true);
        setAiSearchError('');
        const prompt = `You are a pharmacology DB. Output JSON object for drug "${searchQuery}". Keys: "name", "class", "indication", "system" (Choose from list: Gastro-intestinal system, Cardiovascular system, Respiratory system, Central nervous system, Infections, Endocrine system, Obstetrics, gynaecology, and urinary-tract disorders, Malignant disease and immunosuppression, Nutrition and blood, Musculoskeletal and joint disease, Eye, Ear, nose, and oropharynx, Skin, Immunological products and vaccines, Anaesthesia), "SideEffects", "nursing", "hold_param" (optional), "admin_type" (optional). Output JSON only.`;

        try {
            let jsonStr = await getFullAIResponse(prompt, settings);
            jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
            const data = JSON.parse(jsonStr);
            setAiPreviewDrug(data);
        } catch (e) {
            setAiSearchError((e as Error).message);
        } finally {
            setAiSearchLoading(false);
        }
    };

    const saveAIDrug = async () => {
        if (!aiPreviewDrug) return;
        setAiSearchLoading(true); // Reuse loading state
        try {
            await uploadDrug(aiPreviewDrug);
            setDrugs(prev => [...prev, aiPreviewDrug]);
            setSearchQuery('');
            setAiPreviewDrug(null);
            alert('Saved!');
        } catch (e) {
            alert('Upload failed (CORS/Script error). Locally saved.');
            setDrugs(prev => [...prev, aiPreviewDrug]);
            setSearchQuery('');
            setAiPreviewDrug(null);
        } finally {
            setAiSearchLoading(false);
        }
    };

    // --- Filtering Logic ---
    let filteredDrugs = drugs;
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filteredDrugs = drugs.filter(d => 
            (d.name || "").toLowerCase().includes(q) || 
            (d.class || "").toLowerCase().includes(q) ||
            (d.indication || "").toLowerCase().includes(q)
        ).sort((a, b) => {
             const nameA = (a.name || "").toLowerCase();
             const nameB = (b.name || "").toLowerCase();
             if (nameA.startsWith(q) && !nameB.startsWith(q)) return -1;
             if (!nameA.startsWith(q) && nameB.startsWith(q)) return 1;
             return nameA.localeCompare(nameB);
        });
    } else if (selectedSystem !== 'All') {
        filteredDrugs = drugs.filter(d => (d.system || "").includes(selectedSystem))
            .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } else {
        filteredDrugs = [...drugs].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }

    return (
        <div className="min-h-screen bg-background pb-20">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-surface-sec/80 backdrop-blur-md border-b border-black/10 px-4 pt-[calc(env(safe-area-inset-top)+6px)] pb-3 flex justify-between items-center">
                <h1 className="text-xl font-bold flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-primary shadow-sm flex items-center justify-center text-white text-xs">💊</div>
                    Drug Tutor
                </h1>
                <div className="flex gap-2">
                    <button onClick={() => setShowVS(true)} className="bg-blue-500/10 text-primary font-bold text-[13px] px-3 py-1 rounded-2xl">🆚 VS</button>
                    <button onClick={() => setShowSettings(true)} className="bg-gray-200/50 w-8 h-8 rounded-full flex items-center justify-center">⚙️</button>
                </div>
            </header>

            {/* Search */}
            <div className="p-4 bg-transparent sticky top-[60px] z-40">
                <div className="relative w-full">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                    <input 
                        type="text" 
                        value={searchQuery}
                        onChange={handleSearch}
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-input-bg text-[17px] text-black outline-none focus:bg-surface focus:ring-2 focus:ring-primary transition-all"
                        placeholder="Search drug..."
                    />
                </div>
            </div>

            {/* Chips */}
            <div className="flex gap-2 overflow-x-auto px-4 pb-4 no-scrollbar">
                <button 
                    onClick={() => handleSystemClick('All')}
                    className={`px-4 py-2 rounded-full text-[13px] font-semibold whitespace-nowrap transition-all ${selectedSystem === 'All' ? 'bg-primary text-white shadow-lg shadow-blue-500/30' : 'bg-surface text-black shadow-sm'}`}
                >
                    All
                </button>
                {SYSTEMS.map(sys => (
                    <button 
                        key={sys.id}
                        onClick={() => handleSystemClick(sys.full)}
                        className={`px-4 py-2 rounded-full text-[13px] font-semibold whitespace-nowrap transition-all ${selectedSystem === sys.full ? 'bg-primary text-white shadow-lg shadow-blue-500/30' : 'bg-surface text-black shadow-sm'}`}
                    >
                        {sys.name}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="px-4 pb-8 space-y-4">
                {loading && (
                    <div className="space-y-4 animate-pulse">
                        <div className="h-20 bg-gray-200 rounded-[18px]"></div>
                        <div className="h-20 bg-gray-200 rounded-[18px]"></div>
                        <div className="h-20 bg-gray-200 rounded-[18px]"></div>
                    </div>
                )}

                {!loading && !aiPreviewDrug && filteredDrugs.map((drug, idx) => (
                    <DrugCard key={idx} drug={drug} settings={settings} />
                ))}

                {!loading && filteredDrugs.length === 0 && !aiPreviewDrug && (
                    <div className="text-center py-10">
                         <div className="text-6xl opacity-20 mb-4">🩺</div>
                         <div className="text-gray-500 mb-6">Drug not found locally.</div>
                         <button 
                            onClick={handleAISearch}
                            disabled={aiSearchLoading}
                            className="bg-primary text-white font-semibold py-3 px-6 rounded-xl shadow-lg active:opacity-80 disabled:opacity-50"
                         >
                             {aiSearchLoading ? '✨ Consulting AI...' : '✨ Ask AI Pharmacist'}
                         </button>
                         {aiSearchError && <div className="text-red-500 mt-4 text-sm">{aiSearchError}</div>}
                    </div>
                )}

                {aiPreviewDrug && (
                    <div className="bg-surface border-2 border-primary p-6 rounded-[18px]">
                        <div className="text-xs font-bold text-primary uppercase mb-2">✨ AI Generated Preview</div>
                        <h2 className="text-2xl font-extrabold mb-1">{aiPreviewDrug.name}</h2>
                        <div className="text-gray-500 mb-4">{aiPreviewDrug.class}</div>
                        <div className="space-y-2 text-sm">
                            <p><strong>System:</strong> {aiPreviewDrug.system}</p>
                            <p><strong>Indication:</strong> {aiPreviewDrug.indication}</p>
                        </div>
                        <button onClick={saveAIDrug} className="w-full mt-6 bg-primary text-white font-bold py-3 rounded-xl mb-2">💾 Save to Database</button>
                        <button onClick={() => setAiPreviewDrug(null)} className="w-full text-gray-400 font-semibold py-2">Cancel</button>
                    </div>
                )}
            </div>

            {/* Settings Modal */}
            {showSettings && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center sm:justify-center backdrop-blur-sm" onClick={() => setShowSettings(false)}>
                    <div className="bg-surface w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 h-[85vh] sm:h-auto overflow-y-auto animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold">Settings</h2>
                            <button onClick={() => setShowSettings(false)} className="bg-input-bg text-black font-semibold px-4 py-2 rounded-full text-sm">Done</button>
                        </div>
                        
                        <div className="bg-surface-sec rounded-xl overflow-hidden mb-6">
                            <div className="p-4 border-b border-black/5 flex justify-between items-center">
                                <span>📚 Data Source</span>
                                <span className="text-gray-500">Google Sheets</span>
                            </div>
                            <div className="p-4 flex justify-between items-center cursor-pointer active:bg-gray-200" onClick={() => setSettings(s => ({...s, aiLanguage: s.aiLanguage === 'english' ? 'lihkg' : 'english'}))}>
                                <span>🌐 AI Persona</span>
                                <span className="text-primary font-bold">{settings.aiLanguage === 'lihkg' ? 'LIHKG Mode' : 'English'}</span>
                            </div>
                        </div>

                        <h3 className="text-xs font-bold text-gray-500 uppercase px-4 mb-2">Voice</h3>
                        <div className="bg-surface-sec rounded-xl p-4 mb-6">
                            <select 
                                className="w-full bg-transparent text-base outline-none"
                                value={settings.voiceURI}
                                onChange={(e) => {
                                    setSettings(s => ({...s, voiceURI: e.target.value}));
                                    localStorage.setItem('voice_uri', e.target.value);
                                }}
                            >
                                <option value="">🤖 Auto-Detect Best</option>
                                {getAvailableVoices().map(v => (
                                    <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
                                ))}
                            </select>
                        </div>

                        <h3 className="text-xs font-bold text-gray-500 uppercase px-4 mb-2">AI Configuration</h3>
                        <div className="bg-surface-sec rounded-xl p-4 space-y-4">
                            <select 
                                className="w-full p-2 rounded-lg bg-surface border border-gray-200"
                                value={settings.provider}
                                onChange={(e) => {
                                    const val = e.target.value as any;
                                    setSettings(s => ({...s, provider: val}));
                                    localStorage.setItem('ai_provider', val);
                                }}
                            >
                                <option value="deepseek">DeepSeek (Official)</option>
                                <option value="yinli">Yinli (Gemini/Any)</option>
                            </select>
                            
                            {settings.provider === 'deepseek' ? (
                                <input 
                                    type="password" 
                                    className="w-full p-3 rounded-lg bg-surface border border-gray-200"
                                    placeholder="API Key"
                                    value={settings.deepseekKey}
                                    onChange={(e) => {
                                        setSettings(s => ({...s, deepseekKey: e.target.value}));
                                        localStorage.setItem('ds_key', e.target.value);
                                    }}
                                />
                            ) : (
                                <input 
                                    type="password" 
                                    className="w-full p-3 rounded-lg bg-surface border border-gray-200"
                                    placeholder="Yinli Key"
                                    value={settings.yinliKey}
                                    onChange={(e) => {
                                        setSettings(s => ({...s, yinliKey: e.target.value}));
                                        localStorage.setItem('yl_key', e.target.value);
                                    }}
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* VS Modal */}
            {showVS && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center sm:justify-center backdrop-blur-sm" onClick={() => setShowVS(false)}>
                    <div className="bg-surface w-full max-w-xl rounded-t-3xl sm:rounded-3xl p-6 h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-2xl font-bold">Drug Comparison</h2>
                            <button onClick={() => setShowVS(false)} className="bg-input-bg text-black font-semibold px-4 py-2 rounded-full text-sm">Close</button>
                        </div>
                        <div className="flex gap-4 mb-4">
                            <div className="flex-1">
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Drug A</label>
                                <input className="w-full p-3 bg-input-bg rounded-xl" placeholder="e.g. Panadol" value={vsA} onChange={e => setVsA(e.target.value)} />
                            </div>
                            <div className="flex items-center pt-5 font-bold text-primary">VS</div>
                            <div className="flex-1">
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Drug B</label>
                                <input className="w-full p-3 bg-input-bg rounded-xl" placeholder="e.g. Aspirin" value={vsB} onChange={e => setVsB(e.target.value)} />
                            </div>
                        </div>
                        <button onClick={handleAICompare} disabled={vsLoading} className="w-full bg-primary text-white font-bold py-3 rounded-xl mb-4">
                            {vsLoading ? '⚔️ Comparing...' : '⚔️ Compare Now'}
                        </button>
                        <div className="flex-1 overflow-y-auto bg-input-bg rounded-xl p-4 text-sm prose max-w-none">
                            {vsOutput ? <div dangerouslySetInnerHTML={{__html: window.marked ? window.marked.parse(vsOutput) : vsOutput}} /> : <span className="text-gray-400 text-center block mt-10">Result will appear here...</span>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;