import { Settings } from '../types';

export const streamAI = async (
  prompt: string,
  settings: Settings,
  onChunk: (chunk: string) => void
): Promise<void> => {
  const url = "https://api.deepseek.com/chat/completions";
  const headers: any = { "Content-Type": "application/json", "Authorization": `Bearer ${settings.deepseekKey}` };
  const body: any = { model: "deepseek-flash", messages: [{ role: "user", content: prompt }], stream: true };

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
  const url = "https://api.deepseek.com/chat/completions";
  const headers: any = { "Content-Type": "application/json", "Authorization": `Bearer ${settings.deepseekKey}` };
  const body: any = { model: "deepseek-flash", messages: [{ role: "user", content: prompt }], stream: false };

  const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if(!response.ok) throw new Error("API Request Failed");
  
  const json = await response.json();
  return json.choices[0].message.content;
};
