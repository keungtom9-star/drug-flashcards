import { Settings } from '../types';

const PROXY_URL = "/.netlify/functions/deepseek";
const DIRECT_URL = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-flash";
const MODE_STORAGE_KEY = "drug_tutor_deepseek_mode";
const KEY_STORAGE_KEY = "drug_tutor_deepseek_key";

const getConnection = (settings: Settings) => {
  const mode = settings.deepseekMode || localStorage.getItem(MODE_STORAGE_KEY) || 'server';
  const key = (settings.deepseekKey || localStorage.getItem(KEY_STORAGE_KEY) || '').trim();
  if (mode === 'personal') {
    if (!key) throw new Error('Own DeepSeek API is selected, but no key is saved.');
    return { url: DIRECT_URL, headers: { Authorization: `Bearer ${key}` }, model: MODEL };
  }
  return { url: PROXY_URL, headers: {}, model: '' };
};

export const streamAI = async (
  prompt: string,
  settings: Settings,
  onChunk: (chunk: string) => void
): Promise<void> => {
  const connection = getConnection(settings);
  const url = connection.url;
  const headers: any = { "Content-Type": "application/json", ...connection.headers };
  const body: any = {
    messages: [{ role: "user", content: prompt }], stream: true,
    ...(connection.model ? { model: connection.model } : {}),
  };

  const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });

  if (!response.ok) {
     const err = await response.text();
     throw new Error(`API Error: ${err}`);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let fullText = "";

  if (!reader) throw new Error("No response body");

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ') && line !== 'data: [DONE]') {
        try {
          const json = JSON.parse(line.substring(6));
          const content = json.choices[0]?.delta?.content || "";
          fullText += content;
          onChunk(fullText);
        } catch (e) {
            // ignore parse errors for partial chunks
        }
      }
    }
  }
};

export const getFullAIResponse = async (prompt: string, settings: Settings): Promise<string> => {
  const connection = getConnection(settings);
  const url = connection.url;
  const headers: any = { "Content-Type": "application/json", ...connection.headers };
  const body: any = {
    messages: [{ role: "user", content: prompt }], stream: false,
    ...(connection.model ? { model: connection.model } : {}),
  };

  const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if(!response.ok) throw new Error("API Request Failed");
  
  const json = await response.json();
  return json.choices[0].message.content;
};
