import { getSlide } from './deck';
import { normalizePreferences } from './adapt';
import type { Preferences, Slide } from './types';

export type PersonalizedSlide = {
  slide: Slide;
  title: string;
  body: string;
  takeaway: string;
  terms: Array<{ label: string; body: string }>;
  className: string;
  style: string;
};

export function renderPersonalizedSlide(slideId: string, preferences: Preferences): PersonalizedSlide {
  preferences = normalizePreferences(preferences);
  const slide = getSlide(slideId);
  const body = chooseBody(slide, preferences);
  return {
    slide,
    title: preferences.language === 'ja' ? localizeTitle(slide.title) : slide.title,
    body,
    takeaway: slide.takeaway,
    terms: slide.terms.map(term => ({
      label: term.label,
      body: preferences.language === 'ja' ? term.ja : term.en,
    })),
    className: [
      preferences.contrast === 'high' ? 'theme-high' : 'theme-default',
      `level-${preferences.level}`,
      `detail-${preferences.detail}`,
    ].join(' '),
    style: `--font-scale:${preferences.fontScale}`,
  };
}

function chooseBody(slide: Slide, preferences: Preferences): string {
  if (preferences.level === 'beginner') return slide.beginner;
  if (preferences.level === 'expert' || preferences.detail === 'detailed') return slide.expert;
  return preferences.language === 'ja' ? slide.ja : slide.en;
}

function localizeTitle(title: string): string {
  const titles: Record<string, string> = {
    'One talk, many interfaces': '1つの発表、たくさんのUI',
    'Speaker workflow': 'スピーカーの流れ',
    'Attendee workflow': '参加者の流れ',
    'Live, agent-shaped access': 'ライブで変わるエージェント型アクセス',
  };
  return titles[title] ?? title;
}
