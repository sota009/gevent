export type Language = 'en' | 'ja';
export type Detail = 'normal' | 'detailed';
export type Contrast = 'default' | 'high';
export type Level = 'standard' | 'beginner' | 'expert';

export type Preferences = {
  language: Language;
  fontScale: number;
  detail: Detail;
  contrast: Contrast;
  level: Level;
};

export type Term = {
  label: string;
  en: string;
  ja: string;
};

export type Slide = {
  id: string;
  title: string;
  en: string;
  ja: string;
  beginner: string;
  expert: string;
  takeaway: string;
  terms: Term[];
};

export type SessionState = {
  eventId: string;
  currentSlideId: string;
  updatedAt: string;
};

export type AdaptResult = Preferences & {
  explanation: string;
};
