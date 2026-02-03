export interface Drug {
  name: string;
  class: string;
  indication: string;
  system: string;
  SideEffects: string;
  nursing: string;
  hold_param?: string;
  admin_type?: string;
}

export interface System {
  id: string;
  name: string;
  full: string;
}

export interface Settings {
  provider: 'deepseek' | 'yinli';
  deepseekKey: string;
  yinliKey: string;
  yinliModel: string;
  voiceURI: string;
  aiLanguage: 'english' | 'lihkg';
}

export interface AIResponse {
  text: string;
  isError: boolean;
}

// Global window extensions for CDN libraries
declare global {
  interface Window {
    Papa: any;
    marked: {
      parse: (text: string) => string;
    };
  }
}