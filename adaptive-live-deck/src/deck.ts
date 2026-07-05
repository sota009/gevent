import type { Preferences, Slide } from './types';

export const EVENT_ID = 'demo-event';

export const defaultPreferences: Preferences = {
  language: 'en',
  fontScale: 1,
  detail: 'normal',
  contrast: 'default',
  level: 'standard',
};

export const presets = {
  standard: defaultPreferences,
  jaLarge: {
    language: 'ja',
    fontScale: 1.35,
    detail: 'normal',
    contrast: 'default',
    level: 'standard',
  },
  beginner: {
    language: 'ja',
    fontScale: 1.2,
    detail: 'normal',
    contrast: 'default',
    level: 'beginner',
  },
  highContrast: {
    language: 'en',
    fontScale: 1.2,
    detail: 'normal',
    contrast: 'high',
    level: 'standard',
  },
  expert: {
    language: 'en',
    fontScale: 1,
    detail: 'detailed',
    contrast: 'default',
    level: 'expert',
  },
} satisfies Record<string, Preferences>;

export const slides: Slide[] = [
  {
    id: 's01',
    title: 'One talk, many interfaces',
    en: 'The speaker gives one talk. Every attendee receives an interface shaped for them.',
    ja: '登壇者は1つの発表をします。参加者はそれぞれ自分に合ったUIで受け取ります。',
    beginner: '同じ話を聞いていても、見る画面は人によって変わります。',
    expert: 'The shared primitive is slide identity plus semantic content. The rendered interface is attendee-specific.',
    takeaway: 'The event is shared; the interface is personal.',
    terms: [
      {
        label: 'Dynamic interface',
        en: 'A UI that changes shape based on user intent and context.',
        ja: 'ユーザーの意図や状況に合わせて形が変わるUI。',
      },
    ],
  },
  {
    id: 's02',
    title: 'Speaker workflow',
    en: 'The speaker creates a deck from notes, then presents normally from the laptop.',
    ja: 'スピーカーはメモからスライドを作り、PCでいつも通り発表します。',
    beginner: '登壇者は特別な操作を覚えません。いつものスライドのように進めるだけです。',
    expert: 'speaker-deck-builder emits speaker.html, speaker-notes.md, attendee.html, and deck.json as the semantic IR.',
    takeaway: 'Do not make the speaker manage accessibility variants live.',
    terms: [
      {
        label: 'Semantic IR',
        en: 'A structured deck format that preserves meaning, notes, takeaways, and terms.',
        ja: '意味、ノート、要点、用語を保つスライドの構造データ。',
      },
    ],
  },
  {
    id: 's03',
    title: 'Attendee workflow',
    en: 'The attendee scans the QR code, chooses a preset, and asks their agent for changes.',
    ja: '参加者はQRを読み取り、プリセットを選び、エージェントに調整を頼みます。',
    beginner: 'スマホで開いて「大きくして」「日本語にして」と頼むだけです。',
    expert: 'The attendee agent maps natural language to preference JSON, then the renderer transforms the current slide.',
    takeaway: 'Attendees adapt their own view without interrupting the talk.',
    terms: [
      {
        label: 'Preference JSON',
        en: 'A small state object describing language, text size, detail, contrast, and expertise level.',
        ja: '言語、文字サイズ、詳しさ、コントラスト、理解レベルを表す小さな状態。',
      },
    ],
  },
  {
    id: 's04',
    title: 'Live, agent-shaped access',
    en: 'The speaker controls the moment. Each attendee or agent controls how that moment is rendered.',
    ja: '登壇者は場の進行を制御し、参加者やエージェントはその場面の表示を調整します。',
    beginner: '登壇者が次に進むとスマホも同期し、見づらければその場で調整できます。',
    expert: 'The MVP uses HTTP/SSE session state plus a deterministic preference boundary. External agents can call the same boundary later.',
    takeaway: 'Synchronize the moment, not the presentation UI.',
    terms: [
      {
        label: 'SSE',
        en: 'Server-Sent Events, a simple way to push state updates from server to browser.',
        ja: 'サーバーからブラウザへ状態更新を送るシンプルな仕組み。',
      },
      {
        label: 'MCP',
        en: 'A standard way for AI applications to connect to tools and external systems.',
        ja: 'AIアプリが外部ツールやシステムにつながるための標準的な仕組み。',
      },
    ],
  },
];

export function getSlide(slideId: string): Slide {
  return slides.find(slide => slide.id === slideId) ?? slides[0]!;
}

export function nextSlideId(currentSlideId: string): string {
  const index = slides.findIndex(slide => slide.id === currentSlideId);
  return slides[Math.min(index + 1, slides.length - 1)]!.id;
}

export function previousSlideId(currentSlideId: string): string {
  const index = slides.findIndex(slide => slide.id === currentSlideId);
  return slides[Math.max(index - 1, 0)]!.id;
}
