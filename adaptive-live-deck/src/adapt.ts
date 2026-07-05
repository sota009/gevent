import { defaultPreferences, presets } from './deck';
import type { AdaptResult, Preferences } from './types';

export type PresetName = keyof typeof presets;

export function preferencesForPreset(name: PresetName | string): Preferences {
  return { ...(presets[name as PresetName] ?? defaultPreferences) };
}

export function normalizePreferences(value: Partial<Preferences> | undefined): Preferences {
  const next = value ?? {};
  const fontScale = typeof next.fontScale === 'number' && Number.isFinite(next.fontScale)
    ? next.fontScale
    : defaultPreferences.fontScale;
  return {
    language: next.language === 'ja' ? 'ja' : 'en',
    fontScale: clampFontScale(fontScale),
    detail: next.detail === 'detailed' ? 'detailed' : 'normal',
    contrast: next.contrast === 'high' ? 'high' : 'default',
    level: next.level === 'beginner' || next.level === 'expert' ? next.level : 'standard',
  };
}

export function mergePreferences(base: Preferences, patch: Partial<Preferences>): Preferences {
  return normalizePreferences({
    ...base,
    ...patch,
  });
}

export function adaptRequest(requestText: string, current: Preferences = defaultPreferences): AdaptResult {
  current = normalizePreferences(current);
  const text = normalize(requestText);
  const patch: Partial<Preferences> = {};
  const reasons: string[] = [];

  if (matches(text, ['日本語', '翻訳', 'ja', 'japanese'])) {
    patch.language = 'ja';
    reasons.push('Japanese language');
  }

  if (matches(text, ['英語', 'en', 'english', '戻して'])) {
    patch.language = 'en';
    reasons.push('English language');
  }

  if (matches(text, ['もっと大きく', 'さらに大きく', 'huge', 'bigger'])) {
    patch.fontScale = Math.max(current.fontScale + 0.35, 1.55);
    reasons.push('larger text');
  } else if (matches(text, ['大きく', '読みやすく', '見やすく', 'large'])) {
    patch.fontScale = Math.max(current.fontScale + 0.2, 1.3);
    reasons.push('large text');
  }

  if (matches(text, ['小さく', 'compact', 'smaller'])) {
    patch.fontScale = 1;
    reasons.push('standard text size');
  }

  if (matches(text, ['初心者', 'やさしく', '優しく', 'わかりやすく', '分かりやすく', 'beginner'])) {
    patch.level = 'beginner';
    patch.detail = patch.detail ?? 'normal';
    reasons.push('beginner explanation');
  }

  if (matches(text, ['専門', '詳しく', '深く', 'expert', 'technical', 'detail'])) {
    patch.level = 'expert';
    patch.detail = 'detailed';
    reasons.push('expert detail');
  }

  if (matches(text, ['暗く', '高コントラスト', 'コントラスト', 'dark', 'contrast'])) {
    patch.contrast = 'high';
    reasons.push('high contrast');
  }

  if (matches(text, ['標準', '普通', 'standard', 'reset'])) {
    return {
      ...defaultPreferences,
      explanation: 'Reset to the standard attendee view.',
    };
  }

  const next = mergePreferences(current, patch);
  return {
    ...next,
    explanation: reasons.length > 0
      ? `Updated for ${reasons.join(', ')}.`
      : 'No matching preference keywords found; kept the current view.',
  };
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function matches(text: string, needles: string[]): boolean {
  return needles.some(needle => text.includes(needle.toLowerCase()));
}

function clampFontScale(value: number): number {
  return Math.max(0.9, Math.min(1.8, Number(value.toFixed(2))));
}
