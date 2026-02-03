import React, { useState } from 'react';

const IVCalculator: React.FC = () => {
    const [vol, setVol] = useState<string>("");
    const [time, setTime] = useState<string>("");
    const [drop, setDrop] = useState<string>("20");
    const [result, setResult] = useState<string>("--");

    const calculate = () => {
        const v = parseFloat(vol);
        const t = parseFloat(time);
        const d = parseFloat(drop);
        if (v && t && d) {
            setResult(`${Math.round((v * d) / t)} gtt/min`);
        } else {
            setResult("--");
        }
    };

    return (
        <div className="bg-input-bg p-4 rounded-xl mt-4 animate-in fade-in slide-in-from-top-2 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="text-xs font-bold mb-2 text-gray-500 uppercase">IV Drip Calculator</div>
            <div className="flex gap-2 mb-2">
                <input 
                    type="number" 
                    placeholder="Vol (ml)" 
                    className="flex-1 p-2 rounded-lg bg-surface text-center text-base border-none outline-none focus:ring-2 focus:ring-primary"
                    value={vol}
                    onChange={(e) => setVol(e.target.value)}
                />
                <input 
                    type="number" 
                    placeholder="Min" 
                    className="flex-1 p-2 rounded-lg bg-surface text-center text-base border-none outline-none focus:ring-2 focus:ring-primary"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                />
                <input 
                    type="number" 
                    placeholder="Gtt (20)" 
                    className="flex-1 p-2 rounded-lg bg-surface text-center text-base border-none outline-none focus:ring-2 focus:ring-primary"
                    value={drop}
                    onChange={(e) => setDrop(e.target.value)}
                />
            </div>
            <div className="flex justify-between items-center">
                <button 
                    className="bg-primary text-white font-bold py-2 px-4 rounded-lg text-sm active:opacity-80 transition-opacity"
                    onClick={calculate}
                >
                    Calculate
                </button>
                <div className="text-xl font-extrabold text-primary">{result}</div>
            </div>
        </div>
    );
};

export default IVCalculator;